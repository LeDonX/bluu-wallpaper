import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';

import { type Migration, MIGRATIONS } from './migrations';

/** 迁移与事务只依赖这两个能力，便于在测试里换用其他 SQLite 驱动验证同一套逻辑 */
export interface SqlStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqlDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  close(): void;
}

const SCHEMA_MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
`;

/**
 * 打开（必要时创建）数据库并执行未应用的迁移。
 * 迁移记录写在 schema_migrations：重复启动只跳过，不重复建表。
 */
export function openDatabase(filePath: string): SqlDatabase {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  applyMigrations(database);
  return database;
}

/** 返回本次实际应用的迁移条数（重复调用时为 0） */
export function applyMigrations(
  database: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS
): number {
  database.exec(SCHEMA_MIGRATIONS_SQL);
  const appliedRows = database.prepare('SELECT id FROM schema_migrations').all() as Array<{
    id: number;
  }>;
  const appliedIds = new Set(appliedRows.map((row) => row.id));

  let applied = 0;
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    withTransaction(database, () => {
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.id, migration.name, Date.now());
    });
    applied += 1;
  }
  return applied;
}

/** 写入统一走显式事务；失败回滚后原样抛出 */
export function withTransaction<T>(database: SqlDatabase, work: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
