import type { ViewsStore } from '@main/storage/views';
import { AppErrorException, createAppError, type Result } from '@shared/errors';

import { parseViewsInput } from '../views-input';

export type ViewsMarkHandler = (raw: unknown) => Promise<Result<null>>;

/**
 * `views:mark` 的纯逻辑处理：入参校验 → 写入 `post_views`（02 §6.1）。
 * 存储层注入便于离线单测；失败返回 Result 信封，不向 IPC 抛异常（05 §4）。
 */
export function createViewsMarkHandler(store: Pick<ViewsStore, 'mark'>): ViewsMarkHandler {
  return async (raw) => {
    try {
      const input = parseViewsInput(raw);
      store.mark(input.site, input.postIds);
      return { ok: true, data: null };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '已看记录写入失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
