import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { HttpClient } from '@main/network/http';
import { createMoebooruAdapter } from '@main/sites/moebooru';
import { parseQuery } from '@main/sites/query';
import { createAppError } from '@shared/errors';
import { describe, expect, it } from 'vitest';

const readFixture = (name: string): string =>
  readFileSync(resolve(process.cwd(), 'fixtures', 'yande', name), 'utf8');

const fakeClient = (body: string): { client: HttpClient; paths: string[] } => {
  const paths: string[] = [];
  return {
    paths,
    client: {
      site: 'yande',
      request: async (path) => {
        paths.push(path);
        return { ok: true, data: { status: 200, body } };
      }
    }
  };
};

/** 构造合法的 moebooru 原始条目，便于覆盖 fixtures 之外的字段组合 */
const rawPost = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  md5: '0123456789abcdef0123456789abcdef',
  rating: 's',
  score: 0,
  tags: '',
  file_url: 'https://files.example/image/1.jpg',
  sample_url: 'https://files.example/sample/1.jpg',
  preview_url: 'https://assets.example/preview/1.jpg',
  width: 10,
  height: 10,
  file_size: 100,
  created_at: 1_793_668_940,
  status: 'active',
  source: null,
  ...overrides
});

describe('moebooru 适配器归一化', () => {
  it('按 06 §3 归一化 fixtures：rating 映射、created_at ×1000、保留 active 条目', async () => {
    const { client, paths } = fakeClient(readFixture('posts-safe.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.search(parseQuery('rating:safe'));

    expect(paths).toEqual(['/post.json?tags=rating%3Asafe&limit=100&page=1']);
    expect(page.posts).toHaveLength(2);
    expect(page.posts[0]).toMatchObject({
      site: 'yande',
      id: 1271989,
      md5: '4d3b8a5d672619c40856bfb35580b76a',
      rating: 'safe',
      createdAt: 1_793_668_940_000,
      width: 3000,
      height: 3950,
      fileSize: 917952,
      score: 1
    });
    expect(page.posts[0]?.tags.map((tag) => tag.name)).toEqual([
      'koh_(minagi_kou)',
      'police_uniform',
      'selfie'
    ]);
    expect(page.lastId).toBe(1271988);
  });

  it('归一化 jpeg_url/jpeg_file_size，原图为 JPG 时两者与 file_url 一致（06 §4）', async () => {
    const body = JSON.stringify([
      rawPost({
        id: 1,
        file_url: 'https://files.example/image/1.png',
        jpeg_url: 'https://files.example/image/1.jpg',
        jpeg_file_size: 500
      }),
      rawPost({
        id: 2,
        jpeg_url: 'https://files.example/image/1.jpg',
        jpeg_file_size: 0
      })
    ]);
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient(body).client });

    const page = await adapter.search(parseQuery(''));

    expect(page.posts[0]).toMatchObject({
      jpegUrl: 'https://files.example/image/1.jpg',
      jpegFileSize: 500
    });
    expect(page.posts[1]).toMatchObject({
      jpegUrl: 'https://files.example/image/1.jpg',
      jpegFileSize: 0
    });
  });

  it('s/q/e 全部映射为 safe/questionable/explicit', async () => {
    const body = JSON.stringify([
      rawPost({ id: 1, rating: 's' }),
      rawPost({ id: 2, rating: 'q' }),
      rawPost({ id: 3, rating: 'e' })
    ]);
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient(body).client });

    const page = await adapter.search(parseQuery(''));

    expect(page.posts.map((post) => post.rating)).toEqual(['safe', 'questionable', 'explicit']);
  });

  it('丢弃 status !== active 的条目', async () => {
    const body = JSON.stringify([
      rawPost({ id: 1 }),
      rawPost({ id: 2, status: 'deleted' }),
      rawPost({ id: 3, status: 'pending' })
    ]);
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient(body).client });

    const page = await adapter.search(parseQuery(''));

    expect(page.posts.map((post) => post.id)).toEqual([1]);
    expect(page.lastId).toBe(1);
  });

  it('空数组按正常结果处理', async () => {
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient('[]').client });

    const page = await adapter.search(parseQuery('hatsune'));

    expect(page.posts).toEqual([]);
    expect(page.lastId).toBeNull();
    expect(page.page).toBe(1);
  });
});

