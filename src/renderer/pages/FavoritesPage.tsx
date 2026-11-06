import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { FollowsPanel } from '@renderer/components/FollowsPanel';
import { ImageViewer } from '@renderer/components/ImageViewer';
import { PostGrid } from '@renderer/components/PostGrid';
import { ALL_SITE_IDS, type AnySiteId, isSiteId } from '@shared/constants';
import type { AppError } from '@shared/errors';
import type { FavoriteSort } from '@shared/favorites';
import type { Post } from '@shared/models';
import { SITE_LABELS } from '@shared/sites';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const SORT_LABELS: Record<FavoriteSort, string> = {
  added: '按收藏时间',
  score: '按评分'
};

/** views:list 单次上限 100（03 §6.2）；收藏可能更多，按 100 分块查询 */
const VIEW_CHUNK = 100;

async function fetchViewedIds(
  site: AnySiteId,
  ids: readonly number[]
): Promise<ReadonlySet<number>> {
  const result = new Set<number>();
  for (let start = 0; start < ids.length; start += VIEW_CHUNK) {
    const chunk = ids.slice(start, start + VIEW_CHUNK);
    try {
      const response = await window.booru.listViews({ site, postIds: chunk });
      if (response.ok) {
        for (const id of response.data) result.add(id);
      }
    } catch {
      // 已看状态只影响变暗，失败不阻断收藏页展示
    }
  }
  return result;
}

type FavoritesTab = 'favorites' | 'follows';

/** T-53：收藏页按全部站点分组（含 wallhaven / bing）；关注动态仍仅 booru 站点 */
const FAVORITE_SITE_TABS: readonly AnySiteId[] = ALL_SITE_IDS;

/**
 * 02 §8：收藏页。按站点分组 tab，支持标签二次筛选与按收藏时间/评分排序；
 * 数据只读本地 SQLite（07 DR-032），不请求站点。
 * T-47 / DR-069 新增「关注动态」子页签，关注列表与刷新由 FollowsPanel 负责。
 */
