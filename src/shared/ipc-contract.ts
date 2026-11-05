import type { SiteId } from '@shared/constants';
import type {
  DownloadClearResult,
  DownloadControlInput,
  DownloadControlResult,
  DownloadEnqueueInput,
  DownloadEnqueueResult,
  DownloadProgressEvent,
  DownloadRemoveInput,
  DownloadRemoveResult,
  DownloadRevealInput,
  DownloadTask
} from '@shared/downloads';
import type { Result } from '@shared/errors';
import type { FavoriteSort } from '@shared/favorites';
import type { Post, PostPage, TagSuggestion } from '@shared/models';
import type { ProxyStatus } from '@shared/proxy';
import type { RankingDate, RankingKind } from '@shared/rankings';
import type { Settings, SettingsSetResult, SettingsSnapshot } from '@shared/settings';
import type { UpdateState } from '@shared/updates';

/** 03 §7：channel 名集中定义，主进程与 preload 共用 */
export const IPC_CHANNELS = {
  postsSearch: 'posts:search',
  postsRankings: 'posts:rankings',
  tagsSuggest: 'tags:suggest',
  imagesFetch: 'images:fetch',
  imagesProgress: 'images:progress',
  viewsMark: 'views:mark',
  viewsList: 'views:list',
  viewsClear: 'views:clear',
  viewsUpdated: 'views:updated',
  favoritesToggle: 'favorites:toggle',
  favoritesList: 'favorites:list',
  downloadsEnqueue: 'downloads:enqueue',
  downloadsControl: 'downloads:control',
  downloadsReveal: 'downloads:reveal',
  downloadsDelete: 'downloads:delete',
  downloadsClear: 'downloads:clear',
  downloadsList: 'downloads:list',
  downloadsProgress: 'downloads:progress',
  networkStatus: 'network:status',
  networkStatusChanged: 'network:status-changed',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsPickDownloadDir: 'settings:pick-download-dir',
  settingsDestinationChanged: 'settings:destination-changed',
  searchHistoryList: 'search-history:list',
  searchHistoryRecord: 'search-history:record',
  searchHistoryDelete: 'search-history:delete',
  searchHistoryClear: 'search-history:clear',
  updatesGetState: 'updates:get-state',
  updatesCheck: 'updates:check',
  updatesDownload: 'updates:download',
  updatesInstall: 'updates:install',
  updatesStatus: 'updates:status'
} as const;

/** `page` 与 `lastId` 二选一；都未提供时取第 1 页（03 §7） */
export interface PostsSearchInput {
  site: SiteId;
  query: string;
  page?: number;
  lastId?: number;
}

