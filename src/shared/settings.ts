import {
  type ContentConfig,
  defaultContentConfig,
  MAX_BLACKLIST_TAGS,
  normalizeBlacklistTag,
  parseContentConfig
} from '@shared/content';
import {
  defaultDownloadConfig,
  type DownloadConfig,
  MAX_DOWNLOAD_CONCURRENCY,
  MAX_DOWNLOAD_TEMPLATE_LENGTH,
  MIN_DOWNLOAD_CONCURRENCY,
  parseDownloadConfig
} from '@shared/downloads';
import {
  defaultHostmapConfig,
  type HostmapConfig,
  type HostMapEntry,
  isValidHostname,
  isValidIPv4,
  parseHostmapConfig
} from '@shared/hostmap';
import {
  defaultProvidersConfig,
  parseProvidersConfig,
  type ProvidersConfig,
  validateProviderKey
} from '@shared/providers';
import {
  defaultNetworkConfig,
  isValidProxyHost,
  isValidProxyPort,
  type NetworkConfig,
  parseNetworkConfig,
  PROXY_MODES,
  type ProxyStatus
} from '@shared/proxy';

/**
 * 03 §7 / 07 DR-040：设置页与 `settings:get` / `settings:set` 的唯一数据形状。
 * 与 `config.json` 的分组一一对应，可整体序列化后落盘。
 */
export interface Settings {
  hostmap: HostmapConfig;
  content: ContentConfig;
  downloads: DownloadConfig;
  network: NetworkConfig;
  /** 07 DR-071：第三方图库密钥，空白表示未配置 */
  providers: ProvidersConfig;
}

/** `settings:get` 的返回：设置本体 + 主进程解析后的默认下载目录（渲染层无法自行取 userData） */
export interface SettingsSnapshot {
  settings: Settings;
  defaultDownloadDir: string;
}

/** `settings:set` 的返回：保存后的设置、代理复检状态与"需重启生效"标记 */
export interface SettingsSetResult extends SettingsSnapshot {
  proxyStatus: ProxyStatus;
  restartRequired: boolean;
}

