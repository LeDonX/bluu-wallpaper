import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyMigrations, type SqlDatabase } from '@main/storage/db';
import { createSubscriptionsStore } from '@main/storage/subscriptions';
import type { Post } from '@shared/models';
import {
  buildSubscriptionDays,
  buildSubscriptionTimeline,
  formatFollowDayLabel,
  normalizeFollowTag,
  type SubscriptionPostEntry,
  type SubscriptionSummary,
  type SubscriptionTimelineEntry
} from '@shared/subscriptions';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type DatabaseSyncConstructor = new (path: string) => SqlDatabase;

/** 与 favorites.test.ts 同一策略：Node 20 无 node:sqlite 时跳过，真实驱动由 Electron 烟测覆盖 */
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

describeWithSqlite('subscriptions 存取（T-47 / DR-069）', () => {
  let directory: string;
  let database: SqlDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'booru-subscriptions-'));
    database = new (DatabaseSync as DatabaseSyncConstructor)(join(directory, 'booru.db'));
    applyMigrations(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('迁移 007 建立关注表与索引', () => {
    const subscriptionColumns = database
      .prepare('PRAGMA table_info(subscriptions)')
      .all() as Array<{ name: string }>;
    expect(subscriptionColumns.map((column) => column.name)).toEqual([
      'site',
      'tag',
      'created_at',
      'initialized',
      'last_seen_post_id',
      'last_checked_at'
    ]);

    const entryColumns = database
      .prepare('PRAGMA table_info(subscription_posts)')
      .all() as Array<{ name: string }>;
    expect(entryColumns.map((column) => column.name)).toEqual([
      'site',
      'tag',
      'post_id',
      'first_seen_at',
      'unread'
    ]);

    const indexes = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'subscription_posts'"
      )
      .all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining(['idx_subscription_posts_seen', 'idx_subscription_posts_unread'])
    );
  });

  it('首次拉取全部已读，之后只把新 id 标未读', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'koh_foo');

    expect(store.record('yande', 'koh_foo', [makePost(1), makePost(2), makePost(3)])).toEqual({
      added: 3,
      unread: 0
    });
    expect(store.get('yande', 'koh_foo')).toMatchObject({ postCount: 3, unreadCount: 0 });
    expect(store.entries('yande').every((entry) => !entry.unread)).toBe(true);

    expect(
      store.record('yande', 'koh_foo', [makePost(2), makePost(3), makePost(4), makePost(5)])
    ).toEqual({ added: 2, unread: 2 });
    expect(store.get('yande', 'koh_foo')?.unreadCount).toBe(2);
    expect(
      store
        .entries('yande')
        .filter((entry) => entry.unread)
        .map((entry) => entry.post.id)
        .sort((left, right) => left - right)
    ).toEqual([4, 5]);
  });

  it('last_seen 只上调，旧作品不会把新未读覆盖成已读', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'tag');
    store.record('yande', 'tag', [makePost(1), makePost(2), makePost(3)]);
    store.record('yande', 'tag', [makePost(4)]);

    expect(store.get('yande', 'tag')?.unreadCount).toBe(1);
    expect(store.record('yande', 'tag', [makePost(1)])).toEqual({ added: 0, unread: 0 });
    expect(store.get('yande', 'tag')?.unreadCount).toBe(1);
  });

  it('单关注只保留最近 100 条，裁剪不丢未读状态', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'tag');

    const first = Array.from({ length: 120 }, (_, index) => makePost(index + 1));
    store.record('yande', 'tag', first);
    expect(store.entries('yande')).toHaveLength(100);

    const next = Array.from({ length: 10 }, (_, index) => makePost(121 + index));
    store.record('yande', 'tag', next);
    const entries = store.entries('yande');
    expect(entries).toHaveLength(100);
    expect(entries.filter((entry) => entry.unread)).toHaveLength(10);
    expect(Math.min(...entries.map((entry) => entry.post.id))).toBe(31);
    expect(Math.max(...entries.map((entry) => entry.post.id))).toBe(130);
  });

  it('markRead 支持单条、分组与整站三档', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'alpha');
    store.add('yande', 'beta');
    store.record('yande', 'alpha', [makePost(1)]);
    store.record('yande', 'beta', [makePost(2, { site: 'yande' })]);
    store.record('yande', 'alpha', [makePost(3)]);
    store.record('yande', 'beta', [makePost(4, { site: 'yande' })]);

    expect(store.get('yande', 'alpha')?.unreadCount).toBe(1);
    expect(store.get('yande', 'beta')?.unreadCount).toBe(1);

    store.markRead('yande', { postIds: [3] });
    expect(store.get('yande', 'alpha')?.unreadCount).toBe(0);
    expect(store.get('yande', 'beta')?.unreadCount).toBe(1);

    store.markRead('yande', { tag: 'beta' });
    expect(store.get('yande', 'beta')?.unreadCount).toBe(0);

    store.record('yande', 'alpha', [makePost(5)]);
    store.record('yande', 'beta', [makePost(6, { site: 'yande' })]);
    store.markRead('yande');
    expect(store.get('yande', 'alpha')?.unreadCount).toBe(0);
    expect(store.get('yande', 'beta')?.unreadCount).toBe(0);
  });

  it('取消关注级联删除作品记录，且 posts 快照保留', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'tag');
    store.record('yande', 'tag', [makePost(1), makePost(2)]);

    store.remove('yande', 'tag');

    expect(store.list('yande')).toEqual([]);
    expect(store.entries('yande')).toEqual([]);
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM subscription_posts').get() as { count: number })
        .count
    ).toBe(0);
    expect((database.prepare('SELECT COUNT(*) AS count FROM posts').get() as { count: number }).count)
      .toBe(2);
  });

  it('并发取消后 record 不再写入孤儿条目', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'tag');
    store.remove('yande', 'tag');

    expect(store.record('yande', 'tag', [makePost(1)])).toEqual({ added: 0, unread: 0 });
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM subscription_posts').get() as { count: number })
        .count
    ).toBe(0);
  });

  it('按站点隔离，其他站点互不影响', () => {
    const store = createSubscriptionsStore(database);
    store.add('yande', 'tag');
    store.add('konachan', 'tag');
    store.record('yande', 'tag', [makePost(1)]);
    store.record('konachan', 'tag', [makePost(2, { site: 'konachan' })]);

    expect(store.list('yande').map((item) => item.postCount)).toEqual([1]);
    expect(store.list('konachan').map((item) => item.postCount)).toEqual([1]);
    expect(store.entries('yande').map((entry) => entry.post.site)).toEqual(['yande']);
    expect(store.entries('konachan').map((entry) => entry.post.site)).toEqual(['konachan']);
  });

  it('重复 add 幂等，并保留已有拉取状态', () => {
    const store = createSubscriptionsStore(database);
    expect(store.add('yande', 'tag').postCount).toBe(0);
    store.record('yande', 'tag', [makePost(1)]);
    expect(store.add('yande', 'tag').postCount).toBe(1);
  });

  it('关闭后重新打开数据库，关注仍在（重启保留）', () => {
    const filePath = join(directory, 'booru.db');
    const store = createSubscriptionsStore(database);
    store.add('yande', 'tag');
    store.record('yande', 'tag', [makePost(9)]);
    database.close();

    database = new (DatabaseSync as DatabaseSyncConstructor)(filePath);
    expect(applyMigrations(database)).toBe(0);
    expect(createSubscriptionsStore(database).list('yande').map((item) => item.tag)).toEqual(['tag']);
  });
});

