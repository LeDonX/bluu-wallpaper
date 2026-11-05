import {
  describeBatchSummary,
  DOWNLOAD_BATCH_SIZE,
  DOWNLOAD_CONFIRM_THRESHOLD,
  enqueueDownloadBatch,
  type EnqueueDownloads,
  estimateBatchSize,
  formatBatchSize,
  shouldConfirmBatch,
  splitDownloadBatch} from '@shared/download-batch';
import type { DownloadEnqueueInput } from '@shared/downloads';
import { createAppError } from '@shared/errors';
import type { Post } from '@shared/models';
import { describe, expect, it } from 'vitest';

const post = (id: number, fileSize = 1024): Post => ({
  site: 'yande',
  id,
  md5: `${id}`.padStart(32, '0'),
  previewUrl: `https://assets.example/${id}.jpg`,
  sampleUrl: `https://files.example/sample/${id}.jpg`,
  fileUrl: `https://files.example/image/${id}.jpg`,
  width: 100,
  height: 100,
  fileSize,
  rating: 'safe',
  score: 0,
  tags: [{ name: 'sample', type: 'general' }],
  createdAt: 1_793_668_940_000
});

describe('批量确认阈值（02 §7.5）', () => {
  it('50 张及以下不弹确认，51 张起弹确认', () => {
    expect(DOWNLOAD_CONFIRM_THRESHOLD).toBe(50);
    expect(shouldConfirmBatch(0)).toBe(false);
    expect(shouldConfirmBatch(50)).toBe(false);
    expect(shouldConfirmBatch(51)).toBe(true);
  });
});

describe('分片提交（03 §7 / DR-038）', () => {
  it('每片不超过 100 张，末片保留余数', () => {
    expect(DOWNLOAD_BATCH_SIZE).toBe(100);
    const chunks = splitDownloadBatch(Array.from({ length: 250 }, (_item, index) => index + 1));
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
  });

  it('空数组不产生分片；单项一片', () => {
    expect(splitDownloadBatch([])).toEqual([]);
    expect(splitDownloadBatch([1])).toEqual([[1]]);
  });
});

describe('预估体积（02 §7.5）', () => {
  it('缺失或 0 计入未知，其余求和', () => {
    const estimate = estimateBatchSize([post(1, 2048), post(2, 0), post(3, -1)]);
    expect(estimate).toEqual({ bytes: 2048, unknownCount: 2 });
  });

  it('全部已知显示可读体积，全部未知显示未知，部分未知标注数量', () => {
    expect(formatBatchSize({ bytes: 2048, unknownCount: 0 })).toBe('2.0 KB');
    expect(formatBatchSize({ bytes: 0, unknownCount: 3 })).toBe('未知');
    expect(formatBatchSize({ bytes: 1536, unknownCount: 2 })).toBe('约 1.5 KB（2 张未知）');
  });
});

describe('批量入队汇总（DR-038）', () => {
  it('250 张按 100 分片，汇总 added / skipped', async () => {
    const calls: DownloadEnqueueInput[] = [];
    const enqueue: EnqueueDownloads = async (input) => {
      calls.push(input);
      return {
        ok: true,
        data: {
          taskIds: input.posts.map((item) => `task-${item.id}`),
          skipped: 0
        }
      };
    };

    const posts = Array.from({ length: 250 }, (_item, index) => post(index + 1));
    const summary = await enqueueDownloadBatch(posts, 'yande', enqueue);

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.posts.length)).toEqual([100, 100, 50]);
    expect(calls.every((call) => call.site === 'yande')).toBe(true);
    expect(summary).toEqual({ requested: 250, added: 250, skipped: 0, failed: 0 });
  });

  it('单片失败或抛异常只计入该片，后续分片继续', async () => {
    const posts = Array.from({ length: 250 }, (_item, index) => post(index + 1));
    const calls: DownloadEnqueueInput[] = [];
    const enqueue: EnqueueDownloads = async (input) => {
      calls.push(input);
      if (calls.length === 1) {
        return {
          ok: true,
          data: { taskIds: input.posts.slice(0, 97).map((item) => `task-${item.id}`), skipped: 3 }
        };
      }
      if (calls.length === 2) throw new Error('network down');
      return { ok: false, error: createAppError('DOWNLOAD', '入队失败') };
    };

    const summary = await enqueueDownloadBatch(posts, 'yande', enqueue);

    expect(calls).toHaveLength(3);
    expect(summary).toEqual({ requested: 250, added: 97, skipped: 3, failed: 150 });
  });

  it('汇总文案包含已加入、已跳过与失败数量', () => {
    expect(
      describeBatchSummary({ requested: 120, added: 110, skipped: 5, failed: 5 })
    ).toBe('已加入 110 项，已跳过 5 项，失败 5 项');
  });
});
