import { getHttpClient } from '@main/network/http-site';
import { getSession } from '@main/network/sessions';
import { ALL_SITE_IDS } from '@shared/constants';
import {
  buildProxyRules,
  judgeProxyFallback,
  parseProxyResolution,
  type ProxyConfig,
  type ProxyMode,
  type ProxyStatus
} from '@shared/proxy';
import { siteBaseUrl } from '@shared/sites';
import type { ProxyConfig as ElectronProxyConfig } from 'electron';

/** 探测只发一次轻量请求；走既有 HTTP 客户端，因此仍受站点限速与错误分类约束 */
const PROBE_PATH = '/post.json?limit=1';
const PROBE_TIMEOUT_MS = 8_000;

let currentStatus: ProxyStatus = {
  configured: 'direct',
  effective: 'direct',
  fallback: false,
  reason: null
};

/** 配置切换序号：异步探测返回时若序号已变化，说明已有更新的配置，丢弃旧结果 */
let applySeq = 0;

type StatusListener = (status: ProxyStatus) => void;

const listeners = new Set<StatusListener>();

export function getProxyStatus(): ProxyStatus {
  return currentStatus;
}

export function onProxyStatusChange(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updateStatus(next: ProxyStatus): void {
  currentStatus = next;
  for (const listener of listeners) listener(next);
}

/** DR-078：`system` 交给 Chromium 读取 Windows 系统代理（含 Clash Verge 等） */
function toElectronProxyConfig(config: ProxyConfig): ElectronProxyConfig {
  switch (config.mode) {
    case 'direct':
      return { mode: 'direct' };
    case 'system':
      return { mode: 'system' };
    default: {
      const rules = buildProxyRules(config);
      // 地址非法时与原实现一致：先按直连应用，再由回退判定给出原因
      return rules ? { mode: 'fixed_servers', proxyRules: rules } : { mode: 'direct' };
    }
  }
}

async function applySessionProxy(config: ElectronProxyConfig): Promise<void> {
  // 07 DR-070：第三方图库也有自己的 session，代理与映射同样需要覆盖
  await Promise.all(ALL_SITE_IDS.map((site) => getSession(site).setProxy(config)));
}

async function resolveEffective(): Promise<ProxyMode | null> {
  try {
    return parseProxyResolution(await getSession('yande').resolveProxy(siteBaseUrl('yande')));
  } catch {
    return null;
  }
}

/**
 * 代理不可达才回退；限流 / 5xx / CF 说明流量已到达站点，不归因于代理。
 * 403/404 等业务状态同样视为代理可用。
 */
async function probeReachability(): Promise<'ok' | 'unreachable'> {
  const result = await getHttpClient('yande').request(PROBE_PATH, {
    timeoutMs: PROBE_TIMEOUT_MS,
    retries: 0
  });
  if (result.ok) return 'ok';
  return result.error.code === 'NETWORK' || result.error.code === 'TIMEOUT' ? 'unreachable' : 'ok';
}

async function rollbackToDirect(configured: ProxyMode, reason: string | null): Promise<void> {
  try {
    await applySessionProxy({ mode: 'direct' });
  } catch {
    // 回退失败不影响提示；下一次启动仍会重新按配置应用
  }
  updateStatus({ configured, effective: 'direct', fallback: true, reason });
}

async function verifyReachability(
  seq: number,
  mode: ProxyMode,
  resolution: ProxyMode
): Promise<void> {
  const probe = await probeReachability();
  if (probe === 'ok' || seq !== applySeq) return;

  const decision = judgeProxyFallback({
    mode,
    rulesValid: true,
    resolution,
    probe: 'unreachable'
  });
  if (decision.fallback) await rollbackToDirect(mode, decision.reason);
}

/**
 * app ready 后调用（03 §4.5 / DR-039）：
 * 1. 为全部站点 session 应用代理规则；2. `resolveProxy` 复检；3. 不匹配立即回退；
 * 4. 非直连时后台探测可达性，不可达再回退并广播状态。
 */
export async function applyProxyConfig(config: ProxyConfig): Promise<ProxyStatus> {
  applySeq += 1;
  const seq = applySeq;
  const rules = buildProxyRules(config);
  const rulesValid = config.mode === 'direct' || config.mode === 'system' || rules !== '';

  try {
    await applySessionProxy(toElectronProxyConfig(config));
  } catch {
    await rollbackToDirect(config.mode, '代理设置失败，已回退直连');
    return currentStatus;
  }

  const resolution = await resolveEffective();
  const decision = judgeProxyFallback({
    mode: config.mode,
    rulesValid,
    resolution,
    probe: 'skipped'
  });
  if (decision.fallback) {
    await rollbackToDirect(config.mode, decision.reason);
    return currentStatus;
  }

  const ready: ProxyStatus = {
    configured: config.mode,
    effective: resolution,
    fallback: false,
    reason: null
  };
  updateStatus(ready);

  // DR-078：跟随系统不做可达性回退；HTTP/SOCKS5 才探测并兜底
  if (config.mode !== 'direct' && config.mode !== 'system' && resolution === config.mode) {
    void verifyReachability(seq, config.mode, resolution);
  }
  return ready;
}
