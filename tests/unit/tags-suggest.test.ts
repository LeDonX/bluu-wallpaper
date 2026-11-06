import { createTagsSuggestHandler } from '@main/ipc/handlers/tags-suggest';
import type { MoebooruAdapter } from '@main/sites/moebooru';
import type { TagCache } from '@main/storage/tags';
import type { AnySiteId } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { TagSuggestion } from '@shared/models';
import { describe, expect, it } from 'vitest';

const hatsune: TagSuggestion = { name: 'hatsune_miku', type: 'character', count: 12321 };

interface FindCall {
  site: AnySiteId;
  prefix: string;
  limit: number;
}

const createFakeCache = (initial: TagSuggestion[] = []) => {
  const stored = [...initial];
  const finds: FindCall[] = [];
  const saved: TagSuggestion[][] = [];
  const cache: TagCache = {
    find: (site, prefix, limit) => {
      finds.push({ site, prefix, limit });
      return stored.filter((tag) => tag.name.startsWith(prefix));
    },
    save: (_site, tags) => {
      saved.push([...tags]);
      stored.push(...tags);
    }
  };
  return { cache, finds, saved, stored };
};

const createFakeAdapter = (
  result: () => Promise<TagSuggestion[]> = async () => [hatsune]
): { adapter: Pick<MoebooruAdapter, 'suggestTags'>; calls: Array<{ prefix: string; limit?: number }> } => {
  const calls: Array<{ prefix: string; limit?: number }> = [];
  const adapter: Pick<MoebooruAdapter, 'suggestTags'> = {
    suggestTags: async (prefix, limit) => {
      calls.push({ prefix, limit });
      return result();
    }
  };
  return { adapter, calls };
};

describe('tags:suggest 入参校验', () => {
  it('非法 site 返回 CONFIG 且不查缓存/适配器', async () => {
    const { cache, finds } = createFakeCache();
    const { adapter, calls } = createFakeAdapter();
    const handler = createTagsSuggestHandler({ getAdapter: () => adapter, cache });

    const result = await handler({ site: 'sankaku', prefix: 'hatsune' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
    expect(finds).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it('前缀少于 2 字符返回 CONFIG（02 §3）', async () => {
    const { cache } = createFakeCache();
    const { adapter, calls } = createFakeAdapter();
    const handler = createTagsSuggestHandler({ getAdapter: () => adapter, cache });

    const result = await handler({ site: 'yande', prefix: 'h' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(calls).toHaveLength(0);
  });
});

describe('tags:suggest 本地优先与远端兜底', () => {
  it('站点没有联想能力时返回 CONFIG，不发起远端请求（DR-070）', async () => {
    const { cache } = createFakeCache();
    const handler = createTagsSuggestHandler({ getAdapter: () => ({}), cache });

    const result = await handler({ site: 'yande', prefix: 'hatsune' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG', retryable: false } });
  });

  it('本地命中时直接返回，不请求远端', async () => {
    const { cache } = createFakeCache([hatsune]);
    const { adapter, calls } = createFakeAdapter();
    const handler = createTagsSuggestHandler({ getAdapter: () => adapter, cache });

    const result = await handler({ site: 'yande', prefix: 'HATSUNE' });

    expect(result).toEqual({ ok: true, data: [hatsune] });
    expect(calls).toHaveLength(0);
  });

  it('本地未命中时请求远端，前缀小写并限定 10 条，结果回写缓存', async () => {
    const { cache, finds, saved } = createFakeCache();
    const { adapter, calls } = createFakeAdapter(async () => [
      hatsune,
      { name: 'hatsune', type: 'character', count: 3 }
    ]);
    const handler = createTagsSuggestHandler({ getAdapter: () => adapter, cache });

    const result = await handler({ site: 'yande', prefix: ' Hatsune ' });

    expect(finds).toEqual([{ site: 'yande', prefix: 'hatsune', limit: 10 }]);
    expect(calls).toEqual([{ prefix: 'hatsune', limit: 10 }]);
    expect(saved).toEqual([[hatsune, { name: 'hatsune', type: 'character', count: 3 }]]);
    expect(result).toMatchObject({ ok: true });
  });

  it('远端失败返回 Result 信封，不抛异常（渲染层静默降级）', async () => {
    const { cache, saved } = createFakeCache();
    const { adapter } = createFakeAdapter(async () => {
      throw new AppErrorException(createAppError('TIMEOUT', '请求超时'));
    });
    const handler = createTagsSuggestHandler({ getAdapter: () => adapter, cache });

    const result = await handler({ site: 'yande', prefix: 'hatsune' });

    expect(result).toMatchObject({ ok: false, error: { code: 'TIMEOUT', retryable: true } });
    expect(saved).toHaveLength(0);
  });

  it('按入参站点选择适配器（DR-057）', async () => {
    const { cache } = createFakeCache();
    const yande = createFakeAdapter();
    const konachan = createFakeAdapter(async () => [
      { name: 'konachan_only', type: 'general', count: 1 }
    ]);
    const handler = createTagsSuggestHandler({
      getAdapter: (site) => (site === 'konachan' ? konachan.adapter : yande.adapter),
      cache
    });

    const result = await handler({ site: 'konachan', prefix: 'konachan' });

    expect(result).toMatchObject({ ok: true });
    expect(yande.calls).toHaveLength(0);
    expect(konachan.calls).toEqual([{ prefix: 'konachan', limit: 10 }]);
  });

  it('远端空结果按空数组返回，且不写入缓存', async () => {
    const { cache, saved } = createFakeCache();
    const { adapter } = createFakeAdapter(async () => []);
    const handler = createTagsSuggestHandler({ getAdapter: () => adapter, cache });

    const result = await handler({ site: 'yande', prefix: 'zzz' });

    expect(result).toEqual({ ok: true, data: [] });
    expect(saved).toHaveLength(0);
  });
});
