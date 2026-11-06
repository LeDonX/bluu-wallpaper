import { createDailyListHandler } from '@main/ipc/handlers/daily-list';
import type { SiteAdapter } from '@main/sites/types';
import { AppErrorException, createAppError } from '@shared/errors';
import type { Post, PostPage } from '@shared/models';
import { describe, expect, it, vi } from 'vitest';

const bingPost: Post = {
  site: 'bing',
  id: 20261106,
  md5: '',
  previewUrl: 'https://www.bing.com/th?id=OHR.Newest_400x240.jpg',
  sampleUrl: 'https://www.bing.com/th?id=OHR.Newest_1920x1080.jpg',
  fileUrl: 'https://www.bing.com/th?id=OHR.Newest_1920x1080.jpg',
  width: 1920,
  height: 1080,
  fileSize: 0,
  rating: 'safe',
  score: 0,
  tags: [],
  createdAt: new Date(2026, 10, 6).getTime(),
  source: 'Newest (© Example)'
};

const page: PostPage = { posts: [bingPost], page: 1, lastId: null };

describe('daily:list handler', () => {
  it('按入参站点取适配器并把结果包成 Result', async () => {
    const getAdapter = vi.fn((): Pick<SiteAdapter, 'daily'> => ({
      daily: async () => page
    }));
    const handler = createDailyListHandler({ getAdapter });

    const result = await handler({ site: 'bing' });

    expect(result).toEqual({ ok: true, data: page });
    expect(getAdapter).toHaveBeenCalledWith('bing');
  });

  it('缺乏 daily 能力的站点返回 CONFIG', async () => {
    const handler = createDailyListHandler({
      getAdapter: () => ({}) as Pick<SiteAdapter, 'daily'>
    });

    const result = await handler({ site: 'yande' });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'CONFIG', retryable: false }
    });
    if (!result.ok) expect(result.error.message).toContain('不支持每日壁纸');
  });

  it('非法入参返回 CONFIG 且不调用适配器', async () => {
    const getAdapter = vi.fn((): Pick<SiteAdapter, 'daily'> => ({ daily: async () => page }));
    const handler = createDailyListHandler({ getAdapter });

    const result = await handler({ site: 'nope' });

    expect(result).toMatchObject({ ok: false, error: { code: 'CONFIG' } });
    expect(getAdapter).not.toHaveBeenCalled();
  });

  it('适配器抛出的错误转为 Result 信封', async () => {
    const handler = createDailyListHandler({
      getAdapter: () => ({
        daily: async () => {
          throw new AppErrorException(createAppError('PARSE', '站点返回数据结构异常'));
        }
      })
    });

    const result = await handler({ site: 'bing' });

    expect(result).toMatchObject({ ok: false, error: { code: 'PARSE' } });
  });
});
