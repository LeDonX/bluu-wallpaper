import type { Post } from '@shared/models';

const postKey = (post: Post): string => `${post.site}:${post.id}`;

/** 02 §6.3：隐藏已看时，连续自动补页无未看项的上限 */
export const MAX_AUTO_FILL_PAGES = 5;

/** 02 §6.3：隐藏已看的补页进度，`skipped` 为连续空补页中跳过的已看数量 */
export interface FillProgress {
  streak: number;
  skipped: number;
}

export const INITIAL_FILL_PROGRESS: FillProgress = { streak: 0, skipped: 0 };

/**
 * 02 §6.3 补页统计：某页出现任一未看项即重置连续计数；
 * 空页（站点结果已耗尽）不改变进度，避免误判为"无未看项"。
 */
export function advanceFillProgress(
  previous: FillProgress,
  pagePostCount: number,
  viewedCount: number
): FillProgress {
  if (pagePostCount === 0) return previous;
  if (pagePostCount > viewedCount) return INITIAL_FILL_PROGRESS;
  return {
    streak: previous.streak + 1,
    skipped: previous.skipped + viewedCount
  };
}

export function isAutoFillExhausted(progress: FillProgress): boolean {
  return progress.streak >= MAX_AUTO_FILL_PAGES;
}

/** 02 §2.1 / §6.3：过滤只在渲染层派生，不改变已加载数据与站点查询 */
export function filterUnviewed(posts: readonly Post[], viewedIds: ReadonlySet<number>): Post[] {
  return posts.filter((post) => !viewedIds.has(post.id));
}

/**
 * 翻页合并：按 `site + id` 去重，保留已有顺序，仅追加新条目。
 * 站点按 page 深翻可能返回重复项，渲染层必须去重（09 TC-12）。
 */
export function mergePosts(current: readonly Post[], incoming: readonly Post[]): Post[] {
  const seen = new Set(current.map(postKey));
  const merged = [...current];

  for (const post of incoming) {
    const key = postKey(post);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(post);
  }

  return merged;
}