describe('moebooru 适配器分页', () => {
  it('page 游标生成 page 参数', async () => {
    const { client, paths } = fakeClient(readFixture('posts-safe.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.search(parseQuery('hatsune -miku'), { page: 2 });

    expect(paths).toEqual(['/post.json?tags=hatsune%20-miku&limit=100&page=2']);
    expect(page.page).toBe(2);
  });

  it('id: 游标追加到 tags 且不叠加 page', async () => {
    const { client, paths } = fakeClient(readFixture('posts-safe.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.search(parseQuery('rating:safe'), { lastId: 1271988 });

    expect(paths).toEqual(['/post.json?tags=rating%3Asafe%20id%3A1271988&limit=100']);
    expect(page.page).toBe(1);
    expect(page.lastId).toBe(1271988);
  });

  it('by-id fixture 精确命中单条', async () => {
    const { client, paths } = fakeClient(readFixture('by-id.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.search(parseQuery('id:1271989'));

    expect(paths).toEqual(['/post.json?tags=id%3A1271989&limit=100&page=1']);
    expect(page.posts.map((post) => post.id)).toEqual([1271989]);
  });
});

describe('moebooru 适配器榜单（DR-041）', () => {
  it('热门固定 period=1d，返回 fixtures 的 40 条并归一化', async () => {
    const { client, paths } = fakeClient(readFixture('popular-recent.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.rankings('popular', undefined);

    expect(paths).toEqual(['/post/popular_recent.json?period=1d']);
    expect(page.posts).toHaveLength(40);
    expect(page.posts[0]).toMatchObject({ site: 'yande', id: 1271732 });
    expect(page.lastId).toBe(1271210);
    expect(page.page).toBe(1);
  });

  it('热门忽略 page 游标，始终只取第 1 页（DR-008）', async () => {
    const { client, paths } = fakeClient(readFixture('popular-recent.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.rankings('popular', undefined, { page: 2 });

    expect(paths).toEqual(['/post/popular_recent.json?period=1d']);
    expect(page.page).toBe(1);
  });

  it('日榜按 date: 单日 + order:score 请求并携带 page（DR-092）', async () => {
    const { client, paths } = fakeClient(readFixture('posts-safe.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const page = await adapter.rankings('day', { year: 2026, month: 11, day: 4 }, { page: 2 });

    expect(paths).toEqual([
      '/post.json?tags=date%3A2026-11-04%20order%3Ascore&limit=100&page=2'
    ]);
    expect(page.page).toBe(2);
  });

  it('周榜按周区间、月榜按月区间请求', async () => {
    const { client, paths } = fakeClient('[]');
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    await adapter.rankings('week', { year: 2026, month: 10, day: 26 });
    await adapter.rankings('month', { year: 2026, month: 10, day: 4 });

    expect(paths).toEqual([
      '/post.json?tags=date%3A2026-10-26..2026-11-01%20order%3Ascore&limit=100&page=1',
      '/post.json?tags=date%3A2026-10-01..2026-10-31%20order%3Ascore&limit=100&page=1'
    ]);
  });
});

describe('moebooru 适配器失败路径', () => {
  it('非法 JSON 返回 PARSE', async () => {
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient('<html>').client });

    await expect(adapter.search(parseQuery('hatsune'))).rejects.toMatchObject({
      name: 'AppErrorException',
      appError: { code: 'PARSE', retryable: false }
    });
  });

  it('未知 rating 返回 PARSE', async () => {
    const body = JSON.stringify([rawPost({ rating: 'x' })]);
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient(body).client });

    await expect(adapter.search(parseQuery(''))).rejects.toMatchObject({
      name: 'AppErrorException',
      appError: { code: 'PARSE', retryable: false }
    });
  });

  it('网络层错误原样向上抛出', async () => {
    const client: HttpClient = {
      site: 'yande',
      request: async () => ({
        ok: false,
        error: createAppError('NOT_FOUND', '资源不存在或已被删除')
      })
    };
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    await expect(adapter.search(parseQuery('hatsune'))).rejects.toMatchObject({
      name: 'AppErrorException',
      appError: { code: 'NOT_FOUND', retryable: false }
    });
  });
});

describe('moebooru 适配器标签联想', () => {
  it('按 03 §5.1 请求 /tag.json 前缀通配，并映射 fixtures 的 type 整数', async () => {
    const { client, paths } = fakeClient(readFixture('tags.json'));
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    const tags = await adapter.suggestTags('hatsune');

    expect(paths).toEqual(['/tag.json?name=hatsune*&limit=10']);
    expect(tags).toEqual([
      { name: 'hatsune', type: 'character', count: 3 },
      { name: 'hatsune_(rurudo)', type: 'character', count: 28 },
      { name: 'hatsune_miku', type: 'character', count: 12321 },
      { name: 'hatsune_miku_(shinkalion)', type: 'character', count: 1 },
      { name: 'hatsune_miku_dreamy_vocal', type: 'copyright', count: 4 }
    ]);
  });

  it('06 §4：0/1/3/4 映射为 general/artist/copyright/character，未知按 general', async () => {
    const body = JSON.stringify([
      { id: 1, name: 'a', count: 0, type: 0 },
      { id: 2, name: 'b', count: 0, type: 1 },
      { id: 3, name: 'c', count: 0, type: 3 },
      { id: 4, name: 'd', count: 0, type: 4 },
      { id: 5, name: 'e', count: 0, type: 7 }
    ]);
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient(body).client });

    const tags = await adapter.suggestTags('a', 5);

    expect(tags.map((tag) => tag.type)).toEqual([
      'general',
      'artist',
      'copyright',
      'character',
      'general'
    ]);
  });

  it('非法 JSON 返回 PARSE', async () => {
    const adapter = createMoebooruAdapter({ site: 'yande', client: fakeClient('<html>').client });

    await expect(adapter.suggestTags('ha')).rejects.toMatchObject({
      name: 'AppErrorException',
      appError: { code: 'PARSE', retryable: false }
    });
  });

  it('网络层错误原样向上抛出', async () => {
    const client: HttpClient = {
      site: 'yande',
      request: async () => ({
        ok: false,
        error: createAppError('TIMEOUT', '请求超时')
      })
    };
    const adapter = createMoebooruAdapter({ site: 'yande', client });

    await expect(adapter.suggestTags('ha')).rejects.toMatchObject({
      name: 'AppErrorException',
      appError: { code: 'TIMEOUT', retryable: true }
    });
  });
});
