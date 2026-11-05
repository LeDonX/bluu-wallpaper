import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { ImageViewer } from '@renderer/components/ImageViewer';
import { PostGrid } from '@renderer/components/PostGrid';
import { SITE_IDS, type SiteId } from '@shared/constants';
import type { AppError, Result } from '@shared/errors';
import type { PostsRankingsInput } from '@shared/ipc-contract';
import type { Post, PostPage } from '@shared/models';
import { mergePosts } from '@shared/posts';
import {
  formatRankingDateInput,
  parseRankingDateInput,
  RANKING_KINDS,
  RANKING_LABELS,
  type RankingDate,
  type RankingKind,
  rankingNeedsDate,
  rankingSupportsPaging,
  todayRankingDate
} from '@shared/rankings';
import { SITE_LABELS } from '@shared/sites';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './RankingPage.module.css';

/** views:list 单次上限 100（03 §6.2）；榜单单页可能超过 100 条，按块查询 */
const VIEW_CHUNK = 100;

interface PagePayload {
  result: Result<PostPage>;
  viewedIds: number[];
}

async function fetchViewedIds(site: SiteId, ids: readonly number[]): Promise<number[]> {
  const viewed: number[] = [];
  for (let start = 0; start < ids.length; start += VIEW_CHUNK) {
    const chunk = ids.slice(start, start + VIEW_CHUNK);
    try {
      const response = await window.booru.listViews({ site, postIds: chunk });
      if (response.ok) viewed.push(...response.data);
    } catch {
      // 已看状态只影响变暗，失败不阻断榜单展示
    }
  }
  return viewed;
}

/**
 * 02 §4 榜单页：热门 / 日 / 周 / 月四个入口，期榜可选日期；
 * 复用搜索页的 PostGrid 与查看器/收藏/下载链路（DR-041）。
 */
export interface RankingPageProps {
  /** 查看器内点击标签后切到搜索页并立即查询，带上当前榜单站点（DR-041 / DR-057） */
  onSearchTag(name: string, site: SiteId): void;
}