export function FavoritesPage(): ReactElement {
  const [tab, setTab] = useState<FavoritesTab>('favorites');
  const [followUnread, setFollowUnread] = useState(0);
  const [site, setSite] = useState<AnySiteId>('yande');
  const [sort, setSort] = useState<FavoriteSort>('added');
  const [filter, setFilter] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(() => new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const requestSeq = useRef(0);
  const favoriteRef = useRef<ReadonlySet<number>>(new Set());

  const loadViewedIds = useCallback(
    (ids: readonly number[], targetSite: AnySiteId, seq: number): void => {
      void (async () => {
        const viewed = await fetchViewedIds(targetSite, ids);
        if (requestSeq.current !== seq) return;
        setViewedIds(viewed);
        setLoading(false);
      })();
    },
    []
  );

  const loadFavorites = useCallback(async (): Promise<void> => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setLoading(true);
    setError(null);
    setActionError(null);

    const trimmed = filter.trim();
    try {
      const result = await window.booru.listFavorites({
        site,
        sort,
        ...(trimmed !== '' ? { query: trimmed } : {})
      });
      if (requestSeq.current !== seq) return;
      if (!result.ok) {
        setLoading(false);
        setError(result.error);
        return;
      }

      const loaded = result.data.posts;
      const ids = new Set(loaded.map((post) => post.id));
      favoriteRef.current = ids;
      setFavoriteIds(ids);
      setPosts(loaded);
      setViewerIndex(null);
      loadViewedIds(
        loaded.map((post) => post.id),
        site,
        seq
      );
    } catch {
      if (requestSeq.current === seq) {
        setLoading(false);
        setActionError('收藏列表读取失败');
      }
    }
  }, [filter, loadViewedIds, site, sort]);

  // DR-069：子页签徽标需要在「收藏作品」时也能显示，故由父级读取未读总数
  useEffect(() => {
    if (!isSiteId(site)) return;
    let active = true;
    void (async () => {
      try {
        const result = await window.booru.listFollows({ site });
        if (active && result.ok) {
          setFollowUnread(result.data.reduce((total, item) => total + item.unreadCount, 0));
        }
      } catch {
        // 徽标读取失败不影响收藏列表
      }
    })();
    return () => {
      active = false;
    };
  }, [site]);

  useEffect(() => {
    return window.booru.onFollowsUpdated((event) => {
      if (!isSiteId(site) || event.site !== site) return;
      void (async () => {
        try {
          const result = await window.booru.listFollows({ site });
          if (result.ok) {
            setFollowUnread(result.data.reduce((total, item) => total + item.unreadCount, 0));
          }
        } catch {
          // 刷新后的徽标同步失败保持旧值
        }
      })();
    });
  }, [site]);

  // 05 §6 / DR-033：设置页清除记录后即时重读当前站点的本地收藏
  useEffect(() => {
    return window.booru.onViewsUpdated((event) => {
      if (event.site === null || event.site === site) void loadFavorites();
    });
  }, [loadFavorites, site]);

  // 本地读取放在定时器里，避免筛选输入时每个字符都同步触发一次查询
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFavorites();
    }, 120);
    return () => {
      clearTimeout(timer);
    };
  }, [loadFavorites]);

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
        if (result.ok) {
          // 收藏页取消收藏后立即从列表移除；收藏与已看独立，不动 viewedIds
          if (!result.data.favorited) {
            setPosts((previous) => previous.filter((item) => item.id !== post.id));
            setViewerIndex(null);
          }
          return;
        }
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

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.target.value;
    if (value === 'added' || value === 'score') setSort(value);
  };

  const handleTagSearch = (name: string): void => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    setTab('favorites');
    setFilter(trimmed);
    setViewerIndex(null);
  };

  return (
    <main className="favorites-page">
      <header className="favorites-page__header">
        <div className="favorites-page__title">
          <h1>收藏</h1>
          <p className="favorites-page__count">
            {tab === 'favorites'
              ? loading
                ? '正在读取本地收藏…'
                : `已收藏 ${posts.length} 张 · ${SITE_LABELS[site]}`
              : `未读 ${followUnread} 条 · ${SITE_LABELS[site]}`}
          </p>
          {tab === 'favorites' && actionError !== null ? (
            <p className="favorites-page__error" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="favorites-page__toolbar">
          <span className="site-tabs" role="group" aria-label="收藏视图">
            <button
              type="button"
              className="site-tabs__item"
              aria-pressed={tab === 'favorites'}
              onClick={() => {
                setTab('favorites');
              }}
            >
              收藏作品
            </button>
            <button
              type="button"
              className="site-tabs__item"
              aria-pressed={tab === 'follows'}
              disabled={!isSiteId(site)}
              title={!isSiteId(site) ? '关注动态仅支持 booru 站点' : undefined}
              onClick={() => {
                setTab('follows');
                setViewerIndex(null);
              }}
            >
              关注动态
              {isSiteId(site) && followUnread > 0 ? (
                <span className="favorites-page__badge" aria-label={`未读 ${followUnread} 条`}>
                  {followUnread}
                </span>
              ) : null}
            </button>
          </span>

          <span className="site-tabs" role="group" aria-label="站点切换">
            {FAVORITE_SITE_TABS.map((id) => (
              <button
                key={id}
                type="button"
                className="site-tabs__item"
                aria-pressed={site === id}
                onClick={() => {
                  setSite(id);
                  if (!isSiteId(id)) setTab('favorites');
                }}
              >
                {SITE_LABELS[id]}
              </button>
            ))}
          </span>

          {tab === 'favorites' ? (
            <>
              <input
                type="search"
                className="favorites-filter"
                value={filter}
                placeholder="按标签筛选，如 koh_foo"
                aria-label="按标签筛选收藏"
                onChange={(event) => {
                  setFilter(event.target.value);
                }}
              />

              <select
                className="favorites-sort"
                value={sort}
                aria-label="收藏排序"
                onChange={handleSortChange}
              >
                {(['added', 'score'] as const).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </header>

      <section className="favorites-page__content">
        {tab === 'follows' ? (
          isSiteId(site) ? (
            <FollowsPanel
              site={site}
              onUnreadChange={setFollowUnread}
              onTagSearch={handleTagSearch}
            />
          ) : (
            <EmptyState
              title="关注动态仅支持 booru 站点"
              description="切回 yande.re 或 konachan.com 查看关注更新"
            />
          )
        ) : loading && posts.length === 0 ? (
          <div className="state-view" role="status">
            <p className="state-view__title">正在读取收藏…</p>
          </div>
        ) : error !== null ? (
          <ErrorState
            error={error}
            onRetry={() => {
              void loadFavorites();
            }}
          />
        ) : posts.length > 0 ? (
          <PostGrid
            posts={posts}
            viewedIds={viewedIds}
            favoritedIds={favoriteIds}
            loading={false}
            onNearEnd={() => undefined}
            onToggleFavorite={toggleFavorite}
            onOpen={(post) => {
              const target = posts.findIndex((item) => item.id === post.id);
              if (target >= 0) setViewerIndex(target);
            }}
          />
        ) : (
          <EmptyState
            title={filter.trim() !== '' ? '没有匹配的收藏' : '还没有收藏'}
            description={
              filter.trim() !== '' ? '试试减少标签或清空筛选' : '在搜索页或查看器点击 ☆ 即可收藏'
            }
          />
        )}
      </section>

      {viewerIndex !== null && posts[viewerIndex] !== undefined ? (
        <ImageViewer
          posts={posts}
          index={viewerIndex}
          favorited={favoriteIds.has(posts[viewerIndex].id)}
          onToggleFavorite={toggleFavorite}
          onIndexChange={setViewerIndex}
          onClose={() => {
            setViewerIndex(null);
          }}
          onTagSearch={handleTagSearch}
        />
      ) : null}
    </main>
  );
}
