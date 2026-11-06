import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { ImageViewer } from '@renderer/components/ImageViewer';
import { PostCard } from '@renderer/components/PostCard';
import { type AnySiteId, type SiteId } from '@shared/constants';
import type { AppError } from '@shared/errors';
import type { Post } from '@shared/models';
import {
  buildSubscriptionDays,
  type FollowRefreshResult,
  formatFollowDayLabel,
  type SubscriptionSummary,
  type SubscriptionTimeline
} from '@shared/subscriptions';
import type { FormEvent, ReactElement, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './FollowsPanel.module.css';

type FollowView = 'timeline' | 'tags';
type PendingAction = 'add' | 'refresh' | null;
type Expanded = { kind: 'day'; day: number } | { kind: 'tag'; tag: string } | null;
/** 时间轴条目与标签条目共有的渲染字段 */
type RenderEntry = { post: Post; unread: boolean };

export interface FollowsPanelProps {
  site: SiteId;
  /** 未读总数变化时同步父级子页签徽标 */
  onUnreadChange(total: number): void;
  /** 查看器标签点击后回到收藏筛选 */
  onTagSearch(name: string): void;
}

const VIEW_LABELS: Record<FollowView, string> = {
  timeline: '时间轴',
  tags: '标签'
};

/** DR-072：单行卡片布局的间距与最小卡宽，与 `.post-card` 的 200px 最小宽度对齐 */
const ROW_GAP = 12;
const CARD_MIN_WIDTH = 200;
const SECTION_PADDING = 12;

function favoriteKey(site: AnySiteId, postId: number): string {
  return `${site}:${postId}`;
}

function refreshNotice(result: FollowRefreshResult): string {
  const parts = [`刷新完成：新增 ${result.added} 张`];
  if (result.unread > 0) parts.push(`未读 ${result.unread} 张`);
  if (result.failedTags.length > 0) parts.push(`失败：${result.failedTags.join('、')}`);
  return parts.join('，');
}

/** DR-072：按容器宽度计算单行可容纳的卡片数（含间距），窗口缩放时重算 */
function useRowColumns(ref: RefObject<HTMLDivElement | null>): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const update = (): void => {
      const width = element.clientWidth - SECTION_PADDING * 2;
      setColumns(Math.max(1, Math.floor((width + ROW_GAP) / (CARD_MIN_WIDTH + ROW_GAP))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return columns;
}

/**
 * 02 §8 / 07 DR-069、DR-072：关注动态。
 * 时间轴按首次发现的本地日期分组；标签页每个关注只占一行，均按宽度自适应并可就地展开。
 */
export function FollowsPanel({
  site,
  onUnreadChange,
  onTagSearch
}: FollowsPanelProps): ReactElement {
  const [follows, setFollows] = useState<SubscriptionSummary[]>([]);
  const [timeline, setTimeline] = useState<SubscriptionTimeline | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(() => new Set());
  const [view, setView] = useState<FollowView>('timeline');
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction>(null);
  const [markingTag, setMarkingTag] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ posts: Post[]; index: number } | null>(null);

  const favoriteRef = useRef<ReadonlySet<number>>(new Set());
  const requestSeq = useRef(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const columns = useRowColumns(bodyRef);

  const load = useCallback(
    async (silent = false): Promise<void> => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [listResult, timelineResult, favoriteResult] = await Promise.all([
          window.booru.listFollows({ site }),
          window.booru.getFollowTimeline({ site }),
          window.booru.listFavorites({ site })
        ]);
        if (requestSeq.current !== seq) return;
        if (!listResult.ok) {
          setError(listResult.error);
          return;
        }
        if (!timelineResult.ok) {
          setError(timelineResult.error);
          return;
        }

        const ids = new Set<number>(
          favoriteResult.ok ? favoriteResult.data.posts.map((post) => post.id) : []
        );
        favoriteRef.current = ids;
        setFavoriteIds(ids);
        setFollows(listResult.data);
        setTimeline(timelineResult.data);
        onUnreadChange(timelineResult.data.unreadTotal);
      } catch {
        if (requestSeq.current === seq) setActionError('关注数据读取失败');
      } finally {
        if (requestSeq.current === seq) setLoading(false);
      }
    },
    [onUnreadChange, site]
  );

  // 放到定时器中，避免 effect 内同步 setState 触发级联渲染（与 FavoritesPage 同策略）
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [load]);

  // DR-069：启动刷新或其它窗口触发后重读本地数据
  useEffect(() => {
    return window.booru.onFollowsUpdated((event) => {
      if (event.site === site) void load(true);
    });
  }, [load, site]);

  const toggleFavorite = useCallback((post: Post): void => {
    const wasFavorited = favoriteRef.current.has(post.id);
    const next = new Set(favoriteRef.current);
    if (wasFavorited) next.delete(post.id);
    else next.add(post.id);
    favoriteRef.current = next;
    setFavoriteIds(next);
    setActionError(null);

    void (async () => {
      try {
        const result = await window.booru.toggleFavorite({ site: post.site, post });
        if (result.ok) return;
        setActionError(result.error.message);
      } catch {
        setActionError('收藏操作失败');
      }
      const rollback = new Set(favoriteRef.current);
      if (wasFavorited) rollback.add(post.id);
      else rollback.delete(post.id);
      favoriteRef.current = rollback;
      setFavoriteIds(rollback);
    })();
  }, []);

  const openPost = useCallback(
    (posts: Post[], index: number): void => {
      const post = posts[index];
      if (post === undefined) return;
      setViewer({ posts, index });
      // 打开哪条清哪条；作品可能同时命中多个关注，store 会按 site + postId 一并清除
      void (async () => {
        try {
          const result = await window.booru.markFollowsRead({ site, postIds: [post.id] });
          if (result.ok) await load(true);
        } catch {
          // 已读失败不影响查看作品
        }
      })();
    },
    [load, site]
  );

  const handleAdd = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const tag = newTag.trim();
      if (tag === '' || pending !== null) return;
      setPending('add');
      setActionError(null);
      setNotice(null);
      void (async () => {
        try {
          const result = await window.booru.addFollow({ site, tag });
          if (!result.ok) {
            setActionError(result.error.message);
            return;
          }
          setNewTag('');
          if (result.data.warning !== null) setNotice(result.data.warning);
          else setNotice(`已关注 ${result.data.subscription.tag}，拉取 ${result.data.newPosts} 张`);
          await load(true);
        } catch {
          setActionError('添加关注失败');
        } finally {
          setPending(null);
        }
      })();
    },
    [load, newTag, pending, site]
  );

  const handleRemove = useCallback(
    (tag: string): void => {
      if (pending !== null) return;
      setActionError(null);
      setNotice(null);
      void (async () => {
        try {
          const result = await window.booru.removeFollow({ site, tag });
          if (!result.ok) {
            setActionError(result.error.message);
            return;
          }
          await load(true);
        } catch {
          setActionError('取消关注失败');
        }
      })();
    },
    [load, pending, site]
  );

  const handleRefresh = useCallback((): void => {
    if (pending !== null || follows.length === 0) return;
    setPending('refresh');
    setActionError(null);
    setNotice(null);
    void (async () => {
      try {
        const result = await window.booru.refreshFollows({ site });
        if (!result.ok) {
          setActionError(result.error.message);
          return;
        }
        setNotice(refreshNotice(result.data));
        await load(true);
      } catch {
        setActionError('刷新失败');
      } finally {
        setPending(null);
      }
    })();
  }, [follows.length, load, pending, site]);

  const handleMarkGroupRead = useCallback(
    (tag: string): void => {
      if (markingTag !== null) return;
      setMarkingTag(tag);
      setActionError(null);
      void (async () => {
        try {
          const result = await window.booru.markFollowsRead({ site, tag });
          if (!result.ok) {
            setActionError(result.error.message);
            return;
          }
          await load(true);
        } catch {
          setActionError('标记已读失败');
        } finally {
          setMarkingTag(null);
        }
      })();
    },
    [load, markingTag, site]
  );

  const days = timeline === null ? [] : buildSubscriptionDays(timeline.entries);
  const viewerPost = viewer === null ? undefined : viewer.posts[viewer.index];
  const hasFollows = follows.length > 0;

  /** 单行展示：超出可用列数时末位放「查看全部」入口；展开后就地渲染完整网格 */
  const renderEntries = (
    entries: readonly RenderEntry[],
    expandedHere: boolean,
    onExpand: () => void,
    expandLabel: string,
    posts: Post[]
  ): ReactElement => {
    if (expandedHere) {
      return (
        <div className={styles.rowGrid}>
          {entries.map((entry, index) => (
            <PostCard
              key={favoriteKey(entry.post.site, entry.post.id)}
              post={entry.post}
              viewed={false}
              favorited={favoriteIds.has(entry.post.id)}
              unread={entry.unread}
              onToggleFavorite={toggleFavorite}
              onOpen={() => openPost(posts, index)}
            />
          ))}
        </div>
      );
    }

    const overflow = entries.length > columns;
    const visible = overflow ? entries.slice(0, Math.max(columns - 1, 1)) : entries;
    return (
      <div
        className={styles.row}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visible.map((entry, index) => (
          <PostCard
            key={favoriteKey(entry.post.site, entry.post.id)}
            post={entry.post}
            viewed={false}
            favorited={favoriteIds.has(entry.post.id)}
            unread={entry.unread}
            onToggleFavorite={toggleFavorite}
            onOpen={() => openPost(posts, index)}
          />
        ))}
        {overflow ? (
          <button type="button" className={styles.moreTile} onClick={onExpand}>
            <span className={styles.moreTitle}>{expandLabel}</span>
            <span className={styles.moreMeta}>共 {entries.length} 张</span>
          </button>
        ) : null}
      </div>
    );
  };

  const renderBody = (): ReactElement => {
    if (loading && timeline === null) {
      return (
        <div className="state-view" role="status">
          <p className="state-view__title">正在读取关注…</p>
        </div>
      );
    }
    if (error !== null) {
      return (
        <ErrorState
          error={error}
          onRetry={() => {
            void load();
          }}
        />
      );
    }
    if (!hasFollows) {
      return (
        <EmptyState
          title="还没有关注"
          description="在查看器标签旁点 ＋，或在上方输入画师/标签名添加关注"
        />
      );
    }

    if (view === 'timeline') {
      if (days.length === 0) {
        return (
          <EmptyState
            title="关注的作品还没拉取到"
            description="点上方「刷新」重试，或等待下次打开 app 自动刷新"
          />
        );
      }
      return (
        <div className={styles.scroll}>
          {days.map((dayGroup) => {
            const dayExpanded = expanded?.kind === 'day' && expanded.day === dayGroup.day;
            const posts = dayGroup.entries.map((entry) => entry.post);
            return (
              <section key={dayGroup.day} className={styles.section}>
                <header className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    {formatFollowDayLabel(dayGroup.day, Date.now())}
                  </span>
                  {dayGroup.unreadCount > 0 ? (
                    <span className={styles.unreadBadge}>
                      <span className={styles.unreadDot} aria-hidden="true" />
                      未读 {dayGroup.unreadCount}
                    </span>
                  ) : null}
                  <span className={styles.sectionMeta}>{dayGroup.entries.length} 张</span>
                  {dayExpanded ? (
                    <button
                      type="button"
                      className={styles.sectionAction}
                      onClick={() => {
                        setExpanded(null);
                      }}
                    >
                      收起
                    </button>
                  ) : null}
                </header>
                {renderEntries(dayGroup.entries, dayExpanded, () => {
                  setExpanded({ kind: 'day', day: dayGroup.day });
                }, '查看全部', posts)}
              </section>
            );
          })}
        </div>
      );
    }

    return (
      <div className={styles.scroll}>
        {timeline?.groups.map((group) => {
          const tag = group.subscription.tag;
          const tagExpanded = expanded?.kind === 'tag' && expanded.tag === tag;
          const posts = group.entries.map((entry) => entry.post);
          return (
            <section key={`${site}:${tag}`} className={styles.section}>
              <header className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>#{tag}</span>
                {group.subscription.unreadCount > 0 ? (
                  <span className={styles.unreadBadge}>
                    <span className={styles.unreadDot} aria-hidden="true" />
                    未读 {group.subscription.unreadCount}
                  </span>
                ) : null}
                <span className={styles.sectionMeta}>{group.entries.length} 张</span>
                <button
                  type="button"
                  className={styles.sectionAction}
                  disabled={group.subscription.unreadCount === 0 || markingTag !== null}
                  onClick={() => handleMarkGroupRead(tag)}
                >
                  {markingTag === tag ? '处理中…' : '全部已读'}
                </button>
                <button
                  type="button"
                  className={styles.sectionAction}
                  disabled={pending !== null}
                  onClick={() => handleRemove(tag)}
                >
                  取消关注
                </button>
                {tagExpanded ? (
                  <button
                    type="button"
                    className={styles.sectionAction}
                    onClick={() => {
                      setExpanded(null);
                    }}
                  >
                    收起
                  </button>
                ) : null}
              </header>
              {posts.length > 0 ? (
                renderEntries(group.entries, tagExpanded, () => {
                  setExpanded({ kind: 'tag', tag });
                }, '查看更多', posts)
              ) : (
                <p className={styles.sectionEmpty}>暂无作品，点上方「刷新」重试</p>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className="site-tabs" role="group" aria-label="关注视图">
          {(['timeline', 'tags'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="site-tabs__item"
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                setExpanded(null);
              }}
            >
              {VIEW_LABELS[value]}
            </button>
          ))}
        </span>

        <form className={styles.addForm} onSubmit={handleAdd}>
          <input
            type="search"
            className={styles.addInput}
            value={newTag}
            placeholder="添加关注标签，如 koh_foo"
            aria-label="添加关注标签"
            onChange={(event) => {
              setNewTag(event.target.value);
            }}
          />
          <button type="submit" className={styles.primaryButton} disabled={pending !== null}>
            {pending === 'add' ? '添加中…' : '添加关注'}
          </button>
        </form>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={pending !== null || !hasFollows}
          onClick={handleRefresh}
        >
          {pending === 'refresh' ? '刷新中…' : '刷新'}
        </button>
      </div>

      {actionError !== null ? (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      ) : null}
      {notice !== null ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      <div ref={bodyRef} className={styles.body}>
        {renderBody()}
      </div>

      {viewer !== null && viewerPost !== undefined ? (
        <ImageViewer
          posts={viewer.posts}
          index={viewer.index}
          favorited={favoriteIds.has(viewerPost.id)}
          onToggleFavorite={toggleFavorite}
          onIndexChange={(index) => {
            setViewer((current) => (current === null ? current : { ...current, index }));
          }}
          onClose={() => {
            setViewer(null);
          }}
          onTagSearch={(name) => {
            setViewer(null);
            onTagSearch(name);
          }}
        />
      ) : null}
    </div>
  );
}
