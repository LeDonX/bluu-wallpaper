import { type SqlDatabase, withTransaction } from '@main/storage/db';
import type { AnySiteId } from '@shared/constants';
import type { FavoriteEntry } from '@shared/favorites';
import { type Post, type PostTag, type Rating, RATINGS } from '@shared/models';
import { z } from 'zod';

/**
 * 02 §8 / 03 §6.2 / 07 DR-032：收藏的本地存取。
 * 收藏时把 Post 快照写入既有 `posts` 表，收藏页只读本地快照，不请求站点（避免限流）。
 */
export interface FavoritesStore {
  /** 已收藏则取消并返回 false，未收藏则写入快照与收藏记录并返回 true */
  toggle(site: AnySiteId, post: Post): boolean;
  /** 该站点全部收藏条目，按收藏时间降序 */
  list(site: AnySiteId): FavoriteEntry[];
}

interface FavoriteRow {
  post_id: number;
  added_at: number;
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
  source: string | null;
}

const TagsSchema = z.array(z.object({ name: z.string(), type: z.string() }));

function isRating(value: string | null): value is Rating {
  return value !== null && (RATINGS as readonly string[]).includes(value);
}

/** tags_json 损坏时按空标签处理，避免单条坏数据阻断整个收藏页 */
function parseTags(raw: string | null): PostTag[] {
  if (raw === null) return [];
  try {
    const parsed = TagsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function toPost(row: FavoriteRow, site: AnySiteId): Post {
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
    createdAt: row.created_at ?? 0,
    ...(row.source !== null && row.source !== '' ? { source: row.source } : {})
  };
}

const UPSERT_POST_SQL = `
INSERT INTO posts (
  site, post_id, md5, preview_url, sample_url, file_url,
  width, height, file_size, rating, score, tags_json, created_at, source, cached_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  source = excluded.source,
  cached_at = excluded.cached_at
`;

export function createFavoritesStore(database: SqlDatabase): FavoritesStore {
  const upsertPost = database.prepare(UPSERT_POST_SQL);
  const insertFavorite = database.prepare(
    'INSERT INTO favorites (site, post_id, added_at) VALUES (?, ?, ?)'
  );
  const deleteFavorite = database.prepare('DELETE FROM favorites WHERE site = ? AND post_id = ?');
  const findFavorite = database.prepare(
    'SELECT 1 AS found FROM favorites WHERE site = ? AND post_id = ?'
  );
  const listFavorites = database.prepare(
    `SELECT
      f.post_id, f.added_at, p.md5, p.preview_url, p.sample_url, p.file_url,
      p.width, p.height, p.file_size, p.rating, p.score, p.tags_json, p.created_at, p.source
    FROM favorites f
    LEFT JOIN posts p ON p.site = f.site AND p.post_id = f.post_id
    WHERE f.site = ?
    ORDER BY f.added_at DESC`
  );

  return {
    toggle(site, post) {
      return withTransaction(database, () => {
        if (findFavorite.get(site, post.id) !== undefined) {
          deleteFavorite.run(site, post.id);
          return false;
        }

        const now = Date.now();
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
          post.source ?? '',
          now
        );
        insertFavorite.run(site, post.id, now);
        return true;
      });
    },
    list(site) {
      const rows = listFavorites.all(site) as FavoriteRow[];
      return rows.map((row) => ({ post: toPost(row, site), addedAt: row.added_at }));
    }
  };
}
