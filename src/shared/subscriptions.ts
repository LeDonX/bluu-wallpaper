import type { SiteId } from '@shared/constants';
import type { Post } from '@shared/models';

/** 07 DR-069：每次刷新每个关注取最近 20 条 */
export const FOLLOW_REFRESH_LIMIT = 20;

/** 07 DR-069：单关注本地保留最近 100 条 */
export const FOLLOW_KEEP_LIMIT = 100;

/** 05 §5：关注标签长度上限，避免把整段查询存进库 */
export const MAX_FOLLOW_TAG_LENGTH = 100;

/** 关注概览：计数来自本地 `subscription_posts`，不额外请求站点 */
export interface SubscriptionSummary {
  site: SiteId;
  tag: string;
  createdAt: number;
  lastCheckedAt: number;
  postCount: number;
  unreadCount: number;
}

/** 存储层条目：一条作品命中一个关注 */
export interface SubscriptionPostEntry {
  tag: string;
  post: Post;
  firstSeenAt: number;
  unread: boolean;
}

/** 聚合时间线条目：同一作品按 `(site, post.id)` 去重，`tags` 为命中的关注 */
export interface SubscriptionTimelineEntry {
  post: Post;
  tags: string[];
  firstSeenAt: number;
  unread: boolean;
}

export interface SubscriptionGroup {
  subscription: SubscriptionSummary;
  entries: SubscriptionPostEntry[];
}

export interface SubscriptionTimeline {
  entries: SubscriptionTimelineEntry[];
  groups: SubscriptionGroup[];
  unreadTotal: number;
}

/** 07 DR-072：时间轴的单日分组；`day` 为本地自然日 0 点时间戳 */
export interface SubscriptionDayGroup {
  day: number;
  entries: SubscriptionTimelineEntry[];
  unreadCount: number;
}

export interface FollowRefreshResult {
  site: SiteId;
  checked: number;
  added: number;
  unread: number;
  failedTags: string[];
}

export interface FollowAddResult {
  subscription: SubscriptionSummary;
  newPosts: number;
  warning: string | null;
}

/**
 * 05 §5 / DR-069：关注标签归一化为小写。
 * 拒绝空串、含空白、超长、`-` 开头与 `:`（后两者会被 parseQuery 当成元数据条件）。
 */
export function normalizeFollowTag(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value === '' || value.length > MAX_FOLLOW_TAG_LENGTH) return null;
  if (/\s/.test(value) || value.startsWith('-') || value.includes(':')) return null;
  return value;
}

const compareEntries = (
  left: { firstSeenAt: number; post: Post },
  right: { firstSeenAt: number; post: Post }
): number => {
  if (left.firstSeenAt !== right.firstSeenAt) return right.firstSeenAt - left.firstSeenAt;
  return right.post.id - left.post.id;
};

/** 按关注分组；组顺序沿用入参（存储层已按创建时间倒序），组内按首次发现时间倒序 */
function groupEntries(
  entries: readonly SubscriptionPostEntry[],
  subscriptions: readonly SubscriptionSummary[]
): SubscriptionGroup[] {
  return subscriptions.map((subscription) => ({
    subscription,
    entries: entries
      .filter((entry) => entry.tag === subscription.tag && entry.post.site === subscription.site)
      .sort(compareEntries)
  }));
}

/**
 * 02 §8 / DR-069：聚合时间线按作品去重，未读状态取「任一关注未读即未读」；
 * 分组视图仍按关注展示同一作品，便于用户按来源浏览。
 */
export function buildSubscriptionTimeline(
  entries: readonly SubscriptionPostEntry[],
  subscriptions: readonly SubscriptionSummary[]
): SubscriptionTimeline {
  const merged = new Map<string, SubscriptionTimelineEntry>();
  for (const entry of entries) {
    const key = `${entry.post.site}:${entry.post.id}`;
    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, {
        post: entry.post,
        tags: [entry.tag],
        firstSeenAt: entry.firstSeenAt,
        unread: entry.unread
      });
      continue;
    }
    if (!existing.tags.includes(entry.tag)) existing.tags.push(entry.tag);
    existing.unread = existing.unread || entry.unread;
    existing.firstSeenAt = Math.min(existing.firstSeenAt, entry.firstSeenAt);
  }

  const timelineEntries = [...merged.values()].sort(compareEntries);
  return {
    entries: timelineEntries,
    groups: groupEntries(entries, subscriptions),
    unreadTotal: countUnread(timelineEntries)
  };
}

/** 未读计数按去重后的作品统计，避免同作品命中多个关注时虚高 */
export function countUnread(entries: readonly SubscriptionTimelineEntry[]): number {
  return entries.filter((entry) => entry.unread).length;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 取本地自然日 0 点，避免按 UTC 切日期把作品分到错误的"天" */
function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * 07 DR-072：时间轴按「首次发现时间」的本地自然日分组，只保留有作品的日期（跳过空日期）。
 * 入参已按首次发现时间倒序，日期内保持原顺序；分组结果按日期倒序。
 */
export function buildSubscriptionDays(
  entries: readonly SubscriptionTimelineEntry[]
): SubscriptionDayGroup[] {
  const groups = new Map<number, SubscriptionDayGroup>();
  for (const entry of entries) {
    const day = startOfLocalDay(entry.firstSeenAt);
    const group = groups.get(day);
    if (group === undefined) {
      groups.set(day, { day, entries: [entry], unreadCount: entry.unread ? 1 : 0 });
      continue;
    }
    group.entries.push(entry);
    if (entry.unread) group.unreadCount += 1;
  }
  return [...groups.values()].sort((left, right) => right.day - left.day);
}

/** 07 DR-072：日期标题；今天/昨天用相对词，其余显示「M月D日 周X」 */
export function formatFollowDayLabel(day: number, now: number): string {
  const date = new Date(day);
  const diffDays = Math.round((startOfLocalDay(now) - day) / DAY_MS);
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
  if (diffDays === 0) return `今天 · ${monthDay}`;
  if (diffDays === 1) return `昨天 · ${monthDay}`;
  return `${monthDay} ${WEEKDAYS[date.getDay()]}`;
}
