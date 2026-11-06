import { createRateLimiter, type RateLimiter } from '@main/network/rate-limiter';
import type { AnySiteId } from '@shared/constants';
import {
  type AppError,
  AppErrorException,
  createAppError,
  type Result,
  toAppError
} from '@shared/errors';
import { classifyHttpFailure, parseRetryAfter, retryDelayMs } from '@shared/http';
import { siteBaseUrl } from '@shared/sites';

export const DEFAULT_TIMEOUT_MS = 20_000;
export const DEFAULT_RETRIES = 2;

const DEFAULT_HEADERS: Record<string, string> = { Accept: 'application/json' };

export interface TransportRequest {
  headers: Record<string, string>;
  signal: AbortSignal;
}

export interface TransportResponse {
  status: number;
  body: string;
  retryAfter: string | null;
}

export type HttpTransport = (url: string, request: TransportRequest) => Promise<TransportResponse>;

export interface HttpRequestOptions {
  timeoutMs?: number;
  /** 重试次数（不含首次请求），默认 2 */
  retries?: number;
  headers?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: string;
}

export interface HttpClient {
  readonly site: AnySiteId;
  request(path: string, options?: HttpRequestOptions): Promise<Result<HttpResponse>>;
}

export interface HttpClientDeps {
  site: AnySiteId;
  transport: HttpTransport;
  /** 站点根地址，默认取 `siteBaseUrl`；集成测试可指向本地 mock server */
  baseUrl?: string;
  limiter?: RateLimiter;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const timeoutError = (): AppErrorException =>
  new AppErrorException(createAppError('TIMEOUT', '请求超时，请检查网络后重试'));

/** 超时同时中止底层请求，避免连接悬挂；中止信号由各站点通道自行消费 */
const runWithTimeout = async (
  transport: HttpTransport,
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<TransportResponse> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(timeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([transport(url, { headers, signal: controller.signal }), timeout]);
  } catch (error) {
    // 超时与"被中止后传输层抛出的 AbortError"都归为 TIMEOUT，保证分类稳定
    if (timedOut) throw timeoutError();
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

type AttemptOutcome =
  | { kind: 'ok'; response: HttpResponse }
  | { kind: 'failure'; error: AppError; retryAfterMs: number | null };

/**
 * 统一 HTTP 入口：限速排队 → 超时控制 → 错误分类 → 按语义重试。
 * 主进程内部以 Result 信封返回，不向 IPC 抛异常（05 §4）。
 */
export function createHttpClient(deps: HttpClientDeps): HttpClient {
  const { site, transport } = deps;
  const baseUrl = deps.baseUrl ?? siteBaseUrl(site);
  const limiter = deps.limiter ?? createRateLimiter();
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const defaultTimeoutMs = deps.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const defaultRetries = deps.defaultRetries ?? DEFAULT_RETRIES;

  const attemptRequest = async (
    url: string,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<AttemptOutcome> => {
    try {
      const response = await runWithTimeout(transport, url, headers, timeoutMs);
      const error = classifyHttpFailure(response.status, response.body);
      if (error === null) {
        return { kind: 'ok', response: { status: response.status, body: response.body } };
      }
      return {
        kind: 'failure',
        error,
        retryAfterMs: parseRetryAfter(response.retryAfter, now())
      };
    } catch (caught) {
      return { kind: 'failure', error: toAppError(caught, 'NETWORK'), retryAfterMs: null };
    }
  };

  const request = async (
    path: string,
    options: HttpRequestOptions = {}
  ): Promise<Result<HttpResponse>> => {
    const url = new URL(path, baseUrl).toString();
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const retries = Math.max(0, options.retries ?? defaultRetries);
    const headers = { ...DEFAULT_HEADERS, ...options.headers };

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      // 重试同样经过令牌桶，保证所有请求（含失败重发）都不突破站点速率
      await limiter.acquire();
      const outcome = await attemptRequest(url, headers, timeoutMs);

      if (outcome.kind === 'ok') return { ok: true, data: outcome.response };

      const error = outcome.error;
      if (!error.retryable || attempt === retries) return { ok: false, error };

      await sleep(retryDelayMs(attempt, outcome.retryAfterMs));
    }

    return { ok: false, error: createAppError('NETWORK', '网络请求失败，请检查网络连接后重试') };
  };

  return { site, request };
}
