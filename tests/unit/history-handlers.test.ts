import { createViewsClearHandler } from '@main/ipc/handlers/views-clear';
import type { HistoryClearCounts, HistoryStore } from '@main/storage/history';
import type { AnySiteId } from '@shared/constants';
import { describe, expect, it } from 'vitest';

function createFakeStore(counts: HistoryClearCounts = { views: 3, favorites: 1 }) {
  const calls: Array<AnySiteId | undefined> = [];
  const store: Pick<HistoryStore, 'clear'> = {
    clear: (site) => {
      calls.push(site);
      return counts;
    }
  };
  return { store, calls };
}

describe('views:clear 入参校验与返回', () => {
  it('缺省 site 表示全部站点', async () => {
    const { store, calls } = createFakeStore();
    const handler = createViewsClearHandler(store);

    const result = await handler({});

    expect(result).toEqual({
      ok: true,
      data: { site: null, clearedViews: 3, clearedFavorites: 1 }
    });
    expect(calls).toEqual([undefined]);
  });

  it('指定站点时只清该站点', async () => {
    const { store, calls } = createFakeStore({ views: 2, favorites: 1 });
    const handler = createViewsClearHandler(store);

    const result = await handler({ site: 'yande' });

    expect(result).toEqual({
      ok: true,
      data: { site: 'yande', clearedViews: 2, clearedFavorites: 1 }
    });
    expect(calls).toEqual(['yande']);
  });

  it('非法 site 返回 CONFIG 且不清库', async () => {
    const { store, calls } = createFakeStore();
    const handler = createViewsClearHandler(store);

    const result = await handler({ site: 'sankaku' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
    expect(calls).toHaveLength(0);
  });

  it('非对象入参返回 CONFIG', async () => {
    const handler = createViewsClearHandler(createFakeStore().store);

    const result = await handler(null);

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('存储异常返回 DB 且可重试', async () => {
    const handler = createViewsClearHandler({
      clear: () => {
        throw new Error('db locked');
      }
    });

    const result = await handler({});

    expect(result).toMatchObject({ ok: false, error: { code: 'DB' } });
  });
});
