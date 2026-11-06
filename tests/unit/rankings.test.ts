import {
  buildRankingPath,
  dateFromIsoWeek,
  defaultRankingDate,
  formatRankingDateInput,
  formatRankingPeriodLabel,
  isoWeekOf,
  isoWeeksInYear,
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

  it('日榜用 date: 单日 + order:score，可翻页', () => {
    expect(buildRankingPath('day', date, 3)).toBe(
      '/post.json?tags=date%3A2026-11-04%20order%3Ascore&limit=100&page=3'
    );
  });

  it('周榜取该周周一至周日的 date 区间', () => {
    expect(buildRankingPath('week', date, 1)).toBe(
      '/post.json?tags=date%3A2026-11-02..2026-11-08%20order%3Ascore&limit=100&page=1'
    );
  });

  it('周榜对周内任意一天都归一化为同一周区间', () => {
    expect(buildRankingPath('week', { year: 2026, month: 11, day: 8 }, 1)).toBe(
      '/post.json?tags=date%3A2026-11-02..2026-11-08%20order%3Ascore&limit=100&page=1'
    );
  });

  it('月榜为当月 1 日至月末，月末按实际天数计算', () => {
    expect(buildRankingPath('month', date, 1)).toBe(
      '/post.json?tags=date%3A2026-11-01..2026-11-30%20order%3Ascore&limit=100&page=1'
    );
    expect(buildRankingPath('month', { year: 2024, month: 2, day: 1 }, 2)).toBe(
      '/post.json?tags=date%3A2024-02-01..2024-02-29%20order%3Ascore&limit=100&page=2'
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

describe('周榜周数与期默认值（T-62 / DR-091）', () => {
  it('isoWeekOf 按 ISO 8601 归属周历年份', () => {
    expect(isoWeekOf({ year: 2026, month: 11, day: 6 })).toEqual({ year: 2026, week: 45 });
    expect(isoWeekOf({ year: 2026, month: 11, day: 2 })).toEqual({ year: 2026, week: 45 });
    // 2025-12-31 属于 2026 年第 1 周
    expect(isoWeekOf({ year: 2025, month: 12, day: 31 })).toEqual({ year: 2026, week: 1 });
  });

  it('dateFromIsoWeek 取该周周一', () => {
    expect(dateFromIsoWeek(2026, 45)).toEqual({ year: 2026, month: 11, day: 2 });
    expect(dateFromIsoWeek(2026, 1)).toEqual({ year: 2025, month: 12, day: 29 });
  });

  it('isoWeeksInYear 返回 52 或 53', () => {
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeeksInYear(2026)).toBe(53);
  });

  it('日/周/月榜默认取上一个完整周期', () => {
    const now = new Date(2026, 10, 6, 10, 0);
    expect(defaultRankingDate('day', now)).toEqual({ year: 2026, month: 11, day: 5 });
    // 2026-11-06 属于第 45 周（周一 11-02），上一周周一为 10-26
    expect(defaultRankingDate('week', now)).toEqual({ year: 2026, month: 10, day: 26 });
    expect(defaultRankingDate('month', now)).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it('计数行期标签', () => {
    expect(formatRankingPeriodLabel('day', { year: 2026, month: 11, day: 5 })).toBe('2026-11-05');
    expect(formatRankingPeriodLabel('week', { year: 2026, month: 11, day: 2 })).toBe(
      '2026 年第 45 周'
    );
    expect(formatRankingPeriodLabel('month', { year: 2026, month: 10, day: 1 })).toBe('2026-10');
    expect(formatRankingPeriodLabel('popular', { year: 2026, month: 11, day: 6 })).toBe('');
  });
});
