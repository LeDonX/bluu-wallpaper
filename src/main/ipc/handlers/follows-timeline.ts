import type { SubscriptionService } from '@main/subscriptions/service';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { SubscriptionTimeline } from '@shared/subscriptions';

import { parseFollowsSiteInput } from '../follows-input';

export type FollowsTimelineHandler = (raw: unknown) => Promise<Result<SubscriptionTimeline>>;

/** `follows:timeline`：聚合并去重后的本地时间线（02 §8 / DR-069） */
export function createFollowsTimelineHandler(
  service: Pick<SubscriptionService, 'timeline'>
): FollowsTimelineHandler {
  return async (raw) => {
    try {
      const input = parseFollowsSiteInput(raw);
      return { ok: true, data: service.timeline(input.site) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '关注时间线读取失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
