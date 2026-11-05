import { createFavoritesListHandler } from '@main/ipc/handlers/favorites-list';
import { createFavoritesToggleHandler } from '@main/ipc/handlers/favorites-toggle';
import type { FavoritesStore } from '@main/storage/favorites';
import type { SiteId } from '@shared/constants';
import type { FavoriteEntry } from '@shared/favorites';
import type { Post } from '@shared/models';
import { describe, expect, it } from 'vitest';

function makePost(id: number, overrides: Partial<Post> = {}): Post {
  return {
    site: 'yande',
    id,
    md5: `md5-${id}`,
    previewUrl: 'https://assets.yande.re/data/preview/a.jpg',
    sampleUrl: 'https://files.yande.re/sample/a.jpg',
    fileUrl: 'https://files.yande.re/image/a.jpg',
    width: 1000,
    height: 1400,
    fileSize: 12345,
    rating: 'safe',
    score: 10,
    tags: [
      { name: 'alpha', type: 'general' },
      { name: 'beta', type: 'general' }
    ],
    createdAt: 1793668940000,
    ...overrides
  };
}

const createFakeStore = (entries: FavoriteEntry[] = []): FavoritesStore => {
  const toggles: Array<{ site: SiteId; post: Post }> = [];
  const store: FavoritesStore = {
    toggle: (site, post) => {
      toggles.push({ site, post });
      return true;
    },
    list: (site) => (site === 'yande' ? entries : [])
  };
  return store;
};

describe('favorites:toggle 入参校验', () => {
  it('非法 site 返回 CONFIG 且不写库', async () => {
    const store = createFakeStore();
    const handler = createFavoritesToggleHandler(store);

    const result = await handler({ site: 'sankaku', post: makePost(1) });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
  });

  it('Post 缺少必填字段返回 CONFIG', async () => {
    const handler = createFavoritesToggleHandler(createFakeStore());
    const incomplete = { site: 'yande', id: 1 };

    const result = await handler({ site: 'yande', post: incomplete });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('非法 rating 返回 CONFIG', async () => {
    const handler = createFavoritesToggleHandler(createFakeStore());

    const result = await handler({
      site: 'yande',
      post: makePost(1, { rating: 'nsfw' as Post['rating'] })
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('Post.site 与入参 site 不一致返回 CONFIG', async () => {
    const handler = createFavoritesToggleHandler(createFakeStore());

    const result = await handler({
      site: 'konachan',
      post: makePost(1, { site: 'yande' })
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('合法入参调用存储并返回收藏状态', async () => {
    const store = createFakeStore();
    const handler = createFavoritesToggleHandler(store);
    const post = makePost(7);

    const result = await handler({ site: 'yande', post });

    expect(result).toEqual({ ok: true, data: { favorited: true } });
  });

  it('存储异常返回 DB 且可重试', async () => {
    const handler = createFavoritesToggleHandler({
      toggle: () => {
        throw new Error('disk full');
      }
    });

    const result = await handler({ site: 'yande', post: makePost(1) });

    expect(result).toMatchObject({ ok: false, error: { code: 'DB' } });
  });
});

describe('favorites:list 本地筛选与排序', () => {
  const entries: FavoriteEntry[] = [
    {
      post: makePost(1, { score: 5, tags: [{ name: 'alpha', type: 'general' }] }),
      addedAt: 100
    },
    {
      post: makePost(2, {
        score: 20,
        tags: [
          { name: 'alpha', type: 'general' },
          { name: 'beta', type: 'general' }
        ]
      }),
      addedAt: 300
    },
    {
      post: makePost(3, { score: 20, tags: [{ name: 'beta', type: 'general' }] }),
      addedAt: 200
    }
  ];

  it('默认按收藏时间降序返回 PostPage', async () => {
    const handler = createFavoritesListHandler(createFakeStore(entries));

    const result = await handler({ site: 'yande' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((post) => post.id)).toEqual([2, 3, 1]);
    expect(result.data.page).toBe(1);
    expect(result.data.lastId).toBeNull();
  });

  it('按评分排序', async () => {
    const handler = createFavoritesListHandler(createFakeStore(entries));

    const result = await handler({ site: 'yande', sort: 'score' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((post) => post.id)).toEqual([2, 3, 1]);
  });

  it('按标签过滤，多个标签全部命中', async () => {
    const handler = createFavoritesListHandler(createFakeStore(entries));

    const result = await handler({ site: 'yande', query: 'alpha beta' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.posts.map((post) => post.id)).toEqual([2]);
  });

  it('非法 sort 返回 CONFIG', async () => {
    const handler = createFavoritesListHandler(createFakeStore(entries));

    const result = await handler({ site: 'yande', sort: 'random' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('读取异常返回 DB', async () => {
    const handler = createFavoritesListHandler({
      list: () => {
        throw new Error('db locked');
      }
    });

    const result = await handler({ site: 'yande' });

    expect(result).toMatchObject({ ok: false, error: { code: 'DB' } });
  });
});
