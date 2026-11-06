/**
 * 02 §4 / 03 §5.1：榜单类型与请求路径。
 * DR-041：日期用可序列化的 `{year, month, day}`，避免 `Date` 跨 IPC（05 §5）。
 */
export const RANKING_KINDS = ['popular', 'day', 'week', 'month'] as const;
export type RankingKind = (typeof RANKING_KINDS)[number];

export interface RankingDate {
  year: number;
  month: number;
  day: number;
}

export const RANKING_LABELS: Record<RankingKind, string> = {
  popular: '热门',
  day: '日榜',
  week: '周榜',
  month: '月榜'
};

/** 06 §2：limit 最大 100 */
export const RANKING_PAGE_LIMIT = 100;

/** 02 §4：日期选择器只对日/周/月榜显示 */
export function rankingNeedsDate(kind: RankingKind): boolean {
  return kind !== 'popular';
}

/** DR-008 / DR-041：popular_recent 固定 40 条且忽略 limit/page，只能取第 1 页 */
export function rankingSupportsPaging(kind: RankingKind): boolean {
  return kind !== 'popular';
}

/**
 * 期榜的日期区间：日=当天、周=该周周一至周日、月=当月 1 日至月末。
 * 周按 ISO 8601 计算，保证与界面「年 + 周数」的语义一致。
 */
function rankingDateRange(
  kind: Exclude<RankingKind, 'popular'>,
  date: RankingDate
): { from: RankingDate; to: RankingDate } {
  if (kind === 'day') return { from: date, to: date };
  if (kind === 'week') {
    const { year, week } = isoWeekOf(date);
    const monday = dateFromIsoWeek(year, week);
    return { from: monday, to: shiftRankingDate(monday, 6) };
  }
  const lastDay = new Date(date.year, date.month, 0).getDate();
  return {
    from: { year: date.year, month: date.month, day: 1 },
    to: { year: date.year, month: date.month, day: lastDay }
  };
}

/**
 * 03 §5.1 的端点映射。`popular` 固定 `period=1d`（02 §4 无周期选择）。
 * DR-092：`popular_by_day/week/month` 实测固定返回 40 条且忽略 `limit`/`page`，
 * 期榜改用 `/post.json` 的 `date:` 区间 + `order:score`，既能返回当期全部作品，也能继续翻页。
 */
export function buildRankingPath(
  kind: RankingKind,
  date: RankingDate | undefined,
  page = 1,
  limit = RANKING_PAGE_LIMIT
): string {
  if (kind === 'popular') return '/post/popular_recent.json?period=1d';
  if (date === undefined) throw new Error('榜单日期缺失');

  const { from, to } = rankingDateRange(kind, date);
  const fromText = formatRankingDateInput(from);
  const toText = formatRankingDateInput(to);
  const dateExpr = fromText === toText ? `date:${fromText}` : `date:${fromText}..${toText}`;
  const tags = `${dateExpr} order:score`;
  return `/post.json?tags=${encodeURIComponent(tags)}&limit=${limit}&page=${page}`;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 本地时区的"今天"，供日期选择器默认值与上限使用 */
export function todayRankingDate(now: Date = new Date()): RankingDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** 日历日期加减天数（跨月/跨年由 Date 自动进位） */
export function shiftRankingDate(date: RankingDate, days: number): RankingDate {
  const next = new Date(date.year, date.month - 1, date.day + days);
  return { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
}

/**
 * ISO 8601 周：周一为一周开始，跨年时返回该周所属的周历年份。
 * 周榜以「年 + 周数」选择，请求时再换算为周内的周一日期。
 */
export function isoWeekOf(date: RankingDate): { year: number; week: number } {
  const target = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const dayNumber = target.getUTCDay() || 7;
  // 移到本周周四，避免跨年时周数归属错误
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const weekYear = target.getUTCFullYear();
  const yearStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((target.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: weekYear, week };
}

/** ISO 周 → 该周周一的日历日期 */
export function dateFromIsoWeek(weekYear: number, week: number): RankingDate {
  const jan4 = new Date(weekYear, 0, 4);
  const dayNumber = jan4.getDay() || 7;
  const monday = new Date(weekYear, 0, 4 - (dayNumber - 1) + (week - 1) * 7);
  return { year: monday.getFullYear(), month: monday.getMonth() + 1, day: monday.getDate() };
}

/** 某周历年份的 ISO 周数（52 或 53） */
export function isoWeeksInYear(weekYear: number): number {
  return isoWeekOf({ year: weekYear, month: 12, day: 28 }).week;
}

/**
 * 切到日/周/月榜时默认展示上一个完整周期（昨天 / 上周 / 上月），
 * 避免把进行中的当天、本周、本月当成完整期榜单导致结果偏少。
 */
export function defaultRankingDate(kind: RankingKind, now: Date = new Date()): RankingDate {
  const today = todayRankingDate(now);
  if (kind === 'day') return shiftRankingDate(today, -1);
  if (kind === 'week') {
    const { year, week } = isoWeekOf(today);
    return shiftRankingDate(dateFromIsoWeek(year, week), -7);
  }
  if (kind === 'month') {
    const previous = new Date(today.year, today.month - 2, 1);
    return { year: previous.getFullYear(), month: previous.getMonth() + 1, day: 1 };
  }
  return today;
}

/** 计数行展示的期标签：日榜日期 / 周榜周数 / 月榜月份 */
export function formatRankingPeriodLabel(kind: RankingKind, date: RankingDate): string {
  if (kind === 'day') return formatRankingDateInput(date);
  if (kind === 'week') {
    const { year, week } = isoWeekOf(date);
    return `${year} 年第 ${week} 周`;
  }
  if (kind === 'month') return `${date.year}-${pad2(date.month)}`;
  return '';
}

/** 与 `<input type="date">` 的 value 格式一致 */
export function formatRankingDateInput(date: RankingDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

/** 非法格式或不存在日期返回 null；日期选择器只读取合法值 */
export function parseRankingDateInput(value: string): RankingDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return null;

  const year = Number(match[1] ?? '');
  const month = Number(match[2] ?? '');
  const day = Number(match[3] ?? '');
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}
