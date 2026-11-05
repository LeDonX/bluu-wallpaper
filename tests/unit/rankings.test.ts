import {
  buildRankingPath,
  formatRankingDateInput,
  parseRankingDateInput,
  RANKING_LABELS,
  rankingNeedsDate,
  rankingSupportsPaging,
  todayRankingDate
} from '@shared/rankings';
import { describe, expect, it } from 'vitest';

const date = { year: 2026, month: 11, day: 4 };

describe('榜单类型与日期规则（02 §4 / DR-041）', () => {
  it('四个入口标签与日期/翻页能力', () => {
    expect(RANKING_LABELS).toEqual({ popular: '热门', day: '日榜', week: '周榜', month: '月榜' });
    expect(rankingNeedsDate('popular')).toBe(false);
    expect(rankingNeedsDate('day')).toBe(true);
    expect(rankingNeedsDate('week')).toBe(true);
    expect(rankingNeedsDate('month')).toBe(true);
    // DR-008：热门固定 40 条且忽略 page
    expect(rankingSupportsPaging('popular')).toBe(false);
    expect(rankingSupportsPaging('day')).toBe(true);
  });
});

describe('buildRankingPath（03 §5.1）', () => {
  it('热门固定 period=1d，不带 limit/page', () => {
    expect(buildRankingPath('popular', undefined, 2)).toBe('/post/popular_recent.json?period=1d');
  });

  it('日榜带 year/month/day 与 limit/page', () => {
    expect(buildRankingPath('day', date, 3)).toBe(
      '/post/popular_by_day.json?year=2026&month=11&day=4&limit=100&page=3'
    );
  });

  it('周榜与日榜同参数结构', () => {
    expect(buildRankingPath('week', date, 1)).toBe(
      '/post/popular_by_week.json?year=2026&month=11&day=4&limit=100&page=1'
    );
  });

  it('月榜不携带 day', () => {
    expect(buildRankingPath('month', date, 1)).toBe(
      '/post/popular_by_month.json?year=2026&month=11&limit=100&page=1'
    );
  });

  it('期榜缺失日期时抛错（由 handler 的 zod 提前拦截）', () => {
    expect(() => buildRankingPath('day', undefined, 1)).toThrow('榜单日期缺失');
  });
});

describe('日期输入辅助', () => {
  it('格式化与解析往返一致', () => {
    expect(formatRankingDateInput(date)).toBe('2026-11-04');
    expect(parseRankingDateInput('2026-11-04')).toEqual(date);
  });

  it('非法格式与不存在的日期返回 null', () => {
    expect(parseRankingDateInput('2026-11-4')).toBeNull();
    expect(parseRankingDateInput('2026-02-30')).toBeNull();
    expect(parseRankingDateInput('')).toBeNull();
  });

  it('todayRankingDate 使用本地年月日', () => {
    expect(todayRankingDate(new Date(2026, 10, 4, 23, 59))).toEqual(date);
  });
});
