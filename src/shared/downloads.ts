import type { SiteId } from '@shared/constants';
import type { Post } from '@shared/models';

/** 02 §7.2 / 03 §6.1：任务状态，`verifying` 在 T-23 只做状态流转，md5 校验由 T-25 接入 */
export const DOWNLOAD_STATUSES = [
  'queued',
  'downloading',
  'paused',
  'verifying',
  'done',
  'failed'
] as const;

export type DownloadStatus = (typeof DOWNLOAD_STATUSES)[number];

/** 02 §7.2：暂停可恢复、失败可重试；取消会删除任务与文件，不是状态流转 */
export const DOWNLOAD_ACTIONS = ['pause', 'resume', 'cancel', 'retry'] as const;

export type DownloadAction = (typeof DOWNLOAD_ACTIONS)[number];

/** 03 §6.1 的 `download_tasks` 一行；时间统一 epoch 毫秒（05 §7） */
export interface DownloadTask {
  id: string;
  site: SiteId;
  postId: number;
  url: string;
  /** 校验基准；迁移 005 之前的历史任务为 null，按跳过校验处理（DR-037） */
  md5: string | null;
  destPath: string;
  status: DownloadStatus;
  bytesDone: number;
  bytesTotal: number;
  retries: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 03 §7 / DR-037：入队携带模板，模板在入队时渲染，缺失时用默认模板 */
export interface DownloadEnqueueInput {
  site: SiteId;
  posts: Post[];
  template?: string;
  /** DR-050：重新下载，忽略已下载跳过并复用原任务覆盖最终文件 */
  force?: boolean;
  /** DR-051：单次入队使用的下载格式，缺省时使用设置页的默认格式 */
  variant?: DownloadVariant;
}

/**
 * 03 §7 / DR-037：`skipped` 为已下载 md5、目标路径同尺寸文件或同批重复条目而被跳过的数量。
 * DR-042：同一图片已存在未结束任务时复用并回传其 id，`taskIds` 不保证都是新建任务。
 */
export interface DownloadEnqueueResult {
  taskIds: string[];
  skipped: number;
}

export interface DownloadControlInput {
  taskId: string;
  action: DownloadAction;
}

/** DR-043：下载页“打开所在文件夹”，按任务 id 定位本地文件 */
export interface DownloadRevealInput {
  taskId: string;
}

/**
 * DR-044：删除任务。`deleteFile` 不传时只检查文件是否存在并返回 `fileExisted`，
 * 存在则不改动任何数据，由渲染层询问“删文件还是只删记录”。
 */
export interface DownloadRemoveInput {
  taskId: string;
  deleteFile?: boolean;
}

export interface DownloadRemoveResult {
  taskId: string;
  /** 删除检查时最终文件是否存在 */
  fileExisted: boolean;
  /** 任务记录是否已被删除；`fileExisted=true` 且未指定 `deleteFile` 时为 false */
  removed: boolean;
  /** 是否删除了最终文件 */
  deletedFile: boolean;
}

/** DR-044：清空任务记录，已下载的最终文件保留 */
export interface DownloadClearResult {
  removed: number;
}

/** `cancel` 后任务行已删除，`status` 为 null */
export interface DownloadControlResult {
  taskId: string;
  status: DownloadStatus | null;
}

/** 03 §7 / 03 §8：进度事件，按任务节流上报（约 200ms） */
export interface DownloadProgressEvent {
  taskId: string;
  site: SiteId;
  postId: number;
  status: DownloadStatus;
  bytesDone: number;
  bytesTotal: number;
  error: string | null;
}

export const MIN_DOWNLOAD_CONCURRENCY = 1;
export const MAX_DOWNLOAD_CONCURRENCY = 6;
export const DEFAULT_DOWNLOAD_CONCURRENCY = 3;

/** 02 §7.3 / 07 DR-040：模板长度上限，超过时设置页拒绝保存 */
export const MAX_DOWNLOAD_TEMPLATE_LENGTH = 200;

/** DR-051：下载格式；`jpeg` 仅在站点提供独立压缩版时可用 */
export const DOWNLOAD_VARIANTS = ['original', 'jpeg'] as const;
export type DownloadVariant = (typeof DOWNLOAD_VARIANTS)[number];

/** 原图为 PNG 且站点提供更小的 JPEG 版本时返回 true */
export function hasJpegVariant(post: Post): boolean {
  const jpeg = post.jpegUrl?.trim() ?? '';
  return jpeg !== '' && jpeg !== post.fileUrl && (post.jpegFileSize ?? 0) > 0;
}

/** DR-051：按所选格式返回实际下载地址与字节数，JPEG 不可用时回落到原图 */
export function downloadSource(
  post: Post,
  variant: DownloadVariant
): { url: string; size: number } {
  if (variant === 'jpeg' && hasJpegVariant(post)) {
    return { url: post.jpegUrl ?? post.fileUrl, size: post.jpegFileSize ?? post.fileSize };
  }
  return { url: post.fileUrl, size: post.fileSize };
}

export interface DownloadConfig {
  concurrency: number;
  /** 空串表示使用 `userData/downloads`（设置页展示默认目录） */
  destinationDir: string;
  /** 空串回落到 `DEFAULT_DOWNLOAD_TEMPLATE` */
  template: string;
  /** 批量下载默认格式；查看器单张下载另行询问（DR-051） */
  format: DownloadVariant;
}

export function defaultDownloadConfig(): DownloadConfig {
  return {
    concurrency: DEFAULT_DOWNLOAD_CONCURRENCY,
    destinationDir: '',
    template: DEFAULT_DOWNLOAD_TEMPLATE,
    format: 'original'
  };
}

/**
 * `config.json#downloads` 解析：并发必须为 1–6 的整数，目录与模板缺失回落到默认值。
 * 非法值不阻断启动，设置页负责保存前校验并给出反馈（DR-040）。
 */
export function parseDownloadConfig(raw: unknown): DownloadConfig {
  const defaults = defaultDownloadConfig();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaults;
  const record = raw as Record<string, unknown>;

  const concurrency =
    typeof record['concurrency'] === 'number' &&
    Number.isInteger(record['concurrency']) &&
    record['concurrency'] >= MIN_DOWNLOAD_CONCURRENCY &&
    record['concurrency'] <= MAX_DOWNLOAD_CONCURRENCY
      ? record['concurrency']
      : defaults.concurrency;
  const destinationDir =
    typeof record['destinationDir'] === 'string' ? record['destinationDir'].trim() : '';
  const rawTemplate =
    typeof record['template'] === 'string' && record['template'].trim() !== ''
      ? record['template'].trim()
      : defaults.template;
  // DR-043：旧默认模板写进了用户配置，读取时直接迁移，避免继续生成多层目录
  const template = LEGACY_DOWNLOAD_TEMPLATES.has(rawTemplate) ? defaults.template : rawTemplate;
  const format: DownloadVariant = record['format'] === 'jpeg' ? 'jpeg' : defaults.format;

  return { concurrency, destinationDir, template, format };
}

/** 02 §7.2 状态机：只允许表中列出的迁移，其余视为非法操作 */
const STATUS_TRANSITIONS: Record<DownloadStatus, readonly DownloadStatus[]> = {
  queued: ['downloading', 'paused', 'failed'],
  downloading: ['paused', 'verifying', 'failed'],
  verifying: ['done', 'failed'],
  paused: ['queued', 'failed'],
  failed: ['queued'],
  done: []
};

export function canTransition(from: DownloadStatus, to: DownloadStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** control 动作与当前状态是否匹配；`cancel` 对任何未结束任务都可用 */
export function canApplyAction(status: DownloadStatus, action: DownloadAction): boolean {
  switch (action) {
    case 'pause':
      return status === 'queued' || status === 'downloading';
    case 'resume':
      return status === 'paused';
    case 'retry':
      return status === 'failed';
    case 'cancel':
      return status !== 'done';
    default:
      return false;
  }
}

/** 动作成功后应进入的状态；`cancel` 没有目标状态（直接删除任务行） */
export function statusAfterAction(
  action: Exclude<DownloadAction, 'cancel'>,
  status: DownloadStatus
): DownloadStatus | null {
  if (!canApplyAction(status, action)) return null;
  switch (action) {
    case 'pause':
      return 'paused';
    case 'resume':
    case 'retry':
      return 'queued';
    default:
      return null;
  }
}

/** 02 §7.3：默认命名模板，下载文件直接平铺在设置的下载目录下（DR-064） */
export const DEFAULT_DOWNLOAD_TEMPLATE = '{md5}.{ext}';

/**
 * 旧版默认模板；已写入 `config.json` 的旧默认值在读取时迁移到新默认值。
 * DR-043 的 `{site}/{md5}.{ext}` 与更早的多层模板都属于"默认值"而非用户自定义（DR-064）。
 */
const LEGACY_DOWNLOAD_TEMPLATES = new Set([
  '{site}/{rating}/{artist}/{md5}.{ext}',
  '{site}/{md5}.{ext}'
]);

/** 02 §7.3：模板渲染后的相对路径长度上限，超限回落到紧凑路径 */
export const MAX_DOWNLOAD_RELATIVE_PATH = 120;

/** 02 §7.3：非法字符（Windows 保留符号），统一替换为 `_`；控制字符按码位另行替换 */
const ILLEGAL_PATH_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);

/**
 * 02 §7.3：按模板渲染相对路径（用 `/` 分隔），供队列拼接到下载目录。
 * 未知变量保留原文；非法字符与 `.`/`..` 段替换为 `_`；超长时回落到紧凑路径（DR-037）。
 */
export function renderDownloadPath(post: Post, template?: string): string {
  const source =
    template !== undefined && template.trim() !== '' ? template.trim() : DEFAULT_DOWNLOAD_TEMPLATE;
  const segments = source
    .split('/')
    .map((segment) => sanitizePathSegment(substituteTemplate(segment, post)))
    .filter((segment) => segment !== '');
  const relative = segments.join('/');
  if (relative === '' || relative.length > MAX_DOWNLOAD_RELATIVE_PATH) {
    return compactDownloadPath(post);
  }
  return relative;
}

/** 02 §7.3：单段清洗；纯点号段替换为 `_`，避免路径穿越 */
export function sanitizePathSegment(value: string): string {
  let cleaned = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    cleaned += ILLEGAL_PATH_CHARS.has(char) || code < 0x20 ? '_' : char;
  }
  cleaned = cleaned.trim();
  if (cleaned === '' || cleaned.replace(/\./g, '') === '') return '_';
  return cleaned;
}

