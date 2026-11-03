export interface HostMapEntry {
  host: string;
  ip: string;
}

export interface HostmapConfig {
  enabled: boolean;
  entries: HostMapEntry[];
}

/**
 * 默认映射取自 docs/06 §1 的实测结果（DR-004 / DR-007）。
 * konachan 的 Cloudflare IP 会变化，映射失效时把 enabled 改为 false 并重启即可回退直连。
 */
export const DEFAULT_HOSTMAP: HostmapConfig = {
  enabled: true,
  entries: [
    { host: 'yande.re', ip: '198.251.89.183' },
    { host: 'assets.yande.re', ip: '198.251.89.183' },
    { host: 'files.yande.re', ip: '198.251.88.76' },
    { host: 'konachan.com', ip: '104.21.4.105' },
    { host: 'files.konachan.com', ip: '104.21.4.105' }
  ]
};

const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const MAX_HOSTNAME_LENGTH = 253;

export const isValidHostname = (host: string): boolean =>
  host.length <= MAX_HOSTNAME_LENGTH && HOSTNAME_PATTERN.test(host);

export const isValidIPv4 = (ip: string): boolean => IPV4_PATTERN.test(ip);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isHostMapEntry = (value: unknown): value is HostMapEntry =>
  isRecord(value) && typeof value['host'] === 'string' && typeof value['ip'] === 'string';

export function defaultHostmapConfig(): HostmapConfig {
  return {
    enabled: DEFAULT_HOSTMAP.enabled,
    entries: DEFAULT_HOSTMAP.entries.map((e) => ({ ...e }))
  };
}

/**
 * 生成 `--host-resolver-rules` 的规则串。
 * 非法或无法识别的条目直接丢弃，避免 Chromium 因规则语法问题整体失效。
 */
export function buildResolverRules(config: HostmapConfig): string {
  if (!config.enabled) return '';
  return config.entries
    .filter((entry) => isValidHostname(entry.host) && isValidIPv4(entry.ip))
    .map((entry) => `MAP ${entry.host} ${entry.ip}`)
    .join(', ');
}

/** 配置来自磁盘/用户，按 unknown 解析；缺失或非法字段回落到默认值。 */
export function parseHostmapConfig(raw: unknown): HostmapConfig {
  if (!isRecord(raw)) return defaultHostmapConfig();

  const enabled = typeof raw['enabled'] === 'boolean' ? raw['enabled'] : DEFAULT_HOSTMAP.enabled;
  const rawEntries = raw['entries'];
  if (!Array.isArray(rawEntries)) {
    return { enabled, entries: DEFAULT_HOSTMAP.entries.map((e) => ({ ...e })) };
  }

  const entries = rawEntries
    .filter(isHostMapEntry)
    .map((entry) => ({ host: entry.host.trim(), ip: entry.ip.trim() }));
  return { enabled, entries };
}
