import { isValidHostname, isValidIPv4 } from '@shared/hostmap';

/** 03 §4.5：代理模式；`direct` / `system` 不生成固定规则串（DR-078） */
export const PROXY_MODES = ['direct', 'system', 'http', 'socks5'] as const;

export type ProxyMode = (typeof PROXY_MODES)[number];

export interface ProxyConfig {
  mode: ProxyMode;
  host: string;
  port: number;
}

/** `config.json#network`，T-30 设置页接管编辑入口前由用户手工编辑 */
export interface NetworkConfig {
  proxy: ProxyConfig;
}

export const DEFAULT_PROXY_PORT = 7890;

export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  mode: 'direct',
  host: '127.0.0.1',
  port: DEFAULT_PROXY_PORT
};

export const MIN_PROXY_PORT = 1;
export const MAX_PROXY_PORT = 65535;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isProxyMode = (value: unknown): value is ProxyMode =>
  typeof value === 'string' && (PROXY_MODES as readonly string[]).includes(value);

export const isValidProxyPort = (port: number): boolean =>
  Number.isInteger(port) && port >= MIN_PROXY_PORT && port <= MAX_PROXY_PORT;

/** host 允许 IPv4 或主机名（如 `proxy.local`），不允许协议前缀与路径 */
export const isValidProxyHost = (host: string): boolean =>
  isValidIPv4(host) || isValidHostname(host);

export function defaultProxyConfig(): ProxyConfig {
  return { ...DEFAULT_PROXY_CONFIG };
}

export function defaultNetworkConfig(): NetworkConfig {
  return { proxy: defaultProxyConfig() };
}

/** 配置来自磁盘/用户，按 unknown 解析；缺失或非法字段回落到默认值（DR-039） */
export function parseProxyConfig(raw: unknown): ProxyConfig {
  if (!isRecord(raw)) return defaultProxyConfig();

  const mode = isProxyMode(raw['mode']) ? raw['mode'] : DEFAULT_PROXY_CONFIG.mode;
  const rawHost = raw['host'];
  const host =
    typeof rawHost === 'string' && isValidProxyHost(rawHost.trim())
      ? rawHost.trim()
      : DEFAULT_PROXY_CONFIG.host;
  const rawPort = raw['port'];
  const port =
    typeof rawPort === 'number' && isValidProxyPort(rawPort)
      ? rawPort
      : DEFAULT_PROXY_CONFIG.port;

  return { mode, host, port };
}

export function parseNetworkConfig(raw: unknown): NetworkConfig {
  if (!isRecord(raw)) return defaultNetworkConfig();
  return { proxy: parseProxyConfig(raw['proxy']) };
}

/**
 * 生成 Electron `setProxy({ proxyRules })` 的规则串；直连与跟随系统返回空串。
 * 地址非法时同样返回空串，交由 `judgeProxyFallback` 判定为"地址无效"并回退。
 */
export function buildProxyRules(config: ProxyConfig): string {
  const host = config.host.trim();
  if (
    config.mode === 'direct' ||
    config.mode === 'system' ||
    !isValidProxyHost(host) ||
    !isValidProxyPort(config.port)
  ) {
    return '';
  }
  const scheme = config.mode === 'socks5' ? 'socks5' : 'http';
  return `${scheme}://${host}:${config.port}`;
}

/**
 * 解析 `ses.resolveProxy(url)` 的返回值：`DIRECT` 或 `PROXY host:port`（可能多条，取第一条）。
 * Chromium 对 SOCKS 代理可能返回 `SOCKS` 或 `SOCKS5`，两者都按 SOCKS5 处理。
 * 无法识别时返回 null，交由调用方按"规则未生效"处理。
 */
export function parseProxyResolution(raw: string): ProxyMode | null {
  const first = raw.split(';')[0]?.trim() ?? '';
  if (/^direct$/i.test(first)) return 'direct';
  if (/^socks(?:5)?\b/i.test(first)) return 'socks5';
  if (/^proxy\b/i.test(first)) return 'http';
  return null;
}

export type ProxyProbeOutcome = 'skipped' | 'ok' | 'unreachable';

export interface ProxyCheckInput {
  mode: ProxyMode;
  /** `buildProxyRules` 是否产出非空规则；非直连模式下为 false 表示地址非法 */
  rulesValid: boolean;
  /** `parseProxyResolution` 的结果；null 表示无法识别 */
  resolution: ProxyMode | null;
  probe: ProxyProbeOutcome;
}

export interface ProxyDecision {
  fallback: boolean;
  reason: string | null;
}

/**
 * 纯函数：判断应用代理后是否需要回退直连，以及展示给用户的原因（DR-039）。
 * 跟随系统（DR-078）不回退：系统代理关闭时 `DIRECT` 属正常状态，回退会覆盖用户意图。
 */
export function judgeProxyFallback(input: ProxyCheckInput): ProxyDecision {
  if (input.mode === 'direct') return { fallback: false, reason: null };
  if (input.mode === 'system') return { fallback: false, reason: null };
  if (!input.rulesValid) return { fallback: true, reason: '代理地址无效，已回退直连' };
  if (input.resolution === null) return { fallback: true, reason: '代理规则未生效，已回退直连' };
  if (input.resolution === 'direct') {
    return { fallback: true, reason: '系统未使用配置的代理，已回退直连' };
  }
  if (input.resolution !== input.mode) {
    return { fallback: true, reason: '代理未按配置生效，已回退直连' };
  }
  if (input.probe === 'unreachable') return { fallback: true, reason: '代理不可达，已回退直连' };
  return { fallback: false, reason: null };
}

/** 渲染层与设置页共用的模式文案 */
export const PROXY_MODE_LABELS: Record<ProxyMode, string> = {
  direct: '直连',
  system: '跟随系统',
  http: 'HTTP 代理',
  socks5: 'SOCKS5 代理'
};

/** 03 §7 / DR-039：主进程当前实际生效的代理状态 */
export interface ProxyStatus {
  configured: ProxyMode;
  /** `resolveProxy` 复检结果；null 表示无法识别 */
  effective: ProxyMode | null;
  fallback: boolean;
  reason: string | null;
}
