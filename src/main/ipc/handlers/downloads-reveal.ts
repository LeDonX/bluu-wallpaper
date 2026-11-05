import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import type { DownloadTask } from '@shared/downloads';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseDownloadRevealInput } from '../downloads-input';

export interface DownloadsRevealDeps {
  list(): DownloadTask[];
  /** Electron `shell.showItemInFolder`：打开文件夹并选中给定路径 */
  showItemInFolder(path: string): void;
  /** Electron `shell.openPath`：打开目录，返回空串表示成功 */
  openPath(path: string): Promise<string>;
}

export type DownloadsRevealHandler = (raw: unknown) => Promise<Result<null>>;

/**
 * DR-043：`downloads:reveal`。已完成任务选中最终文件；未完成时优先选中 `.part`；
 * 两者都不存在时只打开所在目录。路径只来自本地任务表，不接受渲染层传入路径。
 */
export function createDownloadsRevealHandler(deps: DownloadsRevealDeps): DownloadsRevealHandler {
  return async (raw) => {
    try {
      const { taskId } = parseDownloadRevealInput(raw);
      const task = deps.list().find((item) => item.id === taskId) ?? null;
      if (task === null) {
        throw new AppErrorException(
          createAppError('DOWNLOAD', '下载任务不存在', { detail: taskId, retryable: false })
        );
      }
      if (existsSync(task.destPath)) {
        deps.showItemInFolder(task.destPath);
        return { ok: true, data: null };
      }
      const partPath = `${task.destPath}.part`;
      if (existsSync(partPath)) {
        deps.showItemInFolder(partPath);
        return { ok: true, data: null };
      }
      const failure = await deps.openPath(dirname(task.destPath));
      if (failure !== '') {
        throw new AppErrorException(
          createAppError('DOWNLOAD', '无法打开下载文件夹', { detail: failure, retryable: false })
        );
      }
      return { ok: true, data: null };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '打开下载文件夹失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
