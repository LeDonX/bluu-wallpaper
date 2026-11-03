import type { SiteId } from '@shared/constants';

/** 06 §3：站点返回单字符分级，适配器与 UI 统一使用全称 */
export const RATINGS = ['safe', 'questionable', 'explicit'] as const;
export type Rating = (typeof RATINGS)[number];

/** 06 §4：moebooru 的 tag type 为整数，缺少类型信息时按 general 处理 */
export interface PostTag {
  name: string;
  type: string;
}

/** 06 §4：type 整数映射后的标签类型，未知值按 general 处理 */
export const TAG_TYPES = ['general', 'artist', 'copyright', 'character'] as const;
export type TagType = (typeof TAG_TYPES)[number];

const TAG_TYPE_BY_CODE: Record<number, TagType> = {
  0: 'general',
  1: 'artist',
  3: 'copyright',
  4: 'character'
};

export function tagTypeFromCode(code: number): TagType {
  return TAG_TYPE_BY_CODE[code] ?? 'general';
}

export function isTagType(value: unknown): value is TagType {
  return typeof value === 'string' && (TAG_TYPES as readonly string[]).includes(value);
}

/** 02 §3：标签联想项，`count` 为站点侧作品数（可能为 0） */
export interface TagSuggestion {
  name: string;
  type: TagType;
  count: number;
}

/** 03 §5.2 归一化后的 Post；时间统一为 epoch 毫秒（05 §7） */
export interface Post {
  site: SiteId;
  id: number;
  md5: string;
  previewUrl: string;
  sampleUrl: string;
  fileUrl: string;
  width: number;
  height: number;
  fileSize: number;
  rating: Rating;
  score: number;
  tags: PostTag[];
  createdAt: number;
  source?: string;
}

/** page 与 id: 游标二选一；两者都不传时取第 1 页 */
export type SearchCursor = { page: number } | { lastId: number };

export interface PostPage {
  posts: Post[];
  /** 实际请求的页码；id: 游标翻页固定为 1 */
  page: number;
  /** 本页最后一条 id，供 id: 游标继续翻页；空页为 null */
  lastId: number | null;
  /** 本次是否由服务端自动附加了 R18 排除项（07 DR-023），供界面提示 */
  r18Filtered?: boolean;
}
