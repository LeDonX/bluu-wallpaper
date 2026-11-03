import type { SiteId } from '@shared/constants';
import type { Result } from '@shared/errors';
import type { PostPage, TagSuggestion } from '@shared/models';

/** 03 §7：channel 名集中定义，主进程与 preload 共用 */
export const IPC_CHANNELS = {
  postsSearch: 'posts:search',
  tagsSuggest: 'tags:suggest',
  imagesFetch: 'images:fetch',
  imagesProgress: 'images:progress',
  viewsMark: 'views:mark',
  viewsList: 'views:list'
} as const;

/** `page` 与 `lastId` 二选一；都未提供时取第 1 页（03 §7） */
export interface PostsSearchInput {
  site: SiteId;
  query: string;
  page?: number;
  lastId?: number;
}

/** 03 §7 / 02 §3：prefix 为用户正在输入的标签前缀（≥2 字符） */
export interface TagsSuggestInput {
  site: SiteId;
  prefix: string;
}

/** 03 §7 / DR-028：查看器图片经主进程流式读取，requestId 用于关联进度事件 */
export interface ImageFetchInput {
  requestId: string;
  url: string;
}

export interface ImageBinary {
  mimeType: string;
  bytes: ArrayBuffer;
}

export interface ImageProgress {
  requestId: string;
  loaded: number;
  /** Content-Length 缺失时为 null，渲染层展示不确定进度 */
  total: number | null;
}

/** 03 §7 / 02 §6：`views:mark` 与 `views:list` 共用的入参，单次最多 100 个 id（03 §6.2） */
export interface ViewsInput {
  site: SiteId;
  postIds: number[];
}

/** preload 通过 contextBridge 暴露的白名单 API（05 §2） */
export interface BooruApi {
  platform: string;
  arch: string;
  searchPosts(input: PostsSearchInput): Promise<Result<PostPage>>;
  suggestTags(input: TagsSuggestInput): Promise<Result<TagSuggestion[]>>;
  loadImage(input: ImageFetchInput): Promise<Result<ImageBinary>>;
  onImageProgress(listener: (progress: ImageProgress) => void): () => void;
  markViews(input: ViewsInput): Promise<Result<null>>;
  listViews(input: ViewsInput): Promise<Result<number[]>>;
}
