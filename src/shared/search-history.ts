/** 03 §6.1 / DR-055：搜索历史最多保留的条数，为全局上限 */
export const SEARCH_HISTORY_LIMIT = 50;

/**
 * 历史查询串归一化：去掉首尾空白并把连续空白折叠为单个空格。
 * 空白串视为无有效查询，返回 null（不写入历史）。
 */
export function normalizeSearchQuery(raw: string): string | null {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  return normalized === '' ? null : normalized;
}
