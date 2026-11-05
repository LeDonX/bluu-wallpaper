import { mkdirSync } from 'node:fs';

import { normalizeBlacklist } from '@shared/content';
import type { DownloadConfig } from '@shared/downloads';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { ProxyConfig, ProxyStatus } from '@shared/proxy';
import {
  hostmapRestartRequired,
  type Settings,
  type SettingsSetResult,
  validateSettings
} from '@shared/settings';

import { parseSettingsInput } from '../settings-input';

export interface SettingsSetDeps {
  read(): Settings;
  write(settings: Settings): void;
  defaultDownloadDir: string;
  /** DR-039：保存后立即对两站 session 应用并复检代理 */
  applyProxy(proxy: ProxyConfig): Promise<ProxyStatus>;
  /** DR-040：目录/模板/并发热更新到下载队列 */
  applyDownloads(config: DownloadConfig): void;
}

export type SettingsSetHandler = (raw: unknown) => Promise<Result<SettingsSetResult>>;

/**
 * `settings:set` 的纯逻辑处理：zod 校验 → 语义校验 → 落盘 → 应用运行时配置。
 * 校验失败返回 `CONFIG` 信封，界面据此展示具体哪一项不合法（05 §4 / 02 §9）。
 */
export function createSettingsSetHandler(deps: SettingsSetDeps): SettingsSetHandler {
  return async (raw) => {
    try {
      const parsed = parseSettingsInput(raw);
      const errors = validateSettings(parsed);
      if (errors.length > 0) {
        throw new AppErrorException(
          createAppError('CONFIG', `设置未保存：${errors.join('；')}`, {
            detail: errors.join('; ')
          })
        );
      }

      // DR-056：黑名单落盘前统一小写并去重，读取侧无需再处理重复项
      const settings: Settings = {
        ...parsed,
        content: { ...parsed.content, blacklist: normalizeBlacklist(parsed.content.blacklist) }
      };

      // DR-058：目录在保存时先验证可创建，避免下载时才发现盘符不存在
      const destinationDir = settings.downloads.destinationDir.trim();
      if (destinationDir !== '') {
        try {
          mkdirSync(destinationDir, { recursive: true });
        } catch (error) {
          throw new AppErrorException(
            createAppError('CONFIG', `设置未保存：下载目录不可用（${destinationDir}）`, {
              detail: error instanceof Error ? error.message : String(error),
              cause: error
            })
          );
        }
      }

      const previous = deps.read();
      deps.write(settings);
      deps.applyDownloads(settings.downloads);
      const proxyStatus = await deps.applyProxy(settings.network.proxy);

      return {
        ok: true,
        data: {
          settings,
          defaultDownloadDir: deps.defaultDownloadDir,
          proxyStatus,
          restartRequired: hostmapRestartRequired(previous.hostmap, settings.hostmap)
        }
      };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('CONFIG', '保存设置失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
