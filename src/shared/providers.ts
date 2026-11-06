import type { ProviderSiteId } from '@shared/constants';

/**
 * 07 DR-071：第三方图库密钥。只保存在本机 `config.json#providers`，
 * 不写入日志、错误 `detail` 与诊断报告；空白视为未配置。
 */
export interface ProvidersConfig {
  wallhavenApiKey: string;
}

/** 密钥长度上限：wallhaven 32，留足余量避免误判合法 key */
export const MAX_PROVIDER_KEY_LENGTH = 512;

export function defaultProvidersConfig(): ProvidersConfig {
  return { wallhavenApiKey: '' };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 磁盘配置按 unknown 解析；缺失或非字符串一律视为未配置 */
export function parseProvidersConfig(raw: unknown): ProvidersConfig {
  if (!isRecord(raw)) return defaultProvidersConfig();
  return {
    wallhavenApiKey: typeof raw['wallhavenApiKey'] === 'string' ? raw['wallhavenApiKey'] : ''
  };
}

/** 保存前统一 trim；纯空白 key 归一化为空串 */
export function sanitizeProvidersConfig(providers: ProvidersConfig): ProvidersConfig {
  return {
    wallhavenApiKey: providers.wallhavenApiKey.trim()
  };
}

/** 按站点取 key；Bing 无需密钥，返回空串 */
export function providerApiKey(providers: ProvidersConfig, site: ProviderSiteId): string {
  switch (site) {
    case 'wallhaven':
      return providers.wallhavenApiKey.trim();
    default:
      return '';
  }
}

/** 07 DR-071：T-50/T-51 用此判断站点是否可用 */
export function hasProviderKey(providers: ProvidersConfig, site: ProviderSiteId): boolean {
  return providerApiKey(providers, site) !== '';
}

/** 面向用户的校验文案；空 key 合法（表示不启用该图库） */
export function validateProviderKey(key: string, label: string): string | null {
  if (key.trim() === '') return null;
  if (/\s/.test(key) || /\p{Cc}/u.test(key)) {
    return `${label}不能包含空白或控制字符`;
  }
  if (key.trim().length > MAX_PROVIDER_KEY_LENGTH) {
    return `${label}长度不能超过 ${MAX_PROVIDER_KEY_LENGTH} 个字符`;
  }
  return null;
}
