import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createFavoritesStore } from '@main/storage/favorites';
import { createViewsStore } from '@main/storage/views';
import { type FavoriteEntry, matchesFavoriteQuery, sortFavoriteEntries } from '@shared/favorites';
import type { Post } from '@shared/models';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseSyncConstructor = new (path: string) => SqlDatabase;

/** 与 views.test.ts 同一策略：Node 20 无 node:sqlite 时跳过，真实驱动由 Electron 烟测覆盖 */
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

function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    site: 'yande',
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
    tags: [
      { name: 'koh_(minagi_kou)', type: 'character' },
      { name: 'police_uniform', type: 'general' }
    ],
    createdAt: 1793668940000,
    ...overrides
  };
}

describeWithSqlite('favorites 存取（T-21）', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-favorites-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('迁移 003 建立 favorites 与索引', () => {
    const columns = database.prepare('PRAGMA table_info(favorites)').all() as Array<{
      name: string;
    }>;
    expect(columns.map((column) => column.name)).toEqual(['site', 'post_id', 'added_at']);

    const indexes = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'favorites'")
      .all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toContain('idx_favorites_added');
  });

  it('收藏写入 Post 快照并可读回', () => {
    const store = createFavoritesStore(database);
    const post = makePost(1271989);

    expect(store.toggle('yande', post)).toBe(true);

    const entries = store.list('yande');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.post).toMatchObject({
      site: 'yande',
      id: 1271989,
      previewUrl: post.previewUrl,
      sampleUrl: post.sampleUrl,
      fileUrl: post.fileUrl,
      width: 1000,
      height: 1400,
      fileSize: 12345,
      rating: 'safe',
      score: 10,
      createdAt: 1793668940000
    });
    expect(entries[0]?.post.tags.map((tag) => tag.name)).toEqual([
      'koh_(minagi_kou)',
      'police_uniform'
    ]);
    expect(typeof entries[0]?.addedAt).toBe('number');
  });

  it('收藏快照保留来源/署名（T-53 迁移 008）', () => {
    const store = createFavoritesStore(database);
    const source = 'Jane Doe（https://example.com/@jane-doe）';
    const post = makePost(11, { site: 'bing', source });

    expect(store.toggle('bing', post)).toBe(true);
    expect(store.list('bing')[0]?.post.source).toBe(source);
  });

  it('再次切换取消收藏，列表清空', () => {
    const store = createFavoritesStore(database);
    const post = makePost(42);

    expect(store.toggle('yande', post)).toBe(true);
    expect(store.toggle('yande', post)).toBe(false);
    expect(store.list('yande')).toEqual([]);
  });

  it('按站点隔离，不影响其他站点', () => {
    const store = createFavoritesStore(database);

    store.toggle('yande', makePost(1));
    store.toggle('konachan', makePost(2, { site: 'konachan' }));

    expect(store.list('yande').map((entry) => entry.post.id)).toEqual([1]);
    expect(store.list('konachan').map((entry) => entry.post.id)).toEqual([2]);
  });

  it('收藏与已看独立：取消收藏不删除已看记录', () => {
    const favorites = createFavoritesStore(database);
    const views = createViewsStore(database);
    const post = makePost(7);

    views.mark('yande', [post.id]);
    favorites.toggle('yande', post);
    favorites.toggle('yande', post);

    expect(favorites.list('yande')).toEqual([]);
    expect(views.listViewed('yande', [post.id])).toEqual([post.id]);
  });

  it('关闭后重新打开数据库，收藏仍在（重启保留）', () => {
    const filePath = join(directory, 'booru.db');
    const post = makePost(9);
    createFavoritesStore(database).toggle('yande', post);
    database.close();

    database = new (DatabaseSync as DatabaseSyncConstructor)(filePath);
    expect(applyMigrations(database)).toBe(0);
    expect(
      createFavoritesStore(database)
        .list('yande')
        .map((entry) => entry.post.id)
    ).toEqual([9]);
  });
});

describe('收藏筛选与排序（02 §8）', () => {
  const entries: FavoriteEntry[] = [
    { post: makePost(1, { score: 5, tags: [{ name: 'alpha', type: 'general' }] }), addedAt: 100 },
    {
      post: makePost(2, {
        score: 20,
        tags: [
          { name: 'alpha', type: 'general' },
          { name: 'beta', type: 'general' }
        ]
      }),
      addedAt: 300
    },
    { post: makePost(3, { score: 20, tags: [{ name: 'beta', type: 'general' }] }), addedAt: 200 }
  ];

  it('空筛选保留全部条目', () => {
    expect(matchesFavoriteQuery(entries[0]!.post, undefined)).toBe(true);
    expect(matchesFavoriteQuery(entries[0]!.post, '   ')).toBe(true);
  });

  it('多个标签需全部命中且忽略大小写', () => {
    expect(matchesFavoriteQuery(entries[1]!.post, 'alpha BETA')).toBe(true);
    expect(matchesFavoriteQuery(entries[0]!.post, 'alpha beta')).toBe(false);
    expect(matchesFavoriteQuery(entries[2]!.post, 'alph')).toBe(false);
  });

  it('按收藏时间降序', () => {
    expect(sortFavoriteEntries(entries, 'added').map((entry) => entry.post.id)).toEqual([2, 3, 1]);
  });

  it('按评分降序，同分按收藏时间降序', () => {
    expect(sortFavoriteEntries(entries, 'score').map((entry) => entry.post.id)).toEqual([2, 3, 1]);
  });

  it('排序不修改原数组', () => {
    const original = [...entries];
    sortFavoriteEntries(entries, 'score');
    expect(entries).toEqual(original);
  });
});
