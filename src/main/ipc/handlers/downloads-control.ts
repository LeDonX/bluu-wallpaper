import type { DownloadQueue } from '@main/download/queue';
import type { DownloadControlResult } from '@shared/downloads';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseDownloadControlInput } from '../downloads-input';

export type DownloadsControlHandler = (raw: unknown) => Promise<Result<DownloadControlResult>>;

/** `downloads:control`：暂停/恢复/重试/取消；非法流转返回 CONFIG，存储异常返回 DB */
export function createDownloadsControlHandler(
  queue: Pick<DownloadQueue, 'control'>
): DownloadsControlHandler {
  return async (raw) => {
    try {
      const input = parseDownloadControlInput(raw);
      return { ok: true, data: queue.control(input) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '下载操作失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