describe('关注时间线与标签归一化（02 §8）', () => {
  const subscriptions: SubscriptionSummary[] = [
    {
      site: 'yande',
      tag: 'alpha',
      createdAt: 200,
      lastCheckedAt: 0,
      postCount: 2,
      unreadCount: 1
    },
    {
      site: 'yande',
      tag: 'beta',
      createdAt: 100,
      lastCheckedAt: 0,
      postCount: 1,
      unreadCount: 0
    }
  ];

  const entries: SubscriptionPostEntry[] = [
    { tag: 'alpha', post: makePost(1), firstSeenAt: 100, unread: true },
    { tag: 'beta', post: makePost(1, { site: 'yande' }), firstSeenAt: 200, unread: false },
    { tag: 'alpha', post: makePost(2), firstSeenAt: 150, unread: false }
  ];

  it('聚合视图按作品去重，未读取或，计数不虚高', () => {
    const timeline = buildSubscriptionTimeline(entries, subscriptions);
    expect(timeline.entries).toHaveLength(2);
    expect(timeline.entries.map((entry) => entry.post.id)).toEqual([2, 1]);
    expect(timeline.entries[1]?.tags).toEqual(['alpha', 'beta']);
    expect(timeline.entries[1]?.unread).toBe(true);
    expect(timeline.unreadTotal).toBe(1);
  });

  it('分组视图保留来源，组内按首次发现时间倒序', () => {
    const timeline = buildSubscriptionTimeline(entries, subscriptions);
    expect(timeline.groups.map((group) => group.subscription.tag)).toEqual(['alpha', 'beta']);
    expect(timeline.groups[0]?.entries.map((entry) => entry.post.id)).toEqual([2, 1]);
    expect(timeline.groups[1]?.entries.map((entry) => entry.post.id)).toEqual([1]);
  });

  it('空数据返回空时间线', () => {
    expect(buildSubscriptionTimeline([], [])).toEqual({
      entries: [],
      groups: [],
      unreadTotal: 0
    });
  });

  it('normalizeFollowTag 拒绝空串、空白、超长、负向与元数据', () => {
    expect(normalizeFollowTag('  KOH_Foo  ')).toBe('koh_foo');
    expect(normalizeFollowTag('koh foo')).toBeNull();
    expect(normalizeFollowTag('-tag')).toBeNull();
    expect(normalizeFollowTag('score:>10')).toBeNull();
    expect(normalizeFollowTag('a'.repeat(101))).toBeNull();
  });
});

