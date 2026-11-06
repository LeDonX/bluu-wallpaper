import type { SubscriptionService } from '@main/subscriptions/service';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { SubscriptionSummary } from '@shared/subscriptions';

import { parseFollowsSiteInput } from '../follows-input';

export type FollowsListHandler = (raw: unknown) => Promise<Result<SubscriptionSummary[]>>;

/** `follows:list`：只读本地关注概览，不发请求（02 §8 / DR-069） */
export function createFollowsListHandler(
  service: Pick<SubscriptionService, 'list'>
): FollowsListHandler {
  return async (raw) => {
    try {
      const input = parseFollowsSiteInput(raw);
      return { ok: true, data: service.list(input.site) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '关注列表读取失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
