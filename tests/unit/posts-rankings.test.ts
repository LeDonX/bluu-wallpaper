import { createPostsRankingsHandler } from '@main/ipc/handlers/posts-rankings';
import { AppErrorException, createAppError } from '@shared/errors';
import type { Post, PostPage, SearchCursor } from '@shared/models';
import type { RankingDate, RankingKind } from '@shared/rankings';
import { describe, expect, it } from 'vitest';

const post = (
  id: number,
  rating: Post['rating'] = 'safe',
  tagNames: string[] = ['sample']
): Post => ({
  site: 'yande',
  id,
  md5: `${id}`.padStart(32, '0'),
  previewUrl: 'https://assets.example/preview.jpg',
  sampleUrl: 'https://files.example/sample.jpg',
  fileUrl: 'https://files.example/image.jpg',
  width: 100,
  height: 100,
  fileSize: 1,
  rating,
  score: 0,
  tags: tagNames.map((name) => ({ name, type: 'general' })),
  createdAt: 1_793_668_940_000
});

const pageOf = (posts: Post[]): PostPage => ({
  posts,
  page: 1,
  lastId: posts[posts.length - 1]?.id ?? null
});

interface RankingCall {
  kind: RankingKind;
  date?: RankingDate;
  cursor?: SearchCursor;
}

const createFakeAdapter = (result: () => Promise<PostPage> = async () => pageOf([post(1)])) => {
  const calls: RankingCall[] = [];
  const adapter = {
    rankings: async (
      kind: RankingKind,
      date?: RankingDate,
      cursor?: SearchCursor
    ): Promise<PostPage> => {
      calls.push({ kind, date, cursor });
      return result();
    }
  };
  return { adapter, calls };
};

/** 默认 R18 关闭（DR-023 / DR-041）、黑名单为空 */
const createHandler = (
  adapter: ReturnType<typeof createFakeAdapter>['adapter'],
  isExplicitAllowed = false,
  blacklist: string[] = []
): ReturnType<typeof createPostsRankingsHandler> =>
  createPostsRankingsHandler({
    getAdapter: () => adapter,
    isExplicitAllowed: () => isExplicitAllowed,
    getBlacklist: () => blacklist
  });

const date = { year: 2026, month: 11, day: 4 };

describe('posts:rankings 入参校验', () => {
  it('非法 site 返回 CONFIG 且不请求适配器', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'sankaku', kind: 'popular' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
    expect(calls).toHaveLength(0);
  });

  it('非法 kind 返回 CONFIG', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', kind: 'all' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(calls).toHaveLength(0);
  });

  it('期榜缺失日期返回 CONFIG', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', kind: 'day' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(calls).toHaveLength(0);
  });

  it('page 必须为正整数', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', kind: 'day', date, page: 0 });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(calls).toHaveLength(0);
  });
});

describe('posts:rankings 适配器调用', () => {
  it('热门不传日期；page 透传给游标（适配器内部忽略）', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, true);

    const result = await handler({ site: 'yande', kind: 'popular', page: 2 });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ kind: 'popular', date: undefined, cursor: { page: 2 } }]);
  });

  it('日榜传日期与 page cursor', async () => {
    const { adapter, calls } = createFakeAdapter();
    const handler = createHandler(adapter, true);

    await handler({ site: 'yande', kind: 'day', date, page: 2 });

    expect(calls).toEqual([{ kind: 'day', date, cursor: { page: 2 } }]);
  });

  it('按入参站点选择适配器（DR-057 / T-28）', async () => {
    const yande = createFakeAdapter();
    const konachan = createFakeAdapter(async () => pageOf([post(9)]));
    const handler = createPostsRankingsHandler({
      getAdapter: (site) => (site === 'konachan' ? konachan.adapter : yande.adapter),
      isExplicitAllowed: () => true,
      getBlacklist: () => []
    });

    const result = await handler({ site: 'konachan', kind: 'popular' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((item) => item.id)).toEqual([9]);
    expect(yande.calls).toHaveLength(0);
    expect(konachan.calls).toEqual([{ kind: 'popular', date: undefined, cursor: undefined }]);
  });

  it('适配器错误按信封透传', async () => {
    const { adapter } = createFakeAdapter(async () => {
      throw new AppErrorException(createAppError('NETWORK', '网络错误'));
    });
    const handler = createHandler(adapter);

    const result = await handler({ site: 'yande', kind: 'popular' });

    expect(result).toMatchObject({ ok: false, error: { code: 'NETWORK' } });
  });
});

describe('posts:rankings R18 过滤（DR-041）', () => {
  it('R18 关闭时丢弃 explicit 并标记 r18Filtered', async () => {
    const { adapter } = createFakeAdapter(async () => pageOf([post(1, 'safe'), post(2, 'explicit')]));
    const handler = createHandler(adapter, false);

    const result = await handler({ site: 'yande', kind: 'popular' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((item) => item.id)).toEqual([1]);
    expect(result.data.r18Filtered).toBe(true);
  });

  it('R18 开启时保留 explicit 且不标记', async () => {
    const { adapter } = createFakeAdapter(async () => pageOf([post(1, 'safe'), post(2, 'explicit')]));
    const handler = createHandler(adapter, true);

    const result = await handler({ site: 'yande', kind: 'popular' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((item) => item.id)).toEqual([1, 2]);
  });
});

describe('posts:rankings 标签黑名单（DR-056）', () => {
  it('命中黑名单的条目在本地丢弃并回传数量', async () => {
    const { adapter } = createFakeAdapter(async () =>
      pageOf([post(1, 'safe', ['sample', 'lowres']), post(2, 'safe'), post(3, 'safe', ['lowres'])])
    );
    const handler = createHandler(adapter, true, ['lowres']);

    const result = await handler({ site: 'yande', kind: 'popular' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((item) => item.id)).toEqual([2]);
    expect(result.data.blacklistFiltered).toBe(2);
  });

  it('黑名单计数不包含 R18 丢弃的条目', async () => {
    const { adapter } = createFakeAdapter(async () =>
      pageOf([post(1, 'safe', ['lowres']), post(2, 'explicit', ['lowres']), post(3, 'safe')])
    );
    const handler = createHandler(adapter, false, ['lowres']);

    const result = await handler({ site: 'yande', kind: 'popular' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((item) => item.id)).toEqual([3]);
    expect(result.data.blacklistFiltered).toBe(1);
    expect(result.data.r18Filtered).toBe(true);
  });

  it('无命中时不回传黑名单计数', async () => {
    const { adapter } = createFakeAdapter(async () => pageOf([post(1), post(2)]));
    const handler = createHandler(adapter, true, ['lowres']);

    const result = await handler({ site: 'yande', kind: 'popular' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.blacklistFiltered).toBeUndefined();
  });
});