export function defaultSettings(): Settings {
  return {
    hostmap: defaultHostmapConfig(),
    content: defaultContentConfig(),
    downloads: defaultDownloadConfig(),
    network: defaultNetworkConfig(),
    providers: defaultProvidersConfig()
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 磁盘配置按 unknown 解析；各分组缺失或非法时回落默认值（与 readConfig 一致） */
export function parseSettings(raw: unknown): Settings {
  const record = isRecord(raw) ? raw : {};
  return {
    hostmap: parseHostmapConfig(record['hostmap']),
    content: parseContentConfig(record['content']),
    downloads: parseDownloadConfig(record['downloads']),
    network: parseNetworkConfig(record['network']),
    providers: parseProvidersConfig(record['providers'])
  };
}

/** Windows 绝对路径：盘符或 UNC；空串表示使用默认目录 */
const WINDOWS_ABSOLUTE_PATH = /^(?:[a-z]:[\\/]|\\\\)/i;
const ILLEGAL_WINDOWS_PATH_CHARS = /[<>"|?*]|\p{Cc}/u;
const PATH_DRIVE_ONLY = /^[a-z]:[\\/]?$/i;

/**
 * 02 §9 / DR-040：设置页保存前校验。返回面向用户的中文错误列表，空数组表示通过。
 * 解析函数只做"回落到默认"，此处才把用户输入的具体问题反馈出来。
 */
export function validateSettings(settings: Settings): string[] {
  const errors: string[] = [];

  if (
    settings.downloads.concurrency < MIN_DOWNLOAD_CONCURRENCY ||
    settings.downloads.concurrency > MAX_DOWNLOAD_CONCURRENCY ||
    !Number.isInteger(settings.downloads.concurrency)
  ) {
    errors.push(`下载并发需为 ${MIN_DOWNLOAD_CONCURRENCY}–${MAX_DOWNLOAD_CONCURRENCY} 的整数`);
  }

  const dirError = validateDownloadDir(settings.downloads.destinationDir);
  if (dirError !== null) errors.push(dirError);

  const template = settings.downloads.template.trim();
  if (template === '') {
    errors.push('命名模板不能为空');
  } else if (template.length > MAX_DOWNLOAD_TEMPLATE_LENGTH) {
    errors.push(`命名模板不能超过 ${MAX_DOWNLOAD_TEMPLATE_LENGTH} 个字符`);
  }

  const proxy = settings.network.proxy;
  if (!(PROXY_MODES as readonly string[]).includes(proxy.mode)) {
    errors.push('代理模式无效');
  } else if (proxy.mode !== 'direct') {
    // 直连不生成规则串，地址/端口保留原值即可，不做校验（DR-039）
    if (!isValidProxyHost(proxy.host.trim())) errors.push('代理地址需为合法 IPv4 或主机名');
    if (!isValidProxyPort(proxy.port)) errors.push('代理端口需为 1–65535 的整数');
  }

  const entries = settings.hostmap.entries;
  if (settings.hostmap.enabled && entries.length === 0) {
    errors.push('启用 IP 映射时至少保留一条记录');
  }
  const seenHosts = new Set<string>();
  entries.forEach((entry, index) => {
    const host = entry.host.trim().toLowerCase();
    const hostValid = isValidHostname(entry.host);
    if (!hostValid) errors.push(`第 ${index + 1} 条映射的域名无效`);
    if (!isValidIPv4(entry.ip)) errors.push(`第 ${index + 1} 条映射的 IP 无效`);
    if (hostValid && seenHosts.has(host)) errors.push(`域名 ${entry.host.trim()} 重复`);
    if (hostValid) seenHosts.add(host);
  });

  const blacklist = settings.content.blacklist;
  if (blacklist.length > MAX_BLACKLIST_TAGS) {
    errors.push(`标签黑名单最多 ${MAX_BLACKLIST_TAGS} 个`);
  }
  blacklist.forEach((tag, index) => {
    if (normalizeBlacklistTag(tag) === null) {
      errors.push(`标签黑名单第 ${index + 1} 项无效（不能为空、含空格或冒号，也不能以 - 开头）`);
    }
  });

  // DR-071：key 可留空；非空时只允许紧凑的可见字符，避免把整段配置贴进来
  const wallhavenError = validateProviderKey(settings.providers.wallhavenApiKey, 'wallhaven API key');
  if (wallhavenError !== null) errors.push(wallhavenError);

  return errors;
}

function validateDownloadDir(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (!WINDOWS_ABSOLUTE_PATH.test(value)) return '下载目录需为绝对路径（如 D:\\LePic）';
  const withoutDrive = value.replace(/^[a-z]:/i, '');
  if (PATH_DRIVE_ONLY.test(value) || ILLEGAL_WINDOWS_PATH_CHARS.test(withoutDrive)) {
    return '下载目录包含非法字符';
  }
  return null;
}

/** 02 §9：IP 映射改动只能随启动注入，保存后必须提示重启（DR-004 / DR-013） */
export function hostmapRestartRequired(previous: HostmapConfig, next: HostmapConfig): boolean {
  if (previous.enabled !== next.enabled) return true;
  if (previous.entries.length !== next.entries.length) return true;
  return previous.entries.some((entry, index) => {
    const other: HostMapEntry | undefined = next.entries[index];
    return (
      other === undefined ||
      entry.host.trim() !== other.host.trim() ||
      entry.ip.trim() !== other.ip.trim()
    );
  });
}

/** 设置页展示下载目录：配置为空时显示主进程解析后的默认目录 */
export function resolveDownloadDirLabel(configured: string, defaultDir: string): string {
  return configured.trim() !== '' ? configured.trim() : defaultDir;
}
