import type { Post } from '@shared/models';
import { mergePosts } from '@shared/posts';
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
