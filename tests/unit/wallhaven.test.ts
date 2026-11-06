import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { type HttpClient, type HttpResponse } from '@main/network/http';
import type { ParsedQuery } from '@main/sites/query';
import {
  buildWallhavenSearchPath,
  createWallhavenAdapter,
  parseWallhavenDate,
  wallhavenAtleast,
  wallhavenPostId,
  wallhavenPurity
} from '@main/sites/wallhaven';
import { renderDownloadPath } from '@shared/downloads';
import { createAppError, type Result } from '@shared/errors';
import { describe, expect, it } from 'vitest';

const makeQuery = (overrides: Partial<ParsedQuery> = {}): ParsedQuery => ({
  raw: '',
  tags: [],
  excludedTags: [],
  ratings: [],
  excludedRatings: [],
  scores: [],
  widths: [],
  ids: [],
  order: null,
  ...overrides
});

const okResponse = (body: string): Result<HttpResponse> => ({
  ok: true,
  data: { status: 200, body }
});

function createClient(response: Result<HttpResponse>) {
  const calls: Array<{ path: string; headers: Record<string, string> }> = [];
  const client: HttpClient = {
    site: 'wallhaven',
    request: async (path, options) => {
      calls.push({ path, headers: options?.headers ?? {} });
      return response;
    }
  };
  return { client, calls };
}

/** 06 §8：wallhaven 离线 fixture，CI 不访问真实站点 */
const sampleBody = readFileSync(
  resolve(process.cwd(), 'fixtures', 'wallhaven', 'search.json'),
  'utf8'
);

describe('wallhaven 查询映射', () => {
  it('拼出 q / purity / categories / sorting / atleast / page', () => {
    const query = makeQuery({
      tags: ['landscape', 'sky'],
      excludedTags: ['dark'],
      excludedRatings: ['explicit'],
      widths: [{ op: '>=', value: 1920 }],
      order: 'fav'
    });
    expect(buildWallhavenSearchPath(query, { page: 2 })).toBe(
      '/api/v1/search?q=landscape%20sky%20-dark&purity=100&categories=111&sorting=favorites&atleast=1920x1080&page=2'
    );
  });

  it('空查询映射 24 小时热门（DR-085）', () => {
    expect(buildWallhavenSearchPath(makeQuery(), { page: 1 })).toBe(
      '/api/v1/search?purity=111&categories=111&sorting=toplist&topRange=1d&page=1'
    );
    expect(buildWallhavenSearchPath(makeQuery({ excludedRatings: ['explicit'] }), { page: 2 })).toBe(
      '/api/v1/search?purity=100&categories=111&sorting=toplist&topRange=1d&page=2'
    );
  });

  it('R18 关闭映射 SFW，开启映射全档位，显式 rating 按位合并', () => {
    expect(wallhavenPurity(makeQuery({ excludedRatings: ['explicit'] }))).toBe('100');
    expect(wallhavenPurity(makeQuery())).toBe('111');
    expect(wallhavenPurity(makeQuery({ ratings: ['explicit'] }))).toBe('001');
    expect(wallhavenPurity(makeQuery({ ratings: ['safe', 'questionable'] }))).toBe('110');
  });

  it('atleast 取最严格下界并支持标准档位', () => {
    expect(wallhavenAtleast([{ op: '>=', value: 2560 }])).toBe('2560x1440');
    expect(wallhavenAtleast([{ op: '>=', value: 3840 }])).toBe('3840x2160');
    expect(wallhavenAtleast([{ op: '>=', value: 1280 }])).toBe('1280x720');
    expect(wallhavenAtleast([{ op: '<=', value: 1920 }])).toBeNull();
    expect(
      wallhavenAtleast([
        { op: '>=', value: 1280 },
        { op: '>=', value: 2560 }
      ])
    ).toBe('2560x1440');
  });

  it('lastId 游标按第 1 页处理（wallhaven 无 id 游标）', () => {
    const query = makeQuery({ tags: ['sky'] });
    expect(buildWallhavenSearchPath(query, { lastId: 9 })).toContain('page=1');
  });
});

