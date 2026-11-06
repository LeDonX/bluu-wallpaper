import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseFollowsAddInput, parseFollowsMarkReadInput } from '@main/ipc/follows-input';
import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createSubscriptionsStore } from '@main/storage/subscriptions';
import { createSubscriptionService, FOLLOW_ADD_WARNING } from '@main/subscriptions/service';
import { AppErrorException } from '@shared/errors';
import type { Post } from '@shared/models';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseSyncConstructor = new (path: string) => SqlDatabase;

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

function makePost(id: number, site: 'yande' | 'konachan' = 'yande'): Post {
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
    tags: [{ name: 'tag', type: 'general' }],
    createdAt: 1793668940000
  };
}

describeWithSqlite('关注服务（T-47 / DR-069）', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-follows-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const makeService = (
    fetchLatest: (site: 'yande' | 'konachan', query: { tags: string[] }) => Promise<Post[]>,
    overrides: { blacklist?: string[]; onUpdated?: () => void } = {}
  ) =>
    createSubscriptionService({
      store: createSubscriptionsStore(database),
      fetchLatest,
      isExplicitAllowed: () => true,
      getBlacklist: () => overrides.blacklist ?? [],
      onUpdated: () => {
        overrides.onUpdated?.();
      }
    });

  it('首次关注失败仍保留订阅并返回 warning', async () => {
    const service = makeService(async () => {
      throw new Error('offline');
    });

    const result = await service.add('yande', 'koh_foo');
    expect(result.warning).toBe(FOLLOW_ADD_WARNING);
    expect(result.subscription.tag).toBe('koh_foo');
    expect(service.list('yande')).toHaveLength(1);
    expect(service.list('yande')[0]?.postCount).toBe(0);
  });

  it('首次成功拉取全部已读，刷新只把新作品标未读', async () => {
    let posts: Post[] = [makePost(1)];
    const service = makeService(async () => posts);

    await service.add('yande', 'tag');
    expect(service.list('yande')[0]?.unreadCount).toBe(0);

    posts = [makePost(1), makePost(2)];
    const result = await service.refresh('yande');
    expect(result).toMatchObject({ checked: 1, added: 1, unread: 1, failedTags: [] });
    expect(service.list('yande')[0]?.unreadCount).toBe(1);
  });

  it('黑名单标签拒绝关注，刷新时无正向标签则跳过拉取', async () => {
    const fetchCalls: string[] = [];
    const service = makeService(
      async (_site, query) => {
        fetchCalls.push(query.tags[0] ?? '');
        return [makePost(1)];
      },
      { blacklist: ['blocked'] }
    );

    await expect(service.add('yande', 'blocked')).rejects.toBeInstanceOf(AppErrorException);

    const store = createSubscriptionsStore(database);
    store.add('yande', 'blocked');
    const result = await service.refresh('yande');
    expect(result.checked).toBe(1);
    expect(fetchCalls).toEqual([]);
  });

  it('单关注失败不阻断其它关注，onUpdated 只广播一次', async () => {
    let updates = 0;
    const service = makeService(
      async (_site, query) => {
        if (query.tags[0] === 'beta') throw new Error('boom');
        return [makePost(1)];
      },
      { onUpdated: () => (updates += 1) }
    );

    await service.add('yande', 'alpha');
    await service.add('yande', 'beta');
    updates = 0;

    const result = await service.refresh('yande');
    expect(result.failedTags).toEqual(['beta']);
    expect(result.checked).toBe(2);
    expect(updates).toBe(1);
  });

  it('同站点并发刷新复用同一个 Promise', async () => {
    let release: (posts: Post[]) => void = () => undefined;
    const pending = new Promise<Post[]>((resolve) => {
      release = resolve;
    });
    let added = false;
    const service = makeService(async () => {
      if (!added) {
        added = true;
        return [makePost(1)];
      }
      return pending;
    });

    await service.add('yande', 'tag');
    const first = service.refresh('yande');
    const second = service.refresh('yande');
    expect(first).toBe(second);

    release([]);
    await first;
  });
});

describe('关注 IPC 入参校验（05 §5）', () => {
  it('接受合法标签', () => {
    expect(parseFollowsAddInput({ site: 'yande', tag: 'koh_foo' })).toEqual({
      site: 'yande',
      tag: 'koh_foo'
    });
  });

  it('拒绝空标签、含空白、负向、元数据与未知站点', () => {
    for (const tag of ['', '  ', 'a b', '-tag', 'score:>10', 'a'.repeat(101)]) {
      expect(() => parseFollowsAddInput({ site: 'yande', tag })).toThrow(AppErrorException);
    }
    expect(() => parseFollowsAddInput({ site: 'danbooru', tag: 'tag' })).toThrow(AppErrorException);
  });

  it('markRead 的 postIds 必须是 1–100 个正整数', () => {
    expect(parseFollowsMarkReadInput({ site: 'yande', postIds: [1, 2] })).toEqual({
      site: 'yande',
      postIds: [1, 2]
    });
    expect(() => parseFollowsMarkReadInput({ site: 'yande', postIds: [] })).toThrow(
      AppErrorException
    );
    expect(() => parseFollowsMarkReadInput({ site: 'yande', postIds: [0] })).toThrow(
      AppErrorException
    );
    expect(() =>
      parseFollowsMarkReadInput({ site: 'yande', postIds: new Array(101).fill(1) })
    ).toThrow(AppErrorException);
  });
});
