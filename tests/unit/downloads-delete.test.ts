import type { DownloadQueue } from '@main/download/queue';
import { createDownloadsClearHandler } from '@main/ipc/handlers/downloads-clear';
import { createDownloadsDeleteHandler } from '@main/ipc/handlers/downloads-delete';
import { AppErrorException, createAppError } from '@shared/errors';
import { describe, expect, it, vi } from 'vitest';

describe('downloads:delete / downloads:clear（DR-044）', () => {
  it('delete 返回队列的检查结果', () => {
    const remove = vi.fn(() => ({
      taskId: 'task-1',
      fileExisted: true,
      removed: false,
      deletedFile: false
    }));
    const handler = createDownloadsDeleteHandler({ remove } as Pick<DownloadQueue, 'remove'>);

    expect(handler({ taskId: 'task-1' })).toEqual({
      ok: true,
      data: { taskId: 'task-1', fileExisted: true, removed: false, deletedFile: false }
    });
    expect(remove).toHaveBeenCalledWith({ taskId: 'task-1' });
  });

  it('delete 校验入参不合法时不调用队列', () => {
    const remove = vi.fn();
    const result = createDownloadsDeleteHandler({ remove } as Pick<DownloadQueue, 'remove'>)({
      taskId: ''
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFIG');
    expect(remove).not.toHaveBeenCalled();
  });

  it('delete 把 AppErrorException 转成 Result 错误信封', () => {
    const remove = vi.fn(() => {
      throw new AppErrorException(
        createAppError('DOWNLOAD', '下载任务不存在', { detail: 'missing', retryable: false })
      );
    });
    const result = createDownloadsDeleteHandler({ remove } as Pick<DownloadQueue, 'remove'>)({
      taskId: 'missing'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DOWNLOAD');
  });

  it('clear 返回删除数量', () => {
    const clear = vi.fn(() => ({ removed: 3 }));
    const handler = createDownloadsClearHandler({ clear } as Pick<DownloadQueue, 'clear'>);

    expect(handler()).toEqual({ ok: true, data: { removed: 3 } });
  });

  it('clear 把未知异常包成 DOWNLOAD 错误', () => {
    const clear = vi.fn(() => {
      throw new Error('磁盘占用');
    });
    const result = createDownloadsClearHandler({ clear } as Pick<DownloadQueue, 'clear'>)();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DOWNLOAD');
      expect(result.error.detail).toContain('磁盘占用');
    }
  });
});
