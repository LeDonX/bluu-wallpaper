import type { SearchHistoryStore } from '@main/storage/search-history';
import { createAppError, type Result } from '@shared/errors';

export type SearchHistoryListHandler = () => Promise<Result<string[]>>;

/** `search-history:list`：读取最近使用优先的搜索历史（03 §7 / DR-055） */
export function createSearchHistoryListHandler(
  store: Pick<SearchHistoryStore, 'list'>
): SearchHistoryListHandler {
  return async () => {
    try {
      return { ok: true, data: store.list() };
    } catch (error) {
      return {
        ok: false,
        error: createAppError('DB', '搜索历史读取失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
