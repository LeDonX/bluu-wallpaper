import { type SqlDatabase, withTransaction } from '@main/storage/db';
import type { SiteId } from '@shared/constants';
import { type Post, type PostTag, type Rating, RATINGS } from '@shared/models';
import {
  FOLLOW_KEEP_LIMIT,
  type SubscriptionPostEntry,
  type SubscriptionSummary
} from '@shared/subscriptions';
import { z } from 'zod';

/**
 * 02 §8 / 03 §6.2 / 07 DR-069：关注与关注作品的本地存取。
 * 作品快照写入既有 `posts` 表，关注页只读本地数据，刷新时才请求站点。
 */
export interface SubscriptionsStore {
  list(site: SiteId): SubscriptionSummary[];
  get(site: SiteId, tag: string): SubscriptionSummary | null;
  has(site: SiteId, tag: string): boolean;
  /** 幂等：已存在时返回现有概览 */
  add(site: SiteId, tag: string): SubscriptionSummary;
  remove(site: SiteId, tag: string): void;
  /** 写入本次拉取结果；首次成功拉取全部标已读，之后仅新 id 标未读 */
  record(site: SiteId, tag: string, posts: readonly Post[]): { added: number; unread: number };
  /** 单条 / 分组 / 整站三档已读 */
  markRead(
    site: SiteId,
    options?: { tag?: string; postIds?: readonly number[] }
  ): void;
  entries(site: SiteId): SubscriptionPostEntry[];
}

interface SummaryRow {
  site: string;
  tag: string;
  created_at: number;
  last_checked_at: number;
  post_count: number;
  unread_count: number;
}

interface StateRow {
  initialized: number;
  last_seen_post_id: number;
}

interface EntryRow {
  tag: string;
  post_id: number;
  first_seen_at: number;
  unread: number;
  md5: string | null;
  preview_url: string | null;
  sample_url: string | null;
  file_url: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  rating: string | null;
  score: number | null;
  tags_json: string | null;
  created_at: number | null;
}

const TagsSchema = z.array(z.object({ name: z.string(), type: z.string() }));

function isRating(value: string | null): value is Rating {
  return value !== null && (RATINGS as readonly string[]).includes(value);
}

