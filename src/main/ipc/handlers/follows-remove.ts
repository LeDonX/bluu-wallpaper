import type { SubscriptionService } from '@main/subscriptions/service';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseFollowsRemoveInput } from '../follows-input';

export type FollowsRemoveHandler = (raw: unknown) => Promise<Result<null>>;

/** `follows:remove`：事务内级联删除关注与作品记录（DR-069） */
export function createFollowsRemoveHandler(
  service: Pick<SubscriptionService, 'remove'>
): FollowsRemoveHandler {
  return async (raw) => {
    try {
      const input = parseFollowsRemoveInput(raw);
      service.remove(input.site, input.tag);
      return { ok: true, data: null };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '取消关注失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
