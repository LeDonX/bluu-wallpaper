import { getHttpClient } from '@main/network/http-site';
import { createBingAdapter } from '@main/sites/bing';
import { createMoebooruAdapter } from '@main/sites/moebooru';
import type { SiteAdapter } from '@main/sites/types';
import { createWallhavenAdapter } from '@main/sites/wallhaven';
import type { AnySiteId } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import { providerApiKey, type ProvidersConfig } from '@shared/providers';
import { SITE_LABELS } from '@shared/sites';

const adapters = new Map<AnySiteId, SiteAdapter>();

/** 默认未配置；由 registry 启动时注入 `config.json#providers` 的读取函数 */
let providerSource: () => ProvidersConfig = () => ({
  wallhavenApiKey: ''
});

/** T-50：适配器每次请求通过闭包读取最新密钥，设置页保存后无需重启 */
export function setProviderKeySource(source: () => ProvidersConfig): void {
  providerSource = source;
}

/**
 * 07 DR-057 / T-28：yande 与 konachan 共用同一 moebooru 适配器，
 * 仅按站点切换 HTTP 通道（yande `ses.fetch`、konachan 隐藏窗口 CF 通道，DR-010）。
 * 07 DR-070 / T-50 / T-52：wallhaven、bing 走独立适配器。
 */
export function getSiteAdapter(site: AnySiteId): SiteAdapter {
  const cached = adapters.get(site);
  if (cached) return cached;

  let adapter: SiteAdapter;
  switch (site) {
    case 'yande':
    case 'konachan':
      adapter = createMoebooruAdapter({ site, client: getHttpClient(site) });
      break;
    case 'wallhaven':
      adapter = createWallhavenAdapter({
        client: getHttpClient(site),
        getApiKey: () => providerApiKey(providerSource(), 'wallhaven')
      });
      break;
    case 'bing':
      adapter = createBingAdapter({ client: getHttpClient(site) });
      break;
    default:
      throw new AppErrorException(
        createAppError('CONFIG', `${SITE_LABELS[site]} 尚未接入`, { retryable: false })
      );
  }

  adapters.set(site, adapter);
  return adapter;
}