function compactDownloadPath(post: Post): string {
  const md5 = post.md5.trim() !== '' ? post.md5.trim() : 'unknown';
  return sanitizePathSegment(`${md5}.${fileExtension(post.fileUrl)}`);
}

function substituteTemplate(segment: string, post: Post): string {
  return segment.replace(
    /\{([a-z][a-z0-9_]*)\}/gi,
    (token, name: string) => templateValue(name, post) ?? token
  );
}

function templateValue(name: string, post: Post): string | null {
  switch (name.toLowerCase()) {
    case 'site':
      return post.site;
    case 'rating':
      return post.rating;
    case 'artist':
      return firstTagName(post, 'artist');
    case 'copyright':
      return firstTagName(post, 'copyright');
    case 'character':
      return firstTagName(post, 'character');
    case 'id':
      return String(post.id);
    case 'md5':
      return post.md5.trim() !== '' ? post.md5.trim() : 'unknown';
    case 'ext':
      return fileExtension(post.fileUrl);
    default:
      return null;
  }
}

/** 02 §7.3：该类型首个标签，缺失为 `unknown` */
function firstTagName(post: Post, type: string): string {
  const tag = post.tags.find((item) => item.type === type);
  return tag !== undefined && tag.name.trim() !== '' ? tag.name.trim() : 'unknown';
}

