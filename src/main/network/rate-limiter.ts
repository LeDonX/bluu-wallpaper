/** 03 §4.4：每站点令牌桶 1–2 req/s，超限排队而非报错 */
export const DEFAULT_REQUESTS_PER_SECOND = 2;
export const DEFAULT_BURST = 1;

export interface RateLimiterOptions {
  requestsPerSecond?: number;
  /** 桶容量：允许的瞬时突发数 */
  burst?: number;
  /** 可注入，便于单测用虚拟时钟验证速率 */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RateLimiter {
  /** 取到令牌才返回；超出速率时排队等待，不抛错 */
  acquire(): Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const positiveOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const requestsPerSecond = positiveOr(options.requestsPerSecond, DEFAULT_REQUESTS_PER_SECOND);
  const capacity = Math.max(1, Math.floor(positiveOr(options.burst, DEFAULT_BURST)));
  const intervalMs = 1_000 / requestsPerSecond;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? realSleep;

  let tokens = capacity;
  let lastRefillAt = now();
  let queue: Promise<void> = Promise.resolve();

  const waitForToken = async (): Promise<void> => {
    while (true) {
      const current = now();
      const elapsed = Math.max(0, current - lastRefillAt);
      tokens = Math.min(capacity, tokens + elapsed / intervalMs);
      lastRefillAt = current;

      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await sleep(Math.ceil((1 - tokens) * intervalMs));
    }
  };

  return {
    acquire: () => {
      // 串行排队：保证先到先得，且并发请求不会同时消耗同一个令牌
      const task = queue.then(waitForToken);
      queue = task.catch(() => undefined);
      return task;
    }
  };
}
