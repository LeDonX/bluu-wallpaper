import type { SiteAdapter } from '@main/sites/types';
import type { AnySiteId } from '@shared/constants';
import { isPostBlacklisted } from '@shared/content';
import { createAppError, type Result, toAppError } from '@shared/errors';
import type { PostsRankingsInput } from '@shared/ipc-contract';
import type { PostPage, SearchCursor } from '@shared/models';
import { SITE_LABELS } from '@shared/sites';

import { parseRankingsInput } from '../rankings-input';

export type PostsRankingsHandler = (raw: unknown) => Promise<Result<PostPage>>;

export interface PostsRankingsOptions {
  /** 07 DR-057 / DR-070：榜单属于可选能力，缺失时 handler 按 CONFIG 拒绝 */
  getAdapter: (site: AnySiteId) => Pick<SiteAdapter, 'rankings'>;
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
      const adapter = options.getAdapter(input.site);
      // DR-070：没有榜单能力的站点（如第三方图库）请求榜单时给出明确原因
      if (adapter.rankings === undefined) {
        return {
          ok: false,
          error: createAppError('CONFIG', `${SITE_LABELS[input.site]} 不支持榜单功能`, {
            retryable: false
          })
        };
      }
      const page = await adapter.rankings(
        input.kind,
        input.date,
        cursorOf(input)
      );
      const allowExplicit = options.isExplicitAllowed();
      const blacklist = options.getBlacklist();
      // DR-041 / DR-056 / DR-092：热门端点无 tags 能力，期榜虽支持 tags 但保持同一口径，R18 与黑名单统一在结果上本地过滤
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
