import { isChallengeResponse } from '@shared/cf';
import { type AppError, createAppError } from '@shared/errors';

/** 03 §4.4：429 / 5xx / 网络错误走指数退避，基数为 1s */
export const BASE_RETRY_DELAY_MS = 1_000;

/**
 * 把 HTTP 响应分类为 AppError；2xx 返回 null 表示成功。
 * 判定顺序固定：CF 挑战先于 403 普通拒绝，429/404 先于通用 4xx/5xx。
 */
export function classifyHttpFailure(status: number, body: string): AppError | null {
  if (status >= 200 && status < 300) return null;

  if (isChallengeResponse(status, body)) {
    return createAppError('CF_CHALLENGE', 'Cloudflare 验证未通过，请稍后重试或手动验证');
  }
  if (status === 404) {
    return createAppError('NOT_FOUND', '资源不存在或已被删除');
  }
  if (status === 429) {
    return createAppError('RATE_LIMITED', '请求过于频繁，正在自动退避');
  }
  if (status >= 500) {
    return createAppError('SERVER', '站点服务器暂时不可用，请稍后重试');
  }
  return createAppError('NETWORK', '请求被站点拒绝', {
    retryable: false,
    detail: `HTTP ${status}`
  });
}

/**
 * 解析 Retry-After：支持秒数与 HTTP-date，返回毫秒；无法识别返回 null。
 * nowMs 可注入，便于单测按固定时间断言。
 */
export function parseRetryAfter(value: string | null, nowMs: number = Date.now()): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, dateMs - nowMs);
}

/** 优先尊重 Retry-After，否则按 1s→2s→4s 指数退避（attempt 从 0 开始） */
export function retryDelayMs(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null && retryAfterMs >= 0) return retryAfterMs;
  return BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt);
}
