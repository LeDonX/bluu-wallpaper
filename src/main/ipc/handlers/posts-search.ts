import type { MoebooruAdapter } from '@main/sites/moebooru';
import { parseQuery } from '@main/sites/query';
import type { SiteId } from '@shared/constants';
import { applyBlacklistFilter, applyR18Filter } from '@shared/content';
import { type Result, toAppError } from '@shared/errors';
import type { PostsSearchInput } from '@shared/ipc-contract';
import type { PostPage, SearchCursor } from '@shared/models';

import { parseSearchInput } from '../search-input';

export type PostsSearchHandler = (raw: unknown) => Promise<Result<PostPage>>;

export interface PostsSearchOptions {
  /** 07 DR-057：按入参站点选择适配器（yande / konachan 共用 moebooru 实现） */
  getAdapter: (site: SiteId) => Pick<MoebooruAdapter, 'search'>;
  /** 07 DR-023：R18 开关来自 `config.json`，由注册处注入便于离线单测 */
  isExplicitAllowed: () => boolean;
  /** 07 DR-056：全局黑名单同样每次读取配置，保存后立即生效 */
  getBlacklist: () => string[];
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
export function createPostsSearchHandler(options: PostsSearchOptions): PostsSearchHandler {
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
      const r18 = applyR18Filter(input.query.trim(), options.isExplicitAllowed());
      // 07 DR-056：黑名单统一拼成 -tag，与用户显式 -tag 去重
      const blacklist = applyBlacklistFilter(r18.query, options.getBlacklist());
      const query = parseQuery(blacklist.query);
      const page = await options.getAdapter(input.site).search(query, cursorOf(input));
      return {
        ok: true,
        data: {
          ...page,
          r18Filtered: r18.filtered,
          ...(blacklist.excluded > 0 ? { blacklistFiltered: blacklist.excluded } : {})
        }
      };
    } catch (error) {
      return { ok: false, error: toAppError(error) };
    }
  };
}
