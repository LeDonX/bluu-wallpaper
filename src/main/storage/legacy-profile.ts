import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** 07 DR-074：品牌改名后的数据库文件名 */
export const DB_FILE_NAME = 'lepic.db';

const CONFIG_FILE_NAME = 'config.json';
const LEGACY_DIR_NAME = 'bluu';
const LEGACY_DB_FILE_NAME = 'bluu.db';

/**
 * 07 DR-074：品牌改名会改变 Electron 的 userData 目录（`appData/<name>`）。
 * 首次以新名字启动时，把旧目录的配置与数据库复制到新目录；目标已存在则跳过。
 * 按 DR-030 的既有口径不复制 `Partitions`，站点 cookie 与 CF clearance 由应用重新获取。
 */
export function migrateLegacyProfile(appDataDir: string, userDataDir: string): void {
  const legacyDir = join(appDataDir, LEGACY_DIR_NAME);
  if (legacyDir === userDataDir || !existsSync(legacyDir)) return;

  const files: ReadonlyArray<readonly [source: string, target: string]> = [
    [CONFIG_FILE_NAME, CONFIG_FILE_NAME],
    [LEGACY_DB_FILE_NAME, DB_FILE_NAME]
  ];

  for (const [sourceName, targetName] of files) {
    const source = join(legacyDir, sourceName);
    const target = join(userDataDir, targetName);
    if (!existsSync(source) || existsSync(target)) continue;
    mkdirSync(userDataDir, { recursive: true });
    copyFileSync(source, target);
  }
}
