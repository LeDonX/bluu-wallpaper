import type { DownloadQueue } from '@main/download/queue';
import type { DownloadClearResult } from '@shared/downloads';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

export type DownloadsClearHandler = () => Result<DownloadClearResult>;

/** DR-044：`downloads:clear`。清空全部任务记录，已下载的最终文件保留 */
export function createDownloadsClearHandler(
  queue: Pick<DownloadQueue, 'clear'>
): DownloadsClearHandler {
  return () => {
    try {
      return { ok: true, data: queue.clear() };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '清空下载任务失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
