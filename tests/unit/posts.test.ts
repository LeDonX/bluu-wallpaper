import type { Post } from '@shared/models';
import {
  advanceFillProgress,
  filterUnviewed,
  INITIAL_FILL_PROGRESS,
  isAutoFillExhausted,
  MAX_AUTO_FILL_PAGES,
  mergePosts
} from '@shared/posts';
import { describe, expect, it } from 'vitest';

const post = (id: number, site: Post['site'] = 'yande'): Post => ({
  site,
  id,
  md5: `${id}`.padStart(32, '0'),
  previewUrl: `https://assets.example/${id}.jpg`,
  sampleUrl: `https://files.example/sample/${id}.jpg`,
  fileUrl: `https://files.example/image/${id}.jpg`,
  width: 100,
  height: 100,
  fileSize: 1,
  rating: 'safe',
  score: 0,
  tags: [{ name: 'sample', type: 'general' }],
  createdAt: 1_793_668_940_000
});

describe('mergePosts 翻页去重', () => {
  it('1000 条唯一结果合并后无重复、顺序稳定', () => {
    const first = Array.from({ length: 1000 }, (_item, index) => post(index + 1));
    const merged = mergePosts(first, []);

    expect(merged).toHaveLength(1000);
    expect(new Set(merged.map((item) => item.id)).size).toBe(1000);
    expect(merged[0]?.id).toBe(1);
    expect(merged[999]?.id).toBe(1000);
  });

  it('第 2 页含重复 id 时只追加新条目（09 TC-12）', () => {
    const first = Array.from({ length: 1000 }, (_item, index) => post(index + 1));
    const secondPage = [post(999), post(1000), post(1001), post(1002)];

    const merged = mergePosts(first, secondPage);

    expect(merged).toHaveLength(1002);
    expect(merged.slice(-2).map((item) => item.id)).toEqual([1001, 1002]);
  });

  it('不同站点的同 id 视为不同条目', () => {
    const merged = mergePosts([post(1, 'yande')], [post(1, 'konachan')]);

    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.site)).toEqual(['yande', 'konachan']);
  });
});

describe('filterUnviewed 隐藏已看（02 §6.3）', () => {
  it('剔除已看项并保持原有顺序', () => {
    const posts = [post(1), post(2), post(3), post(4)];

    const visible = filterUnviewed(posts, new Set([2, 4]));

    expect(visible.map((item) => item.id)).toEqual([1, 3]);
  });

  it('全部已看时返回空数组，关闭开关即可用原列表恢复', () => {
    const posts = [post(1), post(2)];

    expect(filterUnviewed(posts, new Set([1, 2]))).toEqual([]);
    expect(filterUnviewed(posts, new Set())).toHaveLength(2);
  });
});

describe('advanceFillProgress 连续补页统计（02 §6.3）', () => {
  it('出现任一未看项即重置连续计数与跳过数', () => {
    const previous = { streak: 3, skipped: 300 };

    const next = advanceFillProgress(previous, 100, 99);

    expect(next).toEqual(INITIAL_FILL_PROGRESS);
  });

  it('整页已看时累计连续次数与跳过数量', () => {
    const next = advanceFillProgress({ streak: 1, skipped: 100 }, 100, 100);

    expect(next).toEqual({ streak: 2, skipped: 200 });
  });

  it('空页视为结果耗尽，不改变已有进度', () => {
    const previous = { streak: 2, skipped: 200 };

    expect(advanceFillProgress(previous, 0, 0)).toEqual(previous);
  });

  it('连续 5 页无未看项时判定为补页耗尽', () => {
    let progress = INITIAL_FILL_PROGRESS;
    for (let index = 0; index < MAX_AUTO_FILL_PAGES; index += 1) {
      progress = advanceFillProgress(progress, 100, 100);
    }

    expect(progress).toEqual({ streak: 5, skipped: 500 });
    expect(isAutoFillExhausted(progress)).toBe(true);
    expect(isAutoFillExhausted({ streak: 4, skipped: 400 })).toBe(false);
  });
});
