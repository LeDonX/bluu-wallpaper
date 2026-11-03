/** 02 §2.4 / 07 DR-003：内容过滤配置，R18 默认关闭 */
export interface ContentConfig {
  allowExplicit: boolean;
}

export const DEFAULT_CONTENT_CONFIG: ContentConfig = { allowExplicit: false };

/** R18 关闭时自动附加的排除项；与 T-11 的 `-rating:` 语法一致 */
export const R18_FILTER_TOKEN = '-rating:e';

const RATING_INTENT_TOKEN = /^-?rating:/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function defaultContentConfig(): ContentConfig {
  return { ...DEFAULT_CONTENT_CONFIG };
}

/** 配置来自磁盘/用户，按 unknown 解析；缺失或非布尔值回落默认（关闭） */
export function parseContentConfig(raw: unknown): ContentConfig {
  if (!isRecord(raw)) return defaultContentConfig();
  const allowExplicit = raw['allowExplicit'];
  return { allowExplicit: typeof allowExplicit === 'boolean' ? allowExplicit : false };
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
