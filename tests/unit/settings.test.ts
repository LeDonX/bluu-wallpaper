import { createSettingsGetHandler } from '@main/ipc/handlers/settings-get';
import { createSettingsSetHandler } from '@main/ipc/handlers/settings-set';
import { parseSettingsInput } from '@main/ipc/settings-input';
import { defaultHostmapConfig } from '@shared/hostmap';
import type { ProxyStatus } from '@shared/proxy';
import {
  defaultSettings,
  hostmapRestartRequired,
  parseSettings,
  validateSettings
} from '@shared/settings';
import { describe, expect, it } from 'vitest';

const PROXY_STATUS: ProxyStatus = {
  configured: 'direct',
  effective: 'direct',
  fallback: false,
  reason: null
};

function settingsWith(patch: (settings: ReturnType<typeof defaultSettings>) => void) {
  const settings = defaultSettings();
  patch(settings);
  return settings;
}

describe('设置模型解析（DR-040）', () => {
  it('缺失或空对象回落四组默认值', () => {
    expect(parseSettings(undefined)).toEqual(defaultSettings());
    expect(parseSettings({})).toEqual(defaultSettings());
  });

  it('群组缺失时独立回落，不影响其他组', () => {
    const parsed = parseSettings({
      content: { allowExplicit: true },
      downloads: { concurrency: 5, destinationDir: 'D:\\Bluu', template: '{id}.{ext}' }
    });
    expect(parsed.content.allowExplicit).toBe(true);
    expect(parsed.downloads.concurrency).toBe(5);
    expect(parsed.downloads.destinationDir).toBe('D:\\Bluu');
    expect(parsed.hostmap.entries.length).toBe(defaultHostmapConfig().entries.length);
  });
});

describe('设置保存前校验（02 §9）', () => {
  it('默认设置通过校验', () => {
    expect(validateSettings(defaultSettings())).toEqual([]);
  });

  it('并发越界、相对目录、非法字符、空模板均被拒绝', () => {
    const errors = validateSettings(
      settingsWith((settings) => {
        settings.downloads.concurrency = 7;
        settings.downloads.destinationDir = 'relative\\dir';
        settings.downloads.template = '   ';
      })
    );
    expect(errors.join('|')).toContain('并发需为 1–6');
    expect(errors.join('|')).toContain('绝对路径');
    expect(errors.join('|')).toContain('模板不能为空');

    expect(
      validateSettings(
        settingsWith((settings) => {
          settings.downloads.destinationDir = 'D:\\bad|dir';
        })
      ).join('|')
    ).toContain('非法字符');
  });

  it('非直连代理校验地址与端口；直连时忽略地址端口', () => {
    const invalidProxy = validateSettings(
      settingsWith((settings) => {
        settings.network.proxy.mode = 'http';
        settings.network.proxy.host = 'http://127.0.0.1';
        settings.network.proxy.port = 0;
      })
    );
    expect(invalidProxy.join('|')).toContain('代理地址');
    expect(invalidProxy.join('|')).toContain('代理端口');

    const direct = validateSettings(
      settingsWith((settings) => {
        settings.network.proxy.mode = 'direct';
        settings.network.proxy.host = 'not a host';
        settings.network.proxy.port = 70000;
      })
    );
    expect(direct).toEqual([]);
  });

  it('IP 映射启用时必须至少一条，条目域名/IP 与重复都会被指出', () => {
    expect(
      validateSettings(
        settingsWith((settings) => {
          settings.hostmap = { enabled: true, entries: [] };
        })
      ).join('|')
    ).toContain('至少保留一条');

    const errors = validateSettings(
      settingsWith((settings) => {
        settings.hostmap = {
          enabled: true,
          entries: [
            { host: 'files.yande.re', ip: '1.2.3.4' },
            { host: 'files.yande.re', ip: '1.2.3.4' },
            { host: 'bad host', ip: '999.1.1.1' }
          ]
        };
      })
    );
    expect(errors.join('|')).toContain('域名 files.yande.re 重复');
    expect(errors.join('|')).toContain('第 3 条映射的域名无效');
    expect(errors.join('|')).toContain('第 3 条映射的 IP 无效');
  });

  it('黑名单非法标签与超过上限都会被拒绝', () => {
    const invalid = validateSettings(
      settingsWith((settings) => {
        settings.content.blacklist = ['bad tag', 'rating:e', '-foo', 'lowres'];
      })
    );
    expect(invalid.join('|')).toContain('第 1 项无效');
    expect(invalid.join('|')).toContain('第 2 项无效');
    expect(invalid.join('|')).toContain('第 3 项无效');

    const tooMany = validateSettings(
      settingsWith((settings) => {
        settings.content.blacklist = Array.from({ length: 101 }, (_, index) => `tag${index}`);
      })
    );
    expect(tooMany.join('|')).toContain('最多 100 个');
  });
});