function fileExtension(fileUrl: string): string {
  try {
    const pathname = new URL(fileUrl).pathname;
    const last = pathname.split('/').pop() ?? '';
    const match = /\.([a-z0-9]{1,5})$/i.exec(last);
    return match?.[1] !== undefined ? match[1].toLowerCase() : 'jpg';
  } catch {
    return 'jpg';
  }
}

/** 02 §7 / T-26 前的最小状态文案；`ratio` 为 null 时用不定进度 */
export function downloadStatusLabel(status: DownloadStatus, ratio: number | null): string {
  switch (status) {
    case 'queued':
      return '已加入下载队列';
    case 'downloading':
      return ratio === null ? '正在下载' : `正在下载 ${Math.min(99, Math.round(ratio * 100))}%`;
    case 'paused':
      return '已暂停';
    case 'verifying':
      return '正在校验';
    case 'done':
      return '下载完成';
    case 'failed':
      return '下载失败';
    default:
      return '';
  }
}

/**
 * T-26：把 `downloads:progress` 合并进本地任务列表。
 * 未找到任务时原样返回，页面据此触发一次补拉（避免入队事件早于首次 list）。
 */
export function applyDownloadProgress(
  tasks: DownloadTask[],
  event: DownloadProgressEvent
): DownloadTask[] {
  const index = tasks.findIndex((task) => task.id === event.taskId);
  const current = tasks[index];
  if (current === undefined) return tasks;
  const next = [...tasks];
  next[index] = {
    ...current,
    status: event.status,
    bytesDone: event.bytesDone,
    bytesTotal: event.bytesTotal,
    error: event.error
  };
  return next;
}

/** 02 §7.2 / T-26：0–1 的进度比例；null 表示总量未知，界面用不定进度 */
export function downloadProgressRatio(
  task: Pick<DownloadTask, 'status' | 'bytesDone' | 'bytesTotal'>
): number | null {
  if (task.status === 'done' || task.status === 'verifying') return 1;
  if (task.status === 'downloading' && task.bytesTotal <= 0) return null;
  if (task.bytesTotal <= 0) return 0;
  return Math.max(0, Math.min(1, task.bytesDone / task.bytesTotal));
}

/** 任务列表展示用文件名：取落盘路径最后一段，缺失时回落到 post id */
export function downloadTaskTitle(task: Pick<DownloadTask, 'destPath' | 'postId'>): string {
  const name = task.destPath.split(/[/\\]/).pop() ?? '';
  return name !== '' ? name : `#${task.postId}`;
}

/** 字节大小展示：保留一位小数，单位最多到 GB */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
