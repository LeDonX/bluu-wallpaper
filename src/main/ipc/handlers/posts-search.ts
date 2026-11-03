import type { MoebooruAdapter } from '@main/sites/moebooru';
import { parseQuery } from '@main/sites/query';
import { applyR18Filter } from '@shared/content';
import { type Result, toAppError } from '@shared/errors';
import type { PostsSearchInput } from '@shared/ipc-contract';
import type { PostPage, SearchCursor } from '@shared/models';

import { parseSearchInput } from '../search-input';

export type PostsSearchHandler = (raw: unknown) => Promise<Result<PostPage>>;

export interface PostsSearchOptions {
  /** 07 DR-023：R18 开关来自 `config.json`，由注册处注入便于离线单测 */
  isExplicitAllowed: () => boolean;
}

const emptyPage = (): PostPage => ({ posts: [], page: 1, lastId: null });

const cursorOf = (input: PostsSearchInput): SearchCursor | undefined => {
  if (input.lastId !== undefined) return { lastId: input.lastId };
  if (input.page !== undefined) return { page: input.page };
  return undefined;
};

/**
 * `posts:search` 的纯逻辑处理：入参校验 → 查询解析 → 适配器请求。
 * 适配器注入便于离线单测；任何失败都转成 Result 信封，不向 IPC 抛异常（05 §4）。
 */
export function createPostsSearchHandler(
  adapter: Pick<MoebooruAdapter, 'search'>,
  options: PostsSearchOptions
): PostsSearchHandler {
  return async (raw) => {
    let input: PostsSearchInput;
    try {
      input = parseSearchInput(raw);
    } catch (error) {
      return { ok: false, error: toAppError(error, 'CONFIG') };
    }

    // 09 TC-06：空查询视为无查询，不发起网络请求
    if (input.query.trim() === '') return { ok: true, data: emptyPage() };

    try {
      // 02 §2.4 / DR-023：R18 关闭时自动附加 -rating:e，用户显式 rating: 不覆盖
      const filtered = applyR18Filter(input.query.trim(), options.isExplicitAllowed());
      const query = parseQuery(filtered.query);
      const page = await adapter.search(query, cursorOf(input));
      return { ok: true, data: { ...page, r18Filtered: filtered.filtered } };
    } catch (error) {
      return { ok: false, error: toAppError(error) };
    }
  };
}
