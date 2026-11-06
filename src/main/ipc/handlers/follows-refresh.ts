import type { SubscriptionService } from '@main/subscriptions/service';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { FollowRefreshResult } from '@shared/subscriptions';

import { parseFollowsSiteInput } from '../follows-input';

export type FollowsRefreshHandler = (raw: unknown) => Promise<Result<FollowRefreshResult>>;

/** `follows:refresh`：逐关注串行拉取，单关注失败不阻断其它（DR-069） */
export function createFollowsRefreshHandler(
  service: Pick<SubscriptionService, 'refresh'>
): FollowsRefreshHandler {
  return async (raw) => {
    try {
      const input = parseFollowsSiteInput(raw);
      return { ok: true, data: await service.refresh(input.site) };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '关注刷新失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
