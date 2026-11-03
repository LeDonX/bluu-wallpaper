import { createViewsListHandler } from '@main/ipc/handlers/views-list';
import { createViewsMarkHandler } from '@main/ipc/handlers/views-mark';
import type { ViewsStore } from '@main/storage/views';
import type { SiteId } from '@shared/constants';
import { describe, expect, it } from 'vitest';

interface MarkCall {
  site: SiteId;
  postIds: readonly number[];
}

const createFakeStore = (initialViewed: number[] = []) => {
  const marks: MarkCall[] = [];
  const viewed = new Set(initialViewed);
  const store: ViewsStore = {
    mark: (site, postIds) => {
      marks.push({ site, postIds });
      for (const id of postIds) viewed.add(id);
      return postIds.length;
    },
    listViewed: (site, postIds) => {
      if (site !== 'yande') return [];
      return postIds.filter((id) => viewed.has(id));
    }
  };
  return { store, marks, viewed };
};

describe('views:mark 入参校验', () => {
  it('非法 site 返回 CONFIG 且不写库', async () => {
    const { store, marks } = createFakeStore();
    const handler = createViewsMarkHandler(store);

    const result = await handler({ site: 'sankaku', postIds: [1] });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
    expect(marks).toHaveLength(0);
  });

  it('空 postIds 返回 CONFIG（03 §7 要求 1–100 个）', async () => {
    const { store, marks } = createFakeStore();
    const handler = createViewsMarkHandler(store);

    const result = await handler({ site: 'yande', postIds: [] });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(marks).toHaveLength(0);
  });

  it('超过 100 个 postIds 返回 CONFIG（03 §6.2）', async () => {
    const { store } = createFakeStore();
    const handler = createViewsMarkHandler(store);
    const ids = Array.from({ length: 101 }, (_, index) => index + 1);

    const result = await handler({ site: 'yande', postIds: ids });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('合法入参写入并返回 ok', async () => {
    const { store, marks } = createFakeStore();
    const handler = createViewsMarkHandler(store);

    const result = await handler({ site: 'yande', postIds: [1, 2] });

    expect(result).toEqual({ ok: true, data: null });
    expect(marks).toEqual([{ site: 'yande', postIds: [1, 2] }]);
  });

  it('存储失败返回 DB 信封，不抛异常', async () => {
    const handler = createViewsMarkHandler({
      mark: () => {
        throw new Error('disk I/O error');
      }
    });

    const result = await handler({ site: 'yande', postIds: [1] });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'DB', message: '已看记录写入失败', retryable: false }
    });
  });
});

describe('views:list 已看状态查询', () => {
  it('返回入参中已看过的 id', async () => {
    const { store } = createFakeStore([1, 3]);
    const handler = createViewsListHandler(store);

    const result = await handler({ site: 'yande', postIds: [1, 2, 3] });

    expect(result).toEqual({ ok: true, data: [1, 3] });
  });

  it('非法入参返回 CONFIG', async () => {
    const { store } = createFakeStore();
    const handler = createViewsListHandler(store);

    const result = await handler({ site: 'yande', postIds: [0] });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('存储失败返回 DB 信封，不抛异常', async () => {
    const handler = createViewsListHandler({
      listViewed: () => {
        throw new Error('database is locked');
      }
    });

    const result = await handler({ site: 'yande', postIds: [1] });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'DB', message: '已看状态读取失败', retryable: false }
    });
  });
});
