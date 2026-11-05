import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createDownloadQueue,
  type DownloadTransport,
  type DownloadTransportResponse
} from '@main/download/queue';
import type { DownloadsStore } from '@main/storage/downloads';
import type { DownloadProgressEvent, DownloadStatus, DownloadTask } from '@shared/downloads';
import { AppErrorException } from '@shared/errors';
import type { Post } from '@shared/models';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 默认 md5 为空 → 不参与校验与 md5 去重，避免测试数据与假传输内容绑死；
 * 校验/去重用例显式传入 md5（DR-037）。
 */
function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    site: 'yande',
    id,
    md5: '',
    previewUrl: `https://assets.yande.re/data/preview/${id}.jpg`,
    sampleUrl: `https://files.yande.re/sample/${id}.jpg`,
    fileUrl: `https://files.yande.re/image/${id}.jpg`,
    width: 1000,
    height: 1400,
    fileSize: 64,
    rating: 'safe',
    score: 10,
    tags: [],
    createdAt: 1793668940000,
    ...overrides
  };
}

function md5Of(bytes: Uint8Array): string {
  return createHash('md5').update(bytes).digest('hex');
}

/** 队列测试不依赖 sqlite：用内存实现验证调度与状态机（TC-30） */
function createMemoryStore(): DownloadsStore {
  const rows = new Map<string, DownloadTask>();
  return {
    create(input) {
      const task: DownloadTask = {
        id: input.id,
        site: input.site,
        postId: input.postId,
        url: input.url,
        md5: input.md5,
        destPath: input.destPath,
        status: 'queued',
        bytesDone: 0,
        bytesTotal: input.bytesTotal,
        retries: 0,
        error: null,
        createdAt: input.now,
        updatedAt: input.now
      };
      rows.set(task.id, task);
      return task;
    },
    get(id) {
      return rows.get(id) ?? null;
    },
    list() {
      return [...rows.values()].sort(
        (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)
      );
    },
    updateProgress(id, bytesDone, bytesTotal, now) {
      const row = rows.get(id);
      if (row === undefined) return;
      rows.set(id, { ...row, bytesDone, bytesTotal, updatedAt: now });
    },
    setStatus(id, status, error, bytes, now) {
      const row = rows.get(id);
      if (row === undefined) return;
      rows.set(id, {
        ...row,
        status,
        error,
        bytesDone: bytes?.done ?? row.bytesDone,
        bytesTotal: bytes?.total ?? row.bytesTotal,
        updatedAt: now
      });
    },
    delete(id) {
      rows.delete(id);
    },
    relocate(id, input, now) {
      const row = rows.get(id);
      if (row === undefined) return;
      rows.set(id, {
        ...row,
        url: input.url,
        md5: input.md5,
        destPath: input.destPath,
        bytesTotal: input.bytesTotal,
        status: 'queued',
        bytesDone: 0,
        error: null,
        updatedAt: now
      });
    },
    resetInterrupted(now) {
      let count = 0;
      for (const [id, row] of rows) {
        if (row.status !== 'downloading' && row.status !== 'verifying') continue;
        rows.set(id, { ...row, status: 'queued', bytesDone: 0, error: null, updatedAt: now });
        count += 1;
      }
      return count;
    },
    findCompletedMd5(site, md5) {
      for (const row of rows.values()) {
        if (row.site === site && row.md5 === md5 && row.status === 'done') return true;
      }
      return false;
    }
  };
}

interface SlowTransportOptions {
  chunks?: number;
  chunkSize?: number;
  delayMs?: number;
  failStatus?: number;
}

/** 可控的假传输：按块输出，便于观测并发与中止行为 */
function createSlowTransport(options: SlowTransportOptions = {}): {
  transport: DownloadTransport;
  stats: { active: number; maxActive: number };
} {
  const chunks = options.chunks ?? 4;
  const chunkSize = options.chunkSize ?? 8;
  const delayMs = options.delayMs ?? 5;
  const stats = { active: 0, maxActive: 0 };

  const transport: DownloadTransport = async (_url, { signal }) => {
    stats.active += 1;
    stats.maxActive = Math.max(stats.maxActive, stats.active);

    if (options.failStatus !== undefined) {
      stats.active -= 1;
      return {
        ok: false,
        status: options.failStatus,
        headers: { get: () => null },
        body: null,
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    }

    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      stats.active -= 1;
    };

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const onAbort = (): void => {
          release();
          try {
            controller.close();
          } catch {
            // 已关闭时忽略
          }
        };
        signal.addEventListener('abort', onAbort);
        for (let index = 0; index < chunks; index += 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (signal.aborted) break;
          try {
            controller.enqueue(new Uint8Array(chunkSize));
          } catch {
            break;
          }
        }
        release();
        try {
          controller.close();
        } catch {
          // 已关闭时忽略
        }
      }
    });

    const response: DownloadTransportResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (name) => (name.toLowerCase() === 'content-length' ? String(chunks * chunkSize) : null)
      },
      body,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
    return response;
  };

  return { transport, stats };
}

