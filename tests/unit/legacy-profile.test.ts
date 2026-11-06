import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DB_FILE_NAME, migrateLegacyProfile } from '@main/storage/legacy-profile';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('品牌改名后的旧配置迁移（DR-074）', () => {
  let root: string;
  let appDataDir: string;
  let legacyDir: string;
  let userDataDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'booru-legacy-'));
    appDataDir = join(root, 'appdata');
    legacyDir = join(appDataDir, 'bluu');
    userDataDir = join(appDataDir, 'lepic');
    mkdirSync(legacyDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('把旧目录的 config.json 与数据库复制到新目录', () => {
    writeFileSync(join(legacyDir, 'config.json'), '{"hostmap":{}}');
    writeFileSync(join(legacyDir, 'bluu.db'), 'db-content');

    migrateLegacyProfile(appDataDir, userDataDir);

    expect(readFileSync(join(userDataDir, 'config.json'), 'utf8')).toBe('{"hostmap":{}}');
    expect(readFileSync(join(userDataDir, DB_FILE_NAME), 'utf8')).toBe('db-content');
  });

  it('新目录已有同名文件时不覆盖', () => {
    writeFileSync(join(legacyDir, 'config.json'), '{"old":true}');
    mkdirSync(userDataDir, { recursive: true });
    writeFileSync(join(userDataDir, 'config.json'), '{"old":false}');

    migrateLegacyProfile(appDataDir, userDataDir);

    expect(readFileSync(join(userDataDir, 'config.json'), 'utf8')).toBe('{"old":false}');
    expect(existsSync(join(userDataDir, DB_FILE_NAME))).toBe(false);
  });

  it('旧目录不存在时不做任何复制', () => {
    rmSync(legacyDir, { recursive: true, force: true });

    migrateLegacyProfile(appDataDir, userDataDir);

    expect(existsSync(join(userDataDir, 'config.json'))).toBe(false);
    expect(existsSync(join(userDataDir, DB_FILE_NAME))).toBe(false);
  });
});
