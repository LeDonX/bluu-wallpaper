/** 已启用的 booru 站点；既有界面站点切换与 IPC 入参校验仍以此集合为准 */
export const SITE_IDS = ['yande', 'konachan'] as const;

/** 07 DR-070：第三方图库站点，与 booru 站点共用多源适配层 */
export const PROVIDER_SITE_IDS = ['wallhaven', 'bing'] as const;

/** 全部站点标识；能力表、图片域名与网络层按此集合驱动 */
export const ALL_SITE_IDS = [...SITE_IDS, ...PROVIDER_SITE_IDS] as const;

export type SiteId = (typeof SITE_IDS)[number];

export type ProviderSiteId = (typeof PROVIDER_SITE_IDS)[number];

/**
 * 多源统一站点标识。T-48 先把网络/域名/能力表扩到全集；
 * T-50 起 `Post`、收藏/已看/下载与搜索类 IPC 入参均使用该集合，
 * 界面站点切换仍以 `SITE_IDS` 为准（入口收敛归 T-53）。
 */
export type AnySiteId = (typeof ALL_SITE_IDS)[number];

export const ERROR_CODES = [
  'NETWORK',
  'TIMEOUT',
  'RATE_LIMITED',
  'CF_CHALLENGE',
  'NOT_FOUND',
  'SERVER',
  'PARSE',
  'DB',
  'DOWNLOAD',
  'CONFIG'
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** 产品名（英文品牌，不设中文名） */
export const APP_NAME = 'LePic';

// 02-UX-Design §1 / DR-080：设计基准尺寸；启动时按主屏可用区域收敛，避免小屏或高 DPI 下超出屏幕
export const DEFAULT_WINDOW_SIZE = { width: 1080, height: 720 } as const;

export const MIN_WINDOW_SIZE = { width: 800, height: 560 } as const;

/** 默认尺寸占主屏可用区域的上限比例（DR-080） */
export const WINDOW_WORK_AREA_RATIO = 0.9;

export interface WindowBounds {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

/** 按主屏可用区域收敛窗口尺寸：默认尺寸不超过区域 90%，最小尺寸不超过区域本身（DR-080） */
export function resolveWindowBounds(workArea: { width: number; height: number }): WindowBounds {
  const minWidth = Math.min(MIN_WINDOW_SIZE.width, Math.floor(workArea.width));
  const minHeight = Math.min(MIN_WINDOW_SIZE.height, Math.floor(workArea.height));
  return {
    width: Math.max(
      minWidth,
      Math.min(DEFAULT_WINDOW_SIZE.width, Math.floor(workArea.width * WINDOW_WORK_AREA_RATIO))
    ),
    height: Math.max(
      minHeight,
      Math.min(DEFAULT_WINDOW_SIZE.height, Math.floor(workArea.height * WINDOW_WORK_AREA_RATIO))
    ),
    minWidth,
    minHeight
  };
}

// 02-UX-Design §5：暗色背景，用作窗口首帧底色避免白闪
export const WINDOW_BACKGROUND_COLOR = '#0f1115';

// 03 §7 / DR-028：images:fetch 只允许这些图片域名，并据此选择站点 session
export const IMAGE_HOSTS: Readonly<Record<string, AnySiteId>> = {
  'assets.yande.re': 'yande',
  'files.yande.re': 'yande',
  'konachan.com': 'konachan',
  'assets.konachan.com': 'konachan',
  'files.konachan.com': 'konachan',
  // DR-070：第三方图库图片域名，T-50/T-51/T-52 接入后生效
  'w.wallhaven.cc': 'wallhaven',
  'th.wallhaven.cc': 'wallhaven',
  'www.bing.com': 'bing',
  'cn.bing.com': 'bing'
};

/** T-50：判断是否为 booru 站点（关注 / 榜单等仅 booru 支持的能力入口） */
export function isSiteId(value: unknown): value is SiteId {
  return typeof value === 'string' && (SITE_IDS as readonly string[]).includes(value);
}

/** T-53：判断是否为需要图库密钥的第三方站点 */
export function isProviderSiteId(value: unknown): value is ProviderSiteId {
  return typeof value === 'string' && (PROVIDER_SITE_IDS as readonly string[]).includes(value);
}

/** T-50：判断磁盘/入参站点标识是否属于全集，供存储层回读时回落 */
export function isAnySiteId(value: unknown): value is AnySiteId {
  return typeof value === 'string' && (ALL_SITE_IDS as readonly string[]).includes(value);
}

export function imageHostSite(hostname: string): AnySiteId | null {
  return Object.prototype.hasOwnProperty.call(IMAGE_HOSTS, hostname)
    ? (IMAGE_HOSTS[hostname] ?? null)
    : null;
}
