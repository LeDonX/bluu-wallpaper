import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createFavoritesStore } from '@main/storage/favorites';
import { createHistoryStore } from '@main/storage/history';
import { createViewsStore } from '@main/storage/views';
import type { Post } from '@shared/models';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseSyncConstructor = new (path: string) => SqlDatabase;

/** 与 db.test.ts 同一策略：Node 20 无 node:sqlite 时跳过，真实驱动由 Electron 烟测覆盖 */
function loadNodeSqlite(): DatabaseSyncConstructor | null {
  try {
    const module = createRequire(import.meta.url)('node:sqlite') as {
      DatabaseSync: DatabaseSyncConstructor;
    };
    return module.DatabaseSync;
  } catch {
    return null;
  }
}

const DatabaseSync = loadNodeSqlite();
const describeWithSqlite = DatabaseSync ? describe : describe.skip;

function makePost(id: number, site: Post['site'] = 'yande'): Post {
  return {
    site,
    id,
    md5: `md5-${id}`,
    previewUrl: 'https://assets.yande.re/data/preview/a.jpg',
    sampleUrl: 'https://files.yande.re/sample/a.jpg',
    fileUrl: 'https://files.yande.re/image/a.jpg',
    width: 1000,
    height: 1400,
    fileSize: 12345,
    rating: 'safe',
    score: 10,
    tags: [{ name: 'alpha', type: 'general' }],
    createdAt: 1793668940000
  };
}

describeWithSqlite('清除浏览记录（T-22 / DR-033）', () => {
  let directory: string;
  let database: SqlDatabase;

  const countRows = (table: string): number =>
    (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-history-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);

    // 两站各写已看与收藏；收藏会同时写入 posts 快照
    const views = createViewsStore(database);
    const favorites = createFavoritesStore(database);
    views.mark('yande', [1, 2]);
    views.mark('konachan', [3]);
    favorites.toggle('yande', makePost(1));
    favorites.toggle('konachan', makePost(3, 'konachan'));
    database
      .prepare('INSERT INTO tag_cache (site, name, type, count) VALUES (?, ?, ?, ?)')
      .run('yande', 'alpha', 'general', 10);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('清除当前站点只清该站点的已看与收藏，不影响另一站', () => {
    const store = createHistoryStore(database);

    expect(store.clear('yande')).toEqual({ views: 2, favorites: 1 });

    const views = createViewsStore(database);
    const favorites = createFavoritesStore(database);
    expect(views.listViewed('yande', [1, 2])).toEqual([]);
    expect(favorites.list('yande')).toEqual([]);
    expect(views.listViewed('konachan', [3])).toEqual([3]);
    expect(favorites.list('konachan').map((entry) => entry.post.id)).toEqual([3]);
  });

  it('清除全部站点时两站记录都清空', () => {
    const store = createHistoryStore(database);

    expect(store.clear()).toEqual({ views: 3, favorites: 2 });

    expect(countRows('post_views')).toBe(0);
    expect(countRows('favorites')).toBe(0);
  });

  it('不误删 posts 快照、tag_cache 与迁移记录', () => {
    const store = createHistoryStore(database);
    const postsBefore = countRows('posts');

    store.clear();

    expect(countRows('posts')).toBe(postsBefore);
    expect(countRows('tag_cache')).toBe(1);
    // 迁移 005 追加 md5 列（DR-037）、006 建搜索历史（DR-055）、007 建关注（DR-069）、
    // 008 追加 posts.source（T-53）、009 清理 pexels 残留数据
    expect(countRows('schema_migrations')).toBe(9);
  });

  it('重复清除幂等：第二次返回 0 且不报错', () => {
    const store = createHistoryStore(database);

    store.clear('yande');

    expect(store.clear('yande')).toEqual({ views: 0, favorites: 0 });
    expect(store.clear()).toEqual({ views: 1, favorites: 1 });
  });
});
