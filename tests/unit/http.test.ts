import { createHttpClient, type HttpTransport, type TransportResponse } from '@main/network/http';
import { AppErrorException, createAppError } from '@shared/errors';
import { classifyHttpFailure, parseRetryAfter, retryDelayMs } from '@shared/http';
import { describe, expect, it } from 'vitest';

const noopLimiter = { acquire: async (): Promise<void> => undefined };

const fixedTransport =
  (response: TransportResponse): HttpTransport =>
  async () =>
    response;

describe('HTTP 错误分类', () => {
  it('2xx 视为成功', () => {
    expect(classifyHttpFailure(200, '[]')).toBeNull();
    expect(classifyHttpFailure(204, '')).toBeNull();
  });

  it('429/404/5xx 分别归类且重试语义正确', () => {
    expect(classifyHttpFailure(429, '')).toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true
    });
    expect(classifyHttpFailure(404, '')).toMatchObject({ code: 'NOT_FOUND', retryable: false });
    expect(classifyHttpFailure(500, '')).toMatchObject({ code: 'SERVER', retryable: true });
    expect(classifyHttpFailure(503, '')).toMatchObject({ code: 'SERVER', retryable: true });
  });

  it('403 挑战页归为 CF_CHALLENGE，普通 403 归为不可重试的 NETWORK', () => {
    expect(classifyHttpFailure(403, '<title>Just a moment...</title>')).toMatchObject({
      code: 'CF_CHALLENGE',
      retryable: false
    });
    expect(classifyHttpFailure(403, '{"error":"forbidden"}')).toMatchObject({
      code: 'NETWORK',
      retryable: false
    });
  });
});

describe('Retry-After 与退避', () => {
  it('支持秒数与 HTTP-date，非法值返回 null', () => {
    expect(parseRetryAfter('1')).toBe(1000);
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('abc')).toBeNull();

    const now = Date.UTC(2026, 0, 1);
    const future = new Date(now + 5_000).toUTCString();
    expect(parseRetryAfter(future, now)).toBe(5_000);
    const past = new Date(now - 5_000).toUTCString();
    expect(parseRetryAfter(past, now)).toBe(0);
  });

  it('默认指数退避 1s→2s→4s，有 Retry-After 时优先采用', () => {
    expect(retryDelayMs(0, null)).toBe(1_000);
    expect(retryDelayMs(1, null)).toBe(2_000);
    expect(retryDelayMs(2, null)).toBe(4_000);
    expect(retryDelayMs(0, 250)).toBe(250);
  });
});

describe('HTTP 客户端重试与分类', () => {
  it('429 连续 3 次后成功，期间按 Retry-After 退避', async () => {
    let calls = 0;
    const transport: HttpTransport = async () => {
      calls += 1;
      return calls <= 3
        ? { status: 429, body: '', retryAfter: '1' }
        : { status: 200, body: '[]', retryAfter: null };
    };
    const delays: number[] = [];
    const client = createHttpClient({
      site: 'yande',
      transport,
      limiter: noopLimiter,
      sleep: async (ms) => {
        delays.push(ms);
      }
    });

    const result = await client.request('/post.json', { retries: 3 });

    expect(result).toMatchObject({ ok: true, data: { status: 200, body: '[]' } });
    expect(calls).toBe(4);
    expect(delays).toEqual([1_000, 1_000, 1_000]);
  });

  it('429 重试耗尽后返回 RATE_LIMITED', async () => {
    const delays: number[] = [];
    const client = createHttpClient({
      site: 'yande',
      transport: fixedTransport({ status: 429, body: '', retryAfter: null }),
      limiter: noopLimiter,
      sleep: async (ms) => {
        delays.push(ms);
      }
    });

    const result = await client.request('/post.json', { retries: 1 });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retryable: true }
    });
    expect(delays).toEqual([1_000]);
  });

  it('5xx 按 1s→2s 退避后返回 SERVER', async () => {
    const delays: number[] = [];
    let calls = 0;
    const client = createHttpClient({
      site: 'yande',
      transport: async () => {
        calls += 1;
        return { status: 502, body: 'bad gateway', retryAfter: null };
      },
      limiter: noopLimiter,
      sleep: async (ms) => {
        delays.push(ms);
      }
    });

    const result = await client.request('/post.json', { retries: 2 });

    expect(result).toMatchObject({ ok: false, error: { code: 'SERVER', retryable: true } });
    expect(calls).toBe(3);
    expect(delays).toEqual([1_000, 2_000]);
  });

  it('404 与 CF 挑战不重试', async () => {
    let notFoundCalls = 0;
    const notFound = createHttpClient({
      site: 'yande',
      transport: async () => {
        notFoundCalls += 1;
        return { status: 404, body: '', retryAfter: null };
      },
      limiter: noopLimiter
    });
    expect(await notFound.request('/post.json', { retries: 2 })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', retryable: false }
    });
    expect(notFoundCalls).toBe(1);

    let challengeCalls = 0;
    const challenge = createHttpClient({
      site: 'konachan',
      transport: async () => {
        challengeCalls += 1;
        return { status: 403, body: '<title>Just a moment...</title>', retryAfter: null };
      },
      limiter: noopLimiter
    });
    expect(await challenge.request('/post.json', { retries: 2 })).toMatchObject({
      ok: false,
      error: { code: 'CF_CHALLENGE', retryable: false }
    });
    expect(challengeCalls).toBe(1);
  });

  it('网络异常与通道错误分别归类，且不静默', async () => {
    let networkCalls = 0;
    const network = createHttpClient({
      site: 'yande',
      transport: async () => {
        networkCalls += 1;
        throw new Error('boom');
      },
      limiter: noopLimiter
    });
    const networkResult = await network.request('/post.json', { retries: 0 });
    expect(networkResult).toMatchObject({
      ok: false,
      error: { code: 'NETWORK', retryable: true, detail: 'boom' }
    });
    expect(networkCalls).toBe(1);

    let cfCalls = 0;
    const cf = createHttpClient({
      site: 'konachan',
      transport: async () => {
        cfCalls += 1;
        throw new AppErrorException(createAppError('CF_CHALLENGE', '需要手动验证'));
      },
      limiter: noopLimiter
    });
    const cfResult = await cf.request('/post.json', { retries: 2 });
    expect(cfResult).toMatchObject({
      ok: false,
      error: { code: 'CF_CHALLENGE', retryable: false }
    });
    expect(cfCalls).toBe(1);
  });

  it('超时返回 TIMEOUT 并按 retries 重试，不挂起', async () => {
    let calls = 0;
    const delays: number[] = [];
    const client = createHttpClient({
      site: 'yande',
      transport: () => {
        calls += 1;
        return new Promise<TransportResponse>(() => undefined);
      },
      limiter: noopLimiter,
      sleep: async (ms) => {
        delays.push(ms);
      }
    });

    const result = await client.request('/post.json', { timeoutMs: 30, retries: 1 });

    expect(result).toMatchObject({ ok: false, error: { code: 'TIMEOUT', retryable: true } });
    expect(calls).toBe(2);
    expect(delays).toEqual([1_000]);
  });
});
