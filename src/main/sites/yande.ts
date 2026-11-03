import { getHttpClient } from '@main/network/http-site';
import { createMoebooruAdapter, type MoebooruAdapter } from '@main/sites/moebooru';

let yandeAdapter: MoebooruAdapter | null = null;

/** yande 站点单例：与 HTTP 层共享同一限速器/会话，避免多套请求状态并存（03 §4） */
export function getYandeAdapter(): MoebooruAdapter {
  if (yandeAdapter) return yandeAdapter;
  yandeAdapter = createMoebooruAdapter({ site: 'yande', client: getHttpClient('yande') });
  return yandeAdapter;
}