describe('IP 映射重启提示（DR-004 / DR-013）', () => {
  it('条目或启用状态变化返回 true，顺序与空白差异不算变化', () => {
    const current = defaultHostmapConfig();
    expect(hostmapRestartRequired(current, defaultHostmapConfig())).toBe(false);
    expect(
      hostmapRestartRequired(current, {
        enabled: !current.enabled,
        entries: current.entries
      })
    ).toBe(true);
    expect(
      hostmapRestartRequired(current, {
        enabled: current.enabled,
        entries: current.entries.map((entry) => ({ host: ` ${entry.host}`, ip: `${entry.ip} ` }))
      })
    ).toBe(false);
    expect(
      hostmapRestartRequired(current, {
        enabled: current.enabled,
        entries: [...current.entries, { host: 'x.test', ip: '10.0.0.1' }]
      })
    ).toBe(true);
  });
});

describe('settings:get / settings:set handler', () => {
  interface Harness {
    deps: Parameters<typeof createSettingsSetHandler>[0];
    stored(): ReturnType<typeof defaultSettings>;
    applied(): { proxy: number; downloads: number };
  }

  function createHarness(initial = defaultSettings()): Harness {
    let stored = initial;
    const applied = { proxy: 0, downloads: 0 };
    const deps = {
      read: () => stored,
      write: (settings: ReturnType<typeof defaultSettings>) => {
        stored = settings;
      },
      defaultDownloadDir: 'C:\\Users\\me\\AppData\\Roaming\\booru-desktop\\downloads',
      applyProxy: async (): Promise<ProxyStatus> => {
        applied.proxy += 1;
        return PROXY_STATUS;
      },
      applyDownloads: () => {
        applied.downloads += 1;
      }
    };
    return { deps, stored: () => stored, applied: () => applied };
  }

  it('get 返回当前设置与默认下载目录', () => {
    const harness = createHarness();
    const getSettings = createSettingsGetHandler(harness.deps);
    const result = getSettings();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.defaultDownloadDir).toContain('downloads');
    expect(result.data.settings.downloads.concurrency).toBe(3);
  });

  it('合法设置落盘并立即应用到代理与下载队列', async () => {
    const harness = createHarness();
    const setSettings = createSettingsSetHandler(harness.deps);
    const input = settingsWith((settings) => {
      settings.downloads = {
        concurrency: 5,
        destinationDir: 'D:\\Bluu',
        template: '{id}.{ext}',
        format: 'jpeg'
      };
      settings.content.allowExplicit = true;
    });

    const result = await setSettings(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(harness.stored().downloads.concurrency).toBe(5);
    expect(harness.stored().downloads.destinationDir).toBe('D:\\Bluu');
    expect(harness.stored().content.allowExplicit).toBe(true);
    expect(harness.applied()).toEqual({ proxy: 1, downloads: 1 });
    expect(result.data.restartRequired).toBe(false);
    expect(result.data.proxyStatus).toEqual(PROXY_STATUS);
  });

  it('黑名单落盘前统一小写并去重（DR-056）', async () => {
    const harness = createHarness();
    const setSettings = createSettingsSetHandler(harness.deps);
    const input = settingsWith((settings) => {
      settings.content.blacklist = [' LowRes ', 'LOWRES', 'bad_id'];
    });

    const result = await setSettings(input);
    expect(result.ok).toBe(true);
    expect(harness.stored().content.blacklist).toEqual(['lowres', 'bad_id']);
  });

  it('IP 映射变化返回重启提示', async () => {
    const harness = createHarness();
    const setSettings = createSettingsSetHandler(harness.deps);
    const input = settingsWith((settings) => {
      settings.hostmap.enabled = false;
    });

    const result = await setSettings(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.restartRequired).toBe(true);
  });

  it('非法设置返回 CONFIG 信封且不落盘、不应用', async () => {
    const harness = createHarness();
    const setSettings = createSettingsSetHandler(harness.deps);
    const before = harness.stored();
    const input = settingsWith((settings) => {
      settings.downloads.concurrency = 9;
    });

    const result = await setSettings(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFIG');
    expect(result.error.message).toContain('设置未保存');
    expect(harness.stored()).toEqual(before);
    expect(harness.applied()).toEqual({ proxy: 0, downloads: 0 });
  });

  it('结构不完整或类型错误由 zod 拒绝', () => {
    expect(() => parseSettingsInput({ downloads: { concurrency: 3 } })).toThrow();
    expect(() => parseSettingsInput(null)).toThrow();
  });
});
