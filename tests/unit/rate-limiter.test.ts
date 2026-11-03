import { createRateLimiter } from '@main/network/rate-limiter';
import { describe, expect, it } from 'vitest';

describe('令牌桶限速', () => {
  it('连续 50 次请求的持续速率不超过 2/s', async () => {
    let clock = 0;
    const limiter = createRateLimiter({
      requestsPerSecond: 2,
      burst: 1,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      }
    });

    const count = 50;
    await Promise.all(Array.from({ length: count }, () => limiter.acquire()));

    // 首次立即放行，之后每 500ms 一个令牌：持续速率 = (n-1)/总时长
    expect(clock).toBeGreaterThanOrEqual((count - 1) * 500);
    expect((count - 1) / (clock / 1000)).toBeLessThanOrEqual(2);
    expect(clock).toBeLessThanOrEqual(count * 500);
  });

  it('桶容量允许瞬时突发，之后按速率排队', async () => {
    let clock = 0;
    const limiter = createRateLimiter({
      requestsPerSecond: 2,
      burst: 2,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      }
    });

    await Promise.all([limiter.acquire(), limiter.acquire()]);
    expect(clock).toBe(0);

    await limiter.acquire();
    expect(clock).toBe(500);
  });

  it('非法速率回落到默认 2/s，不会死循环', async () => {
    let clock = 0;
    const limiter = createRateLimiter({
      requestsPerSecond: 0,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      }
    });

    await limiter.acquire();
    await limiter.acquire();
    expect(clock).toBe(500);
  });
});
