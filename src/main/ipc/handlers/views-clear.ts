import type { HistoryStore } from '@main/storage/history';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { ViewsClearResult } from '@shared/ipc-contract';

import { parseViewsClearInput } from '../views-clear-input';

export type ViewsClearHandler = (raw: unknown) => Promise<Result<ViewsClearResult>>;

/**
 * `views:clear` 的纯逻辑处理：入参校验 → 事务内清除 `post_views` 与 `favorites`（02 §6.4 / DR-033）。
 * 幂等：重复清除返回 0；失败返回 Result 信封，不向 IPC 抛异常（05 §4）。
 */
export function createViewsClearHandler(
  store: Pick<HistoryStore, 'clear'>
): ViewsClearHandler {
  return async (raw) => {
    try {
      const input = parseViewsClearInput(raw);
      const cleared = store.clear(input.site);
      return {
        ok: true,
        data: {
          site: input.site ?? null,
          clearedViews: cleared.views,
          clearedFavorites: cleared.favorites
        }
      };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '清除浏览记录失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
