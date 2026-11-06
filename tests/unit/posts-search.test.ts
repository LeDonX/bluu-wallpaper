import { createPostsSearchHandler } from '@main/ipc/handlers/posts-search';
import type { ParsedQuery } from '@main/sites/query';
import { AppErrorException, createAppError } from '@shared/errors';
import type { Post, PostPage, SearchCursor } from '@shared/models';
import { describe, expect, it } from 'vitest';

const post = (id: number): Post => ({
  site: 'yande',
  id,
  md5: `${id}`.padStart(32, '0'),
  previewUrl: 'https://assets.example/preview.jpg',
  sampleUrl: 'https://files.example/sample.jpg',
  fileUrl: 'https://files.example/image.jpg',
  width: 100,
  height: 100,
  fileSize: 1,
  rating: 'safe',
  score: 0,
  tags: [{ name: 'sample', type: 'general' }],
  createdAt: 1_793_668_940_000
});

const pageOf = (ids: number[]): PostPage => ({
  posts: ids.map(post),
  page: 1,
  lastId: ids[ids.length - 1] ?? null
});

interface SearchCall {
  query: ParsedQuery;
  cursor?: SearchCursor;
}

const createFakeAdapter = (result: () => Promise<PostPage> = async () => pageOf([1, 2])) => {
  const calls: SearchCall[] = [];
  const adapter = {
    search: async (query: ParsedQuery, cursor?: SearchCursor): Promise<PostPage> => {
      calls.push({ query, cursor });
      return result();
    }
  };
  return { adapter, calls };
};

/** 默认 R18 关闭（DR-023）、黑名单为空；需要时显式传入 */
const createHandler = (
  adapter: ReturnType<typeof createFakeAdapter>['adapter'],
  isExplicitAllowed = false,
  blacklist: string[] = []
): ReturnType<typeof createPostsSearchHandler> =>
  createPostsSearchHandler({
    getAdapter: () => adapter,
    isExplicitAllowed: () => isExplicitAllowed,
    getBlacklist: () => blacklist
  });

describe('posts:search 入参校验', () => {
  it('非法 site 返回 CONFIG 且不请求适配器', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'sankaku', query: 'hatsune' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
    expect(calls).toHaveLength(0);
  });

  it('page 与 lastId 二选一，同时传入返回 CONFIG', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'hatsune', page: 1, lastId: 10 });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(calls).toHaveLength(0);
  });

  it('page 必须为正整数', async () => {
    const { adapter } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'hatsune', page: 0 });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('空查询按无查询处理，不发起请求（09 TC-06）', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: '   ' });

    expect(result).toEqual({ ok: true, data: { posts: [], page: 1, lastId: null } });
    expect(calls).toHaveLength(0);
  });

  it('wallhaven 空查询走首页热门并保留 R18 过滤（DR-085）', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'wallhaven', query: '   ', page: 2 });

    expect(result).toMatchObject({ ok: true, data: { lastId: 2, r18Filtered: true } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query.raw).toBe('-rating:e');
    expect(calls[0]?.query.excludedRatings).toEqual(['explicit']);
    expect(calls[0]?.cursor).toEqual({ page: 2 });
  });

  it('普通站点空查询不发起请求，返回空页（TC-06）', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: '   ', page: 2 });

    expect(result).toMatchObject({ ok: true, data: { posts: [], page: 1, lastId: null } });
    expect(calls).toHaveLength(0);
  });
});

describe('posts:search 请求与错误映射', () => {
  it('page 游标传给适配器并原样返回结果', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'hatsune -miku', page: 2 });

    expect(result).toMatchObject({ ok: true, data: { lastId: 2, r18Filtered: true } });
    expect(calls[0]?.query.raw).toBe('hatsune -miku -rating:e');
    expect(calls[0]?.query.tags).toEqual(['hatsune']);
    expect(calls[0]?.query.excludedTags).toEqual(['miku']);
    expect(calls[0]?.query.excludedRatings).toEqual(['explicit']);
    expect(calls[0]?.cursor).toEqual({ page: 2 });
  });

  it('按入参站点选择适配器（DR-057）', async () => {
    const yande = createFakeAdapter(async () => pageOf([1]));
    const konachan = createFakeAdapter(async () => pageOf([2]));
    const handler = createPostsSearchHandler({
      getAdapter: (site) => (site === 'konachan' ? konachan.adapter : yande.adapter),
      isExplicitAllowed: () => true,
      getBlacklist: () => []
    });

    const result = await handler({ site: 'konachan', query: 'hatsune' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((item) => item.id)).toEqual([2]);
    expect(yande.calls).toHaveLength(0);
    expect(konachan.calls).toHaveLength(1);
  });

  it('lastId 游标传给适配器', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    await handler({ site: 'yande', query: 'rating:safe', lastId: 100 });

    expect(calls[0]?.cursor).toEqual({ lastId: 100 });
  });

  it('查询语法错误返回 PARSE 且不请求适配器', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'score:>abc' });

    expect(result).toMatchObject({ ok: false, error: { code: 'PARSE', retryable: false } });
    expect(calls).toHaveLength(0);
  });

  it('适配器失败转成 Result 信封，不抛异常', async () => {
    const { adapter } = createFakeAdapter(async () => {
      throw new AppErrorException(createAppError('NOT_FOUND', '资源不存在或已被删除'));
    });
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'hatsune' });

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND', retryable: false } });
  });
});

