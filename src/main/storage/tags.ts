import { type SqlDatabase, withTransaction } from '@main/storage/db';
import type { AnySiteId } from '@shared/constants';
import { isTagType, type TagSuggestion } from '@shared/models';

/**
 * 02 §3 的数据源之一：`tag_cache` 前缀查询。
 * 只负责存取，不发起网络请求，便于离线单测（T-15）。
 */
export interface TagCache {
  find(site: AnySiteId, prefix: string, limit: number): TagSuggestion[];
  save(site: AnySiteId, tags: readonly TagSuggestion[]): void;
}

interface TagRow {
  name: string;
  type: string | null;
  count: number | null;
}

/** SQLite LIKE 的 `%` / `_` 具有通配含义，前缀中的这两个字符需转义 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function createTagCache(database: SqlDatabase): TagCache {
  return {
    find(site, prefix, limit) {
      const pattern = `${escapeLike(prefix.toLowerCase())}%`;
      const rows = database
        .prepare(
          "SELECT name, type, count FROM tag_cache WHERE site = ? AND name LIKE ? ESCAPE '\\' ORDER BY count DESC, name ASC LIMIT ?"
        )
        .all(site, pattern, limit) as TagRow[];

      return rows.map((row) => ({
        name: row.name,
        // DB 中存字符串；历史数据出现未知类型时按 general 处理（06 §4）
        type: isTagType(row.type) ? row.type : 'general',
        count: row.count ?? 0
      }));
    },
    save(site, tags) {
      if (tags.length === 0) return;
      const upsert = database.prepare(
        'INSERT INTO tag_cache (site, name, type, count) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(site, name) DO UPDATE SET type = excluded.type, count = excluded.count'
      );
      withTransaction(database, () => {
        for (const tag of tags) upsert.run(site, tag.name, tag.type, tag.count);
      });
    }
  };
}
