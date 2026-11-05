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
 * 03 §5.1 的端点映射。`popular` 固定 `period=1d`（02 §4 无周期选择）；
 * 期榜使用 `Date` 的 year/month/day，其中月榜不带 day。
 */
export function buildRankingPath(
  kind: RankingKind,
  date: RankingDate | undefined,
  page = 1,
  limit = RANKING_PAGE_LIMIT
): string {
  if (kind === 'popular') return '/post/popular_recent.json?period=1d';
  if (date === undefined) throw new Error('榜单日期缺失');

  const params = [`year=${date.year}`, `month=${date.month}`];
  if (kind !== 'month') params.push(`day=${date.day}`);
  params.push(`limit=${limit}`, `page=${page}`);
  return `/post/popular_by_${kind}.json?${params.join('&')}`;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 本地时区的"今天"，供日期选择器默认值与 max 使用 */
export function todayRankingDate(now: Date = new Date()): RankingDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
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
