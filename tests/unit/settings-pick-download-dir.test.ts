import { createSettingsPickDownloadDirHandler } from '@main/ipc/handlers/settings-pick-download-dir';
import { describe, expect, it, vi } from 'vitest';

function makeDeps(overrides: { usable?: string[]; picked?: string | null } = {}) {
  const usable = overrides.usable ?? ['/usable'];
  const pickDirectory = vi.fn(async () =>
    overrides.picked === undefined ? '/picked' : overrides.picked
  );
  return {
    pickDirectory,
    deps: {
      pickDirectory,
      isUsableDirectory: (path: string) => usable.includes(path),
      fallbackDir: () => '/fallback'
    }
  };
}

describe('settings:pick-download-dir（DR-061）', () => {
  it('草稿目录可用时从该目录打开选择框', async () => {
    const { deps, pickDirectory } = makeDeps();

    const result = await createSettingsPickDownloadDirHandler(deps)({ current: '/usable' });

    expect(pickDirectory).toHaveBeenCalledWith('/usable');
    expect(result).toEqual({ ok: true, data: '/picked' });
  });

  it('草稿为空或不可用时回退到配置/默认目录', async () => {
    const { deps, pickDirectory } = makeDeps();
    const handler = createSettingsPickDownloadDirHandler(deps);

    await handler({ current: '   ' });
    expect(pickDirectory).toHaveBeenCalledWith('/fallback');

    await handler({ current: '/missing' });
    expect(pickDirectory).toHaveBeenLastCalledWith('/fallback');

    await handler(undefined);
    expect(pickDirectory).toHaveBeenLastCalledWith('/fallback');
  });

  it('取消选择返回 data: null，不视为失败', async () => {
    const { deps } = makeDeps({ picked: null });

    const result = await createSettingsPickDownloadDirHandler(deps)({ current: '/usable' });

    expect(result).toEqual({ ok: true, data: null });
  });

  it('入参非法时返回 CONFIG，不弹框', async () => {
    const { deps, pickDirectory } = makeDeps();

    const result = await createSettingsPickDownloadDirHandler(deps)({ current: 123 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFIG');
    expect(pickDirectory).not.toHaveBeenCalled();
  });

  it('对话框异常映射为 CONFIG', async () => {
    const handler = createSettingsPickDownloadDirHandler({
      pickDirectory: async () => {
        throw new Error('dialog failed');
      },
      isUsableDirectory: () => false,
      fallbackDir: () => '/fallback'
    });

    const result = await handler({ current: '/usable' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG');
      expect(result.error.detail).toContain('dialog failed');
    }
  });
});
