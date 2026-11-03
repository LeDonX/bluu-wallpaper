import { createHttpClient, type HttpClient, type HttpTransport } from '@main/network/http';
import { createRateLimiter, type RateLimiter } from '@main/network/rate-limiter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type MockServer, type MockStats, SCENARIO_HEADER, startMockServer } from '../mock/server';

/** 真实走 TCP 的传输层：用 Node 内置 fetch，超时由调用方的 AbortSignal 传递 */
const fetchTransport: HttpTransport = async (url, request) => {
  const response = await fetch(url, { headers: request.headers, signal: request.signal });
  return {
    status: response.status,
    body: await response.text(),
    retryAfter: response.headers.get('retry-after')
  };
};

const realSleep = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

/** 除 TC-13 外，其余用例不关心限速，用高速率令牌桶缩短耗时 */
const fastLimiter = (): RateLimiter => createRateLimiter({ requestsPerSecond: 20, burst: 6 });

let server: MockServer;

beforeEach(async () => {
  server = await startMockServer();
});

afterEach(async () => {
  await server.close();
});

interface ClientOptions {
  limiter?: RateLimiter;
  sleep?: (ms: number) => Promise<void>;
  defaultTimeoutMs?: number;
}

const createClient = (options: ClientOptions = {}): HttpClient =>
  createHttpClient({
    site: 'yande',
    baseUrl: server.baseUrl,
    transport: fetchTransport,
    ...options
  });

describe('mock server 契约', () => {
  it('/__stats 返回请求次数与时间戳，且不统计自身', async () => {
    const client = createClient({ limiter: fastLimiter() });
    await client.request('/post.json');
    await client.request('/post.json');

    const response = await fetch(server.url('/__stats'));
    const stats = (await response.json()) as MockStats;

    expect(stats.requestCount).toBe(2);
    expect(stats.requests.map((item) => item.path)).toEqual(['/post.json', '/post.json']);
    expect(stats.firstAtMs).not.toBeNull();
    expect(stats.lastAtMs).not.toBeNull();
  });
});

describe('网络层集成（TC-13 ~ TC-17）', () => {
  it(
    'TC-13 连续 20 次请求平均速率 ≤ 2/s（默认令牌桶，__stats 实测）',
    { timeout: 25_000 },
    async () => {
      const client = createClient();

      for (let index = 0; index < 20; index += 1) {
        const result = await client.request('/post.json');
        expect(result.ok).toBe(true);
      }

      const stats = server.stats();
      expect(stats.requestCount).toBe(20);

      const first = stats.firstAtMs ?? 0;
      const last = stats.lastAtMs ?? 0;
      expect(last - first).toBeGreaterThan(0);

      // 平均速率 = 请求间隔数 / 总耗时；5% 余量吸收计时器抖动
      const averageRate = (stats.requestCount - 1) / ((last - first) / 1000);
      expect(averageRate).toBeLessThanOrEqual(2.05);
    }
  );

  it(
    'TC-14 429-3：按 Retry-After 退避 3 次后成功',
    { timeout: 15_000 },
    async () => {
      const delays: number[] = [];
      const client = createClient({
        limiter: fastLimiter(),
        // 记录退避时长，同时真实等待以贴近线上行为
        sleep: async (ms) => {
          delays.push(ms);
          await realSleep(ms);
        }
      });

      const result = await client.request('/post.json', {
        headers: { [SCENARIO_HEADER]: '429-3' },
        retries: 3
      });

      expect(result).toMatchObject({ ok: true, data: { status: 200 } });
      expect(delays).toEqual([1_000, 1_000, 1_000]);
      expect(server.stats().requests.map((item) => item.scenario)).toEqual([
        '429-3',
        '429-3',
        '429-3',
        '429-3'
      ]);
    }
  );

  it(
    'TC-15 challenge-once：识别为 CF_CHALLENGE 且不重试；取得通行后再次请求成功',
    { timeout: 10_000 },
    async () => {
      const client = createClient({ limiter: fastLimiter() });

      const first = await client.request('/post.json', {
        headers: { [SCENARIO_HEADER]: 'challenge-once' },
        retries: 2
      });
      expect(first).toMatchObject({
        ok: false,
        error: { code: 'CF_CHALLENGE', retryable: false }
      });
      expect(server.stats().requestCount).toBe(1);

      // 模拟通道重新取得 clearance 后的重发：mock 已不再返回挑战页
      const second = await client.request('/post.json', {
        headers: { [SCENARIO_HEADER]: 'challenge-once' },
        retries: 2
      });
      expect(second).toMatchObject({ ok: true, data: { status: 200 } });
      expect(server.stats().requestCount).toBe(2);
    }
  );

  it(
    'TC-16 challenge-always：最终返回 CF_CHALLENGE，不无限重试',
    { timeout: 10_000 },
    async () => {
      const client = createClient({ limiter: fastLimiter() });

      const result = await client.request('/post.json', {
        headers: { [SCENARIO_HEADER]: 'challenge-always' },
        retries: 5
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: 'CF_CHALLENGE', retryable: false }
      });
      expect(server.stats().requestCount).toBe(1);
    }
  );

  it('TC-17 timeout：超时返回 TIMEOUT，且测试进程不被挂起', { timeout: 5_000 }, async () => {
    const client = createClient({ limiter: fastLimiter(), defaultTimeoutMs: 100 });

    const startedAt = Date.now();
    const result = await client.request('/post.json', {
      headers: { [SCENARIO_HEADER]: 'timeout' },
      retries: 0
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'TIMEOUT', retryable: true } });
    expect(Date.now() - startedAt).toBeLessThan(3_000);
    expect(server.stats().requestCount).toBe(1);
  });
});
