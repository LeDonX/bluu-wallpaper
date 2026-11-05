import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { appendFile, open, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';

import type { DownloadsStore } from '@main/storage/downloads';
import type { SiteId } from '@shared/constants';
import {
  canApplyAction,
  type DownloadAction,
  type DownloadClearResult,
  type DownloadControlInput,
  type DownloadControlResult,
  type DownloadEnqueueInput,
  type DownloadEnqueueResult,
  type DownloadProgressEvent,
  type DownloadRemoveInput,
  type DownloadRemoveResult,
  downloadSource,
  type DownloadStatus,
  type DownloadTask,
  type DownloadVariant,
  MAX_DOWNLOAD_CONCURRENCY,
  MIN_DOWNLOAD_CONCURRENCY,
  renderDownloadPath
} from '@shared/downloads';
import { AppErrorException, createAppError } from '@shared/errors';

/** 03 §8：流式写盘时按 200ms 节流上报进度 */
export const DOWNLOAD_PROGRESS_INTERVAL_MS = 200;

/** 02 §7.4：同名冲突最多尝试的 `(n)` 后缀 */
const MAX_NAME_CONFLICT_SUFFIX = 99;

/** DR-063：这些文件系统错误判定为"下载目录不可用"，可弹框重选目录后重试 */
const DESTINATION_FAILURE_CODES = new Set(['ENOENT', 'EPERM', 'EACCES', 'EROFS', 'ENOTDIR', 'ENOSPC']);

export interface DownloadTransportResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** DR-035：断点续传需要通过 `Range` 请求头告知服务器续传起点 */
export interface DownloadTransportInit {
  signal: AbortSignal;
  headers?: Record<string, string>;
}

export type DownloadTransport = (
  url: string,
  init: DownloadTransportInit
) => Promise<DownloadTransportResponse>;

export interface DownloadQueueOptions {
  store: DownloadsStore;
  transport: DownloadTransport;
  /** 03 §8：下载根目录，设置页可改；默认 `userData/downloads` */
  destinationDir: string;
  /** 02 §7.3：默认命名模板，入参未携带模板时使用（DR-040） */
  template?: string;
  /** DR-051：批量入队的默认下载格式 */
  format?: DownloadVariant;
  concurrency?: number;
  now?(): number;
  createId?(): string;
  onProgress?(event: DownloadProgressEvent): void;
  /**
   * DR-063：写盘失败且判定为下载目录不可用时，由主进程弹目录选择框并写回配置；
   * 返回新目录，取消/不可用时返回 null。
   */
  requestDestination?(): Promise<string | null>;
}

/** 07 DR-040：设置页保存后立即更新，仅影响后续入队任务 */
export interface DownloadQueueConfig {
  destinationDir: string;
  template: string;
  /** DR-051：批量入队的默认下载格式 */
  format: DownloadVariant;
  concurrency: number;
}

export interface DownloadQueue {
  /**
   * 入队即写 `download_tasks`，返回按入参顺序的 task id 与被跳过数量。
   * DR-042：同一图片已有未结束任务时复用原 id，不新建重复任务。
   */
  enqueue(input: DownloadEnqueueInput): DownloadEnqueueResult;
  /** 非法状态流转抛 AppErrorException，由 handler 转成 Result 信封 */
  control(input: DownloadControlInput): DownloadControlResult;
  /** DR-044：删除任务；`deleteFile` 不传时只检查文件是否存在，存在则不删任何数据 */
  remove(input: DownloadRemoveInput): DownloadRemoveResult;
  /** DR-044：清空任务记录；保留最终文件，清理未完成的 `.part` */
  clear(): DownloadClearResult;
  list(): DownloadTask[];
  /** 进程重启后把中断任务恢复为队列态并立即调度 */
  recover(): number;
  /** 设置页保存后调用；已在运行/排队中的任务保持原目录与文件名 */
  updateConfig(config: DownloadQueueConfig): void;
}

interface ActiveTask {
  controller: AbortController;
  pauseRequested: boolean;
  cancelled: boolean;
}

function errorMessage(status: number): string {
  if (status === 404) return '图片不存在（404）';
  if (status === 429) return '请求过于频繁，请稍后重试（429）';
  return `下载失败（HTTP ${status}）`;
}

function parseContentLength(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

/**
 * 02 §7.2 / 03 §8：下载队列。每站点独立并发，默认 3、上限 6（TC-30）。
 * T-23 只做队列与状态流转：断点续传归 T-24、md5 与模板命名归 T-25（DR-034）。
 */
export function createDownloadQueue(options: DownloadQueueOptions): DownloadQueue {
  const { store, transport } = options;
  /** DR-040：目录、模板与并发可被设置页热更新，调度循环始终读取最新值 */
  let destinationDir = options.destinationDir;
  let template = options.template ?? '';
  let defaultVariant: DownloadVariant = options.format ?? 'original';
  let concurrency = clampConcurrency(options.concurrency ?? 3);
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? (() => randomId());
  const active = new Map<string, ActiveTask>();
  /** 每个任务最近一次进度上报时间，避免逐块写入刷爆 IPC */
  const lastReportAt = new Map<string, number>();

  const emit = (
    base: Pick<DownloadTask, 'id' | 'site' | 'postId'>,
    status: DownloadStatus,
    bytesDone: number,
    bytesTotal: number,
    error: string | null,
    force = false
  ): void => {
    if (options.onProgress === undefined) return;
    const at = now();
    const previous = lastReportAt.get(base.id);
    if (!force && previous !== undefined && at - previous < DOWNLOAD_PROGRESS_INTERVAL_MS) return;
    lastReportAt.set(base.id, at);
    options.onProgress({
      taskId: base.id,
      site: base.site,
      postId: base.postId,
      status,
      bytesDone,
      bytesTotal,
      error
    });
  };

  const setStatus = (
    taskId: string,
    status: DownloadStatus,
    error: string | null,
    bytes: { done: number; total: number } | null
  ): void => {
    store.setStatus(taskId, status, error, bytes, now());
    const task = store.get(taskId);
    if (task === null) return;
    emit(task, task.status, task.bytesDone, task.bytesTotal, task.error, true);
  };

  const control = (input: DownloadControlInput): DownloadControlResult => {
    const task = store.get(input.taskId);
    if (task === null) {
      throw new AppErrorException(
        createAppError('DOWNLOAD', '下载任务不存在', { detail: input.taskId, retryable: false })
      );
    }
    if (!canApplyAction(task.status, input.action)) {
      throw new AppErrorException(
        createAppError('CONFIG', '当前任务状态不支持该操作', {
          detail: `${task.status} 不能执行 ${input.action}`,
          retryable: false
        })
      );
    }

    switch (input.action) {
      case 'pause': {
        // 已在下载的先中止流再落 paused；未开始的直接改状态（DR-034：暂停保留 .part）
        const running = active.get(task.id);
        if (running !== undefined) {
          running.pauseRequested = true;
          running.controller.abort();
        }
        setStatus(task.id, 'paused', null, { done: task.bytesDone, total: task.bytesTotal });
        return { taskId: task.id, status: 'paused' };
      }
      case 'resume':
      case 'retry': {
        // DR-035 / 03 §8：从 `.part` 已有大小续传；先把 bytes_done 回填，避免界面闪回 0
        const resumed = existingPartSize(task.destPath);
        setStatus(task.id, 'queued', null, { done: resumed, total: task.bytesTotal });
        void tick();
        return { taskId: task.id, status: 'queued' };
      }
      case 'cancel': {
        const running = active.get(task.id);
        if (running !== undefined) {
          running.cancelled = true;
          running.controller.abort();
        }
        store.delete(task.id);
        lastReportAt.delete(task.id);
        // DR-042：历史重复任务可能共享同一目标路径，仍被其它任务引用时不能删文件
        if (!store.list().some((item) => item.destPath === task.destPath)) {
          removeTaskFiles(task.destPath);
        }
        void tick();
        return { taskId: task.id, status: null };
      }
      default:
        return never(input.action, task.id);
    }
  };

  const remove = (input: DownloadRemoveInput): DownloadRemoveResult => {
    const task = store.get(input.taskId);
    if (task === null) {
      throw new AppErrorException(
        createAppError('DOWNLOAD', '下载任务不存在', { detail: input.taskId, retryable: false })
      );
    }
    const fileExisted = existsSync(task.destPath);
    // DR-044：文件存在且调用方还没做选择时只回报，不删除任何数据
    if (fileExisted && input.deleteFile === undefined) {
      return { taskId: task.id, fileExisted, removed: false, deletedFile: false };
    }

    const running = active.get(task.id);
    if (running !== undefined) {
      running.cancelled = true;
      running.controller.abort();
    }
    store.delete(task.id);
    lastReportAt.delete(task.id);
    // DR-042：其它任务仍引用同一目标路径时不动磁盘文件
    const shared = store.list().some((item) => item.destPath === task.destPath);
    let deletedFile = false;
    if (!shared) {
      if (input.deleteFile === true) {
        removeTaskFiles(task.destPath);
        deletedFile = fileExisted;
      } else {
        // 仅删记录或最终文件本就不存在：只清理未被引用的 `.part`
        rmSync(`${task.destPath}.part`, { force: true });
      }
    }
    void tick();
    return { taskId: task.id, fileExisted, removed: true, deletedFile };
  };

  const clear = (): DownloadClearResult => {
    const tasks = store.list();
    for (const task of tasks) {
      const running = active.get(task.id);
      if (running !== undefined) {
        running.cancelled = true;
        running.controller.abort();
      }
      store.delete(task.id);
      lastReportAt.delete(task.id);
      // 清空只删记录与未完成分片，已下载的最终文件保留
      rmSync(`${task.destPath}.part`, { force: true });
    }
    void tick();
    return { removed: tasks.length };
  };

  /**
   * 暂停落状态前先确认本协程仍是该任务的活动协程，且控制层仍标记为 paused：
   * 用户在"暂停后立刻恢复"时，旧协程不得把 queued 覆盖回 paused，否则新协程不会被调度（DR-035）。
   */
  const setPaused = (
    task: DownloadTask,
    state: ActiveTask,
    bytes: { done: number; total: number }
  ): void => {
    if (active.get(task.id) !== state) return;
    if (store.get(task.id)?.status !== 'paused') return;
    setStatus(task.id, 'paused', null, bytes);
  };

  /**
   * 02 §7.2 / 03 §8 / TC-27：先校验再改名落盘。
   * md5 不一致时删除 `.part` 与最终文件，抛出 DOWNLOAD 失败，文件不落盘（DR-037）。
   * 迁移 005 之前的历史任务 md5 为 null，跳过校验。
   */
  const finalize = async (
    task: DownloadTask,
    partPath: string,
    bytes: { done: number; total: number }
  ): Promise<void> => {
    setStatus(task.id, 'verifying', null, bytes);
    const expected = task.md5?.trim() ?? '';
    if (expected !== '') {
      const actual = await fileMd5(partPath);
      if (actual !== expected.toLowerCase()) {
        await rm(partPath, { force: true });
        await rm(task.destPath, { force: true });
        throw new AppErrorException(
          createAppError('DOWNLOAD', '文件校验失败（md5 不一致）', {
            detail: `expected ${expected}, got ${actual}`,
            retryable: true
          })
        );
      }
    }
    await rm(task.destPath, { force: true });
    await rename(partPath, task.destPath);
    setStatus(task.id, 'done', null, bytes);
  };

  /**
   * DR-063：写盘失败且属于目录不可用（被删除、无写权限、系统重建后不可写）时，
   * 请主进程弹目录选择框；选中后把任务迁到新目录重新排队，取消则返回 false。
   * 同一任务每次运行只尝试一次，避免选择框反复弹出。
   */
  const repairDestination = async (task: DownloadTask): Promise<boolean> => {
    if (options.requestDestination === undefined) return false;
    const picked = await options.requestDestination().catch(() => null);
    const target = (picked ?? '').trim();
    if (target === '') return false;

    // 保留原有相对路径（默认模板下只有 `{md5}.jpg`），只更换根目录
    const relativePath = isInsideDirectory(task.destPath, destinationDir)
      ? relative(destinationDir, task.destPath)
      : basename(task.destPath);
    const takenPaths = new Set(store.list().map((item) => item.destPath));
    takenPaths.delete(task.destPath);
    const destPath = resolveDestinationPath(target, relativePath, task.bytesTotal, takenPaths);
    if (destPath === null) return false;

    try {
      mkdirSync(dirname(destPath), { recursive: true });
    } catch {
      return false;
    }
    try {
      rmSync(`${task.destPath}.part`, { force: true });
    } catch {
      // 旧目录可能已不可用，旧分片清理失败不影响迁移
    }
    store.relocate(
      task.id,
      { url: task.url, md5: task.md5, destPath, bytesTotal: task.bytesTotal },
      now()
    );
    const relocated = store.get(task.id);
    if (relocated !== null) emit(relocated, 'queued', 0, relocated.bytesTotal, null, true);
    return true;
  };

  const run = async (
    task: DownloadTask,
    state: ActiveTask,
    resumeFrom: number
  ): Promise<void> => {
    const partPath = `${task.destPath}.part`;
    let bytesDone = resumeFrom;
    let bytesTotal = task.bytesTotal;

    try {
      // DR-063：目录可能在入队后被删除，写盘前重建父目录
      mkdirSync(dirname(partPath), { recursive: true });
      // 03 §8：已有 `.part` 时从文件大小发起 `Range: bytes=N-`
      const headers = resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : undefined;
      const response = await transport(task.url, { signal: state.controller.signal, headers });
      if (state.cancelled) return;

      // 03 §8：416 表示请求区间越界，本地 `.part` 已覆盖完整文件，直接进入校验
      if (response.status === 416 && resumeFrom > 0) {
        if (state.pauseRequested) {
          setPaused(task, state, { done: bytesDone, total: bytesTotal });
          return;
        }
        await finalize(task, partPath, {
          done: bytesDone,
          total: bytesTotal > 0 ? bytesTotal : bytesDone
        });
        return;
      }

      if (!response.ok) {
        throw new AppErrorException(
          createAppError('DOWNLOAD', errorMessage(response.status), {
            detail: `HTTP ${response.status}`,
            retryable: response.status === 429 || response.status >= 500
          })
        );
      }

      const headerTotal = parseContentLength(response.headers.get('content-length'));
      /** 只有服务器确认区间（206）且本地已有字节时才追加写 */
      const append = response.status === 206 && bytesDone > 0;
      if (append) {
        // 206 的 content-length 是剩余字节，总进度要加上已写部分
        if (headerTotal !== null) bytesTotal = bytesDone + headerTotal;
      } else {
        // 200：服务器忽略 Range，清空 `.part` 从头下载（03 §8）
        if (headerTotal !== null) bytesTotal = headerTotal;
        if (resumeFrom > 0) {
          bytesDone = 0;
          store.updateProgress(task.id, 0, bytesTotal, now());
          emit(task, 'downloading', 0, bytesTotal, null, true);
        }
      }

      if (response.body === null) {
        const buffer = await response.arrayBuffer();
        if (state.cancelled) return;
        if (state.pauseRequested) {
          setPaused(task, state, { done: bytesDone, total: bytesTotal });
          return;
        }
        if (append) {
          await appendFile(partPath, new Uint8Array(buffer));
          bytesDone += buffer.byteLength;
        } else {
          await writeFile(partPath, new Uint8Array(buffer));
          bytesDone = buffer.byteLength;
        }
        store.updateProgress(task.id, bytesDone, bytesTotal, now());
      } else {
        const reader = response.body.getReader();
        const abort = (): void => {
          void reader.cancel().catch(() => undefined);
        };
        state.controller.signal.addEventListener('abort', abort);

        const handle = await open(partPath, append ? 'a' : 'w');
        try {
          while (true) {
            if (state.cancelled || state.pauseRequested || state.controller.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;
            if (value === undefined) continue;
            await handle.write(value);
            bytesDone += value.byteLength;
            store.updateProgress(task.id, bytesDone, bytesTotal, now());
            emit(task, 'downloading', bytesDone, bytesTotal, null);
          }
        } finally {
          state.controller.signal.removeEventListener('abort', abort);
          await handle.close();
        }
      }

      if (state.cancelled) {
        await rm(partPath, { force: true });
        return;
      }
      if (state.pauseRequested) {
        // 03 §8：暂停保留 .part，供恢复时断点续传
        setPaused(task, state, { done: bytesDone, total: bytesTotal });
        return;
      }

      await finalize(task, partPath, { done: bytesDone, total: bytesTotal });
    } catch (error) {
      if (state.cancelled) return;
      if (state.pauseRequested) {
        setPaused(task, state, { done: bytesDone, total: bytesTotal });
        return;
      }
      // DR-063：目录不可用时先弹框重选目录并迁移任务，取消才落失败；
      // 网络/HTTP 错误保持原有文案，不弹目录框
      const code = error instanceof AppErrorException ? null : fileSystemErrorCode(error);
      if (code !== null && DESTINATION_FAILURE_CODES.has(code)) {
        if (await repairDestination(task)) return;
        setStatus(
          task.id,
          'failed',
          code === 'ENOSPC' ? '磁盘空间不足，请清理或更换下载目录' : '下载目录不可用，请重新选择目录',
          { done: bytesDone, total: bytesTotal }
        );
        return;
      }
      const failure =
        error instanceof AppErrorException
          ? error.appError
          : createAppError('DOWNLOAD', '下载失败，请重试', {
              detail: error instanceof Error ? error.message : String(error)
            });
      setStatus(task.id, 'failed', failure.message, { done: bytesDone, total: bytesTotal });
    }
  };

  const start = (task: DownloadTask): void => {
    const state: ActiveTask = {
      controller: new AbortController(),
      pauseRequested: false,
      cancelled: false
    };
    active.set(task.id, state);
    // DR-035：恢复时把 bytes_done 回填为 `.part` 已有大小，界面不闪回 0
    const resumeFrom = existingPartSize(task.destPath);
    setStatus(task.id, 'downloading', null, { done: resumeFrom, total: task.bytesTotal });

    void run(task, state, resumeFrom)
      .catch(() => undefined)
      .finally(() => {
        active.delete(task.id);
        lastReportAt.delete(task.id);
        void tick();
      });
  };

  /** 按站点补足并发；本轮已分配的名额先记入 runningBySite，防止同一轮重复启动 */
  const tick = (): void => {
    const tasks = store.list();
    const runningBySite = new Map<SiteId, number>();
    for (const [taskId] of active) {
      const task = tasks.find((item) => item.id === taskId);
      if (task === undefined) continue;
      runningBySite.set(task.site, (runningBySite.get(task.site) ?? 0) + 1);
    }

    for (const task of tasks) {
      if (task.status !== 'queued') continue;
      const running = runningBySite.get(task.site) ?? 0;
      if (running >= concurrency) continue;
      runningBySite.set(task.site, running + 1);
      start(task);
    }
  };

  return {
    enqueue(input) {
      const ids: string[] = [];
      let skipped = 0;
      const base = now();
      const site = input.site;
      /** DR-050：重新下载，跳过已下载判定并覆盖原文件 */
      const force = input.force === true;
      /** DR-051：单次入队显式格式优先，否则使用设置页默认格式 */
      const variant = input.variant ?? defaultVariant;
      /** DR-062：目录变更后，已完成任务的目标路径需要迁到当前目录 */
      const destination = destinationDir;
      const canRelocate = destination.trim() !== '';
      const known = store.list();
      // 模板可能不含 id/md5，同批任务的相对路径可能相同，需同时避让已有任务的目标路径
      const takenPaths = new Set(known.map((task) => task.destPath));
      /** 本次请求已处理的身份，避免同一批里重复条目被当成两张图片 */
      const seenKeys = new Set<string>();
      /** 本次请求已返回的任务 id，避免同一任务被重复计入 */
      const claimed = new Set<string>();
      for (const [index, post] of input.posts.entries()) {
        const md5 = post.md5.trim();
        // DR-051：按格式选择实际文件，JPEG 版本不可用时自动回落到原图
        const source = downloadSource(post, variant);
        const sourcePost =
          source.url === post.fileUrl ? post : { ...post, fileUrl: source.url, fileSize: source.size };
        const key = md5 !== '' ? `${site}:${md5}` : `${site}:post:${post.id}`;
        if (seenKeys.has(key)) {
          skipped += 1;
          continue;
        }
        seenKeys.add(key);
        // DR-051：同一图片的原图与 JPG 压缩版共享 md5，已完成判定必须带上实际下载地址
        if (
          !force &&
          known.some(
            (task) =>
              task.site === site &&
              task.status === 'done' &&
              task.url === source.url &&
              // DR-062：已完成在旧目录的图片不视为"已下载到当前目录"，继续走迁移流程
              (!canRelocate || isInsideDirectory(task.destPath, destination))
          )
        ) {
          skipped += 1;
          continue;
        }
        // DR-042：同一图片已排队/下载中/暂停/失败时复用原任务，不重复创建并发副本
        const existing = findReusableTask(known, claimed, site, post.id, md5, source.url);
        if (existing !== undefined) {
          claimed.add(existing.id);
          // DR-062：已在旧目录完成的图片，迁移到当前目录后重新下载，旧文件保留
          if (
            canRelocate &&
            existing.status === 'done' &&
            !isInsideDirectory(existing.destPath, destination)
          ) {
            const destPath = resolveDestinationPath(
              destination,
              renderDownloadPath(sourcePost, input.template ?? template),
              source.size,
              takenPaths
            );
            if (destPath === null) {
              skipped += 1;
              continue;
            }
            takenPaths.add(destPath);
            try {
              mkdirSync(dirname(destPath), { recursive: true });
            } catch (error) {
              throw new AppErrorException(
                createAppError('DOWNLOAD', '下载目录不可用，请在设置中选择其他目录', {
                  detail: `${dirname(destPath)}：${error instanceof Error ? error.message : String(error)}`,
                  cause: error
                })
              );
            }
            // 旧目录可能已不可用，旧分片清理失败不影响迁移
            try {
              rmSync(`${existing.destPath}.part`, { force: true });
            } catch {
              // ignore
            }
            store.relocate(
              existing.id,
              {
                url: source.url,
                md5: md5 === '' || source.url !== post.fileUrl ? null : md5,
                destPath,
                bytesTotal: source.size
              },
              base + index
            );
            const relocated = store.get(existing.id);
            if (relocated !== null) {
              const indexInKnown = known.findIndex((task) => task.id === relocated.id);
              if (indexInKnown >= 0) known[indexInKnown] = relocated;
              emit(relocated, 'queued', 0, relocated.bytesTotal, null, true);
            }
            ids.push(existing.id);
            continue;
          }
          if (existing.status === 'done') {
            // DR-050：强制重新下载时丢弃旧分片，最终文件在 finalize 时被替换
            if (force) {
              rmSync(`${existing.destPath}.part`, { force: true });
              setStatus(existing.id, 'queued', null, { done: 0, total: existing.bytesTotal });
            } else if (existsSync(existing.destPath)) {
              // done 但最终文件已不在（被外部删除）时重新下载；文件仍在则视为已下载
              skipped += 1;
              continue;
            } else {
              setStatus(existing.id, 'queued', null, {
                done: existingPartSize(existing.destPath),
                total: existing.bytesTotal
              });
            }
          } else if (existing.status === 'failed') {
            // 失败任务再次入队等价于重试：回到队列并沿用 `.part`
            setStatus(existing.id, 'queued', null, {
              done: existingPartSize(existing.destPath),
              total: existing.bytesTotal
            });
          } else {
            // 队列中/下载中/暂停/校验中：直接回传原 id，调用方可订阅既有进度
            emit(
              existing,
              existing.status,
              existing.bytesDone,
              existing.bytesTotal,
              existing.error,
              true
            );
          }
          ids.push(existing.id);
          continue;
        }
        const id = createId();
        const destPath = resolveDestinationPath(
          destinationDir,
          // DR-040：调用方显式传入的模板优先，否则使用设置页保存的默认模板
          // DR-051：用实际下载地址渲染，`{md5}.{ext}` 才能得到 `.jpg`
          renderDownloadPath(sourcePost, input.template ?? template),
          source.size,
          takenPaths
        );
        if (destPath === null) {
          skipped += 1;
          continue;
        }
        takenPaths.add(destPath);
        // DR-058：下载目录不可用时给出可读原因（如外接盘未接入），避免兜底成通用失败
        try {
          mkdirSync(dirname(destPath), { recursive: true });
        } catch (error) {
          throw new AppErrorException(
            createAppError('DOWNLOAD', '下载目录不可用，请在设置中选择其他目录', {
              detail: `${dirname(destPath)}：${error instanceof Error ? error.message : String(error)}`,
              cause: error
            })
          );
        }
        const created = store.create({
          id,
          site,
          postId: post.id,
          url: source.url,
          // DR-051：站点 md5 对应原图；独立 JPEG 压缩版字节不同，不能参与校验
          md5: md5 === '' || source.url !== post.fileUrl ? null : md5,
          destPath,
          bytesTotal: source.size,
          // 同一批入队按数组顺序排队：created_at 加序号，避免同毫秒内乱序
          now: base + index
        });
        known.push(created);
        claimed.add(id);
        ids.push(id);
        emit(created, 'queued', 0, created.bytesTotal, null, true);
      }
      void tick();
      return { taskIds: ids, skipped };
    },
    control,
    remove,
    clear,
    list() {
      return store.list();
    },
    recover() {
      // DR-042：先折叠历史重复任务行，避免重启后多条任务并发写同一图片
      collapseDuplicateTasks(store);
      const restored = store.resetInterrupted(now());
      // 即使没有中断任务，也要调度上次遗留的 queued 任务
      void tick();
      return restored;
    },
    updateConfig(config) {
      destinationDir = config.destinationDir;
      template = config.template;
      defaultVariant = config.format;
      concurrency = clampConcurrency(config.concurrency);
      // 并发调大时立即补位；调小不会中断已在运行的任务，等其结束后自然收敛
      void tick();
    }
  };
}

/** DR-063：读取 Node 文件系统错误码；业务错误（AppErrorException）不在此列 */
function fileSystemErrorCode(error: unknown): string | null {
  const code = (error as NodeJS.ErrnoException | null | undefined)?.code;
  return typeof code === 'string' ? code : null;
}

function clampConcurrency(value: number): number {
  return Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(MIN_DOWNLOAD_CONCURRENCY, value));
}

/** DR-042：同一站点同一地址下按 post id 或 md5 找到尚未结束的任务，用于幂等入队 */
function findReusableTask(
  tasks: readonly DownloadTask[],
  claimed: ReadonlySet<string>,
  site: SiteId,
  postId: number,
  md5: string,
  url: string
): DownloadTask | undefined {
  const normalizedMd5 = md5.toLowerCase();
  return tasks.find(
    (task) =>
      !claimed.has(task.id) &&
      task.site === site &&
      // DR-051：原图与 JPG 压缩版地址不同，不能复用彼此的任务
      task.url === url &&
      (task.postId === postId ||
        (normalizedMd5 !== '' && (task.md5 ?? '').trim().toLowerCase() === normalizedMd5))
  );
}

/** DR-042：同一图片的身份键；md5 缺失时回退到 post id，DR-051 再带上实际下载地址 */
function taskIdentity(task: DownloadTask): string {
  const md5 = (task.md5 ?? '').trim().toLowerCase();
  return md5 !== ''
    ? `${task.site}:${md5}:${task.url}`
    : `${task.site}:post:${task.postId}:${task.url}`;
}

/**
 * 折叠重复任务时保留哪一条：已落盘完成 > 下载中 > 校验中 > 暂停 > 队列中 > 失败；
 * 已 done 但文件缺失的排在失败之前，避免把它当作有效结果。
 */
function retentionScore(task: DownloadTask): number {
  if (task.status === 'done') return existsSync(task.destPath) ? 100 : 15;
  switch (task.status) {
    case 'downloading':
      return 80;
    case 'verifying':
      return 70;
    case 'paused':
      return 60;
    case 'queued':
      return 50;
    case 'failed':
      return 10;
    default:
      return 0;
  }
}

/**
 * DR-042：进程启动时折叠同一图片（site+md5 或 site+postId）或同一目标路径的重复任务行，
 * 只保留最可信的一条。删除多余行不删除已完成的最终文件，仅清理无人引用的 `.part`。
 */
function collapseDuplicateTasks(store: DownloadsStore): number {
  const tasks = store.list();
  if (tasks.length < 2) return 0;

  const ordered = [...tasks].sort((left, right) => {
    const delta = retentionScore(right) - retentionScore(left);
    return delta !== 0 ? delta : left.createdAt - right.createdAt || left.id.localeCompare(right.id);
  });

  const kept: DownloadTask[] = [];
  const keptIdentities = new Set<string>();
  const keptPaths = new Set<string>();
  for (const task of ordered) {
    const identity = taskIdentity(task);
    if (keptIdentities.has(identity) || keptPaths.has(task.destPath)) continue;
    kept.push(task);
    keptIdentities.add(identity);
    keptPaths.add(task.destPath);
  }
  if (kept.length === tasks.length) return 0;

  const keptIds = new Set(kept.map((task) => task.id));
  let removed = 0;
  for (const task of tasks) {
    if (keptIds.has(task.id)) continue;
    store.delete(task.id);
    removed += 1;
    if (!keptPaths.has(task.destPath)) {
      rmSync(`${task.destPath}.part`, { force: true });
    }
  }
  return removed;
}

/** 02 §7.4 / DR-037：目标已存在同尺寸文件视为已下载；否则返回可用的新路径 */
function resolveDestinationPath(
  baseDir: string,
  relativePath: string,
  expectedSize: number,
  takenPaths: ReadonlySet<string>
): string | null {
  const candidate = join(baseDir, relativePath);
  if (isAvailable(candidate, takenPaths)) return candidate;
  if (existsSync(candidate) && isSameSizeFile(candidate, expectedSize)) return null;
  const directory = dirname(candidate);
  const name = basename(candidate);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  for (let index = 1; index <= MAX_NAME_CONFLICT_SUFFIX; index += 1) {
    const next = join(directory, `${stem} (${index})${extension}`);
    if (isAvailable(next, takenPaths)) return next;
    if (existsSync(next) && isSameSizeFile(next, expectedSize)) return null;
  }
  return null;
}

/** DR-062：任务目标是否位于当前下载目录内（跨盘时 `relative` 返回绝对路径） */
function isInsideDirectory(path: string, directory: string): boolean {
  const target = directory.trim();
  if (target === '') return false;
  const diff = relative(target, path);
  return diff !== '' && !diff.startsWith('..') && !isAbsolute(diff);
}

function isAvailable(path: string, takenPaths: ReadonlySet<string>): boolean {
  return !takenPaths.has(path) && !existsSync(path);
}

function isSameSizeFile(path: string, expectedSize: number): boolean {
  if (expectedSize <= 0) return false;
  try {
    return statSync(path).size === expectedSize;
  } catch {
    return false;
  }
}

/** 逐块流式计算 md5，避免把大文件整体读入内存 */
async function fileMd5(path: string): Promise<string> {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function removeTaskFiles(destPath: string): void {
  rmSync(`${destPath}.part`, { force: true });
  rmSync(destPath, { force: true });
}

/** `.part` 不存在或不可读时按 0 处理，避免恢复流程因文件缺失中断（DR-035） */
function existingPartSize(destPath: string): number {
  try {
    return statSync(`${destPath}.part`).size;
  } catch {
    return 0;
  }
}

function randomId(): string {
  // 仅作任务主键，不参与文件名；用时间戳前缀便于人工排查顺序
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

/** 联合类型穷尽兜底：新增动作时编译期报错，而不是静默不处理 */
function never(action: DownloadAction, taskId: string): DownloadControlResult {
  throw new AppErrorException(
    createAppError('CONFIG', '不支持的下载操作', { detail: `${taskId}:${String(action)}` })
  );
}