interface RangeTransportOptions {
  totalBytes: number;
  chunkSize?: number;
  delayMs?: number;
  /** 模拟服务器忽略 Range：始终返回 200 与全量内容 */
  ignoreRange?: boolean;
  /** 模拟 416：带 Range 时说明本地文件已完整 */
  notSatisfiable?: boolean;
}

/**
 * 支持 Range 的假传输：206 只返回剩余字节，便于验证追加写与总进度（TC-25 / TC-26）。
 * 内容按字节序号生成，便于断言最终文件没有重复写入。
 */
function createRangeTransport(options: RangeTransportOptions): {
  transport: DownloadTransport;
  requests: (string | null)[];
  payload: Uint8Array;
} {
  const total = options.totalBytes;
  const chunkSize = options.chunkSize ?? 8;
  const delayMs = options.delayMs ?? 5;
  const payload = new Uint8Array(total);
  for (let index = 0; index < total; index += 1) payload[index] = index % 251;
  const requests: (string | null)[] = [];

  const transport: DownloadTransport = async (_url, { signal, headers }) => {
    const range = headers?.['Range'] ?? null;
    requests.push(range);

    if (options.notSatisfiable === true && range !== null) {
      return {
        ok: false,
        status: 416,
        headers: { get: () => null },
        body: null,
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    }

    const requested = range === null ? 0 : Number(range.replace('bytes=', '').replace('-', ''));
    const start = options.ignoreRange === true || !Number.isFinite(requested) ? 0 : requested;
    const status = start > 0 ? 206 : 200;
    const length = total - start;

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let offset = start; offset < total; offset += chunkSize) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (signal.aborted) break;
          try {
            controller.enqueue(payload.slice(offset, Math.min(total, offset + chunkSize)));
          } catch {
            break;
          }
        }
        try {
          controller.close();
        } catch {
          // 已关闭时忽略
        }
      }
    });

    return {
      ok: true,
      status,
      headers: {
        get: (name) =>
          name.toLowerCase() === 'content-length' && length > 0 ? String(length) : null
      },
      body,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  return { transport, requests, payload };
}

async function waitFor(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('等待超时');
}

function statusOf(store: DownloadsStore, id: string): DownloadStatus | undefined {
  return store.get(id)?.status;
}

