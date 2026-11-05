import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { ImageViewer } from '@renderer/components/ImageViewer';
import { PostGrid } from '@renderer/components/PostGrid';
import { SITE_IDS, type SiteId } from '@shared/constants';
import type { AppError } from '@shared/errors';
import type { FavoriteSort } from '@shared/favorites';
import type { Post } from '@shared/models';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const SITE_LABELS: Record<SiteId, string> = {
  yande: 'yande.re',
  konachan: 'konachan.com'
};

const SORT_LABELS: Record<FavoriteSort, string> = {
  added: '按收藏时间',
  score: '按评分'
};

/** views:list 单次上限 100（03 §6.2）；收藏可能更多，按 100 分块查询 */
const VIEW_CHUNK = 100;

async function fetchViewedIds(
  site: SiteId,
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

/**
 * 02 §8：收藏页。按站点分组 tab，支持标签二次筛选与按收藏时间/评分排序；
 * 数据只读本地 SQLite（07 DR-032），不请求站点。
 */
export function FavoritesPage(): ReactElement {
  const [site, setSite] = useState<SiteId>('yande');
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
    (ids: readonly number[], targetSite: SiteId, seq: number): void => {
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
      loadViewedIds(loaded.map((post) => post.id), site, seq);
    } catch {
      if (requestSeq.current === seq) {
        setLoading(false);
        setActionError('收藏列表读取失败');
      }
    }
  }, [filter, loadViewedIds, site, sort]);

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
    setFilter(trimmed);
    setViewerIndex(null);
  };

  return (
    <main className="favorites-page">
      <header className="favorites-page__header">
        <div className="favorites-page__title">
          <h1>收藏</h1>
          <p className="favorites-page__count">
            {loading ? '正在读取本地收藏…' : `已收藏 ${posts.length} 张 · ${SITE_LABELS[site]}`}
          </p>
          {actionError !== null ? (
            <p className="favorites-page__error" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="favorites-page__toolbar">
          <span className="site-tabs" role="group" aria-label="站点切换">
            {SITE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className="site-tabs__item"
                aria-pressed={site === id}
                onClick={() => {
                  setSite(id);
                }}
              >
                {SITE_LABELS[id]}
              </button>
            ))}
          </span>

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
        </div>
      </header>

      <section className="favorites-page__content">
        {loading && posts.length === 0 ? (
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
