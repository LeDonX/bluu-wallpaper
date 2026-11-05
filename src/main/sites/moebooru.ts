import type { HttpClient } from '@main/network/http';
import type { ParsedQuery } from '@main/sites/query';
import type { SiteId } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import {
  type Post,
  type PostPage,
  type Rating,
  type SearchCursor,
  type TagSuggestion,
  tagTypeFromCode
} from '@shared/models';
import {
  buildRankingPath,
  type RankingDate,
  type RankingKind,
  rankingSupportsPaging
} from '@shared/rankings';
import { siteBaseUrl } from '@shared/sites';
import { z } from 'zod';

/** 06 §2：limit 最大 100 */
export const MOEBOORU_PAGE_LIMIT = 100;

/** 02 §3 / 03 §5.1：联想每次最多 10 条 */
export const MOEBOORU_TAG_LIMIT = 10;

const RATING_MAP: Record<string, Rating> = {
  s: 'safe',
  q: 'questionable',
  e: 'explicit'
};

/** 只声明适配器真正消费的字段，其余响应字段由 zod 忽略 */
const RawPostSchema = z.object({
  id: z.number(),
  md5: z.string(),
  rating: z.string(),
  score: z.number(),
  tags: z.string(),
  file_url: z.string(),
  jpeg_url: z.string().nullish(),
  jpeg_file_size: z.number().nullish(),
  sample_url: z.string(),
  preview_url: z.string(),
  width: z.number(),
  height: z.number(),
  file_size: z.number(),
  created_at: z.number(),
  status: z.string(),
  source: z.string().nullish()
});

type RawPost = z.infer<typeof RawPostSchema>;

const PostsSchema = z.array(RawPostSchema);

/** 06 §4：只声明联想展示需要的字段，`type` 为整数 */
const RawTagSchema = z.object({
  id: z.number(),
  name: z.string(),
  count: z.number(),
  type: z.number()
});

const TagsSchema = z.array(RawTagSchema);

const parseError = (detail: string): AppErrorException =>
  new AppErrorException(createAppError('PARSE', '站点返回数据结构异常', { detail }));

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw parseError(error instanceof Error ? error.message : String(error));
  }
}

