import type { AnySiteId } from '@shared/constants';

/** 06 §1 的站点根地址；适配器与网络层共用，避免各处硬编码 */
export const SITE_BASE_URLS: Record<AnySiteId, string> = {
  yande: 'https://yande.re',
  konachan: 'https://konachan.com',
  wallhaven: 'https://wallhaven.cc',
  bing: 'https://www.bing.com'
};

export function siteBaseUrl(site: AnySiteId): string {
  return SITE_BASE_URLS[site];
}

/** 02 §2.1 / §4：界面站点名，多源站点统一使用 */
export const SITE_LABELS: Record<AnySiteId, string> = {
  yande: 'yande.re',
  konachan: 'konachan.com',
  wallhaven: 'wallhaven.cc',
  bing: 'Bing'
};

/**
 * 07 DR-070：能力表驱动界面入口与 handler 校验，避免每个站点到处判断。
 * 缺失的能力对应入口应隐藏，handler 收到请求时以 CONFIG 拒绝。
 */
export interface SiteCapabilities {
  /** 关键词搜索 */
  search: boolean;
  /** 榜单（热门/日/周/月） */
  rankings: boolean;
  /** 标签联想 */
  suggest: boolean;
  /** 需要用户提供 API key（T-49 设置后可用） */
  needsKey: boolean;
  /** 空查询走 24 小时热门（wallhaven；DR-085） */
  toplist: boolean;
  /** 每日壁纸（bing；DR-076） */
  daily: boolean;
  /** 支持最小分辨率筛选（T-53） */
  resolutionFilter: boolean;
}

export const SITE_CAPABILITIES: Record<AnySiteId, SiteCapabilities> = {
  yande: {
    search: true,
    rankings: true,
    suggest: true,
    needsKey: false,
    toplist: false,
    daily: false,
    resolutionFilter: true
  },
  konachan: {
    search: true,
    rankings: true,
    suggest: true,
    needsKey: false,
    toplist: false,
    daily: false,
    resolutionFilter: true
  },
  wallhaven: {
    search: true,
    rankings: false,
    suggest: false,
    needsKey: true,
    toplist: true,
    daily: false,
    resolutionFilter: true
  },
  // Bing 只有每日壁纸（T-52），既不参与关键词搜索也不属于热门列表
  bing: {
    search: false,
    rankings: false,
    suggest: false,
    needsKey: false,
    toplist: false,
    daily: true,
    resolutionFilter: false
  }
};

/** DR-085 / DR-087：搜索页空查询（首页）的内容来源；`ranking` 实际取站点 24 小时热门（popular_recent period=1d） */
export type HomeFeedKind = 'ranking' | 'toplist';

export function homeFeedFor(site: AnySiteId): HomeFeedKind | null {
  if (siteSupports(site, 'rankings')) return 'ranking';
  if (siteSupports(site, 'toplist')) return 'toplist';
  return null;
}

/** 按能力表筛选站点，供导航、站点 tab 等入口复用（T-53） */
export function sitesWithCapability(capability: keyof SiteCapabilities): AnySiteId[] {
  return (Object.keys(SITE_CAPABILITIES) as AnySiteId[]).filter((site) =>
    siteSupports(site, capability)
  );
}

export function siteSupports(site: AnySiteId, capability: keyof SiteCapabilities): boolean {
  return SITE_CAPABILITIES[site][capability];
}
