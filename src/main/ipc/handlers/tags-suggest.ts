import { MOEBOORU_TAG_LIMIT, type MoebooruAdapter } from '@main/sites/moebooru';
import type { TagCache } from '@main/storage/tags';
import { type Result, toAppError } from '@shared/errors';
import type { TagsSuggestInput } from '@shared/ipc-contract';
import type { TagSuggestion } from '@shared/models';

import { parseSuggestInput } from '../suggest-input';

export type TagsSuggestHandler = (raw: unknown) => Promise<Result<TagSuggestion[]>>;

export interface TagsSuggestDeps {
  adapter: Pick<MoebooruAdapter, 'suggestTags'>;
  cache: TagCache;
}

/**
 * `tags:suggest` 的纯逻辑处理：入参校验 → 本地 `tag_cache` 前缀 →
 * 未命中再请求远端，远端结果回写缓存（02 §3 数据源优先级）。
 * 依赖注入便于离线单测；失败返回 Result 信封，由渲染层静默降级。
 */
export function createTagsSuggestHandler(deps: TagsSuggestDeps): TagsSuggestHandler {
  const { adapter, cache } = deps;

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

      const remote = await adapter.suggestTags(prefix, MOEBOORU_TAG_LIMIT);
      if (remote.length > 0) cache.save(input.site, remote);
      return { ok: true, data: remote };
    } catch (error) {
      return { ok: false, error: toAppError(error) };
    }
  };
}
