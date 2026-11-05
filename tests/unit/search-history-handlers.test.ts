import { createSearchHistoryClearHandler } from '@main/ipc/handlers/search-history-clear';
import { createSearchHistoryDeleteHandler } from '@main/ipc/handlers/search-history-delete';
import { createSearchHistoryListHandler } from '@main/ipc/handlers/search-history-list';
import { createSearchHistoryRecordHandler } from '@main/ipc/handlers/search-history-record';
import type { SearchHistoryStore } from '@main/storage/search-history';
import { describe, expect, it } from 'vitest';

function createFakeStore(initial: string[] = []): Pick<
  SearchHistoryStore,
  'record' | 'list' | 'remove' | 'clear'
> {
  let items = [...initial];
  return {
    record: (query) => {
      items = [query, ...items.filter((item) => item !== query)];
    },
    list: () => items,
    remove: (query) => {
      const before = items.length;
      items = items.filter((item) => item !== query);
      return items.length < before;
    },
    clear: () => {
      const removed = items.length;
      items = [];
      return removed;
    }
  };
}

describe('search-history:list', () => {
  it('返回当前历史列表', async () => {
    const handler = createSearchHistoryListHandler(createFakeStore(['beta', 'alpha']));

    const result = await handler();

    expect(result).toEqual({ ok: true, data: ['beta', 'alpha'] });
  });

  it('存储异常返回 DB', async () => {
    const handler = createSearchHistoryListHandler({
      list: () => {
        throw new Error('db locked');
      }
    });

    const result = await handler();

    expect(result).toMatchObject({ ok: false, error: { code: 'DB' } });
  });
});

describe('search-history:record', () => {
  it('归一化后写入并返回更新列表', async () => {
    const store = createFakeStore(['beta']);
    const handler = createSearchHistoryRecordHandler(store);

    const result = await handler({ query: '  alpha   gamma  ' });

    expect(result).toEqual({ ok: true, data: ['alpha gamma', 'beta'] });
  });

  it('重复查询去重且移到最前', async () => {
    const store = createFakeStore(['beta', 'alpha']);
    const handler = createSearchHistoryRecordHandler(store);

    const result = await handler({ query: 'alpha' });

    expect(result).toEqual({ ok: true, data: ['alpha', 'beta'] });
  });

  it('空白查询返回 CONFIG 且不写入', async () => {
    const store = createFakeStore(['alpha']);
    const handler = createSearchHistoryRecordHandler(store);

    const result = await handler({ query: '   ' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
    expect(store.list()).toEqual(['alpha']);
  });

  it('非对象入参返回 CONFIG', async () => {
    const handler = createSearchHistoryRecordHandler(createFakeStore());

    const result = await handler(null);

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });

  it('存储异常返回 DB', async () => {
    const handler = createSearchHistoryRecordHandler({
      record: () => {
        throw new Error('db locked');
      },
      list: () => []
    });

    const result = await handler({ query: 'alpha' });

    expect(result).toMatchObject({ ok: false, error: { code: 'DB' } });
  });
});

describe('search-history:delete', () => {
  it('删除单条并返回更新列表', async () => {
    const store = createFakeStore(['beta', 'alpha']);
    const handler = createSearchHistoryDeleteHandler(store);

    const result = await handler({ query: 'beta' });

    expect(result).toEqual({ ok: true, data: ['alpha'] });
  });

  it('非法入参返回 CONFIG', async () => {
    const handler = createSearchHistoryDeleteHandler(createFakeStore());

    const result = await handler({ query: '' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
  });
});

describe('search-history:clear', () => {
  it('返回删除条数', async () => {
    const handler = createSearchHistoryClearHandler(createFakeStore(['beta', 'alpha']));

    const result = await handler();

    expect(result).toEqual({ ok: true, data: { removed: 2 } });
  });

  it('存储异常返回 DB', async () => {
    const handler = createSearchHistoryClearHandler({
      clear: () => {
        throw new Error('db locked');
      }
    });

    const result = await handler();

    expect(result).toMatchObject({ ok: false, error: { code: 'DB' } });
  });
});
