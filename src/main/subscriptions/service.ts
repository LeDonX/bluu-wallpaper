import type { ParsedQuery } from '@main/sites/query';
import { parseQuery } from '@main/sites/query';
import type { SubscriptionsStore } from '@main/storage/subscriptions';
import type { SiteId } from '@shared/constants';
import { SITE_IDS } from '@shared/constants';
import { applyBlacklistFilter, applyR18Filter } from '@shared/content';
import { AppErrorException, createAppError } from '@shared/errors';
import type { Post } from '@shared/models';
import {
  buildSubscriptionTimeline,
  type FollowAddResult,
  type FollowRefreshResult,
  normalizeFollowTag,
  type SubscriptionSummary,
  type SubscriptionTimeline
} from '@shared/subscriptions';

/** 首次拉取失败时界面提示，不阻断关注本身 */
export const FOLLOW_ADD_WARNING = '首次拉取失败，稍后刷新重试';

export interface SubscriptionServiceOptions {
  store: SubscriptionsStore;
  fetchLatest: (site: SiteId, query: ParsedQuery) => Promise<Post[]>;
  isExplicitAllowed: () => boolean;
  getBlacklist: () => readonly string[];
  onUpdated: (event: { site: SiteId }) => void;
}

export interface SubscriptionService {
  list(site: SiteId): SubscriptionSummary[];
  timeline(site: SiteId): SubscriptionTimeline;
  add(site: SiteId, tag: string): Promise<FollowAddResult>;
  remove(site: SiteId, tag: string): void;
  markRead(site: SiteId, options?: { tag?: string; postIds?: readonly number[] }): void;
  refresh(site: SiteId): Promise<FollowRefreshResult>;
  refreshAll(): Promise<void>;
}

/** 05 §5：统一 CONFIG 错误，由 handler 转成 Result 信封 */
function configError(message: string, detail: string): AppErrorException {
  return new AppErrorException(createAppError('CONFIG', message, { detail }));
}

/**
 * 02 §8 / 07 DR-069：关注刷新编排。
 * 标签本身可能被 R18/黑名单过滤掉，此时返回 null，本次跳过拉取（不产生未读）。
 */
function prepareQuery(
  tag: string,
  isExplicitAllowed: () => boolean,
  getBlacklist: () => readonly string[]
): ParsedQuery | null {
  const r18 = applyR18Filter(tag, isExplicitAllowed()).query;
  const filtered = applyBlacklistFilter(r18, getBlacklist()).query;
  const query = parseQuery(filtered);
  // 关注标签本身被黑名单排除时，正向标签与排除标签相同，等价于空查询，跳过拉取
  const effectiveTags = query.tags.filter((tag) => !query.excludedTags.includes(tag));
  return effectiveTags.length > 0 ? query : null;
}

export function createSubscriptionService(options: SubscriptionServiceOptions): SubscriptionService {
  const { store, fetchLatest, isExplicitAllowed, getBlacklist, onUpdated } = options;
  const inFlight = new Map<SiteId, Promise<FollowRefreshResult>>();

  const refreshInternal = async (site: SiteId): Promise<FollowRefreshResult> => {
    const subscriptions = store.list(site);
    let checked = 0;
    let added = 0;
    let unread = 0;
    const failedTags: string[] = [];

    for (const subscription of subscriptions) {
      checked += 1;
      const query = prepareQuery(subscription.tag, isExplicitAllowed, getBlacklist);
      if (query === null) continue;
      try {
        const posts = await fetchLatest(site, query);
        const result = store.record(site, subscription.tag, posts);
        added += result.added;
        unread += result.unread;
      } catch {
        // 单个关注失败不阻断其它关注，也不弹全局错误（DR-069）
        failedTags.push(subscription.tag);
      }
    }

    if (subscriptions.length > 0) onUpdated({ site });
    return { site, checked, added, unread, failedTags };
  };

  const refresh = (site: SiteId): Promise<FollowRefreshResult> => {
    const running = inFlight.get(site);
    if (running !== undefined) return running;
    const task = refreshInternal(site).finally(() => {
      inFlight.delete(site);
    });
    inFlight.set(site, task);
    return task;
  };

  return {
    list(site) {
      return store.list(site);
    },

    timeline(site) {
      return buildSubscriptionTimeline(store.entries(site), store.list(site));
    },

    async add(site, rawTag) {
      const tag = normalizeFollowTag(rawTag);
      if (tag === null) {
        throw configError('关注标签无效', '标签不能为空、含空格、以 - 开头或含 :');
      }
      if (getBlacklist().includes(tag)) {
        throw configError('该标签已在黑名单中', '请先从设置页移出黑名单再关注');
      }

      if (store.has(site, tag)) {
        const existing = store.get(site, tag);
        if (existing !== null) {
          return { subscription: existing, newPosts: 0, warning: null };
        }
      }

      const subscription = store.add(site, tag);
      const query = prepareQuery(tag, isExplicitAllowed, getBlacklist);
      if (query === null) {
        return {
          subscription,
          newPosts: 0,
          warning: '标签被内容过滤排除，暂未拉取作品'
        };
      }

      try {
        const posts = await fetchLatest(site, query);
        const result = store.record(site, tag, posts);
        return {
          subscription: store.get(site, tag) ?? subscription,
          newPosts: result.added,
          warning: null
        };
      } catch {
        return { subscription: store.get(site, tag) ?? subscription, newPosts: 0, warning: FOLLOW_ADD_WARNING };
      }
    },

    remove(site, tag) {
      store.remove(site, tag);
    },

    markRead(site, markOptions) {
      store.markRead(site, markOptions);
    },

    refresh,

    async refreshAll() {
      const hasAny = SITE_IDS.some((site) => store.list(site).length > 0);
      if (!hasAny) return;
      for (const site of SITE_IDS) {
        await refresh(site);
      }
    }
  };
}
