import type { AnySiteId } from '@shared/constants';
import { sessionPartition } from '@shared/sessions';
import { type Session, session } from 'electron';

const sessionCache = new Map<AnySiteId, Session>();

/**
 * 每站点固定一个 persist 分区：cookie / HTTP 缓存 / 代理互不干扰，且重启后可复用。
 * 不调用 `setUserAgent`：覆盖 UA 会与 Client Hints 版本不一致，CF 挑战无法通过（DR-011）。
 */
export function getSession(site: AnySiteId): Session {
  const cached = sessionCache.get(site);
  if (cached) return cached;

  const partition = sessionPartition(site);
  const ses = session.fromPartition(partition);
  sessionCache.set(site, ses);
  return ses;
}
