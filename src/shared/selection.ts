import type { Post } from '@shared/models';

/** 02 §7.1 / DR-038：选中键与站点绑定，虚拟网格行回收后仍能恢复选中态 */
export function postSelectionKey(post: Pick<Post, 'site' | 'id'>): string {
  return `${post.site}:${post.id}`;
}

/** 点击单项：已有则移除，否则加入；不修改入参集合 */
export function toggleSelectionKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * `Shift` 连选：把 `fromKey → toKey` 之间的可见项并入选中集合（含两端，方向无关）。
 * 锚点或目标不在当前可见列表时保持原集合，避免隐藏已看后误选。
 */
export function selectKeyRange(
  keys: ReadonlySet<string>,
  orderedKeys: readonly string[],
  fromKey: string,
  toKey: string
): ReadonlySet<string> {
  const from = orderedKeys.indexOf(fromKey);
  const to = orderedKeys.indexOf(toKey);
  if (from < 0 || to < 0) return keys;

  const next = new Set(keys);
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  for (let index = start; index <= end; index += 1) {
    const key = orderedKeys[index];
    if (key !== undefined) next.add(key);
  }
  return next;
}