export function RankingPage({ onSearchTag }: RankingPageProps): ReactElement {
  // 07 DR-057：榜单页提供 yande / konachan 入口，站点切换后按当前入口与日期重载
  const [site, setSite] = useState<SiteId>('yande');
  const [kind, setKind] = useState<RankingKind>('popular');
  const [date, setDate] = useState<RankingDate>(() => todayRankingDate());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadedPage, setLoadedPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [r18Filtered, setR18Filtered] = useState(false);
  // DR-056：本次榜单因黑名单在本地丢弃的图片数量
  const [blacklistFiltered, setBlacklistFiltered] = useState(0);
  const [viewedIds, setViewedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // 请求序号丢弃过期响应；loadingRef 防止触底并发请求
  const requestSeq = useRef(0);
  const loadingRef = useRef(false);
  const postsRef = useRef<Post[]>([]);
  const viewedRef = useRef<ReadonlySet<number>>(new Set());
  const favoriteRef = useRef<ReadonlySet<number>>(new Set());

  const updateViewed = useCallback(
    (updater: (previous: ReadonlySet<number>) => ReadonlySet<number>): void => {
      const next = updater(viewedRef.current);
      viewedRef.current = next;
      setViewedIds(next);
    },
    []
  );

  const updateFavorites = useCallback(
    (updater: (previous: ReadonlySet<number>) => ReadonlySet<number>): void => {
      const next = updater(favoriteRef.current);
      favoriteRef.current = next;
      setFavoriteIds(next);
    },
    []
  );

  /** 拉取单页并恢复该页已看状态；隐藏已看不适用于榜单，无需等 views 返回即可展示 */
  const requestPage = useCallback(
    async (
      targetKind: RankingKind,
      targetDate: RankingDate,
      page: number,
      seq: number,
      targetSite: SiteId
    ): Promise<PagePayload> => {
      // DR-041：热门不带 date；期榜必带
      const input: PostsRankingsInput =
        targetKind === 'popular'
          ? { site: targetSite, kind: targetKind, page }
          : { site: targetSite, kind: targetKind, date: targetDate, page };

      const result = await window.booru.listRankings(input);
      if (!result.ok || result.data.posts.length === 0) return { result, viewedIds: [] };

      const viewedIds = await fetchViewedIds(
        targetSite,
        result.data.posts.map((item) => item.id)
      );
      if (requestSeq.current !== seq) return { result, viewedIds: [] };
      return { result, viewedIds };
    },
    []
  );

  /** 切换入口/日期后重置列表并读第 1 页（02 §4） */
  const loadFirst = useCallback(
    async (targetKind: RankingKind, targetDate: RankingDate): Promise<void> => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setActionError(null);
      setViewerIndex(null);
      setR18Filtered(false);
      setBlacklistFiltered(0);
      setPosts([]);
      postsRef.current = [];
      setLoadedPage(0);
      setHasMore(false);
      updateViewed(() => new Set());
      updateFavorites(() => new Set());

      const payload = await requestPage(targetKind, targetDate, 1, seq, site);
      if (requestSeq.current !== seq) return;

      loadingRef.current = false;
      setLoading(false);
      if (!payload.result.ok) {
        setError(payload.result.error);
        return;
      }

      const pagePosts = payload.result.data.posts;
      postsRef.current = pagePosts;
      setPosts(pagePosts);
      setLoadedPage(1);
      // DR-008 / DR-041：热门固定 40 条且忽略 page，不提供翻页
      setHasMore(rankingSupportsPaging(targetKind) && pagePosts.length > 0);
      setR18Filtered(payload.result.data.r18Filtered === true);
      setBlacklistFiltered(payload.result.data.blacklistFiltered ?? 0);
      updateViewed((previous) => {
        const next = new Set(previous);
        for (const id of payload.viewedIds) next.add(id);
        return next;
      });

      // 收藏状态只读本地，与搜索页一致（T-21）
      const favorites = await window.booru.listFavorites({ site }).catch(() => null);
      if (requestSeq.current !== seq) return;
      if (favorites === null) {
        setActionError('收藏状态读取失败');
      } else if (favorites.ok) {
        const ids = new Set(favorites.data.posts.map((post) => post.id));
        favoriteRef.current = ids;
        setFavoriteIds(ids);
      } else {
        setActionError(favorites.error.message);
      }
    },
    [requestPage, site, updateFavorites, updateViewed]
  );

  // 类型与日期变化即重置并重新加载（请求序号会作废旧请求）。
  // 放到宏任务中触发，避免在 effect 内同步 setState（react-hooks/set-state-in-effect）。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFirst(kind, date);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [date, kind, loadFirst, site]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingRef.current || !hasMore) return;

    const seq = requestSeq.current;
    const nextPage = loadedPage + 1;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const payload = await requestPage(kind, date, nextPage, seq, site);
    if (requestSeq.current !== seq) return;

    loadingRef.current = false;
    setLoading(false);
    if (!payload.result.ok) {
      setError(payload.result.error);
      return;
    }

    const pagePosts = payload.result.data.posts;
    const previous = postsRef.current;
    const merged = mergePosts(previous, pagePosts);
    postsRef.current = merged;
    setPosts(merged);
    setLoadedPage(nextPage);
    // DR-041：站点忽略 page 时下一页与已有内容重复，合并后无新增即视为到底
    setHasMore(pagePosts.length > 0 && merged.length > previous.length);
    updateViewed((current) => {
      const next = new Set(current);
      for (const id of payload.viewedIds) next.add(id);
      return next;
    });
  }, [date, hasMore, kind, loadedPage, requestPage, site, updateViewed]);

  // 05 §6 / DR-033：设置页清除记录后同步本地已看与收藏
  useEffect(() => {
    return window.booru.onViewsUpdated((event) => {
      if (event.site !== null && event.site !== site) return;
      updateViewed(() => new Set());
      updateFavorites(() => new Set());
      setActionError(null);
    });
  }, [site, updateFavorites, updateViewed]);

  // T-21：收藏乐观更新，失败回滚并提示
  const toggleFavorite = useCallback(
    (post: Post): void => {
      const wasFavorited = favoriteRef.current.has(post.id);
      updateFavorites((previous) => {
        const next = new Set(previous);
        if (wasFavorited) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      setActionError(null);

      void (async () => {
        try {
          const result = await window.booru.toggleFavorite({ site: post.site, post });
          if (result.ok) return;
          setActionError(result.error.message);
        } catch {
          setActionError('收藏操作失败');
        }
        updateFavorites((previous) => {
          const next = new Set(previous);
          if (wasFavorited) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
      })();
    },
    [updateFavorites]
  );

  // 02 §6.1：打开与切图都标记已看，失败回滚
  const markViewed = useCallback(
    (post: Post): void => {
      const wasViewed = viewedRef.current.has(post.id);
      if (!wasViewed) {
        updateViewed((previous) => {
          const next = new Set(previous);
          next.add(post.id);
          return next;
        });
      }

      void (async () => {
        try {
          const result = await window.booru.markViews({ site: post.site, postIds: [post.id] });
          if (result.ok) return;
          setActionError(result.error.message);
        } catch {
          setActionError('已看记录写入失败');
        }
        if (!wasViewed) {
          updateViewed((previous) => {
            const next = new Set(previous);
            next.delete(post.id);
            return next;
          });
        }
      })();
    },
    [updateViewed]
  );

  const handleKindChange = (next: RankingKind): void => {
    if (next === kind) return;
    setKind(next);
  };

  const maxDateValue = formatRankingDateInput(todayRankingDate());

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = parseRankingDateInput(event.target.value);
    // 02 §4：不可选未来日期
    if (next === null || formatRankingDateInput(next) > maxDateValue) return;
    setDate(next);
  };

  const handleOpenPost = (post: Post): void => {
    const target = posts.findIndex((item) => item.site === post.site && item.id === post.id);
    if (target < 0) return;
    setViewerIndex(target);
    markViewed(post);
  };

  const handleViewerIndexChange = (nextIndex: number): void => {
    setViewerIndex(nextIndex);
    const nextPost = posts[nextIndex];
    if (nextPost !== undefined) markViewed(nextPost);
  };

  const handleTagSearch = (name: string): void => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    setViewerIndex(null);
    onSearchTag(trimmed, site);
  };

  const showEmptyResult = loadedPage > 0 && !loading && error === null && posts.length === 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.title}>
          <h1>榜单</h1>
          <p className={styles.count}>
            {posts.length > 0
              ? `已加载 ${posts.length} 张 · ${SITE_LABELS[site]} · ${RANKING_LABELS[kind]}`
              : `${SITE_LABELS[site]} · ${RANKING_LABELS[kind]}`}
          </p>
          {r18Filtered ? <p className={styles.hint}>已过滤 R18（设置中可开启）</p> : null}
          {blacklistFiltered > 0 ? (
            <p className={styles.hint} role="status">
              已按标签黑名单过滤 {blacklistFiltered} 张
            </p>
          ) : null}
          {actionError !== null ? (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className={styles.toolbar}>
          {/* 07 DR-057：榜单页提供两站入口（T-28） */}
          <span className="site-tabs" role="group" aria-label="站点切换">
            {SITE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className="site-tabs__item"
                aria-pressed={site === id}
                onClick={() => setSite(id)}
              >
                {SITE_LABELS[id]}
              </button>
            ))}
          </span>
          <span className={styles.tabs} role="group" aria-label="榜单类型">
            {RANKING_KINDS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.tab}
                aria-pressed={kind === value}
                onClick={() => {
                  handleKindChange(value);
                }}
              >
                {RANKING_LABELS[value]}
              </button>
            ))}
          </span>

          {rankingNeedsDate(kind) ? (
            <input
              type="date"
              className={styles.dateInput}
              aria-label="榜单日期"
              value={formatRankingDateInput(date)}
              max={maxDateValue}
              onChange={handleDateChange}
            />
          ) : null}
        </div>
      </header>

      <section className={styles.content}>
        {error !== null && posts.length === 0 ? (
          <ErrorState
            error={error}
            onRetry={() => {
              void loadFirst(kind, date);
            }}
          />
        ) : posts.length > 0 ? (
          <PostGrid
            posts={posts}
            viewedIds={viewedIds}
            favoritedIds={favoriteIds}
            loading={loading}
            onNearEnd={() => {
              void loadMore();
            }}
            onToggleFavorite={toggleFavorite}
            onOpen={handleOpenPost}
          />
        ) : loading ? (
          <div className="state-view" role="status">
            <p className="state-view__title">正在加载榜单…</p>
          </div>
        ) : showEmptyResult ? (
          <EmptyState
            title="该榜单暂时没有结果"
            description={
              rankingNeedsDate(kind) ? '试试换一个日期或榜单类型' : '稍后再试，或换一个榜单类型'
            }
          />
        ) : (
          <div className="state-view" role="status">
            <p className="state-view__title">正在加载榜单…</p>
          </div>
        )}
      </section>

      {error !== null && posts.length > 0 ? (
        <div className={styles.footerError}>
          <ErrorState
            error={error}
            onRetry={() => {
              void loadMore();
            }}
          />
        </div>
      ) : null}

      {viewerIndex !== null && posts[viewerIndex] !== undefined ? (
        <ImageViewer
          posts={posts}
          index={viewerIndex}
          favorited={favoriteIds.has(posts[viewerIndex].id)}
          onToggleFavorite={toggleFavorite}
          onIndexChange={handleViewerIndexChange}
          onClose={() => {
            setViewerIndex(null);
          }}
          onTagSearch={handleTagSearch}
        />
      ) : null}
    </main>
  );
}