describe('posts:search R18 默认过滤（DR-023）', () => {
  it('默认关闭且未写 rating: 时自动附加 -rating:e 并标记结果', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'hatsune' });

    expect(result).toMatchObject({ ok: true, data: { r18Filtered: true } });
    expect(calls[0]?.query.raw).toBe('hatsune -rating:e');
    expect(calls[0]?.query.excludedRatings).toEqual(['explicit']);
  });

  it('用户显式 rating:q 时不再追加默认排除', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'hatsune rating:q' });

    expect(result).toMatchObject({ ok: true, data: { r18Filtered: false } });
    expect(calls[0]?.query.raw).toBe('hatsune rating:q');
    expect(calls[0]?.query.ratings).toEqual(['questionable']);
  });

  it('用户显式 rating:e 时保留用户意图，不被默认过滤覆盖', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: 'rating:e' });

    expect(result).toMatchObject({ ok: true, data: { r18Filtered: false } });
    expect(calls[0]?.query.raw).toBe('rating:e');
    expect(calls[0]?.query.ratings).toEqual(['explicit']);
    expect(calls[0]?.query.excludedRatings).toEqual([]);
  });

  it('开关开启（allowExplicit=true）时不追加，explicit 恢复', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, true);

    const result = await handler({ site: 'yande', query: 'hatsune' });

    expect(result).toMatchObject({ ok: true, data: { r18Filtered: false } });
    expect(calls[0]?.query.raw).toBe('hatsune');
    expect(calls[0]?.query.excludedRatings).toEqual([]);
  });

  it('空查询不附加过滤，也不请求适配器（09 TC-06）', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', query: '  ' });

    expect(result).toEqual({ ok: true, data: { posts: [], page: 1, lastId: null } });
    expect(calls).toHaveLength(0);
  });
});

describe('posts:search 标签黑名单（DR-056）', () => {
  it('黑名单逐项追加 -tag 并回传追加数量', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, false, ['lowres', 'bad_id']);

    const result = await handler({ site: 'yande', query: 'hatsune' });

    expect(result).toMatchObject({ ok: true, data: { blacklistFiltered: 2 } });
    expect(calls[0]?.query.raw).toBe('hatsune -rating:e -lowres -bad_id');
    expect(calls[0]?.query.excludedTags).toEqual(['lowres', 'bad_id']);
    expect(calls[0]?.query.tags).toEqual(['hatsune']);
  });

  it('用户已显式排除同名标签时不重复追加（大小写不敏感）', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, false, ['lowres']);

    const result = await handler({ site: 'yande', query: 'hatsune -LowRes' });

    expect(calls[0]?.query.raw).toBe('hatsune -LowRes -rating:e');
    // 只剩 R18 过滤，黑名单没有新增项
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.blacklistFiltered).toBeUndefined();
    expect(calls[0]?.query.excludedTags).toEqual(['lowres']);
  });

  it('黑名单为空时不改动查询也不回传计数', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, true, []);

    const result = await handler({ site: 'yande', query: 'hatsune' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.blacklistFiltered).toBeUndefined();
    expect(calls[0]?.query.raw).toBe('hatsune');
  });

  it('空查询不因黑名单发起请求', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, false, ['lowres']);

    const result = await handler({ site: 'yande', query: '   ' });

    expect(result).toEqual({ ok: true, data: { posts: [], page: 1, lastId: null } });
    expect(calls).toHaveLength(0);
  });
});
