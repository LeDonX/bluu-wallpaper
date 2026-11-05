import type { MoebooruAdapter } from '@main/sites/moebooru';
import type { SiteId } from '@shared/constants';
import { isPostBlacklisted } from '@shared/content';
import { type Result, toAppError } from '@shared/errors';
import type { PostsRankingsInput } from '@shared/ipc-contract';
import type { PostPage, SearchCursor } from '@shared/models';

import { parseRankingsInput } from '../rankings-input';

export type PostsRankingsHandler = (raw: unknown) => Promise<Result<PostPage>>;

export interface PostsRankingsOptions {
  /** 07 DR-057：两站共用 moebooru 榜单端点，按入参站点选择适配器 */
  getAdapter: (site: SiteId) => Pick<MoebooruAdapter, 'rankings'>;
  /** 07 DR-023 / DR-041：榜单无 tags 参数，R18 关闭时在结果上本地过滤 */
  isExplicitAllowed: () => boolean;
  /** 07 DR-056：黑名单同样只能本地过滤，与搜索共用同一份配置 */
  getBlacklist: () => string[];
}

const cursorOf = (input: PostsRankingsInput): SearchCursor | undefined =>
  input.page !== undefined ? { page: input.page } : undefined;

/**
 * `posts:rankings` 的纯逻辑处理：入参校验 → 适配器请求 → R18 本地过滤。
 * 两站共用同一端点与适配器（T-28）；失败统一转 Result 信封（05 §4）。
 */
export function createPostsRankingsHandler(
  options: PostsRankingsOptions
): PostsRankingsHandler {
  return async (raw) => {
    let input: PostsRankingsInput;
    try {
      input = parseRankingsInput(raw);
    } catch (error) {
      return { ok: false, error: toAppError(error, 'CONFIG') };
    }

    try {
      const page = await options.getAdapter(input.site).rankings(
        input.kind,
        input.date,
        cursorOf(input)
      );
      const allowExplicit = options.isExplicitAllowed();
      const blacklist = options.getBlacklist();
      // DR-041 / DR-056：榜单端点无法用 tags 排除，R18 与黑名单都只能在结果上本地过滤
      const r18Posts = allowExplicit
        ? page.posts
        : page.posts.filter((post) => post.rating !== 'explicit');
      const posts = r18Posts.filter((post) => !isPostBlacklisted(post, blacklist));
      // 黑名单计数只统计通过 R18 后被丢弃的条目，避免把 explicit 也算进黑名单
      const blacklistRemoved = r18Posts.length - posts.length;
      // 沿用 DR-041 的标记语义：R18 关闭即视为过滤已生效，与是否真的有条目被丢弃无关
      const r18Flag = allowExplicit ? {} : { r18Filtered: true };
      if (posts.length === page.posts.length) return { ok: true, data: { ...page, ...r18Flag } };

      return {
        ok: true,
        data: {
          ...page,
          posts,
          ...r18Flag,
          ...(blacklistRemoved > 0 ? { blacklistFiltered: blacklistRemoved } : {})
        }
      };
    } catch (error) {
      return { ok: false, error: toAppError(error) };
    }
  };
}
