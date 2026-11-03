export const CF_CLEARANCE_COOKIE = 'cf_clearance';

export const CF_STATUSES = ['idle', 'acquiring', 'ready', 'failed'] as const;

export type CfStatus = (typeof CF_STATUSES)[number];

/**
 * 06 §6 的挑战判定：403 且响应体含 Cloudflare 挑战特征。
 * 网络层与站点适配器共用同一判定，避免各写一套正则。
 */
export function isChallengeResponse(status: number, body: string): boolean {
  return status === 403 && /Just a moment|cf-chl-|__cf_chl/i.test(body);
}
