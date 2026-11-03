import { CF_CLEARANCE_COOKIE, CF_STATUSES, isChallengeResponse } from '@shared/cf';
import { describe, expect, it } from 'vitest';

describe('CF 挑战判定', () => {
  it('403 + Cloudflare 挑战特征命中', () => {
    expect(isChallengeResponse(403, '<title>Just a moment...</title>')).toBe(true);
    expect(isChallengeResponse(403, '<script>window.__cf_chl_opt = {}</script>')).toBe(true);
    expect(isChallengeResponse(403, '<div class="cf-chl-widget"></div>')).toBe(true);
  });

  it('非 403 或普通响应不误判', () => {
    expect(isChallengeResponse(200, 'Just a moment')).toBe(false);
    expect(isChallengeResponse(403, '{"error":"forbidden"}')).toBe(false);
    expect(isChallengeResponse(404, 'Just a moment')).toBe(false);
  });

  it('状态与 cookie 名固定', () => {
    expect(CF_STATUSES).toEqual(['idle', 'acquiring', 'ready', 'failed']);
    expect(CF_CLEARANCE_COOKIE).toBe('cf_clearance');
  });
});