/** 03 §7 / 02 §4：榜单入参；期榜必须带 date，热门不带；page 仅期榜生效（DR-041） */
export interface PostsRankingsInput {
  site: SiteId;
  kind: RankingKind;
  date?: RankingDate;
  page?: number;
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

/** 03 §7 / 02 §6.4：清除浏览记录；不传 site 表示全部站点（DR-033） */
export interface ViewsClearInput {
  site?: SiteId;
}

export interface ViewsClearResult {
  /** 实际清除范围；全部站点时为 null */
  site: SiteId | null;
  clearedViews: number;
  clearedFavorites: number;
}

/** 05 §6：清除记录成功后广播，通知其他页面同步本地缓存 */
export interface ViewsUpdatedEvent {
  site: SiteId | null;
}

/** 03 §7 / DR-032：收藏时携带 Post 快照，主进程写入 `posts` 表供收藏页本地展示 */
export interface FavoriteToggleInput {
  site: SiteId;
  post: Post;
}

/** 03 §7 / 02 §8：收藏页按站点读取，query 为标签本地筛选，sort 为排序方式 */
export interface FavoriteListInput {
  site: SiteId;
  query?: string;
  sort?: FavoriteSort;
}

export interface FavoriteToggleResult {
  favorited: boolean;
}

/** 03 §7 / DR-055：记录或删除搜索历史时的查询串（主进程会再做归一化与校验） */
export interface SearchHistoryInput {
  query: string;
}

export interface SearchHistoryClearResult {
  removed: number;
}

/** DR-061：设置页选择下载目录；`current` 为草稿值，可用时作为对话框起始目录 */
export interface SettingsPickDownloadDirInput {
  current?: string;
}

/** DR-061：下载时目录校验写回设置后广播，设置页据此同步草稿 */
export interface SettingsDestinationChangedEvent {
  destinationDir: string;
}

/** preload 通过 contextBridge 暴露的白名单 API（05 §2） */
export interface BooruApi {
  platform: string;
  arch: string;
  searchPosts(input: PostsSearchInput): Promise<Result<PostPage>>;
  listRankings(input: PostsRankingsInput): Promise<Result<PostPage>>;
  suggestTags(input: TagsSuggestInput): Promise<Result<TagSuggestion[]>>;
  loadImage(input: ImageFetchInput): Promise<Result<ImageBinary>>;
  onImageProgress(listener: (progress: ImageProgress) => void): () => void;
  markViews(input: ViewsInput): Promise<Result<null>>;
  listViews(input: ViewsInput): Promise<Result<number[]>>;
  clearViews(input: ViewsClearInput): Promise<Result<ViewsClearResult>>;
  onViewsUpdated(listener: (event: ViewsUpdatedEvent) => void): () => void;
  toggleFavorite(input: FavoriteToggleInput): Promise<Result<FavoriteToggleResult>>;
  listFavorites(input: FavoriteListInput): Promise<Result<PostPage>>;
  enqueueDownloads(input: DownloadEnqueueInput): Promise<Result<DownloadEnqueueResult>>;
  controlDownload(input: DownloadControlInput): Promise<Result<DownloadControlResult>>;
  /** DR-043：在系统文件管理器中打开任务所在文件夹并选中文件 */
  revealDownload(input: DownloadRevealInput): Promise<Result<null>>;
  /** DR-044：删除单个任务；不传 deleteFile 时只检查文件是否存在 */
  deleteDownload(input: DownloadRemoveInput): Promise<Result<DownloadRemoveResult>>;
  /** DR-044：清空全部任务记录，保留已下载的最终文件 */
  clearDownloads(): Promise<Result<DownloadClearResult>>;
  listDownloads(): Promise<Result<DownloadTask[]>>;
  onDownloadProgress(listener: (event: DownloadProgressEvent) => void): () => void;
  /** 03 §7 / DR-039：读取当前代理生效状态，代理回退后由事件通知 */
  getNetworkStatus(): Promise<Result<ProxyStatus>>;
  onNetworkStatus(listener: (status: ProxyStatus) => void): () => void;
  /** 03 §7 / DR-040：读取与保存四组设置，保存后返回代理复检结果与重启提示 */
  getSettings(): Promise<Result<SettingsSnapshot>>;
  setSettings(input: Settings): Promise<Result<SettingsSetResult>>;
  /** DR-061：弹系统目录选择框，取消返回 null */
  pickDownloadDirectory(input: SettingsPickDownloadDirInput): Promise<Result<string | null>>;
  /** DR-061：下载前目录校验写回设置后通知，设置页同步草稿 */
  onDestinationChanged(listener: (event: SettingsDestinationChangedEvent) => void): () => void;
  /** 03 §7 / DR-055：搜索历史，返回最近使用优先的列表 */
  listSearchHistory(): Promise<Result<string[]>>;
  recordSearchHistory(input: SearchHistoryInput): Promise<Result<string[]>>;
  deleteSearchHistory(input: SearchHistoryInput): Promise<Result<string[]>>;
  clearSearchHistory(): Promise<Result<SearchHistoryClearResult>>;
  /** 03 §7 / DR-066：自动更新（仅 NSIS 安装版），便携版与开发模式返回 unsupported */
  getUpdateState(): Promise<Result<UpdateState>>;
  checkForUpdates(): Promise<Result<UpdateState>>;
  downloadUpdate(): Promise<Result<UpdateState>>;
  installUpdate(): Promise<Result<null>>;
  onUpdateStatus(listener: (state: UpdateState) => void): () => void;
}
