import type { FavoritesStore } from '@main/storage/favorites';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import type { FavoriteToggleResult } from '@shared/ipc-contract';

import { parseFavoriteToggleInput } from '../favorites-input';

export type FavoritesToggleHandler = (raw: unknown) => Promise<Result<FavoriteToggleResult>>;

/**
 * `favorites:toggle` 的纯逻辑处理：入参校验 → 切换收藏（03 §7 / DR-032）。
 * 收藏与已看独立；失败返回 Result 信封，不向 IPC 抛异常（05 §4）。
 */
export function createFavoritesToggleHandler(
  store: Pick<FavoritesStore, 'toggle'>
): FavoritesToggleHandler {
  return async (raw) => {
    try {
      const input = parseFavoriteToggleInput(raw);
      return { ok: true, data: { favorited: store.toggle(input.site, input.post) } };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '收藏操作失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
