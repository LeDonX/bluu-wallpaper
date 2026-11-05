import type { SiteId } from '@shared/constants';

import { type SqlDatabase, withTransaction } from './db';

/** 02 §6.4 / 07 DR-033：清除浏览记录覆盖的两类本地数据 */
export interface HistoryClearCounts {
  views: number;
  favorites: number;
}

export interface HistoryStore {
  /** 清除已看与收藏；`site` 缺省表示全部站点。只删记录表，保留 `posts` 快照与 `tag_cache` */
  clear(site?: SiteId): HistoryClearCounts;
}

interface CountRow {
  count: number;
}

export function createHistoryStore(database: SqlDatabase): HistoryStore {
  const statements = {
    countViewsBySite: database.prepare('SELECT COUNT(*) AS count FROM post_views WHERE site = ?'),
    countViewsAll: database.prepare('SELECT COUNT(*) AS count FROM post_views'),
    countFavoritesBySite: database.prepare('SELECT COUNT(*) AS count FROM favorites WHERE site = ?'),
    countFavoritesAll: database.prepare('SELECT COUNT(*) AS count FROM favorites'),
    deleteViewsBySite: database.prepare('DELETE FROM post_views WHERE site = ?'),
    deleteViewsAll: database.prepare('DELETE FROM post_views'),
    deleteFavoritesBySite: database.prepare('DELETE FROM favorites WHERE site = ?'),
    deleteFavoritesAll: database.prepare('DELETE FROM favorites')
  };

  const countOf = (statement: { get(...params: unknown[]): unknown }, site?: SiteId): number => {
    const row = (
      site === undefined ? statement.get() : statement.get(site)
    ) as CountRow | undefined;
    return row?.count ?? 0;
  };

  return {
    clear(site) {
      return withTransaction(database, () => {
        const views = countOf(
          site === undefined ? statements.countViewsAll : statements.countViewsBySite,
          site
        );
        const favorites = countOf(
          site === undefined ? statements.countFavoritesAll : statements.countFavoritesBySite,
          site
        );

        if (site === undefined) {
          statements.deleteViewsAll.run();
          statements.deleteFavoritesAll.run();
        } else {
          statements.deleteViewsBySite.run(site);
          statements.deleteFavoritesBySite.run(site);
        }

        return { views, favorites };
      });
    }
  };
}
