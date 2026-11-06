import type { SubscriptionService } from '@main/subscriptions/service';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { FollowAddResult } from '@shared/subscriptions';

import { parseFollowsAddInput } from '../follows-input';

export type FollowsAddHandler = (raw: unknown) => Promise<Result<FollowAddResult>>;

/** `follows:add`：首次关注会立即拉最近 20 条并标已读（DR-069） */
export function createFollowsAddHandler(
  service: Pick<SubscriptionService, 'add'>
): FollowsAddHandler {
  return async (raw) => {
    try {
      const input = parseFollowsAddInput(raw);
      return { ok: true, data: await service.add(input.site, input.tag) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '关注失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
