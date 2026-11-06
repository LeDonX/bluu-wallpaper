import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type HttpClient, type HttpResponse } from '@main/network/http';
import {
  BING_DAILY_COUNT,
  buildBingDailyPath,
  createBingAdapter,
  parseBingDate
} from '@main/sites/bing';
import type { ParsedQuery } from '@main/sites/query';
import { renderDownloadPath } from '@shared/downloads';
import { createAppError, type Result } from '@shared/errors';
import type { Post } from '@shared/models';
import { describe, expect, it } from 'vitest';

const okResponse = (body: string): Result<HttpResponse> => ({
  ok: true,
  data: { status: 200, body }
});

function createClient(response: Result<HttpResponse>) {
  const calls: string[] = [];
  const client: HttpClient = {
    site: 'bing',
    request: async (path) => {
      calls.push(path);
      return response;
    }
  };
  return { client, calls };
}

const image = (date: string, urlbase: string, copyright: string): Record<string, string> => ({
  startdate: date,
  enddate: date,
  url: `${urlbase}_1920x1080.jpg`,
  urlbase,
  copyright
});

/** 06 §8：fixture 故意打乱顺序，验证适配器自身按日期倒序 */
const sampleBody = readFileSync(resolve(process.cwd(), 'fixtures', 'bing', 'daily.json'), 'utf8');

describe('bing 每日壁纸映射', () => {
  it('接口固定取最近 8 天并带 zh-CN 地区参数', () => {
    expect(BING_DAILY_COUNT).toBe(8);
    expect(buildBingDailyPath()).toBe(
      `/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN`
    );
  });

  it('按日期倒序归一化，日期同时作为 id 与本地零点时间', async () => {
    const { client, calls } = createClient(okResponse(sampleBody));
    const adapter = createBingAdapter({ client });

    const page = await adapter.daily?.();

    expect(calls).toEqual([buildBingDailyPath()]);
    expect(page).toMatchObject({ page: 1, lastId: null });
    expect(page?.posts.map((post) => post.id)).toEqual([20261106, 20261105, 20261104]);
    expect(page?.posts[0]).toMatchObject({
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
    });
  });

  it('接口返回空列表时得到空页而不报错', async () => {
    const { client } = createClient(okResponse(JSON.stringify({ images: [] })));
    const adapter = createBingAdapter({ client });

    const page = await adapter.daily?.();

    expect(page).toEqual({ posts: [], page: 1, lastId: null });
  });

  it('无 md5 时下载命名回退为 bing_日期', async () => {
    const { client } = createClient(okResponse(sampleBody));
    const adapter = createBingAdapter({ client });
    const post = (await adapter.daily?.())?.posts[0] as Post;

    expect(renderDownloadPath(post)).toBe('bing_20261106.jpg');
  });

  it('日期解析拒绝非法格式与不存在的日历日', () => {
    expect(parseBingDate('20261106')).toEqual({
      id: 20261106,
      createdAt: new Date(2026, 10, 6).getTime()
    });
    expect(parseBingDate('2026-11-06')).toBeNull();
    expect(parseBingDate('20261340')).toBeNull();
    expect(parseBingDate(undefined)).toBeNull();
  });
});

describe('bing 错误态', () => {
  it('关键词搜索直接返回 CONFIG 且不发起请求', async () => {
    const { client, calls } = createClient(okResponse(sampleBody));
    const adapter = createBingAdapter({ client });

    await expect(adapter.search({} as ParsedQuery)).rejects.toMatchObject({
      appError: { code: 'CONFIG', retryable: false }
    });
    expect(calls).toHaveLength(0);
  });

  it('缺 urlbase 判为 PARSE', async () => {
    const { client } = createClient(okResponse(JSON.stringify({ images: [{ enddate: '20261106' }] })));
    const adapter = createBingAdapter({ client });

    await expect(adapter.daily?.()).rejects.toMatchObject({
      appError: { code: 'PARSE' }
    });
  });

  it('日期字段异常判为 PARSE', async () => {
    const { client } = createClient(
      okResponse(
        JSON.stringify({
          images: [image('2026-11-06', '/th?id=OHR.BadDate', 'Bad (© Example)')]
        })
      )
    );
    const adapter = createBingAdapter({ client });

    await expect(adapter.daily?.()).rejects.toMatchObject({
      appError: { code: 'PARSE' }
    });
  });

  it('响应不是合法 JSON 判为 PARSE', async () => {
    const { client } = createClient(okResponse('<html></html>'));
    const adapter = createBingAdapter({ client });

    await expect(adapter.daily?.()).rejects.toMatchObject({
      appError: { code: 'PARSE' }
    });
  });

  it('网络失败原样透传', async () => {
    const { client } = createClient({
      ok: false,
      error: createAppError('NETWORK', '请求失败')
    });
    const adapter = createBingAdapter({ client });

    await expect(adapter.daily?.()).rejects.toMatchObject({
      appError: { code: 'NETWORK', retryable: true }
    });
  });

  it('429 映射为更明确的 RATE_LIMITED 文案', async () => {
    const { client } = createClient({
      ok: false,
      error: createAppError('RATE_LIMITED', '请求过于频繁', { detail: 'HTTP 429' })
    });
    const adapter = createBingAdapter({ client });

    await expect(adapter.daily?.()).rejects.toMatchObject({
      appError: { code: 'RATE_LIMITED', message: 'Bing 请求过于频繁，请稍后重试' }
    });
  });
});
