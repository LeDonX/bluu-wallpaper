import type { ViewsStore } from '@main/storage/views';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseViewsInput } from '../views-input';

export type ViewsListHandler = (raw: unknown) => Promise<Result<number[]>>;

/**
 * `views:list` 的纯逻辑处理：入参校验 → 批量查询已看 id（03 §6.2 / 07 DR-029）。
 * 供搜索页在加载新页与重启后恢复变暗状态；失败返回 Result 信封。
 */
export function createViewsListHandler(
  store: Pick<ViewsStore, 'listViewed'>
): ViewsListHandler {
  return async (raw) => {
    try {
      const input = parseViewsInput(raw);
      return { ok: true, data: store.listViewed(input.site, input.postIds) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '已看状态读取失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
