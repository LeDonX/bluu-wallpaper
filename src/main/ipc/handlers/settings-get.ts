import type { Result } from '@shared/errors';
import type { Settings } from '@shared/settings';
import type { SettingsSnapshot } from '@shared/settings';

export interface SettingsGetDeps {
  read(): Settings;
  /** 主进程解析后的默认下载目录，供渲染层在未自定义时展示 */
  defaultDownloadDir: string;
}

export type SettingsGetHandler = () => Result<SettingsSnapshot>;

/** 03 §7 / DR-040：读取当前 `config.json` 的设置快照 */
export function createSettingsGetHandler(deps: SettingsGetDeps): SettingsGetHandler {
  return () => ({
    ok: true,
    data: { settings: deps.read(), defaultDownloadDir: deps.defaultDownloadDir }
  });
}
