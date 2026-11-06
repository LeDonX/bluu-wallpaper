import type { HttpClient } from '@main/network/http';
import type { NumericComparison, OrderKey, ParsedQuery } from '@main/sites/query';
import type { SiteAdapter } from '@main/sites/types';
import { type AppError, AppErrorException, createAppError } from '@shared/errors';
import type { Post, PostPage, Rating, SearchCursor } from '@shared/models';
import { siteBaseUrl } from '@shared/sites';
import { z } from 'zod';

/**
 * 04 §M6 / T-50：wallhaven `/api/v1/search` 适配器。
 * 06 §3 的归一化约定同样适用：rating 转全称、created_at 转 epoch 毫秒、缺失 md5 置空串。
 */

/** wallhaven 的 purity 位顺序固定为 SFW / sketchy / NSFW */
const PURITY_ORDER: readonly Rating[] = ['safe', 'questionable', 'explicit'];

const PURITY_TO_RATING: Record<string, Rating> = {
  '100': 'safe',
  '010': 'questionable',
  '001': 'explicit'
};

/** 02 §2.4 的排序语法 → wallhaven sorting；未指定或 score 时按相关度 */
const ORDER_TO_SORTING: Record<OrderKey, string> = {
  score: 'relevance',
  fav: 'favorites',
  random: 'random'
};

/** 1080P 以上的常用档位；其余宽度按 16:9 推导 */
const ATLEAST_PRESETS: readonly { min: number; value: string }[] = [
  { min: 3840, value: '3840x2160' },
  { min: 2560, value: '2560x1440' },
  { min: 1920, value: '1920x1080' }
];

/** 只声明适配器真正消费的字段，其余响应字段由 zod 忽略 */
const RawPostSchema = z.object({
  id: z.string().min(1),
  purity: z.string(),
  dimension_x: z.number(),
  dimension_y: z.number(),
  file_size: z.number(),
  created_at: z.string(),
  path: z.string(),
  source: z.string().nullish(),
  favorites: z.number().optional(),
  thumbs: z.object({
    large: z.string(),
    original: z.string()
  })
});

const SearchSchema = z.object({ data: z.array(RawPostSchema) });

type RawPost = z.infer<typeof RawPostSchema>;

const parseError = (detail: string): AppErrorException =>
  new AppErrorException(createAppError('PARSE', '站点返回数据结构异常', { detail }));

function parseBody(body: string): RawPost[] {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (error) {
    throw parseError(error instanceof Error ? error.message : String(error));
  }
  const parsed = SearchSchema.safeParse(json);
  if (!parsed.success) {
    throw parseError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data.data;
}

/**
 * `q` 只下发普通标签与排除标签；rating/score/width/order 等元数据
 * 已分别映射为 purity / atleast / sorting，不能原样拼进 wallhaven 的 q。
 */
function queryText(query: ParsedQuery): string {
  const parts = [...query.tags, ...query.excludedTags.map((tag) => `-${tag}`)];
  return parts.join(' ');
}

/**
 * R18 映射：用户显式 `rating:` 时按位合并；
 * 否则 R18 关闭（handler 追加了 `-rating:e`）只保留 SFW，R18 开启时三档全开。
 */
export function wallhavenPurity(query: ParsedQuery): string {
  const included = new Set<Rating>(query.ratings);
  if (query.ratings.length === 0) {
    const allowed = query.excludedRatings.includes('explicit')
      ? (['safe'] as const)
      : PURITY_ORDER;
    for (const rating of allowed) included.add(rating);
  } else {
    for (const rating of query.excludedRatings) included.delete(rating);
  }
  return PURITY_ORDER.map((rating) => (included.has(rating) ? '1' : '0')).join('');
}

/**
 * `width:>=1920` 一类比较式映射为 `atleast`。
 * 取所有下界里最严格的一个；>=1920/2560/3840 用标准档位，其余按 16:9 推导偶数高度。
 */
export function wallhavenAtleast(widths: readonly NumericComparison[]): string | null {
  let minimum: number | null = null;
  for (const item of widths) {
    if (item.op !== '>=' && item.op !== '>' && item.op !== '=') continue;
    const value = item.op === '>' ? item.value + 1 : item.value;
    minimum = minimum === null ? value : Math.max(minimum, value);
  }
  if (minimum === null || minimum <= 0) return null;

  const min = minimum;
  const preset = ATLEAST_PRESETS.find((item) => min >= item.min);
  if (preset !== undefined) return preset.value;
  const height = Math.max(2, Math.round((min * 9) / 16 / 2) * 2);
  return `${min}x${height}`;
}

/** 查询串与分页；`lastId` 游标对 wallhaven 无意义，按第 1 页处理 */
export function buildWallhavenSearchPath(
  query: ParsedQuery,
  cursor?: SearchCursor
): string {
  const params: string[] = [];
  const q = queryText(query);
  if (q !== '') params.push(`q=${encodeURIComponent(q)}`);
  params.push(`purity=${wallhavenPurity(query)}`);
  params.push('categories=111');
  // DR-085：空查询即首页，按 24 小时热门排序
  if (q === '') {
    params.push('sorting=toplist', 'topRange=1d');
  } else {
    params.push(`sorting=${ORDER_TO_SORTING[query.order ?? 'score']}`);
  }
  const atleast = wallhavenAtleast(query.widths);
  if (atleast !== null) params.push(`atleast=${atleast}`);
  const page = cursor !== undefined && 'page' in cursor ? cursor.page : 1;
  params.push(`page=${page}`);
  return `/api/v1/search?${params.join('&')}`;
}

/**
 * wallhaven 的 id 为 6 位 base36 字符串，而本地 Post.id / 收藏与下载主键要求数字。
 * 用 base36 解码成安全整数；异常格式走稳定哈希兜底。
 */
export function wallhavenPostId(id: string): number {
  if (/^\d+$/.test(id)) {
    const numeric = Number(id);
    if (Number.isSafeInteger(numeric) && numeric > 0) return numeric;
  }
  if (/^[a-z0-9]+$/i.test(id)) {
    const decoded = Number.parseInt(id, 36);
    if (Number.isSafeInteger(decoded) && decoded > 0) return decoded;
  }
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 8_388_607;
  }
  return hash > 0 ? hash : 1;
}

