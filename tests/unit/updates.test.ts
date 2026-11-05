import { EventEmitter } from 'node:events';

import { createUpdateService, type UpdateUpdater } from '@main/update/service';
import {
  clampPercent,
  initialUpdateState,
  normalizeReleaseNotes
} from '@shared/updates';
import { describe, expect, it } from 'vitest';

interface FakeUpdater {
  emitter: EventEmitter;
  updater: UpdateUpdater;
  calls: { check: number; download: number; install: Array<[boolean?, boolean?]> };
}

function createFakeUpdater(
  check: () => Promise<unknown> = async () => null,
  download: () => Promise<unknown> = async () => []
): FakeUpdater {
  const emitter = new EventEmitter();
  const calls: FakeUpdater['calls'] = { check: 0, download: 0, install: [] };
  const updater = Object.assign(emitter, {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    checkForUpdates: async () => {
      calls.check += 1;
      return check();
    },
    downloadUpdate: async () => {
      calls.download += 1;
      return download();
    },
    quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => {
      calls.install.push([isSilent, isForceRunAfter]);
    }
  }) as unknown as UpdateUpdater;
  return { emitter, updater, calls };
}

const FIXED_NOW = 1_700_000_000_000;

function createService(overrides: {
  isPackaged?: boolean;
  isPortable?: boolean;
  check?: () => Promise<unknown>;
  download?: () => Promise<unknown>;
} = {}) {
  const fake = createFakeUpdater(overrides.check, overrides.download);
  const states: string[] = [];
  const service = createUpdateService({
    updater: fake.updater,
    currentVersion: '0.1.0',
    isPackaged: overrides.isPackaged ?? true,
    isPortable: overrides.isPortable ?? false,
    now: () => FIXED_NOW,
    onStateChange: (state) => states.push(state.phase)
  });
  return { ...fake, service, states };
}

