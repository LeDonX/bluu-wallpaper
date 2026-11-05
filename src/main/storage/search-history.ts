import { type SqlDatabase, withTransaction } from '@main/storage/db';
import { normalizeSearchQuery, SEARCH_HISTORY_LIMIT } from '@shared/search-history';

/**
 * 03 §6.1 / DR-055：搜索历史的本地存取。
 * 不按站点分区；写入按最近使用去重，并在同一事务内截断到上限。
 */
export interface SearchHistoryStore {
  /** 记录一次成功搜索；同一查询串只保留一条并移动到最前 */
  record(query: string): void;
  /** 按最近使用优先返回（最多 `SEARCH_HISTORY_LIMIT` 条） */
  list(): string[];
  /** 删除单条；返回是否确有记录被删除 */
  remove(query: string): boolean;
  /** 清空全部；返回删除条数 */
  clear(): number;
}

interface QueryRow {
  query: string;
}

interface LastUsedRow {
  last: number | null;
}

interface CountRow {
  count: number;
}

interface ChangesResult {
  changes: number;
}

export function createSearchHistoryStore(database: SqlDatabase): SearchHistoryStore {
  const upsert = database.prepare(
    'INSERT INTO search_history (query, last_used_at, use_count) VALUES (?, ?, 1) ' +
      'ON CONFLICT(query) DO UPDATE SET last_used_at = excluded.last_used_at, ' +
      'use_count = search_history.use_count + 1'
  );
  const trim = database.prepare(
    'DELETE FROM search_history WHERE query NOT IN (' +
      `SELECT query FROM search_history ORDER BY last_used_at DESC LIMIT ${SEARCH_HISTORY_LIMIT})`
  );
  const listRecent = database.prepare(
    `SELECT query FROM search_history ORDER BY last_used_at DESC LIMIT ${SEARCH_HISTORY_LIMIT}`
  );
  const removeOne = database.prepare('DELETE FROM search_history WHERE query = ?');
  const maxLastUsed = database.prepare('SELECT MAX(last_used_at) AS last FROM search_history');
  const countAll = database.prepare('SELECT COUNT(*) AS count FROM search_history');
  const removeAll = database.prepare('DELETE FROM search_history');

  return {
    record(query) {
      const normalized = normalizeSearchQuery(query);
      if (normalized === null) return;

      withTransaction(database, () => {
        // 同一毫秒内连续记录时继续递增，保证“最近使用”排序严格稳定
        const row = maxLastUsed.get() as LastUsedRow;
        const lastUsedAt = Math.max(Date.now(), (row.last ?? 0) + 1);
        upsert.run(normalized, lastUsedAt);
        trim.run();
      });
    },
    list() {
      return (listRecent.all() as QueryRow[]).map((row) => row.query);
    },
    remove(query) {
      const normalized = normalizeSearchQuery(query);
      if (normalized === null) return false;
      const result = removeOne.run(normalized) as ChangesResult;
      return result.changes > 0;
    },
    clear() {
      const row = countAll.get() as CountRow;
      removeAll.run();
      return row.count;
    }
  };
}
