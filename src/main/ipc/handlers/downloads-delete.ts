import type { DownloadQueue } from '@main/download/queue';
import type { DownloadRemoveResult } from '@shared/downloads';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseDownloadRemoveInput } from '../downloads-input';

export type DownloadsDeleteHandler = (raw: unknown) => Result<DownloadRemoveResult>;

/**
 * DR-044：`downloads:delete`。不传 `deleteFile` 时只检查最终文件是否存在：
 * 不存在直接删记录；存在则返回 `removed:false`，由渲染层询问删文件还是只删记录。
 */
export function createDownloadsDeleteHandler(
  queue: Pick<DownloadQueue, 'remove'>
): DownloadsDeleteHandler {
  return (raw) => {
    try {
      return { ok: true, data: queue.remove(parseDownloadRemoveInput(raw)) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '删除下载任务失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
