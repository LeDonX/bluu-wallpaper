import type { Post } from '@shared/models';

/** 02 §2.4 / 07 DR-003：内容过滤配置，R18 默认关闭 */
export interface ContentConfig {
  allowExplicit: boolean;
  /** 07 DR-056：全局排除标签，已归一化为小写并去重；搜索拼接 `-tag`，榜单本地过滤 */
  blacklist: string[];
}

export const DEFAULT_CONTENT_CONFIG: ContentConfig = { allowExplicit: false, blacklist: [] };

/** R18 关闭时自动附加的排除项；与 T-11 的 `-rating:` 语法一致 */
export const R18_FILTER_TOKEN = '-rating:e';

/** 黑名单上限，避免把整段查询塞进 URL */
export const MAX_BLACKLIST_TAGS = 100;

const RATING_INTENT_TOKEN = /^-?rating:/i;
const TAG_WHITESPACE = /\s/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function defaultContentConfig(): ContentConfig {
  return { ...DEFAULT_CONTENT_CONFIG, blacklist: [] };
}

/**
 * 单个黑名单项归一化：trim + 小写。
 * 返回 null 表示不是合法标签：空串、含空白、以 `-` 开头（应为正向标签）或含 `:`（元数据条件）。
 */
export function normalizeBlacklistTag(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value === '' || TAG_WHITESPACE.test(value) || value.startsWith('-') || value.includes(':')) {
    return null;
  }
  return value;
}

/** 归一化并去重（保留首次出现顺序），超过上限截断 */
export function normalizeBlacklist(raw: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = normalizeBlacklistTag(item);
    if (tag === null || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= MAX_BLACKLIST_TAGS) break;
  }
  return result;
}

/** 设置页文本 → 标签数组：按空白与逗号切分，非法项交由 `validateSettings` 反馈 */
export function splitBlacklistText(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** 配置来自磁盘/用户，按 unknown 解析；缺失或非法项忽略，回落为空黑名单 */
export function parseContentConfig(raw: unknown): ContentConfig {
  if (!isRecord(raw)) return defaultContentConfig();
  const allowExplicit = raw['allowExplicit'];
  const blacklist = raw['blacklist'];
  return {
    allowExplicit: typeof allowExplicit === 'boolean' ? allowExplicit : false,
    blacklist: Array.isArray(blacklist)
      ? normalizeBlacklist(blacklist.filter((item): item is string => typeof item === 'string'))
      : []
  };
}

export interface R18FilterResult {
  query: string;
  /** 本次是否自动附加了 `-rating:e`，供界面提示"已过滤 R18" */
  filtered: boolean;
}

/**
 * 02 §2.4：R18 关闭且用户未显式写 `rating:` 时自动附加 `-rating:e`。
 * 任何显式 rating token（正负向、单字符或全称）都视为用户意图，不再追加。
 */
export function applyR18Filter(raw: string, allowExplicit: boolean): R18FilterResult {
  const tokens = raw.split(/\s+/).filter((token) => token !== '');
  const hasRatingIntent = tokens.some((token) => RATING_INTENT_TOKEN.test(token));
  if (allowExplicit || hasRatingIntent) return { query: raw, filtered: false };

  return { query: [...tokens, R18_FILTER_TOKEN].join(' '), filtered: true };
}

export interface BlacklistFilterResult {
  query: string;
  /** 本次追加的 `-tag` 数量；0 表示未改动查询（含用户已显式排除的情况） */
  excluded: number;
}

/**
 * 07 DR-056：把黑名单拼成 `-tag` 追加到查询。
 * 与用户已写的 `-tag` 去重（大小写不敏感），不重复追加；空查询不处理。
 */
export function applyBlacklistFilter(raw: string, blacklist: readonly string[]): BlacklistFilterResult {
  if (blacklist.length === 0 || raw.trim() === '') return { query: raw, excluded: 0 };

  const tokens = raw.split(/\s+/).filter((token) => token !== '');
  const existing = new Set(tokens.map((token) => token.toLowerCase()));
  const appended: string[] = [];
  for (const tag of blacklist) {
    const token = `-${tag}`;
    if (existing.has(token)) continue;
    existing.add(token);
    appended.push(token);
  }

  if (appended.length === 0) return { query: raw, excluded: 0 };
  return { query: [...tokens, ...appended].join(' '), excluded: appended.length };
}

/** 07 DR-056：榜单端点不支持 tags，命中任一黑名单标签时本地丢弃 */
export function isPostBlacklisted(
  post: Pick<Post, 'tags'>,
  blacklist: readonly string[]
): boolean {
  if (blacklist.length === 0) return false;
  return post.tags.some((tag) => blacklist.includes(tag.name.toLowerCase()));
}
