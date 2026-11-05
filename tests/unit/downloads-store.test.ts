import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createDownloadsStore } from '@main/storage/downloads';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseSyncConstructor = new (path: string) => SqlDatabase;

/** 与 db.test.ts 同一策略：无 node:sqlite 时跳过，真实驱动由 Electron 烟测覆盖 */
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

const NOW = 1_793_668_940_000;

describeWithSqlite('下载任务存储（T-23 / 迁移 004）', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-downloads-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'bluu.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('入队写 queued，按创建时间升序读取', () => {
    const store = createDownloadsStore(database);
    const first = store.create({
      id: 'a',
      site: 'yande',
      postId: 1,
      url: 'https://files.yande.re/image/a.jpg',
      md5: 'md5-a',
      destPath: join(directory, 'yande', '1.jpg'),
      bytesTotal: 100,
      now: NOW
    });
    store.create({
      id: 'b',
      site: 'yande',
      postId: 2,
      url: 'https://files.yande.re/image/b.jpg',
      md5: null,
      destPath: join(directory, 'yande', '2.jpg'),
      bytesTotal: 200,
      now: NOW + 1
    });

    expect(first).toMatchObject({
      id: 'a',
      status: 'queued',
      bytesDone: 0,
      bytesTotal: 100,
      md5: 'md5-a'
    });
    expect(store.list().map((task) => task.id)).toEqual(['a', 'b']);
  });

  it('进度与状态更新写回同一行', () => {
    const store = createDownloadsStore(database);
    store.create({
      id: 'a',
      site: 'yande',
      postId: 1,
      url: 'https://files.yande.re/image/a.jpg',
      md5: null,
      destPath: join(directory, 'yande', '1.jpg'),
      bytesTotal: 100,
      now: NOW
    });

    store.updateProgress('a', 40, 100, NOW + 10);
    expect(store.get('a')).toMatchObject({ bytesDone: 40, bytesTotal: 100 });

    store.setStatus('a', 'failed', '下载失败（HTTP 500）', { done: 40, total: 100 }, NOW + 20);
    expect(store.get('a')).toMatchObject({
      status: 'failed',
      error: '下载失败（HTTP 500）',
      bytesDone: 40
    });
  });

  it('删除任务后不可再读取', () => {
    const store = createDownloadsStore(database);
    store.create({
      id: 'a',
      site: 'yande',
      postId: 1,
      url: 'https://files.yande.re/image/a.jpg',
      md5: null,
      destPath: join(directory, 'yande', '1.jpg'),
      bytesTotal: 100,
      now: NOW
    });

    store.delete('a');

    expect(store.get('a')).toBeNull();
    expect(store.list()).toEqual([]);
  });

  it('启动恢复把 downloading/verifying 重置为 queued 并清零已下字节', () => {
    const store = createDownloadsStore(database);
    for (const [id, status] of [
      ['a', 'downloading'],
      ['b', 'verifying'],
      ['c', 'paused'],
      ['d', 'done']
    ] as const) {
      store.create({
        id,
        site: 'yande',
        postId: 1,
        url: 'https://files.yande.re/image/a.jpg',
        md5: null,
        destPath: join(directory, 'yande', `${id}.jpg`),
        bytesTotal: 100,
        now: NOW
      });
      store.setStatus(id, status, null, { done: 50, total: 100 }, NOW);
    }

    expect(store.resetInterrupted(NOW + 100)).toBe(2);
    expect(store.get('a')).toMatchObject({ status: 'queued', bytesDone: 0 });
    expect(store.get('b')).toMatchObject({ status: 'queued', bytesDone: 0 });
    expect(store.get('c')?.status).toBe('paused');
    expect(store.get('d')?.status).toBe('done');
  });

  it('findCompletedMd5 只命中同站点已完成的 md5（DR-037）', () => {
    const store = createDownloadsStore(database);
    store.create({
      id: 'a',
      site: 'yande',
      postId: 1,
      url: 'https://files.yande.re/image/a.jpg',
      md5: 'abc',
      destPath: join(directory, 'yande', '1.jpg'),
      bytesTotal: 100,
      now: NOW
    });

    expect(store.findCompletedMd5('yande', 'abc')).toBe(false);
    store.setStatus('a', 'done', null, { done: 100, total: 100 }, NOW + 1);
    expect(store.findCompletedMd5('yande', 'abc')).toBe(true);
    expect(store.findCompletedMd5('konachan', 'abc')).toBe(false);
    expect(store.findCompletedMd5('yande', 'other')).toBe(false);
  });

  it('relocate 改写目标路径并回到队列态（DR-062）', () => {
    const store = createDownloadsStore(database);
    store.create({
      id: 'a',
      site: 'yande',
      postId: 1,
      url: 'https://files.yande.re/image/a.jpg',
      md5: 'abc',
      destPath: join(directory, 'old', 'yande', '1.jpg'),
      bytesTotal: 100,
      now: NOW
    });
    store.setStatus('a', 'done', null, { done: 100, total: 100 }, NOW + 1);

    store.relocate(
      'a',
      {
        url: 'https://files.yande.re/image/a.jpg',
        md5: 'abc',
        destPath: join(directory, 'new', 'yande', '1.jpg'),
        bytesTotal: 100
      },
      NOW + 2
    );

    expect(store.get('a')).toMatchObject({
      status: 'queued',
      bytesDone: 0,
      destPath: join(directory, 'new', 'yande', '1.jpg')
    });
  });
});
