import type { SearchHistoryStore } from '@main/storage/search-history';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseSearchHistoryInput } from '../search-history-input';

export type SearchHistoryRecordHandler = (raw: unknown) => Promise<Result<string[]>>;

/**
 * `search-history:record`：校验并归一化查询串 → UPSERT → 返回截断后的列表。
 * 直接回传列表，避免渲染层再发一次 list 造成顺序竞态（DR-055）。
 */
export function createSearchHistoryRecordHandler(
  store: Pick<SearchHistoryStore, 'record' | 'list'>
): SearchHistoryRecordHandler {
  return async (raw) => {
    try {
      const input = parseSearchHistoryInput(raw);
      store.record(input.query);
      return { ok: true, data: store.list() };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '搜索历史写入失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
