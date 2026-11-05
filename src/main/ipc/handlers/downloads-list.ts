import type { DownloadQueue } from '@main/download/queue';
import type { DownloadTask } from '@shared/downloads';
import { createAppError, type Result } from '@shared/errors';

export type DownloadsListHandler = (raw: unknown) => Promise<Result<DownloadTask[]>>;

/** `downloads:list`：只读本地任务表，不触发下载；读取失败返回 DB */
export function createDownloadsListHandler(
  queue: Pick<DownloadQueue, 'list'>
): DownloadsListHandler {
  return async () => {
    try {
      return { ok: true, data: queue.list() };
    } catch (error) {
      return {
        ok: false,
        error: createAppError('DB', '下载任务读取失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
