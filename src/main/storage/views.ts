import { type SqlDatabase, withTransaction } from '@main/storage/db';
import type { SiteId } from '@shared/constants';

/**
 * 02 §6.1 / 03 §6.2：已看标记的存取。
 * 只读写 `post_views`，不发起网络请求，便于离线单测（T-18）。
 */
export interface ViewsStore {
  /** 已看过则累加次数并刷新 last_at；返回实际写入条数 */
  mark(site: SiteId, postIds: readonly number[]): number;
  /** 批量筛出已看过的 id（03 §6.2），顺序与入参无关 */
  listViewed(site: SiteId, postIds: readonly number[]): number[];
}

interface PostIdRow {
  post_id: number;
}

export function createViewsStore(database: SqlDatabase): ViewsStore {
  const upsert = database.prepare(
    'INSERT INTO post_views (site, post_id, viewed_at, last_at, view_count) VALUES (?, ?, ?, ?, 1) ' +
      'ON CONFLICT(site, post_id) DO UPDATE SET last_at = excluded.last_at, ' +
      'view_count = post_views.view_count + 1'
  );

  return {
    mark(site, postIds) {
      if (postIds.length === 0) return 0;
      const now = Date.now();
      return withTransaction(database, () => {
        for (const postId of postIds) upsert.run(site, postId, now, now);
        return postIds.length;
      });
    },
    listViewed(site, postIds) {
      if (postIds.length === 0) return [];
      const placeholders = postIds.map(() => '?').join(', ');
      const rows = database
        .prepare(
          `SELECT post_id FROM post_views WHERE site = ? AND post_id IN (${placeholders})`
        )
        .all(site, ...postIds) as PostIdRow[];
      return rows.map((row) => row.post_id);
    }
  };
}
