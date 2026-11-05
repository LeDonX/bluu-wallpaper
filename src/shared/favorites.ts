import type { Post } from '@shared/models';

/** 03 §7 / 02 §8：收藏页排序方式 */
export const FAVORITE_SORTS = ['added', 'score'] as const;

export type FavoriteSort = (typeof FAVORITE_SORTS)[number];

/** 收藏条目：Post 快照 + 收藏时间（epoch 毫秒） */
export interface FavoriteEntry {
  post: Post;
  addedAt: number;
}

/** 02 §8：标签二次筛选按空格分词，全部分词命中才保留 */
export function favoriteQueryTokens(query: string | undefined): string[] {
  if (query === undefined) return [];
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '');
}

export function matchesFavoriteQuery(post: Post, query: string | undefined): boolean {
  const tokens = favoriteQueryTokens(query);
  if (tokens.length === 0) return true;
  const names = new Set(post.tags.map((tag) => tag.name.toLowerCase()));
  return tokens.every((token) => names.has(token));
}

/** 按收藏时间或评分降序；同值时以收藏时间、再以 id 兜底，保证顺序稳定 */
export function sortFavoriteEntries(
  entries: readonly FavoriteEntry[],
  sort: FavoriteSort
): FavoriteEntry[] {
  return [...entries].sort((left, right) => {
    if (sort === 'score' && left.post.score !== right.post.score) {
      return right.post.score - left.post.score;
    }
    if (left.addedAt !== right.addedAt) return right.addedAt - left.addedAt;
    return right.post.id - left.post.id;
  });
}