describe('更新状态辅助函数', () => {
  it('初始状态为 idle 且版本取自当前应用', () => {
    expect(initialUpdateState('0.1.0')).toEqual({
      phase: 'idle',
      currentVersion: '0.1.0',
      version: null,
      releaseNotes: null,
      progress: null,
      message: null,
      detail: null,
      checkedAt: null
    });
  });

  it('下载进度百分比截断到 0–100', () => {
    expect(clampPercent(37.4)).toBe(37.4);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('releaseNotes 兼容字符串与多版本数组', () => {
    expect(normalizeReleaseNotes('  修复若干问题  ')).toBe('修复若干问题');
    expect(normalizeReleaseNotes('   ')).toBeNull();
    expect(normalizeReleaseNotes(undefined)).toBeNull();
    expect(
      normalizeReleaseNotes([
        { version: '1.1.0', note: '新增更新入口' },
        { version: '1.0.9', note: null }
      ])
    ).toBe('1.1.0: 新增更新入口\n1.0.9');
  });
});

describe('自动更新状态机', () => {
  it('开发模式返回 unsupported，且检查与下载不会真正发起', () => {
    const { service, calls } = createService({ isPackaged: false });
    expect(service.getState().phase).toBe('unsupported');
    expect(service.getState().message).toBe('开发模式不支持自动更新，请在安装版中使用');

    return Promise.all([service.check(), service.download()]).then(([check, download]) => {
      expect(check.ok).toBe(true);
      expect(download.ok).toBe(true);
      expect(calls.check).toBe(0);
      expect(calls.download).toBe(0);
      expect(service.install().ok).toBe(false);
    });
  });

  it('便携版返回 unsupported 并区分原因', () => {
    const { service } = createService({ isPortable: true });
    expect(service.getState().phase).toBe('unsupported');
    expect(service.getState().message).toBe('便携版不支持自动更新，请使用安装版');
  });

  it('检查到新版本后进入 available，并记录版本与说明', async () => {
    const { service, emitter } = createService({
      check: async () => {
        emitter.emit('checking-for-update');
        emitter.emit('update-available', {
          version: '1.1.0',
          releaseNotes: '新增自动更新入口'
        });
        return null;
      }
    });

    const result = await service.check();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phase).toBe('available');
    expect(result.data.version).toBe('1.1.0');
    expect(result.data.releaseNotes).toBe('新增自动更新入口');
    expect(result.data.checkedAt).toBe(FIXED_NOW);
  });

  it('无新版本时进入 not-available', async () => {
    const { service, emitter } = createService({
      check: async () => {
        emitter.emit('update-not-available', { version: '0.1.0' });
        return null;
      }
    });

    const result = await service.check();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phase).toBe('not-available');
    expect(result.data.checkedAt).toBe(FIXED_NOW);
  });

  it('检查异常时进入 error 并保留技术细节', async () => {
    const { service } = createService({
      check: async () => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))
    });

    const result = await service.check();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phase).toBe('error');
    expect(result.data.message).toBe('检查更新失败，请稍后重试');
    expect(result.data.detail).toBe('net::ERR_INTERNET_DISCONNECTED');
  });

  it('下载需要先处于 available，否则返回前置错误', async () => {
    const { service, calls } = createService();
    const result = await service.download();
    expect(result.ok).toBe(false);
    expect(calls.download).toBe(0);
  });

  it('下载进度实时更新，下载完成进入 downloaded，安装触发重启', async () => {
    const { service, emitter, calls } = createService({
      check: async () => {
        emitter.emit('update-available', { version: '1.1.0' });
        return null;
      },
      download: async () => {
        emitter.emit('download-progress', {
          percent: 42.5,
          transferred: 1024,
          total: 2048,
          bytesPerSecond: 512
        });
        emitter.emit('download-progress', {
          percent: 120,
          transferred: 9000,
          total: 2048,
          bytesPerSecond: 800
        });
        emitter.emit('update-downloaded', { version: '1.1.0' });
        return [];
      }
    });

    await service.check();
    const downloaded = await service.download();
    expect(downloaded.ok).toBe(true);
    if (!downloaded.ok) return;
    expect(downloaded.data.phase).toBe('downloaded');
    expect(downloaded.data.version).toBe('1.1.0');
    expect(downloaded.data.progress?.percent).toBe(100);
    // transferred 不允许超过 total
    expect(downloaded.data.progress?.transferred).toBe(2048);

    const installed = service.install();
    expect(installed.ok).toBe(true);
    expect(calls.install).toEqual([[false, true]]);
  });

  it('下载过程中异常进入 error，文案区分为下载失败', async () => {
    const { service, emitter } = createService({
      check: async () => {
        emitter.emit('update-available', { version: '1.1.0' });
        return null;
      },
      download: async () => Promise.reject(new Error('disk full'))
    });

    await service.check();
    const result = await service.download();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phase).toBe('error');
    expect(result.data.message).toBe('下载更新失败，请稍后重试');
    expect(result.data.detail).toBe('disk full');
  });

  it('未下载完成时拒绝安装', () => {
    const { service } = createService();
    expect(service.install().ok).toBe(false);
  });

  it('检查进行中重复点击不会并发发起请求', async () => {
    const pending: { resolve: ((value: unknown) => void) | null } = { resolve: null };
    const { service, calls, emitter } = createService({
      check: async () =>
        new Promise((resolve) => {
          emitter.emit('checking-for-update');
          pending.resolve = resolve;
        })
    });

    const first = service.check();
    const second = await service.check();
    expect(second.ok).toBe(true);
    expect(calls.check).toBe(1);
    pending.resolve?.(null);
    await first;
  });

  it('状态变化逐次广播，供 `updates:status` 推送', async () => {
    const { service, emitter, states } = createService({
      check: async () => {
        emitter.emit('update-available', { version: '1.1.0' });
        return null;
      }
    });

    await service.check();
    expect(states).toContain('checking');
    expect(states).toContain('available');
  });
});