const parseBody = (body: string): RawPost[] => {
  const parsed = PostsSchema.safeParse(parseJson(body));
  if (!parsed.success) {
    throw parseError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
};

const parseTagBody = (body: string): z.infer<typeof RawTagSchema>[] => {
  const parsed = TagsSchema.safeParse(parseJson(body));
  if (!parsed.success) {
    throw parseError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
};

const normalizePost = (raw: RawPost, site: SiteId): Post => {
  // 06 §3 归一化规则 1：rating 单字符映射为全称
  const rating = RATING_MAP[raw.rating];
  if (rating === undefined) throw parseError(`post ${raw.id} 的 rating 未知：${raw.rating}`);

  const post: Post = {
    site,
    id: raw.id,
    md5: raw.md5,
    previewUrl: raw.preview_url,
    sampleUrl: raw.sample_url,
    fileUrl: raw.file_url,
    jpegUrl: raw.jpeg_url ?? '',
    jpegFileSize: raw.jpeg_file_size ?? 0,
    width: raw.width,
    height: raw.height,
    fileSize: raw.file_size,
    rating,
    score: raw.score,
    // tag 类型需 /tag.json 补充；当前没有缓存时按 general 处理（03 §5.2）
    tags: raw.tags
      .split(/\s+/)
      .filter((name) => name !== '')
      .map((name) => ({ name, type: 'general' })),
    // 06 §3 归一化规则 2：created_at 为 epoch 秒，×1000 得到毫秒
    createdAt: raw.created_at * 1000
  };
  if (typeof raw.source === 'string') post.source = raw.source;
  return post;
};

/**
 * 03 §5.3：用解析结果里的 `raw` 原文拼 tags，避免重排用户查询；
 * id: 游标追加在后，保持服务端“相对上次结果继续取”的语义。
 */
export function buildTags(query: ParsedQuery, cursor?: SearchCursor): string {
  const cursorTag = cursor !== undefined && 'lastId' in cursor ? `id:${cursor.lastId}` : '';
  return [query.raw, cursorTag].filter((part) => part !== '').join(' ');
}

export function buildSearchPath(
  query: ParsedQuery,
  cursor: SearchCursor | undefined,
  limit: number
): string {
  const params: string[] = [];
  const tags = buildTags(query, cursor);
  if (tags !== '') params.push(`tags=${encodeURIComponent(tags)}`);
  params.push(`limit=${limit}`);
  // id: 游标本身就是第一页的本地游标，不再叠加页码（06 §5）
  if (cursor === undefined || 'page' in cursor) {
    params.push(`page=${cursor === undefined ? 1 : cursor.page}`);
  }
  return `/post.json?${params.join('&')}`;
}

export interface MoebooruAdapterOptions {
  site: SiteId;
  client: HttpClient;
  /** 默认取 `siteBaseUrl`，便于本地 mock 或单测替换 */
  baseUrl?: string;
  pageLimit?: number;
}

export interface MoebooruAdapter {
  readonly id: SiteId;
  readonly baseUrl: string;
  search(query: ParsedQuery, cursor?: SearchCursor): Promise<PostPage>;
  /** DR-041：热门固定单页；期榜按日期请求，`date` 缺失时抛错 */
  rankings(
    kind: RankingKind,
    date: RankingDate | undefined,
    cursor?: SearchCursor
  ): Promise<PostPage>;
  suggestTags(prefix: string, limit?: number): Promise<TagSuggestion[]>;
}

/** 06 §4：`/tag.json?name=<prefix>*` 前缀通配；limit 默认 10 条 */
export function buildTagSuggestPath(prefix: string, limit: number): string {
  return `/tag.json?name=${encodeURIComponent(`${prefix}*`)}&limit=${limit}`;
}

/** moebooru 公共适配器；konachan 后续复用，仅替换网络通道（T-28） */
export function createMoebooruAdapter(options: MoebooruAdapterOptions): MoebooruAdapter {
  const { site, client } = options;
  const baseUrl = options.baseUrl ?? siteBaseUrl(site);
  const limit = options.pageLimit ?? MOEBOORU_PAGE_LIMIT;

  return {
    id: site,
    baseUrl,
    async search(query, cursor) {
      const page = cursor !== undefined && 'page' in cursor ? cursor.page : 1;
      const result = await client.request(buildSearchPath(query, cursor, limit));
      if (!result.ok) throw new AppErrorException(result.error);

      const posts = parseBody(result.data.body)
        // 06 §3 归一化规则 3：非 active 条目丢弃
        .filter((raw) => raw.status === 'active')
        .map((raw) => normalizePost(raw, site));

      return { posts, page, lastId: posts[posts.length - 1]?.id ?? null };
    },
    async rankings(kind, date, cursor) {
      // DR-041：热门忽略 page，只取第 1 页；期榜按 page 请求
      const requestedPage = cursor !== undefined && 'page' in cursor ? cursor.page : 1;
      const page = rankingSupportsPaging(kind) ? requestedPage : 1;
      const result = await client.request(buildRankingPath(kind, date, page, limit));
      if (!result.ok) throw new AppErrorException(result.error);

      const posts = parseBody(result.data.body)
        .filter((raw) => raw.status === 'active')
        .map((raw) => normalizePost(raw, site));

      return { posts, page, lastId: posts[posts.length - 1]?.id ?? null };
    },
    async suggestTags(prefix, limit = MOEBOORU_TAG_LIMIT) {
      const result = await client.request(buildTagSuggestPath(prefix, limit));
      if (!result.ok) throw new AppErrorException(result.error);

      // 06 §4：type 为整数，未知值按 general 处理
      return parseTagBody(result.data.body).map((raw) => ({
        name: raw.name,
        type: tagTypeFromCode(raw.type),
        count: raw.count
      }));
    }
  };
}
