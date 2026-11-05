import { BADGE_GLYPHS, BADGE_LABELS, resolveBadges } from '@shared/badges';
import { describe, expect, it } from 'vitest';

describe('resolveBadges 三态角标', () => {
  it('无任何状态时不渲染角标', () => {
    expect(resolveBadges({})).toEqual([]);
    expect(resolveBadges({ viewed: false, downloaded: false, favorited: false })).toEqual([]);
  });

  it('仅已看时只返回 ✓（02 §6.2：不出现空角标）', () => {
    expect(resolveBadges({ viewed: true })).toEqual([
      { kind: 'viewed', label: BADGE_LABELS.viewed, glyph: BADGE_GLYPHS.viewed }
    ]);
  });

  it('三态齐全时顺序固定为 ✓ → ↓ → ★（02 §14.3）', () => {
    const badges = resolveBadges({ viewed: true, downloaded: true, favorited: true });
    expect(badges.map((badge) => badge.kind)).toEqual(['viewed', 'downloaded', 'favorited']);
    expect(badges.map((badge) => badge.glyph)).toEqual(['✓', '↓', '★']);
  });

  it('部分组合也保持固定顺序，不随状态传入顺序重排', () => {
    expect(resolveBadges({ favorited: true, viewed: true }).map((badge) => badge.kind)).toEqual([
      'viewed',
      'favorited'
    ]);
    expect(resolveBadges({ favorited: true, downloaded: true }).map((badge) => badge.kind)).toEqual(
      ['downloaded', 'favorited']
    );
  });

  it('每枚角标都有非空的 aria-label 文案（02 §13）', () => {
    for (const badge of resolveBadges({ viewed: true, downloaded: true, favorited: true })) {
      expect(badge.label.length).toBeGreaterThan(0);
    }
  });
});
