import { AppErrorException, createAppError } from '@shared/errors';
import type { Rating } from '@shared/models';

const RATING_ALIASES: Record<string, Rating> = {
  s: 'safe',
  q: 'questionable',
  e: 'explicit',
  safe: 'safe',
  questionable: 'questionable',
  explicit: 'explicit'
};

export const ORDER_KEYS = ['score', 'fav', 'random'] as const;
export type OrderKey = (typeof ORDER_KEYS)[number];

export type ComparisonOperator = '>=' | '>' | '<=' | '<' | '=';

export interface NumericComparison {
  op: ComparisonOperator;
  value: number;
}

/** 查询解析结果；`raw` 保留用户原文，供 T-12 拼 `id:` 游标翻页 */
export interface ParsedQuery {
  raw: string;
  tags: string[];
  excludedTags: string[];
  ratings: Rating[];
  excludedRatings: Rating[];
  scores: NumericComparison[];
  widths: NumericComparison[];
  ids: number[];
  order: OrderKey | null;
}

/** 03 §5.3：解析失败抛 QueryError，由渲染层展示且不发起请求 */
export class QueryError extends AppErrorException {
  constructor(message: string, detail?: string) {
    super(createAppError('PARSE', message, detail === undefined ? {} : { detail }));
    this.name = 'QueryError';
  }
}

const COMPARISON_PATTERN = /^(>=|<=|>|<|=)?(-?\d+)$/;
const PREFIX_PATTERN = /^([A-Za-z_]+):([\s\S]*)$/;

const isKnownPrefix = (prefix: string): boolean =>
  ['rating', 'score', 'width', 'order', 'id'].includes(prefix);

function parseComparison(
  body: string,
  token: string,
  field: 'score' | 'width'
): NumericComparison {
  const match = COMPARISON_PATTERN.exec(body);
  const value = match?.[2] === undefined ? undefined : Number(match[2]);
  if (!match || value === undefined || !Number.isSafeInteger(value)) {
    throw new QueryError(`${field} 比较式无效，应为 ${field}:>=100 形式`, token);
  }
  return { op: (match[1] as ComparisonOperator | undefined) ?? '=', value };
}

function parseRating(body: string, token: string): Rating {
  const normalized = body.toLowerCase();
  if (normalized === '') throw new QueryError('rating 缺少值，仅支持 s / q / e', token);
  const rating = RATING_ALIASES[normalized];
  if (rating === undefined) {
    throw new QueryError(`未知分级 "${normalized}"，仅支持 s / q / e`, token);
  }
  return rating;
}

function parseOrder(body: string, token: string): OrderKey {
  const normalized = body.toLowerCase();
  if (!(ORDER_KEYS as readonly string[]).includes(normalized)) {
    throw new QueryError(`未知排序 "${normalized}"，仅支持 score / fav / random`, token);
  }
  return normalized as OrderKey;
}

function parseId(body: string, token: string): number {
  const id = /^\d+$/.test(body) ? Number(body) : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new QueryError(`id 必须是正整数：${token}`, token);
  }
  return id;
}

function parseToken(token: string, result: ParsedQuery): void {
  const negated = token.startsWith('-');
  const body = negated ? token.slice(1) : token;
  if (body === '') throw new QueryError('"-" 后缺少标签名', token);

  const match = PREFIX_PATTERN.exec(body);
  const prefix = match?.[1]?.toLowerCase();
  const value = match?.[2] ?? '';
  const known = match !== null && prefix !== undefined && isKnownPrefix(prefix);

  if (!known) {
    // 非内置前缀（含 `tag:` 一类站点标签）按普通标签处理，保持与原站一致
    const target = negated ? result.excludedTags : result.tags;
    target.push(body.toLowerCase());
    return;
  }

  if (negated) {
    // `-rating:e` 为 T-16 的 R18 过滤语法，需要保留分级语义；其余负向形式不支持
    if (prefix === 'rating') {
      result.excludedRatings.push(parseRating(value, token));
      return;
    }
    throw new QueryError(`暂不支持排除式 "${prefix}:"，请改用普通标签`, token);
  }

  switch (prefix) {
    case 'rating':
      result.ratings.push(parseRating(value, token));
      break;
    case 'score':
      result.scores.push(parseComparison(value, token, 'score'));
      break;
    case 'width':
      result.widths.push(parseComparison(value, token, 'width'));
      break;
    case 'order':
      if (result.order !== null) throw new QueryError('order 只能指定一次', token);
      result.order = parseOrder(value, token);
      break;
    case 'id':
      result.ids.push(parseId(value, token));
      break;
  }
}

/** 解析 02 §2.4 的搜索语法；空串返回空查询（是否允许提交由调用方决定） */
export function parseQuery(input: string): ParsedQuery {
  const raw = input.trim();
  const result: ParsedQuery = {
    raw,
    tags: [],
    excludedTags: [],
    ratings: [],
    excludedRatings: [],
    scores: [],
    widths: [],
    ids: [],
    order: null
  };
  if (raw === '') return result;

  for (const token of raw.split(/\s+/)) {
    parseToken(token, result);
  }
  return result;
}
