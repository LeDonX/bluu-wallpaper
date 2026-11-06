import type { HttpClient } from '@main/network/http';
import type { SiteAdapter } from '@main/sites/types';
import { type AppError, AppErrorException, createAppError } from '@shared/errors';
import type { Post, PostPage } from '@shared/models';
import { siteBaseUrl } from '@shared/sites';
import { z } from 'zod';

/**
 * 04 §M6 / T-52（07 DR-076）：Bing 每日壁纸适配器。
 * `HPImageArchive.aspx` 无需 API key，只提供最近 8 天；归一化遵循 06 §3：
 * 无 md5 置空串、无分级固定 safe、文件尺寸由固定 1920x1080 变体给出。
 */

/** Bing 接口最多返回 8 天，页面同样固定展示 8 张卡片 */
export const BING_DAILY_COUNT = 8;

/** 图片变体尺寸；预览取 400x240 减少首屏流量（DR-076） */
const PREVIEW_VARIANT = '400x240';
const FULL_VARIANT = '1920x1080';
const FULL_WIDTH = 1920;
const FULL_HEIGHT = 1080;

/** 只声明适配器真正消费的字段，其余响应字段由 zod 忽略 */
const RawImageSchema = z.object({
  startdate: z.string().optional(),
  enddate: z.string().optional(),
  urlbase: z.string().min(1),
  copyright: z.string().optional()
});

const ArchiveSchema = z.object({ images: z.array(RawImageSchema) });

type RawImage = z.infer<typeof RawImageSchema>;

const parseError = (detail: string): AppErrorException =>
  new AppErrorException(createAppError('PARSE', '站点返回数据结构异常', { detail }));

/** 地区参数固定 zh-CN，让 copyright 文案与日期习惯保持中文 */
export function buildBingDailyPath(count: number = BING_DAILY_COUNT): string {
  return `/HPImageArchive.aspx?format=js&idx=0&n=${count}&mkt=zh-CN`;
}

/** `YYYYMMDD` 按本地零点转 epoch 毫秒，避免渲染层按 UTC 格式化时出现跨日 */
export function parseBingDate(value: string | undefined): { id: number; createdAt: number } | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec((value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return { id: year * 10000 + month * 100 + day, createdAt: date.getTime() };
}

/** fileUrl 与查看器原图都取 1920x1080 变体；urlbase 已带 `?id=` 查询串，直接拼接后缀 */
function imageUrl(urlbase: string, variant: string): string {
  return `${siteBaseUrl('bing')}${urlbase}_${variant}.jpg`;
}

function normalizeImage(raw: RawImage): Post {
  const date = parseBingDate(raw.enddate ?? raw.startdate);
  if (date === null) {
    throw parseError('Bing 日期字段格式异常');
  }

  const post: Post = {
    site: 'bing',
    id: date.id,
    md5: '',
    previewUrl: imageUrl(raw.urlbase, PREVIEW_VARIANT),
    sampleUrl: imageUrl(raw.urlbase, FULL_VARIANT),
    fileUrl: imageUrl(raw.urlbase, FULL_VARIANT),
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    // Bing 不返回文件字节数
    fileSize: 0,
    rating: 'safe',
    // Bing 无评分字段
    score: 0,
    tags: [],
    createdAt: date.createdAt
  };
  const copyright = raw.copyright?.trim();
  if (copyright !== undefined && copyright !== '') post.source = copyright;
  return post;
}

function parseBody(body: string): RawImage[] {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (error) {
    throw parseError(error instanceof Error ? error.message : String(error));
  }
  const parsed = ArchiveSchema.safeParse(json);
  if (!parsed.success) {
    throw parseError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data.images;
}

/** 429 单独给出更明确的文案，其余错误按统一模型透传 */
function mapFailure(error: AppError): AppError {
  if (error.code === 'RATE_LIMITED') {
    return createAppError('RATE_LIMITED', 'Bing 请求过于频繁，请稍后重试', {
      detail: error.detail
    });
  }
  return error;
}

export interface BingAdapterOptions {
  client: HttpClient;
  /** 默认取 `siteBaseUrl('bing')`，便于单测指向本地 mock */
  baseUrl?: string;
}

export function createBingAdapter(options: BingAdapterOptions): SiteAdapter {
  const { client } = options;
  const baseUrl = options.baseUrl ?? siteBaseUrl('bing');

  return {
    id: 'bing',
    baseUrl,
    // Bing 不提供关键词搜索（能力表 search=false），直接按 CONFIG 拒绝
    search: async (): Promise<PostPage> => {
      throw new AppErrorException(
        createAppError('CONFIG', 'Bing 仅提供每日壁纸，不支持关键词搜索', { retryable: false })
      );
    },
    async daily(): Promise<PostPage> {
      const result = await client.request(buildBingDailyPath());
      if (!result.ok) throw new AppErrorException(mapFailure(result.error));

      const posts = parseBody(result.data.body).map(normalizeImage);
      // 接口本身按 idx 顺序返回，这里再按日期倒序保险（DR-076）
      posts.sort((left, right) => right.createdAt - left.createdAt);
      return { posts, page: 1, lastId: null };
    }
  };
}