/** wallhaven 的 `YYYY-MM-DD HH:mm:ss` 为 UTC 时间，转为本地统一的 epoch 毫秒 */
export function parseWallhavenDate(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePost(raw: RawPost): Post {
  const post: Post = {
    site: 'wallhaven',
    id: wallhavenPostId(raw.id),
    md5: '',
    previewUrl: raw.thumbs.large,
    sampleUrl: raw.thumbs.original,
    fileUrl: raw.path,
    width: raw.dimension_x,
    height: raw.dimension_y,
    fileSize: raw.file_size,
    // 06 §3：purity 的三种值映射为全称，未知值按 safe
    rating: PURITY_TO_RATING[raw.purity] ?? 'safe',
    score: raw.favorites ?? 0,
    // wallhaven 不提供标签，按 06 §3 的空标签约定处理
    tags: [],
    createdAt: parseWallhavenDate(raw.created_at)
  };
  const source = raw.source?.trim() ?? '';
  if (source !== '') post.source = source;
  return post;
}

/** 401 是密钥配置问题，429 需要更明确的 wallhaven 文案 */
function mapFailure(error: AppError): AppError {
  if (error.code === 'NETWORK' && error.detail === 'HTTP 401') {
    return createAppError('CONFIG', 'Wallhaven API 密钥无效，请在设置中重新填写', {
      detail: error.detail,
      retryable: false
    });
  }
  if (error.code === 'RATE_LIMITED') {
    return createAppError('RATE_LIMITED', 'Wallhaven 请求过于频繁（429），请稍后重试', {
      detail: error.detail
    });
  }
  return error;
}

export interface WallhavenAdapterOptions {
  client: HttpClient;
  /** 每次请求读取最新密钥；空白表示未配置 */
  getApiKey: () => string;
  /** 默认取 `siteBaseUrl('wallhaven')`，便于单测指向本地 mock */
  baseUrl?: string;
}

export function createWallhavenAdapter(options: WallhavenAdapterOptions): SiteAdapter {
  const { client, getApiKey } = options;
  const baseUrl = options.baseUrl ?? siteBaseUrl('wallhaven');

  return {
    id: 'wallhaven',
    baseUrl,
    async search(query, cursor): Promise<PostPage> {
      const apiKey = getApiKey().trim();
      if (apiKey === '') {
        throw new AppErrorException(
          createAppError('CONFIG', '请先在设置中配置 Wallhaven API Key', { retryable: false })
        );
      }

      const result = await client.request(buildWallhavenSearchPath(query, cursor), {
        headers: { 'X-API-Key': apiKey }
      });
      if (!result.ok) throw new AppErrorException(mapFailure(result.error));

      const posts = parseBody(result.data.body).map(normalizePost);
      // wallhaven 只有页码分页，不提供 id: 游标
      return {
        posts,
        page: cursor !== undefined && 'page' in cursor ? cursor.page : 1,
        lastId: null
      };
    }
  };
}
