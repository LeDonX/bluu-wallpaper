import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase, withTransaction } from '@main/storage/db';
import { MIGRATIONS } from '@main/storage/migrations';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseSyncConstructor = new (path: string) => SqlDatabase;

/**
 * 生产驱动是 better-sqlite3（按 Electron ABI 重建），无法在 Node 测试进程里加载；
 * Node ≥22.5 自带的 node:sqlite 走同一套 SQL 与迁移执行器，可离线验证。
 * Node 20（08 §1）没有 node:sqlite，此时跳过，真实 DB 由 scripts/spike-sqlite.cjs 在 Electron 中覆盖。
 */
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

describeWithSqlite('SQLite 迁移 001', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-db-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const tableNames = (): string[] =>
    (
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

  const countRows = (table: string): number =>
    (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;

  it('首次迁移建立 posts 与 tag_cache', () => {
    applyMigrations(database);

    expect(tableNames()).toEqual(['post_views', 'posts', 'schema_migrations', 'tag_cache']);

    const postsColumns = database.prepare('PRAGMA table_info(posts)').all() as Array<{
      name: string;
      type: string;
    }>;
    const createdAt = postsColumns.find((column) => column.name === 'created_at');
    expect(createdAt?.type).toBe('INTEGER');
    expect(postsColumns.map((column) => column.name)).toEqual([
      'site',
      'post_id',
      'md5',
      'preview_url',
      'sample_url',
      'file_url',
      'width',
      'height',
      'file_size',
      'rating',
      'score',
      'tags_json',
      'created_at',
      'cached_at'
    ]);
  });

  it('重复执行不重复建表、不重复记录迁移', () => {
    expect(applyMigrations(database)).toBe(MIGRATIONS.length);
    expect(applyMigrations(database)).toBe(0);
    expect(countRows('schema_migrations')).toBe(MIGRATIONS.length);
    expect(tableNames()).toEqual(['post_views', 'posts', 'schema_migrations', 'tag_cache']);
  });

  it('事务失败时回滚已写入的数据', () => {
    applyMigrations(database);
    const insert = (id: number): void => {
      database
        .prepare('INSERT INTO posts (site, post_id, cached_at) VALUES (?, ?, ?)')
        .run('yande', id, Date.now());
    };

    expect(() =>
      withTransaction(database, () => {
        insert(1271989);
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(countRows('posts')).toBe(0);
  });

  it('事务成功时提交写入', () => {
    applyMigrations(database);
    withTransaction(database, () => {
      database
        .prepare('INSERT INTO posts (site, post_id, cached_at) VALUES (?, ?, ?)')
        .run('yande', 1271989, Date.now());
    });

    const row = database
      .prepare('SELECT site, post_id FROM posts WHERE site = ? AND post_id = ?')
      .get('yande', 1271989) as { site: string; post_id: number } | undefined;
    expect(row).toEqual({ site: 'yande', post_id: 1271989 });
  });
});
