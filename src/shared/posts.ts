import type { Post } from '@shared/models';

const postKey = (post: Post): string => `${post.site}:${post.id}`;

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
