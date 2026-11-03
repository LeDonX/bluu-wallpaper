import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type ContentConfig, defaultContentConfig, parseContentConfig } from '@shared/content';
import {
  buildResolverRules,
  defaultHostmapConfig,
  type HostmapConfig,
  parseHostmapConfig
} from '@shared/hostmap';
import { app } from 'electron';

export interface AppConfig {
  hostmap: HostmapConfig;
  content: ContentConfig;
}

export const HOST_RESOLVER_RULES_SWITCH = 'host-resolver-rules';

const CONFIG_FILE_NAME = 'config.json';

const defaultAppConfig = (): AppConfig => ({
  hostmap: defaultHostmapConfig(),
  content: defaultContentConfig()
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME);
}

/** 读取失败（缺失、损坏）一律回落到默认配置，启动流程不因配置中断。 */
export function readConfig(configPath: string): AppConfig {
  if (!existsSync(configPath)) return defaultAppConfig();
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
    const record: Record<string, unknown> = isRecord(parsed) ? parsed : {};
    return {
      hostmap: parseHostmapConfig(record['hostmap']),
      content: parseContentConfig(record['content'])
    };
  } catch {
    return defaultAppConfig();
  }
}

/** 先写临时文件再改名，避免进程中断留下半截 JSON。 */
export function writeConfig(configPath: string, config: AppConfig): void {
  mkdirSync(dirname(configPath), { recursive: true });
  const tempPath = `${configPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  renameSync(tempPath, configPath);
}

/** 首次启动落一份默认配置，用户可直接编辑；已有文件不覆盖。 */
export function ensureConfigFile(configPath: string): void {
  if (!existsSync(configPath)) writeConfig(configPath, defaultAppConfig());
}

/**
 * 必须在 app ready 之前调用：`appendSwitch` 只对之后建立的 Chromium 网络栈生效（DR-004）。
 * 返回注入的规则串，便于启动日志与冒烟验证。
 */
export function applyHostmap(configPath: string = getConfigPath()): string {
  ensureConfigFile(configPath);
  const rules = buildResolverRules(readConfig(configPath).hostmap);
  if (rules) app.commandLine.appendSwitch(HOST_RESOLVER_RULES_SWITCH, rules);
  return rules;
}
