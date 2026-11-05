/**
 * 02 §14.3 / §6.2：三态角标顺序固定为 ✓ → ↓ → ★，最多 3 个。
 * 顺序与文案集中在此，避免组件内散落判断，也保证角标不随状态组合重排。
 */
export const BADGE_KINDS = ['viewed', 'downloaded', 'favorited'] as const;

export type BadgeKind = (typeof BADGE_KINDS)[number];

export const BADGE_LABELS: Record<BadgeKind, string> = {
  viewed: '已看过',
  downloaded: '已下载',
  favorited: '已收藏'
};

export const BADGE_GLYPHS: Record<BadgeKind, string> = {
  viewed: '✓',
  downloaded: '↓',
  favorited: '★'
};

export interface BadgeState {
  viewed?: boolean;
  downloaded?: boolean;
  favorited?: boolean;
}

export interface BadgeDescriptor {
  kind: BadgeKind;
  label: string;
  glyph: string;
}

/** 只返回有数据源的角标；状态全为 false 时返回空数组，调用方据此不渲染空角标 */
export function resolveBadges(state: BadgeState): BadgeDescriptor[] {
  const result: BadgeDescriptor[] = [];
  for (const kind of BADGE_KINDS) {
    if (state[kind] === true) {
      result.push({ kind, label: BADGE_LABELS[kind], glyph: BADGE_GLYPHS[kind] });
    }
  }
  return result;
}