describe('下载队列（TC-30）', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-queue-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('并发不超过设定值，完成后全部落盘', async () => {
    const store = createMemoryStore();
    const { transport, stats } = createSlowTransport({ chunks: 6, delayMs: 5 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 2
    });

    queue.enqueue({ site: 'yande', posts: [1, 2, 3, 4, 5].map((id) => makePost(id)) });

    await waitFor(() => store.list().every((task) => task.status === 'done'));

    expect(stats.maxActive).toBe(2);
    for (const task of store.list()) {
      expect(existsSync(task.destPath)).toBe(true);
      expect(existsSync(`${task.destPath}.part`)).toBe(false);
    }
  });

  it('下载目录不可用时抛出可读的 DOWNLOAD 错误（DR-058）', () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 1, delayMs: 1 });
    // 用文件占位模拟"目录不可用"，在 Windows / Linux 下都会让 mkdir 失败
    const blocked = join(directory, 'blocked');
    writeFileSync(blocked, 'not a directory');
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: blocked,
      concurrency: 1
    });

    let caught: unknown;
    try {
      queue.enqueue({ site: 'yande', posts: [makePost(40)] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppErrorException);
    if (!(caught instanceof AppErrorException)) return;
    expect(caught.appError.code).toBe('DOWNLOAD');
    expect(caught.appError.message).toBe('下载目录不可用，请在设置中选择其他目录');
    expect(store.list()).toHaveLength(0);
  });

  /** DR-063：先等一会儿再回响应，便于在打开 `.part` 之前删除目标目录 */
  function createDelayedTransport(delayMs: number): DownloadTransport {
    const inner = createSlowTransport({ chunks: 2, delayMs: 1 }).transport;
    return async (url, init) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return inner(url, init);
    };
  }

  it('写盘时下载目录被删除会弹框重选并迁移任务（DR-063）', async () => {
    const store = createMemoryStore();
    const replacement = join(directory, 'rescued');
    const requestDestination = vi.fn(async () => replacement);
    const queue = createDownloadQueue({
      store,
      transport: createDelayedTransport(80),
      destinationDir: directory,
      concurrency: 1,
      requestDestination
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(41)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    // 入队时已建好下载目录；在打开 `.part` 之前删掉它，模拟用户清理下载文件夹
    await new Promise((resolve) => setTimeout(resolve, 30));
    rmSync(directory, { recursive: true, force: true });

    await waitFor(() => store.list().every((task) => task.status === 'done'));

    expect(requestDestination).toHaveBeenCalledTimes(1);
    const task = store.get(taskId);
    expect(task?.destPath.startsWith(replacement)).toBe(true);
    expect(existsSync(task?.destPath ?? '')).toBe(true);
  });

  it('目录不可用且用户取消选择时落失败并给出可读原因（DR-063）', async () => {
    const store = createMemoryStore();
    const queue = createDownloadQueue({
      store,
      transport: createDelayedTransport(80),
      destinationDir: directory,
      concurrency: 1,
      requestDestination: async () => null
    });
    queue.enqueue({ site: 'yande', posts: [makePost(42)] });

    await new Promise((resolve) => setTimeout(resolve, 30));
    rmSync(directory, { recursive: true, force: true });

    await waitFor(() => store.list().every((task) => task.status === 'failed'));

    expect(store.list()[0]).toMatchObject({
      status: 'failed',
      error: '下载目录不可用，请重新选择目录',
      bytesDone: 0
    });
  });

  it('updateConfig 热更新目录/模板/并发，仅影响后续入队（DR-040）', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 1, delayMs: 1 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      template: '{id}.{ext}',
      concurrency: 1
    });

    queue.updateConfig({
      destinationDir: join(directory, 'custom'),
      template: 'named-{id}.{ext}',
      format: 'original',
      concurrency: 2
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(30)] }).taskIds[0];

    expect(taskId).toBeTruthy();
    if (taskId === undefined) return;
    await waitFor(() => store.list().every((task) => task.status === 'done'));
    expect(store.get(taskId)?.destPath).toBe(join(directory, 'custom', 'named-30.jpg'));
  });

  it('暂停保留 .part，恢复后继续完成', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 20, delayMs: 10 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(7)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => (store.get(taskId)?.bytesDone ?? 0) > 0);
    expect(queue.control({ taskId, action: 'pause' }).status).toBe('paused');

    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(statusOf(store, taskId)).toBe('paused');
    expect(existsSync(`${task.destPath}.part`)).toBe(true);
    expect(existsSync(task.destPath)).toBe(false);

    expect(queue.control({ taskId, action: 'resume' }).status).toBe('queued');
    await waitFor(() => statusOf(store, taskId) === 'done');
    expect(existsSync(task.destPath)).toBe(true);
    expect(existsSync(`${task.destPath}.part`)).toBe(false);
  });

  it('取消删除任务行与 .part 文件', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 20, delayMs: 10 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(8)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => (store.get(taskId)?.bytesDone ?? 0) > 0);
    queue.control({ taskId, action: 'pause' });
    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    await waitFor(() => existsSync(`${task.destPath}.part`));

    expect(queue.control({ taskId, action: 'cancel' }).status).toBeNull();
    expect(store.get(taskId)).toBeNull();
    expect(existsSync(`${task.destPath}.part`)).toBe(false);
    expect(existsSync(task.destPath)).toBe(false);
  });

  it('HTTP 失败进入 failed，错误信息不丢失', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ failStatus: 404 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 2
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(9)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => statusOf(store, taskId) === 'failed');
    expect(store.get(taskId)?.error).toContain('404');
    expect(store.get(taskId)?.status).toBe('failed');
  });

  it('非法状态流转抛出 CONFIG 级错误', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 2, delayMs: 5 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(10)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => statusOf(store, taskId) === 'done');
    expect(() => queue.control({ taskId, action: 'pause' })).toThrow(AppErrorException);
    expect(() => queue.control({ taskId, action: 'retry' })).toThrow(AppErrorException);
  });

  it('进度事件覆盖 queued/downloading/verifying/done，且按任务节流', async () => {
    const events: DownloadProgressEvent[] = [];
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 8, delayMs: 10 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1,
      onProgress: (event) => events.push(event)
    });

    queue.enqueue({ site: 'yande', posts: [makePost(11)] });
    await waitFor(() => store.list().every((task) => task.status === 'done'));

    const statuses = new Set(events.map((event) => event.status));
    expect(statuses.has('queued')).toBe(true);
    expect(statuses.has('downloading')).toBe(true);
    expect(statuses.has('verifying')).toBe(true);
    expect(statuses.has('done')).toBe(true);
    // 8 块 × 10ms 共约 80ms，远小于 200ms 节流窗口，下载中进度事件只应有一条
    expect(events.filter((event) => event.status === 'downloading')).toHaveLength(1);
  });

  it('重启恢复把中断任务重新排队并完成', async () => {
    const store = createMemoryStore();
    // 入队时已建目录；这里模拟上次进程留下的任务行，目录同样存在
    mkdirSync(join(directory, 'yande'), { recursive: true });
    store.create({
      id: 'interrupted',
      site: 'yande',
      postId: 12,
      url: 'https://files.yande.re/image/12.jpg',
      md5: null,
      destPath: join(directory, 'yande', '12.jpg'),
      bytesTotal: 32,
      now: Date.now()
    });
    store.setStatus('interrupted', 'downloading', null, { done: 8, total: 32 }, Date.now());

    const { transport } = createSlowTransport({ chunks: 4, delayMs: 5 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    expect(queue.recover()).toBe(1);
    await waitFor(() => statusOf(store, 'interrupted') === 'done');
    expect(existsSync(join(directory, 'yande', '12.jpg'))).toBe(true);
  });

  it('暂停后恢复从 .part 已有字节续传（206 追加，不重复下载）', async () => {
    const store = createMemoryStore();
    const { transport, requests, payload } = createRangeTransport({
      totalBytes: 160,
      chunkSize: 16,
      delayMs: 10
    });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(20)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => (store.get(taskId)?.bytesDone ?? 0) >= 32);
    queue.control({ taskId, action: 'pause' });
    await waitFor(() => statusOf(store, taskId) === 'paused');

    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    const partial = readFileSync(`${task.destPath}.part`);
    expect(partial.byteLength).toBeGreaterThan(0);
    expect(partial.byteLength).toBeLessThan(payload.length);

    expect(queue.control({ taskId, action: 'resume' }).status).toBe('queued');
    // 恢复时 bytes_done 先回填为文件大小，界面不闪回 0
    expect(store.get(taskId)?.bytesDone).toBe(partial.byteLength);

    await waitFor(() => statusOf(store, taskId) === 'done');

    expect(requests[1]).toBe(`bytes=${partial.byteLength}-`);
    const written = readFileSync(task.destPath);
    expect(written.byteLength).toBe(payload.byteLength);
    expect(written.equals(Buffer.from(payload))).toBe(true);
    expect(existsSync(`${task.destPath}.part`)).toBe(false);
    expect(store.get(taskId)?.bytesDone).toBe(payload.byteLength);
  });

  it('服务器忽略 Range（200）时清空 .part 从头下载（TC-26）', async () => {
    const store = createMemoryStore();
    const { transport, requests, payload } = createRangeTransport({
      totalBytes: 160,
      chunkSize: 16,
      delayMs: 10,
      ignoreRange: true
    });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({ site: 'yande', posts: [makePost(21)] }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => (store.get(taskId)?.bytesDone ?? 0) >= 32);
    queue.control({ taskId, action: 'pause' });
    await waitFor(() => statusOf(store, taskId) === 'paused');

    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    const partialBytes = readFileSync(`${task.destPath}.part`).byteLength;

    queue.control({ taskId, action: 'resume' });
    await waitFor(() => statusOf(store, taskId) === 'done');

    // 仍会先带 Range 试探，服务器返回 200 后本地清空重下
    expect(requests[1]).toBe(`bytes=${partialBytes}-`);
    const written = readFileSync(task.destPath);
    expect(written.byteLength).toBe(payload.byteLength);
    expect(written.equals(Buffer.from(payload))).toBe(true);
  });

  it('416 视为本地文件已完整并直接落盘', async () => {
    const store = createMemoryStore();
    const content = new Uint8Array(32).map((_value, index) => index % 251);
    mkdirSync(join(directory, 'yande'), { recursive: true });
    const destPath = join(directory, 'yande', '22.jpg');
    writeFileSync(`${destPath}.part`, content);

    store.create({
      id: 'complete-part',
      site: 'yande',
      postId: 22,
      url: 'https://files.yande.re/image/22.jpg',
      md5: null,
      destPath,
      bytesTotal: content.byteLength,
      now: Date.now()
    });
    store.setStatus('complete-part', 'paused', null, {
      done: content.byteLength,
      total: content.byteLength
    }, Date.now());

    const { transport, requests } = createRangeTransport({
      totalBytes: content.byteLength,
      notSatisfiable: true
    });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    queue.control({ taskId: 'complete-part', action: 'resume' });
    await waitFor(() => statusOf(store, 'complete-part') === 'done');

    expect(requests[0]).toBe(`bytes=${content.byteLength}-`);
    expect(readFileSync(destPath).equals(Buffer.from(content))).toBe(true);
    expect(existsSync(`${destPath}.part`)).toBe(false);
  });

  it('重启恢复从 .part 已有大小继续（不重复下载）', async () => {
    const store = createMemoryStore();
    mkdirSync(join(directory, 'yande'), { recursive: true });
    const destPath = join(directory, 'yande', '23.jpg');
    const { transport, requests, payload } = createRangeTransport({
      totalBytes: 32,
      chunkSize: 8,
      delayMs: 5
    });
    writeFileSync(`${destPath}.part`, payload.slice(0, 8));

    store.create({
      id: 'resumed',
      site: 'yande',
      postId: 23,
      url: 'https://files.yande.re/image/23.jpg',
      md5: null,
      destPath,
      bytesTotal: payload.byteLength,
      now: Date.now()
    });
    store.setStatus('resumed', 'downloading', null, { done: 8, total: payload.byteLength }, Date.now());

    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    expect(queue.recover()).toBe(1);
    await waitFor(() => statusOf(store, 'resumed') === 'done');

    expect(requests[0]).toBe('bytes=8-');
    expect(readFileSync(destPath).equals(Buffer.from(payload))).toBe(true);
  });

  it('md5 一致时校验通过并落盘（TC-27）', async () => {
    const store = createMemoryStore();
    const content = new Uint8Array(32);
    const { transport } = createSlowTransport({ chunks: 4, chunkSize: 8 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({
      site: 'yande',
      posts: [makePost(30, { md5: md5Of(content), fileSize: content.byteLength })]
    }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => statusOf(store, taskId) === 'done');
    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    expect(readFileSync(task.destPath).equals(Buffer.from(content))).toBe(true);
    expect(existsSync(`${task.destPath}.part`)).toBe(false);
  });

  it('md5 不一致进入 failed，且最终文件与 .part 都不落盘（TC-27）', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 4, chunkSize: 8 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const taskId = queue.enqueue({
      site: 'yande',
      posts: [makePost(31, { md5: 'deadbeef' })]
    }).taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');

    await waitFor(() => statusOf(store, taskId) === 'failed');
    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    expect(task.error).toContain('md5');
    expect(existsSync(task.destPath)).toBe(false);
    expect(existsSync(`${task.destPath}.part`)).toBe(false);
  });

  it('相同 site+md5 已完成后再次入队被跳过（02 §7.4）', async () => {
    const store = createMemoryStore();
    const content = new Uint8Array(32);
    const { transport } = createSlowTransport({ chunks: 4, chunkSize: 8 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const post = makePost(32, { md5: md5Of(content), fileSize: content.byteLength });

    const first = queue.enqueue({ site: 'yande', posts: [post] });
    expect(first.taskIds).toHaveLength(1);
    await waitFor(() => statusOf(store, first.taskIds[0] ?? '') === 'done');

    const second = queue.enqueue({ site: 'yande', posts: [post] });
    expect(second).toEqual({ taskIds: [], skipped: 1 });
  });

  it('下载目录变更后，已完成任务迁到新目录并重新下载（DR-062）', async () => {
    const store = createMemoryStore();
    const content = new Uint8Array(32);
    const { transport } = createSlowTransport({ chunks: 4, chunkSize: 8 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const post = makePost(33, { md5: md5Of(content), fileSize: content.byteLength });

    const first = queue.enqueue({ site: 'yande', posts: [post] });
    const taskId = first.taskIds[0] ?? '';
    await waitFor(() => statusOf(store, taskId) === 'done');
    const oldPath = store.get(taskId)?.destPath ?? '';
    expect(existsSync(oldPath)).toBe(true);

    queue.updateConfig({
      destinationDir: join(directory, 'new'),
      template: '',
      format: 'original',
      concurrency: 1
    });
    const second = queue.enqueue({ site: 'yande', posts: [post] });

    expect(second).toEqual({ taskIds: [taskId], skipped: 0 });
    await waitFor(() => statusOf(store, taskId) === 'done');
    expect(store.get(taskId)?.destPath).toBe(join(directory, 'new', `${md5Of(content)}.jpg`));
    // 旧目录中的已完成文件保留，仅新目录新增一份
    expect(existsSync(oldPath)).toBe(true);
  });

  it('目标路径存在同尺寸文件时跳过，尺寸不同则追加 (1)（02 §7.4）', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 4, chunkSize: 8 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    writeFileSync(join(directory, '40'), new Uint8Array(64));
    const skipped = queue.enqueue({
      site: 'yande',
      posts: [makePost(40)],
      template: '{id}'
    });
    expect(skipped).toEqual({ taskIds: [], skipped: 1 });

    writeFileSync(join(directory, '41'), new Uint8Array(10));
    const created = queue.enqueue({
      site: 'yande',
      posts: [makePost(41)],
      template: '{id}'
    });
    expect(created.taskIds).toHaveLength(1);
    const conflictedId = created.taskIds[0] ?? '';
    expect(store.get(conflictedId)?.destPath).toBe(join(directory, '41 (1)'));
    // 等任务结束，避免 afterEach 删除目录时后台仍在写盘
    await waitFor(() => statusOf(store, conflictedId) === 'done');
  });

  it('同一图片重复入队复用已有任务，不产生并发副本（DR-042）', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 20, delayMs: 10 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 3
    });
    const post = makePost(50);

    const first = queue.enqueue({ site: 'yande', posts: [post] });
    const repeated = [
      queue.enqueue({ site: 'yande', posts: [post] }),
      queue.enqueue({ site: 'yande', posts: [post] }),
      queue.enqueue({ site: 'yande', posts: [post] })
    ];

    expect(first.taskIds).toHaveLength(1);
    for (const result of repeated) {
      expect(result.taskIds).toEqual(first.taskIds);
      expect(result.skipped).toBe(0);
    }
    expect(store.list()).toHaveLength(1);

    await waitFor(() => store.list().every((task) => task.status === 'done'));
    expect(store.list()).toHaveLength(1);
  });

  it('同一批内的重复条目只入队一次（DR-042）', async () => {
    const store = createMemoryStore();
    const { transport } = createSlowTransport({ chunks: 4, delayMs: 5 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const post = makePost(51);

    const result = queue.enqueue({ site: 'yande', posts: [post, post] });
    expect(result.taskIds).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(store.list()).toHaveLength(1);

    await waitFor(() => store.list().every((task) => task.status === 'done'));
  });

  it('失败任务再次入队复用原任务并重试（DR-042）', async () => {
    const store = createMemoryStore();
    const content = new Uint8Array(64);
    let attempts = 0;
    const transport: DownloadTransport = async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          ok: false,
          status: 500,
          headers: { get: () => null },
          body: null,
          arrayBuffer: async () => new ArrayBuffer(0)
        };
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) =>
            name.toLowerCase() === 'content-length' ? String(content.byteLength) : null
        },
        body: null,
        arrayBuffer: async () => content.slice().buffer as ArrayBuffer
      };
    };
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    const first = queue.enqueue({ site: 'yande', posts: [makePost(52)] });
    const taskId = first.taskIds[0];
    if (taskId === undefined) throw new Error('入队未返回任务 id');
    await waitFor(() => statusOf(store, taskId) === 'failed');

    const retried = queue.enqueue({ site: 'yande', posts: [makePost(52)] });
    expect(retried.taskIds).toEqual([taskId]);
    expect(retried.skipped).toBe(0);
    expect(store.list()).toHaveLength(1);

    await waitFor(() => statusOf(store, taskId) === 'done');
    const task = store.get(taskId);
    if (task === null) throw new Error('任务丢失');
    expect(existsSync(task.destPath)).toBe(true);
  });

  it('取消任务不会删除被其它任务共享的已完成文件（DR-042）', () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'shared.jpg');
    writeFileSync(destPath, new Uint8Array(64));
    writeFileSync(`${destPath}.part`, new Uint8Array(8));

    store.create({
      id: 'finished',
      site: 'yande',
      postId: 53,
      url: 'https://files.yande.re/image/53.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 1
    });
    store.setStatus('finished', 'done', null, { done: 64, total: 64 }, 2);
    store.create({
      id: 'duplicate',
      site: 'yande',
      postId: 53,
      url: 'https://files.yande.re/image/53.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 3
    });

    const { transport } = createSlowTransport({ chunks: 2, delayMs: 5 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    queue.control({ taskId: 'duplicate', action: 'cancel' });
    expect(store.get('duplicate')).toBeNull();
    expect(existsSync(destPath)).toBe(true);
  });

  it('启动折叠四条重复任务行，只保留最可信的一条并继续下载（DR-042）', async () => {
    const store = createMemoryStore();
    const { transport, requests, payload } = createRangeTransport({
      totalBytes: 32,
      chunkSize: 8,
      delayMs: 5
    });
    const base = join(directory, 'yande');
    mkdirSync(base, { recursive: true });
    const keptPath = join(base, '60.jpg');
    writeFileSync(`${keptPath}.part`, payload.slice(0, 8));

    for (let index = 0; index < 4; index += 1) {
      const destPath = index === 0 ? keptPath : join(base, `60 (${index}).jpg`);
      store.create({
        id: `dup-${index}`,
        site: 'yande',
        postId: 60,
        url: 'https://files.yande.re/image/60.jpg',
        md5: null,
        destPath,
        bytesTotal: payload.byteLength,
        now: 1000 + index
      });
      store.setStatus(
        `dup-${index}`,
        index === 0 ? 'downloading' : 'queued',
        null,
        { done: index === 0 ? 8 : 0, total: payload.byteLength },
        1000 + index
      );
    }

    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    expect(queue.recover()).toBe(1);
    expect(store.list()).toHaveLength(1);
    await waitFor(() => statusOf(store, 'dup-0') === 'done');

    expect(store.list()).toHaveLength(1);
    expect(requests[0]).toBe('bytes=8-');
    expect(readFileSync(keptPath).equals(Buffer.from(payload))).toBe(true);
  });

  it('启动时即使没有中断任务，也会调度遗留的 queued 任务（DR-042）', async () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'leftover.jpg');
    store.create({
      id: 'leftover',
      site: 'yande',
      postId: 61,
      url: 'https://files.yande.re/image/61.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: Date.now()
    });

    const { transport } = createSlowTransport({ chunks: 4, chunkSize: 16, delayMs: 5 });
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });

    expect(queue.recover()).toBe(0);
    await waitFor(() => statusOf(store, 'leftover') === 'done');
    expect(existsSync(destPath)).toBe(true);
  });

  it('删除任务：最终文件不存在时直接删记录并清理 .part（DR-044）', () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'missing.jpg');
    writeFileSync(`${destPath}.part`, new Uint8Array(8));
    store.create({
      id: 'no-file',
      site: 'yande',
      postId: 62,
      url: 'https://files.yande.re/image/62.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 1
    });

    const queue = createDownloadQueue({
      store,
      transport: createSlowTransport({ chunks: 2, delayMs: 5 }).transport,
      destinationDir: directory,
      concurrency: 1
    });

    const result = queue.remove({ taskId: 'no-file' });
    expect(result).toEqual({
      taskId: 'no-file',
      fileExisted: false,
      removed: true,
      deletedFile: false
    });
    expect(store.get('no-file')).toBeNull();
    expect(existsSync(`${destPath}.part`)).toBe(false);
  });

  it('删除任务：文件存在且未指定 deleteFile 时只回报，不改动数据（DR-044）', () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'exists.jpg');
    writeFileSync(destPath, new Uint8Array(64));
    store.create({
      id: 'has-file',
      site: 'yande',
      postId: 63,
      url: 'https://files.yande.re/image/63.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 1
    });

    const queue = createDownloadQueue({
      store,
      transport: createSlowTransport({ chunks: 2, delayMs: 5 }).transport,
      destinationDir: directory,
      concurrency: 1
    });

    expect(queue.remove({ taskId: 'has-file' })).toEqual({
      taskId: 'has-file',
      fileExisted: true,
      removed: false,
      deletedFile: false
    });
    expect(store.get('has-file')).not.toBeNull();
    expect(existsSync(destPath)).toBe(true);
  });

  it('删除任务：deleteFile=true 同时删除文件与记录（DR-044）', () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'both.jpg');
    writeFileSync(destPath, new Uint8Array(64));
    writeFileSync(`${destPath}.part`, new Uint8Array(8));
    store.create({
      id: 'both',
      site: 'yande',
      postId: 64,
      url: 'https://files.yande.re/image/64.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 1
    });

    const queue = createDownloadQueue({
      store,
      transport: createSlowTransport({ chunks: 2, delayMs: 5 }).transport,
      destinationDir: directory,
      concurrency: 1
    });

    const result = queue.remove({ taskId: 'both', deleteFile: true });
    expect(result.removed).toBe(true);
    expect(result.deletedFile).toBe(true);
    expect(store.get('both')).toBeNull();
    expect(existsSync(destPath)).toBe(false);
    expect(existsSync(`${destPath}.part`)).toBe(false);
  });

  it('删除任务：deleteFile=false 只删记录，保留最终文件（DR-044）', () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'record-only.jpg');
    writeFileSync(destPath, new Uint8Array(64));
    writeFileSync(`${destPath}.part`, new Uint8Array(8));
    store.create({
      id: 'record-only',
      site: 'yande',
      postId: 65,
      url: 'https://files.yande.re/image/65.jpg',
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 1
    });

    const queue = createDownloadQueue({
      store,
      transport: createSlowTransport({ chunks: 2, delayMs: 5 }).transport,
      destinationDir: directory,
      concurrency: 1
    });

    const result = queue.remove({ taskId: 'record-only', deleteFile: false });
    expect(result.removed).toBe(true);
    expect(result.deletedFile).toBe(false);
    expect(store.get('record-only')).toBeNull();
    expect(existsSync(destPath)).toBe(true);
  });

  it('force 重新下载已完成图片：复用原任务并重置进度（DR-050）', async () => {
    const store = createMemoryStore();
    const destPath = join(directory, 'redo.jpg');
    writeFileSync(destPath, new Uint8Array(64));
    const post = makePost(70);
    store.create({
      id: 'redo',
      site: 'yande',
      postId: 70,
      url: post.fileUrl,
      md5: null,
      destPath,
      bytesTotal: 64,
      now: 1
    });
    store.setStatus('redo', 'done', null, { done: 64, total: 64 }, 2);

    const queue = createDownloadQueue({
      store,
      transport: createSlowTransport({ chunks: 2, delayMs: 5 }).transport,
      destinationDir: directory,
      concurrency: 1
    });

    const result = queue.enqueue({ site: 'yande', posts: [post], force: true });
    expect(result.skipped).toBe(0);
    expect(result.taskIds).toEqual(['redo']);
    await waitFor(() => statusOf(store, 'redo') === 'done');
    expect(existsSync(destPath)).toBe(true);
  });

  it('jpeg 变体使用压缩版地址与大小，且与原图任务分开（DR-051）', async () => {
    const store = createMemoryStore();
    const content = new Uint8Array(16);
    const requested: string[] = [];
    const transport: DownloadTransport = async (url) => {
      requested.push(url);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) =>
            name.toLowerCase() === 'content-length' ? String(content.byteLength) : null
        },
        body: null,
        arrayBuffer: async () => content.slice().buffer as ArrayBuffer
      };
    };
    const queue = createDownloadQueue({
      store,
      transport,
      destinationDir: directory,
      concurrency: 1
    });
    const post = makePost(80, {
      md5: md5Of(content),
      fileSize: 128,
      fileUrl: 'https://files.yande.re/image/80.png',
      jpegUrl: 'https://files.yande.re/image/80.jpg',
      jpegFileSize: content.byteLength
    });

    const jpegId = queue.enqueue({ site: 'yande', posts: [post], variant: 'jpeg' }).taskIds[0];
    if (jpegId === undefined) throw new Error('入队未返回任务 id');
    await waitFor(() => statusOf(store, jpegId) === 'done');
    const jpegTask = store.get(jpegId);
    if (jpegTask === null) throw new Error('任务丢失');
    expect(jpegTask.url).toBe(post.jpegUrl);
    expect(jpegTask.bytesTotal).toBe(content.byteLength);
    // 站点 md5 对应原图，独立 JPEG 压缩版不参与校验
    expect(jpegTask.md5).toBeNull();
    expect(jpegTask.destPath.endsWith('.jpg')).toBe(true);

    const original = queue.enqueue({ site: 'yande', posts: [post], variant: 'original' });
    expect(original.skipped).toBe(0);
    const originalId = original.taskIds[0];
    if (originalId === undefined) throw new Error('入队未返回任务 id');
    expect(originalId).not.toBe(jpegId);
    await waitFor(() => statusOf(store, originalId) === 'done');
    const originalTask = store.get(originalId);
    if (originalTask === null) throw new Error('任务丢失');
    expect(originalTask.url).toBe(post.fileUrl);
    expect(originalTask.destPath.endsWith('.png')).toBe(true);

    expect(store.list()).toHaveLength(2);
    expect(requested[0]).toBe(post.jpegUrl);
  });

  it('清空任务列表：删记录与 .part，保留已下载文件（DR-044）', () => {
    const store = createMemoryStore();
    const finishedPath = join(directory, 'finished.jpg');
    const pendingPath = join(directory, 'pending.jpg');
    writeFileSync(finishedPath, new Uint8Array(64));
    writeFileSync(`${pendingPath}.part`, new Uint8Array(8));

    store.create({
      id: 'finished',
      site: 'yande',
      postId: 66,
      url: 'https://files.yande.re/image/66.jpg',
      md5: null,
      destPath: finishedPath,
      bytesTotal: 64,
      now: 1
    });
    store.setStatus('finished', 'done', null, { done: 64, total: 64 }, 2);
    store.create({
      id: 'pending',
      site: 'yande',
      postId: 67,
      url: 'https://files.yande.re/image/67.jpg',
      md5: null,
      destPath: pendingPath,
      bytesTotal: 64,
      now: 3
    });

    const queue = createDownloadQueue({
      store,
      transport: createSlowTransport({ chunks: 2, delayMs: 5 }).transport,
      destinationDir: directory,
      concurrency: 1
    });

    expect(queue.clear()).toEqual({ removed: 2 });
    expect(store.list()).toHaveLength(0);
    expect(existsSync(finishedPath)).toBe(true);
    expect(existsSync(`${pendingPath}.part`)).toBe(false);
  });
});
