import type { SearchHistoryStore } from '@main/storage/search-history';
import { createAppError, type Result } from '@shared/errors';
import type { SearchHistoryClearResult } from '@shared/ipc-contract';

export type SearchHistoryClearHandler = () => Promise<Result<SearchHistoryClearResult>>;

/** `search-history:clear`：清空全部搜索历史并返回删除条数（DR-055） */
export function createSearchHistoryClearHandler(
  store: Pick<SearchHistoryStore, 'clear'>
): SearchHistoryClearHandler {
  return async () => {
    try {
      return { ok: true, data: { removed: store.clear() } };
    } catch (error) {
      return {
        ok: false,
        error: createAppError('DB', '搜索历史清空失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
