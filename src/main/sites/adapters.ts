import { getHttpClient } from '@main/network/http-site';
import { createMoebooruAdapter, type MoebooruAdapter } from '@main/sites/moebooru';
import type { SiteId } from '@shared/constants';

const adapters = new Map<SiteId, MoebooruAdapter>();

/**
 * 07 DR-057 / T-28：yande 与 konachan 共用同一 moebooru 适配器，
 * 仅按站点切换 HTTP 通道（yande `ses.fetch`、konachan 隐藏窗口 CF 通道，DR-010）。
 */
export function getSiteAdapter(site: SiteId): MoebooruAdapter {
  const cached = adapters.get(site);
  if (cached) return cached;
  const adapter = createMoebooruAdapter({ site, client: getHttpClient(site) });
  adapters.set(site, adapter);
  return adapter;
}
