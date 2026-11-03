import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { ImageViewer } from '@renderer/components/ImageViewer';
import { PostGrid } from '@renderer/components/PostGrid';
import { SearchBar } from '@renderer/components/SearchBar';
import type { SiteId } from '@shared/constants';
import type { AppError } from '@shared/errors';
import type { Post } from '@shared/models';
import { mergePosts } from '@shared/posts';
import type { ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';

const SEARCH_SITE: SiteId = 'yande';

export function SearchPage(): ReactElement {
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadedPage, setLoadedPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [r18Filtered, setR18Filtered] = useState(false);
  // 查看器索引为 null 时表示关闭；索引基于当前 posts 数组
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // 已看集合：加载新页时从 post_views 批量恢复，点击时乐观加入（02 §6）
  const [viewedIds, setViewedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [viewError, setViewError] = useState<string | null>(null);

  // 请求序号用于丢弃过期响应；loadingRef 保证触底事件不会并发起重复请求
  const requestSeq = useRef(0);
  const loadingRef = useRef(false);
  // 同步镜像已看集合，供 IPC 回调判断是否需要回滚
  const viewedRef = useRef<ReadonlySet<number>>(new Set());

  const updateViewed = useCallback(
    (updater: (previous: ReadonlySet<number>) => ReadonlySet<number>): void => {
      const next = updater(viewedRef.current);
      viewedRef.current = next;
      setViewedIds(next);
    },
    []
  );

  // 02 §6.1：点击缩略图与查看器切图都标记；失败回滚并提示（05 §6）
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
          const result = await window.booru.markViews({
            site: post.site,
            postIds: [post.id]
          });
          if (result.ok) return;
          setViewError(result.error.message);
        } catch {
          setViewError('已看记录写入失败');
        }
        // 写入失败：仅回滚本次乐观加入的 id，重启前已看过的保持不变
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

  // 批量恢复已看状态（07 DR-029）；读取失败不阻断浏览，只影响变暗
  const refreshViewed = useCallback(
    async (candidate: readonly Post[], seq: number): Promise<void> => {
      if (candidate.length === 0) return;
      const result = await window.booru.listViews({
        site: SEARCH_SITE,
        postIds: candidate.map((item) => item.id)
      });
      if (requestSeq.current !== seq) return;
      if (!result.ok) {
        setViewError(result.error.message);
        return;
      }
      updateViewed((previous) => {
        const next = new Set(previous);
        for (const id of result.data) next.add(id);
        return next;
      });
    },
    [updateViewed]
  );

  const runSearch = useCallback(
    async (searchQuery: string): Promise<void> => {
      requestSeq.current += 1;
      const seq = requestSeq.current;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setPosts([]);
      setLoadedPage(0);
      setHasMore(true);
      setHasSearched(true);
      setR18Filtered(false);
      setViewerIndex(null);
      setViewError(null);
      updateViewed(() => new Set());

      const result = await window.booru.searchPosts({
        site: SEARCH_SITE,
        query: searchQuery,
        page: 1
      });
      if (requestSeq.current !== seq) return;

      loadingRef.current = false;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPosts(result.data.posts);
      setLoadedPage(1);
      setHasMore(result.data.posts.length > 0);
      setR18Filtered(result.data.r18Filtered === true);
      void refreshViewed(result.data.posts, seq);
    },
    [refreshViewed, updateViewed]
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingRef.current || !hasMore || submittedQuery === '') return;

    const seq = requestSeq.current;
    const nextPage = loadedPage + 1;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const result = await window.booru.searchPosts({
      site: SEARCH_SITE,
      query: submittedQuery,
      page: nextPage
    });
    if (requestSeq.current !== seq) return;

    loadingRef.current = false;
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPosts((previous) => mergePosts(previous, result.data.posts));
    setLoadedPage(nextPage);
    setHasMore(result.data.posts.length > 0);
    void refreshViewed(result.data.posts, seq);
  }, [hasMore, loadedPage, refreshViewed, submittedQuery]);

  const handleSubmit = (query: string): void => {
    const trimmed = query.trim();
    if (trimmed === '' || loadingRef.current) return;
    setSubmittedQuery(trimmed);
    void runSearch(trimmed);
  };

  const handleRetry = (): void => {
    if (loadingRef.current) return;
    if (loadedPage === 0) {
      void runSearch(submittedQuery);
      return;
    }
    void loadMore();
  };

  const handleOpenPost = (post: Post): void => {
    const target = posts.findIndex((item) => item.site === post.site && item.id === post.id);
    if (target < 0) return;
    setViewerIndex(target);
    markViewed(post);
  };

  // 02 §5.3：查看器内 ←/→ 切图逐张标记
  const handleViewerIndexChange = (nextIndex: number): void => {
    setViewerIndex(nextIndex);
    const nextPost = posts[nextIndex];
    if (nextPost !== undefined) markViewed(nextPost);
  };

  const handleTagSearch = (name: string): void => {
    setViewerIndex(null);
    const trimmed = name.trim();
    if (trimmed === '') return;
    // 从查看器发起新查询时无条件重置列表，同时作废旧的在途翻页请求
    setSubmittedQuery(trimmed);
    void runSearch(trimmed);
  };

  const showEmptyResult = hasSearched && !loading && error === null && posts.length === 0;

  return (
    <main className="search-page">
      <header className="search-page__header">
        <div className="search-page__title">
          <h1>搜索</h1>
          <p className="search-page__count">
            {hasSearched ? `已显示 ${posts.length} 条` : 'yande.re'}
          </p>
          {r18Filtered ? <p className="search-page__r18-hint">已过滤 R18（设置中可开启）</p> : null}
          {viewError !== null ? (
            <p className="search-page__view-error" role="alert">
              {viewError}
            </p>
          ) : null}
        </div>
        <SearchBar site={SEARCH_SITE} disabled={loading} onSubmit={handleSubmit} />
      </header>

      <section className="search-page__content">
        {error !== null && posts.length === 0 ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : posts.length > 0 ? (
          <PostGrid
            posts={posts}
            viewedIds={viewedIds}
            loading={loading}
            onNearEnd={() => void loadMore()}
            onOpen={handleOpenPost}
          />
        ) : loading ? (
          <div className="state-view" role="status">
            <p className="state-view__title">正在搜索…</p>
          </div>
        ) : showEmptyResult ? (
          <EmptyState title="没有匹配的图片" description="试试减少标签或换用更宽泛的查询" />
        ) : (
          <EmptyState
            title="输入标签开始搜索"
            description="支持 rating:s、score:>=100、order:score 等原站语法"
          />
        )}
      </section>

      {error !== null && posts.length > 0 ? (
        <div className="search-page__footer-error">
          <ErrorState error={error} onRetry={handleRetry} />
        </div>
      ) : null}

      {viewerIndex !== null && posts[viewerIndex] !== undefined ? (
        <ImageViewer
          posts={posts}
          index={viewerIndex}
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
