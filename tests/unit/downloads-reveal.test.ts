import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDownloadsRevealHandler } from '@main/ipc/handlers/downloads-reveal';
import type { DownloadTask } from '@shared/downloads';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeTask(destPath: string, overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: 'task-1',
    site: 'yande',
    postId: 42,
    url: 'https://files.yande.re/image/abc.jpg',
    md5: 'abc123',
    destPath,
    status: 'done',
    bytesDone: 64,
    bytesTotal: 64,
    retries: 0,
    error: null,
    createdAt: 1793668940000,
    updatedAt: 1793668940000,
    ...overrides
  };
}

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'booru-reveal-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('downloads:reveal（DR-043）', () => {
  it('已完成任务打开文件夹并选中最终文件', async () => {
    const destPath = join(directory, 'yande', 'abc.jpg');
    mkdirSync(join(directory, 'yande'), { recursive: true });
    writeFileSync(destPath, new Uint8Array(64));

    const showItemInFolder = vi.fn();
    const openPath = vi.fn(async () => '');
    const handler = createDownloadsRevealHandler({
      list: () => [makeTask(destPath)],
      showItemInFolder,
      openPath
    });

    const result = await handler({ taskId: 'task-1' });
    expect(result.ok).toBe(true);
    expect(showItemInFolder).toHaveBeenCalledWith(destPath);
    expect(openPath).not.toHaveBeenCalled();
  });

  it('未完成时选中 .part 文件', async () => {
    const destPath = join(directory, 'yande', 'abc.jpg');
    mkdirSync(join(directory, 'yande'), { recursive: true });
    writeFileSync(`${destPath}.part`, new Uint8Array(8));

    const showItemInFolder = vi.fn();
    const handler = createDownloadsRevealHandler({
      list: () => [makeTask(destPath, { status: 'paused' })],
      showItemInFolder,
      openPath: vi.fn(async () => '')
    });

    const result = await handler({ taskId: 'task-1' });
    expect(result.ok).toBe(true);
    expect(showItemInFolder).toHaveBeenCalledWith(`${destPath}.part`);
  });

  it('文件和 .part 都不存在时只打开目录', async () => {
    const destPath = join(directory, 'yande', 'abc.jpg');
    const openPath = vi.fn(async () => '');

    const result = await createDownloadsRevealHandler({
      list: () => [makeTask(destPath, { status: 'queued' })],
      showItemInFolder: vi.fn(),
      openPath
    })({ taskId: 'task-1' });

    expect(result.ok).toBe(true);
    expect(openPath).toHaveBeenCalledWith(join(directory, 'yande'));
  });

  it('未知任务返回 DOWNLOAD 错误，不打开任何目录', async () => {
    const showItemInFolder = vi.fn();
    const openPath = vi.fn(async () => '');
    const result = await createDownloadsRevealHandler({
      list: () => [],
      showItemInFolder,
      openPath
    })({ taskId: 'missing' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DOWNLOAD');
    expect(showItemInFolder).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  it('非法入参返回 CONFIG', async () => {
    const result = await createDownloadsRevealHandler({
      list: () => [],
      showItemInFolder: vi.fn(),
      openPath: vi.fn(async () => '')
    })({ taskId: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFIG');
  });
});
