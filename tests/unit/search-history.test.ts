import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createSearchHistoryStore } from '@main/storage/search-history';
import { normalizeSearchQuery, SEARCH_HISTORY_LIMIT } from '@shared/search-history';
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

describe('搜索查询归一化（DR-055）', () => {
  it('去掉首尾空白并折叠连续空白', () => {
    expect(normalizeSearchQuery('  alpha   beta  ')).toBe('alpha beta');
    expect(normalizeSearchQuery('alpha\tbeta\n gamma')).toBe('alpha beta gamma');
  });

  it('空白串返回 null', () => {
    expect(normalizeSearchQuery('   ')).toBeNull();
    expect(normalizeSearchQuery('')).toBeNull();
  });

  it('归一化幂等，历史项可原样复用为查询', () => {
    const stored = normalizeSearchQuery(' alpha  beta ');
    expect(stored).toBe('alpha beta');
    expect(normalizeSearchQuery(stored as string)).toBe('alpha beta');
  });
});

describeWithSqlite('搜索历史存取（T-36 / DR-055）', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-search-history-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('按最近使用优先返回', () => {
    const store = createSearchHistoryStore(database);

    store.record('alpha');
    store.record('beta');
    store.record('gamma');

    expect(store.list()).toEqual(['gamma', 'beta', 'alpha']);
  });

  it('同一查询去重并移到最前', () => {
    const store = createSearchHistoryStore(database);

    store.record('alpha');
    store.record('beta');
    store.record('alpha');

    expect(store.list()).toEqual(['alpha', 'beta']);
    const row = database
      .prepare('SELECT use_count FROM search_history WHERE query = ?')
      .get('alpha') as { use_count: number };
    expect(row.use_count).toBe(2);
  });

  it(`超过 ${SEARCH_HISTORY_LIMIT} 条时截断为最近的 ${SEARCH_HISTORY_LIMIT} 条`, () => {
    const store = createSearchHistoryStore(database);

    for (let index = 0; index < SEARCH_HISTORY_LIMIT + 5; index += 1) {
      store.record(`query ${index}`);
    }

    const entries = store.list();
    expect(entries).toHaveLength(SEARCH_HISTORY_LIMIT);
    expect(entries[0]).toBe(`query ${SEARCH_HISTORY_LIMIT + 4}`);
    expect(entries[entries.length - 1]).toBe('query 5');
  });

  it('记录时归一化查询串', () => {
    const store = createSearchHistoryStore(database);

    store.record('  alpha   beta  ');

    expect(store.list()).toEqual(['alpha beta']);
  });

  it('删除单条后返回剩余列表，重复删除幂等', () => {
    const store = createSearchHistoryStore(database);
    store.record('alpha');
    store.record('beta');

    expect(store.remove('alpha')).toBe(true);
    expect(store.list()).toEqual(['beta']);
    expect(store.remove('alpha')).toBe(false);
    expect(store.list()).toEqual(['beta']);
  });

  it('清空返回删除条数并清空列表', () => {
    const store = createSearchHistoryStore(database);
    store.record('alpha');
    store.record('beta');

    expect(store.clear()).toBe(2);
    expect(store.list()).toEqual([]);
    expect(store.clear()).toBe(0);
  });
});
