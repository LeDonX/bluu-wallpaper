import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createViewsStore } from '@main/storage/views';
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

interface ViewsRow {
  post_id: number;
  viewed_at: number;
  last_at: number;
  view_count: number;
}

describeWithSqlite('post_views 存取（T-18）', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-views-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const rowOf = (postId: number): ViewsRow | undefined =>
    database
      .prepare('SELECT post_id, viewed_at, last_at, view_count FROM post_views WHERE post_id = ?')
      .get(postId) as ViewsRow | undefined;

  it('迁移 002 建立 post_views 与索引', () => {
    const columns = database.prepare('PRAGMA table_info(post_views)').all() as Array<{
      name: string;
    }>;
    expect(columns.map((column) => column.name)).toEqual([
      'site',
      'post_id',
      'viewed_at',
      'last_at',
      'view_count'
    ]);

    const indexes = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'post_views'")
      .all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toContain('idx_views_last');
  });

  it('首次标记写入 viewed_at / last_at / view_count=1', () => {
    const store = createViewsStore(database);

    expect(store.mark('yande', [1271989])).toBe(1);

    const row = rowOf(1271989);
    expect(row?.view_count).toBe(1);
    expect(row?.viewed_at).toBe(row?.last_at);
  });

  it('重复标记累加次数并刷新 last_at，保留首次时间', () => {
    const store = createViewsStore(database);
    store.mark('yande', [1271989]);
    const first = rowOf(1271989);

    store.mark('yande', [1271989]);
    const second = rowOf(1271989);

    expect(second?.view_count).toBe(2);
    expect(second?.viewed_at).toBe(first?.viewed_at);
    expect(second?.last_at ?? 0).toBeGreaterThanOrEqual(first?.last_at ?? 0);
  });

  it('批量查询只返回该站点已看过的 id', () => {
    const store = createViewsStore(database);
    store.mark('yande', [1, 2]);
    store.mark('konachan', [3]);

    expect(store.listViewed('yande', [1, 2, 3, 4])).toEqual([1, 2]);
    expect(store.listViewed('konachan', [1, 3])).toEqual([3]);
  });

  it('空 id 列表不写库也不查询', () => {
    const store = createViewsStore(database);

    expect(store.mark('yande', [])).toBe(0);
    expect(store.listViewed('yande', [])).toEqual([]);
  });

  it('关闭后重新打开数据库，已看状态仍在（重启保留）', () => {
    const filePath = join(directory, 'booru.db');
    createViewsStore(database).mark('yande', [42]);
    database.close();

    database = new (DatabaseSync as DatabaseSyncConstructor)(filePath);
    expect(applyMigrations(database)).toBe(0);
    expect(createViewsStore(database).listViewed('yande', [42])).toEqual([42]);
  });
});
