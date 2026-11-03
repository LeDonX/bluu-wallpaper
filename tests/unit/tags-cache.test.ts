import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createTagCache } from '@main/storage/tags';
import type { TagSuggestion } from '@shared/models';
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

const hat = (name: string, count: number, type: TagSuggestion['type'] = 'character'): TagSuggestion => ({
  name,
  type,
  count
});

describeWithSqlite('tag_cache 前缀查询', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-tags-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('按前缀命中并按作品数降序返回', () => {
    const cache = createTagCache(database);
    cache.save('yande', [hat('hatsune', 3), hat('hatsune_miku', 12321), hat('hatsune_x', 0, 'general')]);

    expect(cache.find('yande', 'hatsune', 10)).toEqual([
      hat('hatsune_miku', 12321),
      hat('hatsune', 3),
      hat('hatsune_x', 0, 'general')
    ]);
  });

  it('前缀中的下划线按字面匹配，不作为 LIKE 通配符', () => {
    const cache = createTagCache(database);
    cache.save('yande', [hat('hatsune_miku', 1), hat('hatsuneXmiku', 2, 'general')]);

    expect(cache.find('yande', 'hatsune_', 10).map((tag) => tag.name)).toEqual(['hatsune_miku']);
  });

  it('两站缓存互相隔离', () => {
    const cache = createTagCache(database);
    cache.save('yande', [hat('hatsune_miku', 1)]);
    cache.save('konachan', [hat('hatsune_miku', 2)]);

    expect(cache.find('yande', 'hatsune', 10)).toEqual([hat('hatsune_miku', 1)]);
    expect(cache.find('konachan', 'hatsune', 10)).toEqual([hat('hatsune_miku', 2)]);
  });

  it('重复写入按主键更新，不产生重复行', () => {
    const cache = createTagCache(database);
    cache.save('yande', [hat('hatsune_miku', 1)]);
    cache.save('yande', [hat('hatsune_miku', 99)]);

    expect(cache.find('yande', 'hatsune', 10)).toEqual([hat('hatsune_miku', 99)]);
  });

  it('库中出现未知类型时按 general 处理', () => {
    database
      .prepare('INSERT INTO tag_cache (site, name, type, count) VALUES (?, ?, ?, ?)')
      .run('yande', 'hatsune_miku', 'mystery', 1);

    expect(createTagCache(database).find('yande', 'hatsune', 10)).toEqual([
      { name: 'hatsune_miku', type: 'general', count: 1 }
    ]);
  });

  it('limit 截断结果', () => {
    const cache = createTagCache(database);
    cache.save('yande', [hat('hatsune_a', 3), hat('hatsune_b', 2), hat('hatsune_c', 1)]);

    expect(cache.find('yande', 'hatsune', 2).map((tag) => tag.name)).toEqual([
      'hatsune_a',
      'hatsune_b'
    ]);
  });
});
