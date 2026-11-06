import type { SiteAdapter } from '@main/sites/types';
import type { AnySiteId } from '@shared/constants';
import { createAppError, type Result, toAppError } from '@shared/errors';
import type { DailyListInput } from '@shared/ipc-contract';
import type { PostPage } from '@shared/models';
import { SITE_LABELS, siteSupports } from '@shared/sites';

import { parseDailyListInput } from '../daily-input';

export type DailyListHandler = (raw: unknown) => Promise<Result<PostPage>>;

export interface DailyListOptions {
  /** 07 DR-076：每日壁纸属于可选能力，缺失时 handler 按 CONFIG 拒绝 */
  getAdapter: (site: AnySiteId) => Pick<SiteAdapter, 'daily'>;
}

/**
 * `daily:list` 的纯逻辑处理：入参校验 → 适配器请求。
 * 能力表与适配器双重判定，能力缺失时给出明确原因（07 DR-070 / DR-076）。
 */
export function createDailyListHandler(options: DailyListOptions): DailyListHandler {
  return async (raw) => {
    let input: DailyListInput;
    try {
      input = parseDailyListInput(raw);
    } catch (error) {
      return { ok: false, error: toAppError(error, 'CONFIG') };
    }

    const unsupported = (): Result<PostPage> => ({
      ok: false,
      error: createAppError('CONFIG', `${SITE_LABELS[input.site]} 不支持每日壁纸`, {
        retryable: false
      })
    });
    // 能力表判定与适配器判定双重校验，避免能力表与实现漂移（DR-076）
    if (!siteSupports(input.site, 'daily')) return unsupported();

    try {
      const adapter = options.getAdapter(input.site);
      if (adapter.daily === undefined) return unsupported();
      return { ok: true, data: await adapter.daily() };
    } catch (error) {
      return { ok: false, error: toAppError(error) };
    }
  };
}