describe('wallhaven 归一化', () => {
  it('字符串 id 转为安全整数且稳定', () => {
    expect(wallhavenPostId('123')).toBe(123);
    const decoded = wallhavenPostId('abc123');
    expect(decoded).toBe(Number.parseInt('abc123', 36));
    expect(wallhavenPostId('abc123')).toBe(decoded);
  });

  it('created_at 按 UTC 解析为 epoch 毫秒', () => {
    expect(parseWallhavenDate('2024-01-02 03:04:05')).toBe(Date.UTC(2024, 0, 2, 3, 4, 5));
    expect(parseWallhavenDate('')).toBe(0);
  });

  it('响应映射为 Post：md5 空、purity→rating、收藏数作为 score', async () => {
    const { client, calls } = createClient(okResponse(sampleBody));
    const adapter = createWallhavenAdapter({ client, getApiKey: () => 'secret' });

    const page = await adapter.search(makeQuery({ tags: ['sky'] }));

    expect(page.page).toBe(1);
    expect(page.lastId).toBeNull();
    expect(page.posts).toHaveLength(1);
    expect(page.posts[0]).toMatchObject({
      site: 'wallhaven',
      id: wallhavenPostId('abc123'),
      md5: '',
      previewUrl: 'https://th.wallhaven.cc/lg/ab/abc123.jpg',
      sampleUrl: 'https://th.wallhaven.cc/orig/ab/abc123.jpg',
      fileUrl: 'https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg',
      width: 3840,
      height: 2160,
      fileSize: 123456,
      rating: 'explicit',
      score: 42,
      tags: [],
      createdAt: Date.UTC(2024, 0, 2, 3, 4, 5),
      source: 'https://example.com/original'
    });
    expect(calls[0]?.path).toContain('/api/v1/search?');
    expect(calls[0]?.headers['X-API-Key']).toBe('secret');
  });

  it('空结果返回空页且保留请求页码', async () => {
    const { client } = createClient(okResponse(JSON.stringify({ data: [], meta: {} })));
    const adapter = createWallhavenAdapter({ client, getApiKey: () => 'secret' });

    const page = await adapter.search(makeQuery(), { page: 2 });
    expect(page).toMatchObject({ posts: [], page: 2, lastId: null });
  });

  it('下载默认模板在 md5 为空时回退为 wallhaven_id', () => {
    const post = {
      site: 'wallhaven' as const,
      id: wallhavenPostId('abc123'),
      md5: '',
      previewUrl: 'https://th.wallhaven.cc/lg/ab/abc123.jpg',
      sampleUrl: 'https://th.wallhaven.cc/orig/ab/abc123.jpg',
      fileUrl: 'https://w.wallhaven.cc/full/ab/wallhaven-abc123.jpg',
      width: 3840,
      height: 2160,
      fileSize: 123456,
      rating: 'safe' as const,
      score: 42,
      tags: [],
      createdAt: 0
    };
    expect(renderDownloadPath(post)).toBe(`wallhaven_${wallhavenPostId('abc123')}.jpg`);
  });
});

describe('wallhaven 错误态', () => {
  it('未配置密钥直接返回 CONFIG 且不发起请求', async () => {
    const { client, calls } = createClient(okResponse(sampleBody));
    const adapter = createWallhavenAdapter({ client, getApiKey: () => '   ' });

    await expect(adapter.search(makeQuery())).rejects.toMatchObject({
      appError: { code: 'CONFIG', retryable: false }
    });
    expect(calls).toHaveLength(0);
  });

  it('401 映射为密钥无效的 CONFIG 错误', async () => {
    const { client } = createClient({
      ok: false,
      error: createAppError('NETWORK', '请求被站点拒绝', {
        retryable: false,
        detail: 'HTTP 401'
      })
    });
    const adapter = createWallhavenAdapter({ client, getApiKey: () => 'bad' });

    await expect(adapter.search(makeQuery())).rejects.toMatchObject({
      appError: { code: 'CONFIG', message: expect.stringContaining('密钥'), retryable: false }
    });
  });

  it('429 保留 RATE_LIMITED 并给出明确文案', async () => {
    const { client } = createClient({
      ok: false,
      error: createAppError('RATE_LIMITED', '请求过于频繁，正在自动退避')
    });
    const adapter = createWallhavenAdapter({ client, getApiKey: () => 'secret' });

    await expect(adapter.search(makeQuery())).rejects.toMatchObject({
      appError: { code: 'RATE_LIMITED', message: expect.stringContaining('429') }
    });
  });

  it('非法 JSON 归类为 PARSE', async () => {
    const { client } = createClient(okResponse('not-json'));
    const adapter = createWallhavenAdapter({ client, getApiKey: () => 'secret' });

    await expect(adapter.search(makeQuery())).rejects.toMatchObject({
      appError: { code: 'PARSE' }
    });
  });
});
