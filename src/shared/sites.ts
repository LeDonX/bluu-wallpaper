import type { SiteId } from '@shared/constants';

/** 06 §1 的站点根地址；适配器与网络层共用，避免各处硬编码 */
export const SITE_BASE_URLS: Record<SiteId, string> = {
  yande: 'https://yande.re',
  konachan: 'https://konachan.com'
};

export function siteBaseUrl(site: SiteId): string {
  return SITE_BASE_URLS[site];
}
