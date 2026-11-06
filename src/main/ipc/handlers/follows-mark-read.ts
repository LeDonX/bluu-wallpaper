import type { SubscriptionService } from '@main/subscriptions/service';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseFollowsMarkReadInput } from '../follows-input';

export type FollowsMarkReadHandler = (raw: unknown) => Promise<Result<null>>;

/** `follows:mark-read`：单条 / 分组 / 整站三档清除未读（DR-069） */
export function createFollowsMarkReadHandler(
  service: Pick<SubscriptionService, 'markRead'>
): FollowsMarkReadHandler {
  return async (raw) => {
    try {
      const input = parseFollowsMarkReadInput(raw);
      const options: { tag?: string; postIds?: readonly number[] } = {};
      if (input.tag !== undefined) options.tag = input.tag;
      if (input.postIds !== undefined) options.postIds = input.postIds;
      service.markRead(input.site, options);
      return { ok: true, data: null };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '标记已读失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
