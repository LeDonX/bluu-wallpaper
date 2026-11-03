import { type CfChannel, createCfChannel } from '@main/network/cloudflare';
import { createHttpClient, type HttpClient, type HttpTransport } from '@main/network/http';
import { createRateLimiter, type RateLimiter } from '@main/network/rate-limiter';
import { getSession } from '@main/network/sessions';
import type { SiteId } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import { siteBaseUrl } from '@shared/sites';

const clients = new Map<SiteId, HttpClient>();
const limiters = new Map<SiteId, RateLimiter>();
const cfChannels = new Map<SiteId, CfChannel>();

/** yande 无 CF：走 ses.fetch，与 cookie/代理/映射共用同一网络栈（DR-005） */
const createYandeTransport = (): HttpTransport => {
  const ses = getSession('yande');
  return async (url, request) => {
    const response = await ses.fetch(url, {
      method: 'GET',
      headers: request.headers,
      signal: request.signal
    });
    return {
      status: response.status,
      body: await response.text(),
      retryAfter: response.headers.get('retry-after')
    };
  };
};

/** konachan：ses.fetch 实测仍 403，改走隐藏窗口上下文 fetch（DR-010） */
const createKonachanTransport =
  (channel: CfChannel): HttpTransport =>
  async (url) => {
    try {
      const response = await channel.fetchText(url);
      return { status: response.status, body: response.body, retryAfter: null };
    } catch (error) {
      // 通道内已含"重过一次挑战"，这里再失败即判定需要用户介入，不做无限重试
      throw new AppErrorException(
        createAppError('CF_CHALLENGE', 'Cloudflare 验证未通过，请稍后重试或手动验证', {
          detail: error instanceof Error ? error.message : String(error)
        })
      );
    }
  };

const getLimiter = (site: SiteId): RateLimiter => {
  const cached = limiters.get(site);
  if (cached) return cached;
  // 每站点独立令牌桶，默认 2 req/s（03 §4.4）
  const limiter = createRateLimiter();
  limiters.set(site, limiter);
  return limiter;
};

const getCfChannel = (site: SiteId): CfChannel => {
  const cached = cfChannels.get(site);
  if (cached) return cached;
  const channel = createCfChannel({ site, baseUrl: siteBaseUrl(site) });
  cfChannels.set(site, channel);
  return channel;
};

/** 站点级单例：同一站点的所有请求共享限速器与通道，避免多套状态并存 */
export function getHttpClient(site: SiteId): HttpClient {
  const cached = clients.get(site);
  if (cached) return cached;

  const transport =
    site === 'yande' ? createYandeTransport() : createKonachanTransport(getCfChannel(site));
  const client = createHttpClient({ site, transport, limiter: getLimiter(site) });
  clients.set(site, client);
  return client;
}
