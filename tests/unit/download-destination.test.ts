import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDestinationGuard, isUsableDirectory } from '@main/download/destination';
import { afterEach, describe, expect, it, vi } from 'vitest';

const roots: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'booru-dest-'));
  roots.push(dir);
  return dir;
}

function cleanup(): void {
  while (roots.length > 0) {
    const dir = roots.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

describe('下载目录校验（DR-059）', () => {
  afterEach(cleanup);

  it('目录可用时不弹选择框，也不写配置', async () => {
    const dir = makeRoot();
    const pick = vi.fn(async () => null);
    const apply = vi.fn();
    const guard = createDestinationGuard({
      readDestinationDir: () => dir,
      defaultDir: dir,
      pickDirectory: pick,
      applyDestination: apply
    });

    const result = await guard();
    cleanup();

    expect(result).toEqual({ ok: true, data: undefined });
    expect(pick).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it('配置目录无效时弹框，选中后写回并继续', async () => {
    const root = makeRoot();
    const invalid = join(root, 'missing-drive');
    const picked = join(root, 'picked');
    const apply = vi.fn();
    const guard = createDestinationGuard({
      readDestinationDir: () => invalid,
      defaultDir: join(root, 'default'),
      pickDirectory: async () => picked,
      applyDestination: apply
    });

    const result = await guard();
    cleanup();

    expect(result.ok).toBe(true);
    expect(apply).toHaveBeenCalledWith(picked);
  });

  it('配置目录指向文件时同样视为无效', async () => {
    const root = makeRoot();
    const blocker = join(root, 'blocker');
    writeFileSync(blocker, 'file');
    const pick = vi.fn(async () => null);
    const guard = createDestinationGuard({
      readDestinationDir: () => blocker,
      defaultDir: join(root, 'default'),
      pickDirectory: pick,
      applyDestination: vi.fn()
    });

    const result = await guard();
    cleanup();

    expect(pick).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DOWNLOAD');
  });

  it('取消选择时返回 DOWNLOAD 错误且不写配置', async () => {
    const root = makeRoot();
    const apply = vi.fn();
    const guard = createDestinationGuard({
      readDestinationDir: () => join(root, 'missing'),
      defaultDir: join(root, 'default'),
      pickDirectory: async () => null,
      applyDestination: apply
    });

    const result = await guard();
    cleanup();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DOWNLOAD');
      expect(result.error.message).toBe('未选择下载目录，下载未开始');
    }
    expect(apply).not.toHaveBeenCalled();
  });

  it('保存失败时返回 CONFIG 错误', async () => {
    const root = makeRoot();
    const picked = join(root, 'picked');
    const guard = createDestinationGuard({
      readDestinationDir: () => join(root, 'missing'),
      defaultDir: join(root, 'default'),
      pickDirectory: async () => picked,
      applyDestination: () => {
        throw new Error('disk full');
      }
    });

    const result = await guard();
    cleanup();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG');
      expect(result.error.detail).toContain('disk full');
    }
  });

  it('默认目录缺失时自动创建，不弹框', async () => {
    const root = makeRoot();
    const defaultDir = join(root, 'default-downloads');
    const pick = vi.fn(async () => null);
    const guard = createDestinationGuard({
      readDestinationDir: () => '',
      defaultDir,
      pickDirectory: pick,
      applyDestination: vi.fn()
    });

    const result = await guard();

    expect(pick).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(isUsableDirectory(defaultDir)).toBe(true);
    cleanup();
  });
});
