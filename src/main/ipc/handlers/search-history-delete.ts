import type { SearchHistoryStore } from '@main/storage/search-history';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseSearchHistoryInput } from '../search-history-input';

export type SearchHistoryDeleteHandler = (raw: unknown) => Promise<Result<string[]>>;

/** `search-history:delete`：删除单条历史并返回更新后的列表（DR-055） */
export function createSearchHistoryDeleteHandler(
  store: Pick<SearchHistoryStore, 'remove' | 'list'>
): SearchHistoryDeleteHandler {
  return async (raw) => {
    try {
      const input = parseSearchHistoryInput(raw);
      store.remove(input.query);
      return { ok: true, data: store.list() };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '搜索历史删除失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
