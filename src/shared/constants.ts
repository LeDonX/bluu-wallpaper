export const SITE_IDS = ['yande', 'konachan'] as const;

export type SiteId = (typeof SITE_IDS)[number];

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

export const APP_NAME = '蓝噗';

export const APP_NAME_EN = 'Bluu';

// 02-UX-Design §1：默认 1280×860，最小 1024×720
export const DEFAULT_WINDOW_SIZE = { width: 1280, height: 860 } as const;

export const MIN_WINDOW_SIZE = { width: 1024, height: 720 } as const;

// 02-UX-Design §5：暗色背景，用作窗口首帧底色避免白闪
export const WINDOW_BACKGROUND_COLOR = '#0f1115';

// 03 §7 / DR-028：images:fetch 只允许这些图片域名，并据此选择站点 session
export const IMAGE_HOSTS: Readonly<Record<string, SiteId>> = {
  'assets.yande.re': 'yande',
  'files.yande.re': 'yande',
  'files.konachan.com': 'konachan'
};

export function imageHostSite(hostname: string): SiteId | null {
  return Object.prototype.hasOwnProperty.call(IMAGE_HOSTS, hostname)
    ? IMAGE_HOSTS[hostname] ?? null
    : null;
}