/** tags_json 损坏时按空标签处理，避免单条坏数据阻断关注页 */
function parseTags(raw: string | null): PostTag[] {
  if (raw === null) return [];
  try {
    const parsed = TagsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function toPost(row: EntryRow, site: SiteId): Post {
  return {
    site,
    id: row.post_id,
    md5: row.md5 ?? '',
    previewUrl: row.preview_url ?? '',
    sampleUrl: row.sample_url ?? '',
    fileUrl: row.file_url ?? '',
    width: row.width ?? 0,
    height: row.height ?? 0,
    fileSize: row.file_size ?? 0,
    rating: isRating(row.rating) ? row.rating : 'safe',
    score: row.score ?? 0,
    tags: parseTags(row.tags_json),
    createdAt: row.created_at ?? 0
  };
}

/** 与 `favorites.ts` 的快照写入保持一致；只存 001_init 已有的列 */
const UPSERT_POST_SQL = `
INSERT INTO posts (
  site, post_id, md5, preview_url, sample_url, file_url,
  width, height, file_size, rating, score, tags_json, created_at, cached_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(site, post_id) DO UPDATE SET
  md5 = excluded.md5,
  preview_url = excluded.preview_url,
  sample_url = excluded.sample_url,
  file_url = excluded.file_url,
  width = excluded.width,
  height = excluded.height,
  file_size = excluded.file_size,
  rating = excluded.rating,
  score = excluded.score,
  tags_json = excluded.tags_json,
  created_at = excluded.created_at,
  cached_at = excluded.cached_at
`;

const SUMMARY_SELECT = `
SELECT
  s.site, s.tag, s.created_at, s.last_checked_at,
  COUNT(p.post_id) AS post_count,
  COALESCE(SUM(p.unread), 0) AS unread_count
FROM subscriptions s
LEFT JOIN subscription_posts p ON p.site = s.site AND p.tag = s.tag
`;

function toSummary(row: SummaryRow): SubscriptionSummary {
  return {
    site: row.site as SiteId,
    tag: row.tag,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
    postCount: Number(row.post_count),
    unreadCount: Number(row.unread_count)
  };
}

function changed(run: unknown): number {
  const result = run as { changes?: number };
  return typeof result.changes === 'number' ? result.changes : 0;
}

export function createSubscriptionsStore(database: SqlDatabase): SubscriptionsStore {
  const listSubscriptions = database.prepare(
    `${SUMMARY_SELECT} WHERE s.site = ? GROUP BY s.site, s.tag ORDER BY s.created_at DESC, s.tag ASC`
  );
  const getSummary = database.prepare(
    `${SUMMARY_SELECT} WHERE s.site = ? AND s.tag = ? GROUP BY s.site, s.tag`
  );
  const findSubscription = database.prepare(
    'SELECT initialized, last_seen_post_id FROM subscriptions WHERE site = ? AND tag = ?'
  );
  const insertSubscription = database.prepare(
    'INSERT OR IGNORE INTO subscriptions (site, tag, created_at) VALUES (?, ?, ?)'
  );
  const deleteSubscriptionPosts = database.prepare(
    'DELETE FROM subscription_posts WHERE site = ? AND tag = ?'
  );
  const deleteSubscription = database.prepare('DELETE FROM subscriptions WHERE site = ? AND tag = ?');
  const upsertPost = database.prepare(UPSERT_POST_SQL);
  const insertEntry = database.prepare(
    `INSERT INTO subscription_posts (site, tag, post_id, first_seen_at, unread)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(site, tag, post_id) DO NOTHING`
  );
  const updateSubscription = database.prepare(
    `UPDATE subscriptions
     SET initialized = 1, last_seen_post_id = ?, last_checked_at = ?
     WHERE site = ? AND tag = ?`
  );
  const pruneEntries = database.prepare(
    `DELETE FROM subscription_posts
     WHERE site = ? AND tag = ? AND post_id NOT IN (
       SELECT post_id FROM subscription_posts
       WHERE site = ? AND tag = ? ORDER BY post_id DESC LIMIT ?
     )`
  );
  const listEntries = database.prepare(
    `SELECT
       sp.tag, sp.post_id, sp.first_seen_at, sp.unread,
       p.md5, p.preview_url, p.sample_url, p.file_url,
       p.width, p.height, p.file_size, p.rating, p.score, p.tags_json, p.created_at
     FROM subscription_posts sp
     INNER JOIN subscriptions s ON s.site = sp.site AND s.tag = sp.tag
     LEFT JOIN posts p ON p.site = sp.site AND p.post_id = sp.post_id
     WHERE sp.site = ?
     ORDER BY sp.first_seen_at DESC, sp.post_id DESC`
  );

  const summaryOf = (site: SiteId, tag: string): SubscriptionSummary => {
    const row = getSummary.get(site, tag) as SummaryRow | undefined;
    if (row === undefined) {
      throw new Error(`关注不存在：${site}/${tag}`);
    }
    return toSummary(row);
  };

  return {
    list(site) {
      const rows = listSubscriptions.all(site) as SummaryRow[];
      return rows.map(toSummary);
    },

    get(site, tag) {
      const row = getSummary.get(site, tag) as SummaryRow | undefined;
      return row === undefined ? null : toSummary(row);
    },

    has(site, tag) {
      return findSubscription.get(site, tag) !== undefined;
    },

    add(site, tag) {
      withTransaction(database, () => {
        insertSubscription.run(site, tag, Date.now());
      });
      return summaryOf(site, tag);
    },

    remove(site, tag) {
      withTransaction(database, () => {
        deleteSubscriptionPosts.run(site, tag);
        deleteSubscription.run(site, tag);
      });
    },

    record(site, tag, posts) {
      return withTransaction(database, () => {
        // 并发取消关注后不再写入，避免孤儿条目
        const state = findSubscription.get(site, tag) as StateRow | undefined;
        if (state === undefined) return { added: 0, unread: 0 };

        const initialized = state.initialized === 1;
        const lastSeen = state.last_seen_post_id;
        const now = Date.now();
        let added = 0;
        let unread = 0;
        let maxId = lastSeen;

        for (const post of posts) {
          upsertPost.run(
            site,
            post.id,
            post.md5,
            post.previewUrl,
            post.sampleUrl,
            post.fileUrl,
            post.width,
            post.height,
            post.fileSize,
            post.rating,
            post.score,
            JSON.stringify(post.tags),
            post.createdAt,
            now
          );
          const isUnread = initialized && post.id > lastSeen ? 1 : 0;
          if (changed(insertEntry.run(site, tag, post.id, now, isUnread)) > 0) {
            added += 1;
            unread += isUnread;
          }
          if (post.id > maxId) maxId = post.id;
        }

        updateSubscription.run(maxId, now, site, tag);
        pruneEntries.run(site, tag, site, tag, FOLLOW_KEEP_LIMIT);

        return { added, unread };
      });
    },

    markRead(site, options = {}) {
      const postIds = options.postIds;
      if (postIds !== undefined && postIds.length > 0) {
        const placeholders = postIds.map(() => '?').join(', ');
        const tagClause = options.tag === undefined ? '' : ' AND tag = ?';
        const sql =
          `UPDATE subscription_posts SET unread = 0 WHERE site = ? AND post_id IN (${placeholders})` +
          tagClause;
        const params: unknown[] = [site, ...postIds];
        if (options.tag !== undefined) params.push(options.tag);
        database.prepare(sql).run(...params);
        return;
      }
      if (options.tag !== undefined) {
        database
          .prepare('UPDATE subscription_posts SET unread = 0 WHERE site = ? AND tag = ?')
          .run(site, options.tag);
        return;
      }
      database.prepare('UPDATE subscription_posts SET unread = 0 WHERE site = ?').run(site);
    },

    entries(site) {
      const rows = listEntries.all(site) as EntryRow[];
      return rows.map((row) => ({
        tag: row.tag,
        post: toPost(row, site),
        firstSeenAt: row.first_seen_at,
        unread: row.unread === 1
      }));
    }
  };
}
