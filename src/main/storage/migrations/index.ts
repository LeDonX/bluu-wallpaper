import initSql from './001_init.sql?raw';
import viewsSql from './002_views.sql?raw';
import favoritesSql from './003_favorites.sql?raw';
import downloadsSql from './004_downloads.sql?raw';
import downloadsMd5Sql from './005_downloads_md5.sql?raw';
import searchHistorySql from './006_search_history.sql?raw';
import subscriptionsSql from './007_subscriptions.sql?raw';
import postsSourceSql from './008_posts_source.sql?raw';
import removePexelsSql from './009_remove_pexels.sql?raw';

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

/** 迁移按 id 升序追加；已执行的 id 记录在 schema_migrations，重复启动不会重放 */
export const MIGRATIONS: readonly Migration[] = [
  { id: 1, name: '001_init', sql: initSql },
  { id: 2, name: '002_views', sql: viewsSql },
  { id: 3, name: '003_favorites', sql: favoritesSql },
  { id: 4, name: '004_downloads', sql: downloadsSql },
  { id: 5, name: '005_downloads_md5', sql: downloadsMd5Sql },
  { id: 6, name: '006_search_history', sql: searchHistorySql },
  { id: 7, name: '007_subscriptions', sql: subscriptionsSql },
  { id: 8, name: '008_posts_source', sql: postsSourceSql },
  { id: 9, name: '009_remove_pexels', sql: removePexelsSql }
];
