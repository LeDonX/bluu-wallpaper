import { createDownloadsControlHandler } from '@main/ipc/handlers/downloads-control';
import { createDownloadsEnqueueHandler } from '@main/ipc/handlers/downloads-enqueue';
import { createDownloadsListHandler } from '@main/ipc/handlers/downloads-list';
import type { DownloadEnqueueInput, DownloadTask } from '@shared/downloads';
import { AppErrorException, createAppError } from '@shared/errors';
import type { Post } from '@shared/models';
import { describe, expect, it, vi } from 'vitest';

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    site: 'yande',
    id: 42,
    md5: 'md5',
    previewUrl: 'https://assets.yande.re/data/preview/a.jpg',
    sampleUrl: 'https://files.yande.re/sample/a.jpg',
    fileUrl: 'https://files.yande.re/image/abc.jpg',
    width: 1000,
    height: 1400,
    fileSize: 12345,
    rating: 'safe',
    score: 10,
    tags: [],
    createdAt: 1793668940000,
    ...overrides
  };
}

function makeTask(): DownloadTask {
  return {
    id: 'task-1',
    site: 'yande',
    postId: 42,
    url: 'https://files.yande.re/image/abc.jpg',
    md5: 'md5',
    destPath: 'C:/downloads/yande/42.jpg',
    status: 'queued',
    bytesDone: 0,
    bytesTotal: 12345,
    retries: 0,
    error: null,
    createdAt: 1793668940000,
    updatedAt: 1793668940000
  };
}

describe('downloads:enqueue 入参校验', () => {
  it('合法参数写入队列并返回任务 id', async () => {
    const enqueue = vi.fn(() => ({ taskIds: ['task-1'], skipped: 0 }));
    const handler = createDownloadsEnqueueHandler({ enqueue });

    const result = await handler({ site: 'yande', posts: [makePost()] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ taskIds: ['task-1'], skipped: 0 });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('拒绝空数组、站点不一致、非 https 图片地址与未知格式', async () => {
    const enqueue = vi.fn(() => ({ taskIds: [], skipped: 0 }));
    const handler = createDownloadsEnqueueHandler({ enqueue });

    for (const raw of [
      { site: 'yande', posts: [] },
      { site: 'konachan', posts: [makePost()] },
      { site: 'yande', posts: [makePost({ fileUrl: 'http://files.yande.re/image/a.jpg' })] },
      { site: 'yande', posts: [makePost({ fileUrl: 'https://evil.example.com/a.jpg' })] },
      { site: 'yande', posts: [makePost({ jpegUrl: 'https://evil.example.com/a.jpg' })] },
      { site: 'yande', posts: [makePost()], variant: 'png' },
      null
    ]) {
      const result = await handler(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('CONFIG');
    }
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('透传 variant，缺省时不写入（DR-051）', async () => {
    const calls: DownloadEnqueueInput[] = [];
    const enqueue = vi.fn((input: DownloadEnqueueInput) => {
      calls.push(input);
      return { taskIds: ['task-1'], skipped: 0 };
    });
    const handler = createDownloadsEnqueueHandler({ enqueue });

    await handler({ site: 'yande', posts: [makePost()], variant: 'jpeg' });
    expect(calls[0]).toMatchObject({ variant: 'jpeg' });

    await handler({ site: 'yande', posts: [makePost()] });
    expect(calls[1]).not.toHaveProperty('variant');
  });

  it('队列写入异常映射为 DOWNLOAD，而不是静默成功', async () => {
    const handler = createDownloadsEnqueueHandler({
      enqueue: () => {
        throw new Error('db is locked');
      }
    });

    const result = await handler({ site: 'yande', posts: [makePost()] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DOWNLOAD');
      expect(result.error.detail).toContain('db is locked');
    }
  });

  it('目录校验失败时不入队（DR-059）', async () => {
    const enqueue = vi.fn(() => ({ taskIds: ['task-1'], skipped: 0 }));
    const handler = createDownloadsEnqueueHandler({ enqueue }, async () => ({
      ok: false,
      error: createAppError('DOWNLOAD', '未选择下载目录，下载未开始')
    }));

    const result = await handler({ site: 'yande', posts: [makePost()] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('未选择下载目录，下载未开始');
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('downloads:control', () => {
  it('透传动作并返回新状态', async () => {
    const control = vi.fn(() => ({ taskId: 'task-1', status: 'paused' as const }));
    const handler = createDownloadsControlHandler({ control });

    const result = await handler({ taskId: 'task-1', action: 'pause' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ taskId: 'task-1', status: 'paused' });
  });

  it('非法动作返回 CONFIG，不调用队列', async () => {
    const control = vi.fn();
    const handler = createDownloadsControlHandler({ control });

    const result = await handler({ taskId: 'task-1', action: 'explode' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFIG');
    expect(control).not.toHaveBeenCalled();
  });

  it('队列抛出的 AppErrorException 原样返回', async () => {
    const handler = createDownloadsControlHandler({
      control: () => {
        throw new AppErrorException(
          createAppError('DOWNLOAD', '下载任务不存在', { detail: 'task-1' })
        );
      }
    });

    const result = await handler({ taskId: 'task-1', action: 'pause' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('下载任务不存在');
  });

  it('非预期异常映射为 DB', async () => {
    const handler = createDownloadsControlHandler({
      control: () => {
        throw new Error('sqlite io error');
      }
    });

    const result = await handler({ taskId: 'task-1', action: 'cancel' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB');
  });
});

describe('downloads:list', () => {
  it('返回任务列表', async () => {
    const handler = createDownloadsListHandler({ list: () => [makeTask()] });

    const result = await handler(undefined);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([makeTask()]);
  });

  it('读取异常映射为 DB', async () => {
    const handler = createDownloadsListHandler({
      list: () => {
        throw new Error('db closed');
      }
    });

    const result = await handler(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB');
  });
});
