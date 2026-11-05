import type { DownloadQueue } from '@main/download/queue';
import type { DownloadEnqueueResult } from '@shared/downloads';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseDownloadEnqueueInput } from '../downloads-input';

export type DownloadsEnqueueHandler = (raw: unknown) => Promise<Result<DownloadEnqueueResult>>;

/**
 * `downloads:enqueue` 的纯逻辑处理：入参校验 → 目录校验 → 写任务行 → 触发调度
 * （03 §7 / 02 §7.2）。目录无效时由注入的 guard 弹选择框（DR-059）。
 * 失败返回 Result 信封，不向 IPC 抛异常（05 §4）。
 */
export function createDownloadsEnqueueHandler(
  queue: Pick<DownloadQueue, 'enqueue'>,
  ensureDestination?: () => Promise<Result<void>>
): DownloadsEnqueueHandler {
  return async (raw) => {
    try {
      const input = parseDownloadEnqueueInput(raw);
      // DR-059：先校验下载目录，无效时弹选择框；取消或保存失败则不入队
      if (ensureDestination) {
        const ensured = await ensureDestination();
        if (!ensured.ok) return { ok: false, error: ensured.error };
      }
      return { ok: true, data: queue.enqueue(input) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '加入下载队列失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
