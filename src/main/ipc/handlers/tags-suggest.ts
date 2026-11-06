import { MOEBOORU_TAG_LIMIT } from '@main/sites/moebooru';
import type { SiteAdapter } from '@main/sites/types';
import type { TagCache } from '@main/storage/tags';
import type { AnySiteId } from '@shared/constants';
import { createAppError, type Result, toAppError } from '@shared/errors';
import type { TagsSuggestInput } from '@shared/ipc-contract';
import type { TagSuggestion } from '@shared/models';
import { SITE_LABELS } from '@shared/sites';

import { parseSuggestInput } from '../suggest-input';

export type TagsSuggestHandler = (raw: unknown) => Promise<Result<TagSuggestion[]>>;

export interface TagsSuggestDeps {
  /** 07 DR-057 / DR-070：联想属于可选能力，缺失时 handler 按 CONFIG 拒绝 */
  getAdapter: (site: AnySiteId) => Pick<SiteAdapter, 'suggestTags'>;
  cache: TagCache;
}

/**
 * `tags:suggest` 的纯逻辑处理：入参校验 → 本地 `tag_cache` 前缀 →
 * 未命中再请求远端，远端结果回写缓存（02 §3 数据源优先级）。
 * 依赖注入便于离线单测；失败返回 Result 信封，由渲染层静默降级。
 */
export function createTagsSuggestHandler(deps: TagsSuggestDeps): TagsSuggestHandler {
  const { getAdapter, cache } = deps;

  return async (raw) => {
    let input: TagsSuggestInput;
    try {
      input = parseSuggestInput(raw);
    } catch (error) {
      return { ok: false, error: toAppError(error, 'CONFIG') };
    }

    const prefix = input.prefix.trim().toLowerCase();
    try {
      const cached = cache.find(input.site, prefix, MOEBOORU_TAG_LIMIT);
      if (cached.length > 0) return { ok: true, data: cached };

      // DR-070：没有联想能力的站点即使缓存未命中，也不发起远端请求
      const adapter = getAdapter(input.site);
      if (adapter.suggestTags === undefined) {
        return {
          ok: false,
          error: createAppError('CONFIG', `${SITE_LABELS[input.site]} 不支持标签联想`, {
            retryable: false
          })
        };
      }
      const remote = await adapter.suggestTags(prefix, MOEBOORU_TAG_LIMIT);
      if (remote.length > 0) cache.save(input.site, remote);
      return { ok: true, data: remote };
    } catch (error) {
      return { ok: false, error: toAppError(error) };
    }
  };
}