describe('时间轴按日分组（T-55 / DR-072）', () => {
  // 用本地时间构造，避免测试机时区把"天"算错
  const day = (month: number, date: number, hour: number): number =>
    new Date(2026, month - 1, date, hour).getTime();

  const entry = (id: number, firstSeenAt: number, unread: boolean): SubscriptionTimelineEntry => ({
    post: makePost(id),
    tags: ['alpha'],
    firstSeenAt,
    unread
  });

  it('按本地自然日分组，日期倒序且组内保持入参顺序', () => {
    const days = buildSubscriptionDays([
      entry(1, day(11, 6, 10), true),
      entry(2, day(11, 6, 9), false),
      entry(3, day(11, 4, 21), true)
    ]);

    expect(days).toHaveLength(2);
    expect(days[0]?.day).toBe(day(11, 6, 0));
    expect(days[0]?.entries.map((item) => item.post.id)).toEqual([1, 2]);
    expect(days[0]?.unreadCount).toBe(1);
    expect(days[1]?.day).toBe(day(11, 4, 0));
    expect(days[1]?.unreadCount).toBe(1);
  });

  it('跨午夜按本地日期切分，不按 UTC 把作品分到前一天', () => {
    const early = day(11, 6, 0) + 5 * 60 * 1000;
    const late = day(11, 5, 0) + 23 * 60 * 60 * 1000 + 55 * 60 * 1000;

    const days = buildSubscriptionDays([entry(4, early, false), entry(5, late, false)]);

    expect(days).toHaveLength(2);
    expect(days[0]?.day).toBe(day(11, 6, 0));
    expect(days[1]?.entries.map((item) => item.post.id)).toEqual([5]);
  });

  it('日期标题区分今天、昨天与更早', () => {
    const now = day(11, 6, 20);

    expect(formatFollowDayLabel(day(11, 6, 0), now)).toBe('今天 · 11月6日');
    expect(formatFollowDayLabel(day(11, 5, 0), now)).toBe('昨天 · 11月5日');
    expect(formatFollowDayLabel(day(11, 3, 0), now)).toBe('11月3日 周二');
  });

  it('空数据不产生分组（跳过空日期）', () => {
    expect(buildSubscriptionDays([])).toEqual([]);
  });
});
