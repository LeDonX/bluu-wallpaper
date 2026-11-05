import type { FavoritesStore } from '@main/storage/favorites';
import { AppErrorException, createAppError, type Result } from '@shared/errors';
import { matchesFavoriteQuery, sortFavoriteEntries } from '@shared/favorites';
import type { PostPage } from '@shared/models';

import { parseFavoriteListInput } from '../favorites-input';

export type FavoritesListHandler = (raw: unknown) => Promise<Result<PostPage>>;

/**
 * `favorites:list` 的纯逻辑处理：入参校验 → 读本地快照 → 标签筛选与排序（02 §8）。
 * 数据仅来自 SQLite，不发起网络请求，避免触发站点限流。
 */
export function createFavoritesListHandler(
  store: Pick<FavoritesStore, 'list'>
): FavoritesListHandler {
  return async (raw) => {
    try {
      const input = parseFavoriteListInput(raw);
      const entries = store.list(input.site).filter((entry) =>
        matchesFavoriteQuery(entry.post, input.query)
      );
      const sorted = sortFavoriteEntries(entries, input.sort ?? 'added');
      return {
        ok: true,
        data: { posts: sorted.map((entry) => entry.post), page: 1, lastId: null }
      };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('DB', '收藏列表读取失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
