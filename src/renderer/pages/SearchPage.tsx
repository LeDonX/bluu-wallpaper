import { BatchDownloadBar } from '@renderer/components/BatchDownloadBar';
import { ConfirmDialog } from '@renderer/components/ConfirmDialog';
import { ContextMenu } from '@renderer/components/ContextMenu';
import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { ImageViewer } from '@renderer/components/ImageViewer';
import { PostGrid } from '@renderer/components/PostGrid';
import { SearchBar } from '@renderer/components/SearchBar';
import { Switch } from '@renderer/components/Switch';
import { SITE_IDS, type SiteId } from '@shared/constants';
import {
  describeBatchSummary,
  enqueueDownloadBatch,
  estimateBatchSize,
  formatBatchSize,
  shouldConfirmBatch
} from '@shared/download-batch';
import type { AppError, Result } from '@shared/errors';
import type { Post, PostPage } from '@shared/models';
import {
  advanceFillProgress,
  type FillProgress,
  filterUnviewed,
  INITIAL_FILL_PROGRESS,
  isAutoFillExhausted,
  mergePosts
} from '@shared/posts';
import { postSelectionKey, selectKeyRange, toggleSelectionKey } from '@shared/selection';
import { SITE_LABELS } from '@shared/sites';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface PagePayload {
  result: Result<PostPage>;
  viewedIds: number[];
}

/** 只追加已看 id，避免无新 id 时改引用触发多余渲染 */
function withViewedIds(previous: ReadonlySet<number>, ids: readonly number[]): ReadonlySet<number> {
  if (ids.length === 0) return previous;
  const next = new Set(previous);
  for (const id of ids) next.add(id);
  return next;
}

export interface SearchPageProps {
  /** DR-041 / DR-057：榜单查看器点击标签后由 App 转发，seq 变化即执行一次查询，并切到来源站点 */
  externalQuery?: { query: string; site?: SiteId; seq: number };
}

export function SearchPage({ externalQuery }: SearchPageProps): ReactElement {
  // 07 DR-057：两站共用同一搜索链路，站点切换只影响请求的站点与本地状态分组
  const [site, setSite] = useState<SiteId>('yande');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadedPage, setLoadedPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [r18Filtered, setR18Filtered] = useState(false);
  // DR-056：本次查询因黑名单追加的 -tag 数量，0 时不展示提示
  const [blacklistFiltered, setBlacklistFiltered] = useState(0);
  // 查看器索引为 null 时表示关闭；索引基于当前 posts 数组
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // 已看集合：加载新页时从 post_views 批量恢复，点击时乐观加入（02 §6）
  const [viewedIds, setViewedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [viewError, setViewError] = useState<string | null>(null);
  // T-21：收藏集合与已看独立，进入搜索时从本地 favorites 读取
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(() => new Set());
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  // DR-055：搜索历史在挂载时读取；记录/删除/清空都由主进程返回最新列表
  const [history, setHistory] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // 02 §2.1：隐藏已看为独立开关，不进入查询串；过滤只在渲染层派生（DR-031）
  const [hideViewed, setHideViewed] = useState(false);
  const [fillProgress, setFillProgress] = useState<FillProgress>(INITIAL_FILL_PROGRESS);
  // T-27：选中键为 `site:id`，与虚拟网格行回收解耦（DR-038）
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  // DR-039 / DR-046：多选默认关闭，通过卡片右键菜单开启后才渲染勾选框
  const [selectMode, setSelectMode] = useState(false);
  // DR-046：右键卡片菜单坐标；不占结果页布局
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  // 非空时表示待确认的批量目标（>50 张才进入，DR-038）
  const [pendingBatch, setPendingBatch] = useState<Post[] | null>(null);

  // 请求序号用于丢弃过期响应；loadingRef 保证触底事件不会并发起重复请求
  const requestSeq = useRef(0);
  const loadingRef = useRef(false);
  // 同步镜像已看集合，供 IPC 回调判断是否需要回滚
  const viewedRef = useRef<ReadonlySet<number>>(new Set());
  // 同步镜像收藏集合，供乐观更新判断原状态
  const favoriteRef = useRef<ReadonlySet<number>>(new Set());
  // 同步镜像补页进度，供视口回调在渲染前判断是否达到上限
  const fillProgressRef = useRef<FillProgress>(INITIAL_FILL_PROGRESS);

  const updateViewed = useCallback(
    (updater: (previous: ReadonlySet<number>) => ReadonlySet<number>): void => {
      const next = updater(viewedRef.current);
      viewedRef.current = next;
      setViewedIds(next);
    },
    []
  );

  const updateFillProgress = useCallback((next: FillProgress): void => {
    fillProgressRef.current = next;
    setFillProgress(next);
  }, []);

  const updateFavorites = useCallback(
    (updater: (previous: ReadonlySet<number>) => ReadonlySet<number>): void => {
      const next = updater(favoriteRef.current);
      favoriteRef.current = next;
      setFavoriteIds(next);
    },
    []
  );

  // 02 §6.3：过滤只在渲染层派生，posts 保留全部已加载数据；T-27 查询级入口以可见结果为准
  const visiblePosts = hideViewed ? filterUnviewed(posts, viewedIds) : posts;
  const selectedPosts = visiblePosts.filter((post) => selectedKeys.has(postSelectionKey(post)));

  // 02 §7.1 / DR-038：点击切换单项；Shift 从锚点连续并入当前可见项
  const handleToggleSelect = useCallback(
    (post: Post, shiftKey: boolean): void => {
      const key = postSelectionKey(post);
      if (shiftKey && selectionAnchor !== null) {
        const orderedKeys = visiblePosts.map(postSelectionKey);
        setSelectedKeys((current) => selectKeyRange(current, orderedKeys, selectionAnchor, key));
        return;
      }
      setSelectedKeys((current) => toggleSelectionKey(current, key));
      setSelectionAnchor(key);
    },
    [selectionAnchor, visiblePosts]
  );

  const clearSelection = useCallback((): void => {
    setSelectedKeys(new Set());
    setSelectionAnchor(null);
  }, []);

  // DR-039：退出多选时一并清空选中，避免隐藏的勾选残留
  const handleToggleSelectMode = (): void => {
    if (selectMode) {
      setSelectMode(false);
      clearSelection();
      return;
    }
    setSelectMode(true);
  };

  // DR-046：右键卡片进入"多选"；多选已开启时不再弹菜单
  const handleCardContextMenu = (x: number, y: number): void => {
    if (selectMode) return;
    setContextMenu({ x, y });
  };

  /**
   * 02 §7.5 / DR-038：按 ≤100 分片提交并汇总；失败分片不阻断其余分片，
   * 有失败时保留选中，便于用户直接重试。
   */
  const runBatch = useCallback(async (targets: Post[]): Promise<void> => {
    if (targets.length === 0) return;
    setPendingBatch(null);
    setBatchBusy(true);
    setBatchNotice(null);
    setBatchError(null);
    try {
      const summary = await enqueueDownloadBatch(targets, site, (input) =>
        window.booru.enqueueDownloads(input)
      );
      setBatchNotice(describeBatchSummary(summary));
      if (summary.failed > 0) {
        setBatchError(`有 ${summary.failed} 张加入失败，可稍后重试`);
      } else {
        setSelectedKeys(new Set());
        setSelectionAnchor(null);
      }
    } finally {
      setBatchBusy(false);
    }
  }, [site]);

  const requestBatch = useCallback(
    (targets: Post[]): void => {
      if (batchBusy || targets.length === 0) return;
      if (shouldConfirmBatch(targets.length)) {
        setPendingBatch(targets);
        return;
      }
      void runBatch(targets);
    },
    [batchBusy, runBatch]
  );

  // 05 §6 / DR-033：设置页清除记录后同步已看与收藏集合，隐藏已看模式立即恢复完整列表
  useEffect(() => {
    return window.booru.onViewsUpdated((event) => {
      if (event.site !== null && event.site !== site) return;
      updateViewed(() => new Set());
      updateFavorites(() => new Set());
      updateFillProgress(INITIAL_FILL_PROGRESS);
      setViewError(null);
      setFavoriteError(null);
    });
  }, [site, updateFavorites, updateFillProgress, updateViewed]);

  // DR-055：启动时读取历史；失败只提示，不影响搜索
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await window.booru.listSearchHistory();
        if (!active) return;
        if (result.ok) setHistory(result.data);
        else setHistoryError(result.error.message);
      } catch {
        if (active) setHistoryError('搜索历史读取失败');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 只在首页搜索成功后记录；主进程返回截断后的最新列表
  const recordHistory = useCallback((query: string): void => {
    void (async () => {
      try {
        const result = await window.booru.recordSearchHistory({ query });
        if (result.ok) {
          setHistory(result.data);
          setHistoryError(null);
        } else {
          setHistoryError(result.error.message);
        }
      } catch {
        setHistoryError('搜索历史写入失败');
      }
    })();
  }, []);

  const handleDeleteHistory = useCallback((query: string): void => {
    void (async () => {
      try {
        const result = await window.booru.deleteSearchHistory({ query });
        if (result.ok) {
          setHistory(result.data);
          setHistoryError(null);
        } else {
          setHistoryError(result.error.message);
        }
      } catch {
        setHistoryError('搜索历史删除失败');
      }
    })();
  }, []);

  const handleClearHistory = useCallback((): void => {
    void (async () => {
      try {
        const result = await window.booru.clearSearchHistory();
        if (result.ok) {
          setHistory([]);
          setHistoryError(null);
        } else {
          setHistoryError(result.error.message);
        }
      } catch {
        setHistoryError('搜索历史清空失败');
      }
    })();
  }, []);

  // T-21：收藏/取消收藏乐观更新，失败回滚并提示（05 §6）
  const toggleFavorite = useCallback(
    (post: Post): void => {
      const wasFavorited = favoriteRef.current.has(post.id);
      updateFavorites((previous) => {
        const next = new Set(previous);
        if (wasFavorited) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      setFavoriteError(null);

      void (async () => {
        try {
          const result = await window.booru.toggleFavorite({ site: post.site, post });
          if (result.ok) return;
          setFavoriteError(result.error.message);
        } catch {
          setFavoriteError('收藏操作失败');
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

  /**
   * 拉取单页并在追加前恢复该页的已看状态。
   * 隐藏已看时若先渲染再异步变暗，已看项会闪现后被移除，因此这里等 `views:list` 返回。
   */
  const requestPage = useCallback(
    async (
      searchQuery: string,
      page: number,
      seq: number,
      targetSite: SiteId
    ): Promise<PagePayload> => {
      const result = await window.booru.searchPosts({
        site: targetSite,
        query: searchQuery,
        page
      });
      if (!result.ok || result.data.posts.length === 0) return { result, viewedIds: [] };

      try {
        const views = await window.booru.listViews({
          site: targetSite,
          postIds: result.data.posts.map((item) => item.id)
        });
        if (requestSeq.current !== seq) return { result, viewedIds: [] };
        if (!views.ok) {
          setViewError(views.error.message);
          return { result, viewedIds: [] };
        }
        return { result, viewedIds: views.data };
      } catch {
        if (requestSeq.current === seq) setViewError('已看记录读取失败');
        return { result, viewedIds: [] };
      }
    },
    []
  );

  const runSearch = useCallback(
    async (searchQuery: string, targetSite: SiteId): Promise<void> => {
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
      setBlacklistFiltered(0);
      setViewerIndex(null);
      setViewError(null);
      setFavoriteError(null);
      setBatchNotice(null);
      setBatchError(null);
      setPendingBatch(null);
      setSelectMode(false);
      setContextMenu(null);
      clearSelection();
      updateViewed(() => new Set());
      updateFavorites(() => new Set());
      updateFillProgress(INITIAL_FILL_PROGRESS);

      // 收藏状态与搜索并行读取；收藏只读本地，不请求站点（T-21）
      const favoritesPromise = window.booru
        .listFavorites({ site: targetSite })
        .catch(() => null);
      const payload = await requestPage(searchQuery, 1, seq, targetSite);
      if (requestSeq.current !== seq) return;

      loadingRef.current = false;
      setLoading(false);
      if (!payload.result.ok) {
        setError(payload.result.error);
        return;
      }

      const favorites = await favoritesPromise;
      if (requestSeq.current === seq) {
        if (favorites === null) setFavoriteError('收藏状态读取失败');
        else if (favorites.ok) {
          updateFavorites(() => new Set(favorites.data.posts.map((post) => post.id)));
        } else setFavoriteError(favorites.error.message);
      }

      const pagePosts = payload.result.data.posts;
      updateViewed((previous) => withViewedIds(previous, payload.viewedIds));
      setPosts(pagePosts);
      setLoadedPage(1);
      setHasMore(pagePosts.length > 0);
      setR18Filtered(payload.result.data.r18Filtered === true);
      setBlacklistFiltered(payload.result.data.blacklistFiltered ?? 0);
      recordHistory(searchQuery);
    },
    [recordHistory, requestPage, updateFavorites, updateFillProgress, updateViewed, clearSelection]
  );

  const externalSeq = externalQuery?.seq ?? 0;
  // DR-041：只在 App 转入新的外部查询（seq 变化）时执行一次；
  // runSearch 的引用会随状态变化，放入依赖会导致每次渲染都重新搜索。
  // 用宏任务触发，避免在 effect 内同步 setState（react-hooks/set-state-in-effect）。
  useEffect(() => {
    if (externalQuery === undefined) return;
    const trimmed = externalQuery.query.trim();
    if (trimmed === '') return;
    // DR-057：从榜单跳转时沿用来源站点，避免在另一个站点上搜同名标签
    const targetSite = externalQuery.site ?? site;
    const timer = window.setTimeout(() => {
      setSite(targetSite);
      setSubmittedQuery(trimmed);
      void runSearch(trimmed, targetSite);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSeq]);

  const loadMore = useCallback(
    async (autoFill: boolean): Promise<void> => {
      if (loadingRef.current || !hasMore || submittedQuery === '') return;

      const seq = requestSeq.current;
      const nextPage = loadedPage + 1;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const payload = await requestPage(submittedQuery, nextPage, seq, site);
      if (requestSeq.current !== seq) return;

      loadingRef.current = false;
      setLoading(false);
      if (!payload.result.ok) {
        setError(payload.result.error);
        return;
      }

      const pagePosts = payload.result.data.posts;
      updateViewed((previous) => withViewedIds(previous, payload.viewedIds));
      setPosts((previous) => mergePosts(previous, pagePosts));
      setLoadedPage(nextPage);
      setHasMore(pagePosts.length > 0);

      // 02 §6.3：只有自动补页参与"连续 5 页无未看项"的计数
      if (autoFill) {
        updateFillProgress(
          advanceFillProgress(fillProgressRef.current, pagePosts.length, payload.viewedIds.length)
        );
      }
    },
    [hasMore, loadedPage, requestPage, site, submittedQuery, updateFillProgress, updateViewed]
  );

  // 02 §6.3：过滤后视口未填满时自动请求下一页，连续 5 页无未看项即停止并提示
  const handleUnderfilled = useCallback((): void => {
    if (!hideViewed || loadingRef.current) return;
    if (!hasSearched || submittedQuery === '' || !hasMore) return;
    if (isAutoFillExhausted(fillProgressRef.current)) return;
    void loadMore(true);
  }, [hasMore, hasSearched, hideViewed, loadMore, submittedQuery]);

  const handleSubmit = (query: string): void => {
    const trimmed = query.trim();
    if (trimmed === '' || loadingRef.current) return;
    setSubmittedQuery(trimmed);
    void runSearch(trimmed, site);
  };

  // 07 DR-057：切站后按当前关键词在新站点重搜；未搜索过则只切站并清理临时状态
  const handleSiteChange = (next: SiteId): void => {
    if (next === site) return;
    if (loadingRef.current) return;
    setSite(next);
    if (submittedQuery === '') {
      setViewerIndex(null);
      setSelectMode(false);
      setContextMenu(null);
      clearSelection();
      return;
    }
    void runSearch(submittedQuery, next);
  };

  const handleRetry = (): void => {
    if (loadingRef.current) return;
    if (loadedPage === 0) {
      void runSearch(submittedQuery, site);
      return;
    }
    void loadMore(false);
  };

  const handleHideViewedChange = (checked: boolean): void => {
    setHideViewed(checked);
    // 02 §6.3：切换开关重新开始补页计数；已加载数据不丢弃，关闭即恢复完整列表
    updateFillProgress(INITIAL_FILL_PROGRESS);
    // 过滤范围变化后原选中项可能不可见，清空避免"选中的看不到"（DR-038/DR-039）
    setSelectMode(false);
    setContextMenu(null);
    clearSelection();
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
    void runSearch(trimmed, site);
  };

  // 02 §6.3：visiblePosts 已在批处理逻辑前派生，这里只做展示用计数
  const filteredViewedCount = posts.length - visiblePosts.length;
  const fillExhausted = isAutoFillExhausted(fillProgress);
  const showEmptyResult = hasSearched && !loading && error === null && posts.length === 0;
  const selectedEstimateLabel = formatBatchSize(estimateBatchSize(selectedPosts));
  const pendingEstimateLabel =
    pendingBatch === null ? '' : formatBatchSize(estimateBatchSize(pendingBatch));

  return (
    <main className="search-page">
      <header className="search-page__header">
        <div className="search-page__title">
          <h1>搜索</h1>
          <p className="search-page__count">
            {hasSearched ? `已显示 ${visiblePosts.length} 条 · ${SITE_LABELS[site]}` : SITE_LABELS[site]}
          </p>
          {hideViewed ? (
            <p className="search-page__filter-hint">已过滤 {filteredViewedCount} 张已看</p>
          ) : null}
          {fillExhausted ? (
            <p className="search-page__filter-hint" role="status">
              已跳过 {fillProgress.skipped} 张已看过的图片
            </p>
          ) : null}
          {r18Filtered ? <p className="search-page__r18-hint">已过滤 R18（设置中可开启）</p> : null}
          {blacklistFiltered > 0 ? (
            <p className="search-page__filter-hint" role="status">
              已按标签黑名单排除 {blacklistFiltered} 个标签
            </p>
          ) : null}
          {viewError !== null ? (
            <p className="search-page__view-error" role="alert">
              {viewError}
            </p>
          ) : null}
          {favoriteError !== null ? (
            <p className="search-page__view-error" role="alert">
              {favoriteError}
            </p>
          ) : null}
          {historyError !== null ? (
            <p className="search-page__view-error" role="alert">
              {historyError}
            </p>
          ) : null}
        </div>
        {/* 07 DR-057：站点切换复用收藏页的 site-tabs 样式（02 §2.1） */}
        <span className="site-tabs" role="group" aria-label="站点切换">
          {SITE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="site-tabs__item"
              aria-pressed={site === id}
              disabled={loading}
              onClick={() => handleSiteChange(id)}
            >
              {SITE_LABELS[id]}
            </button>
          ))}
        </span>
        <SearchBar
          site={site}
          disabled={loading}
          history={history}
          onSubmit={handleSubmit}
          onSelectHistory={handleSubmit}
          onDeleteHistory={handleDeleteHistory}
          onClearHistory={handleClearHistory}
        />
        <Switch
          checked={hideViewed}
          label="隐藏已看"
          disabled={!hasSearched}
          onChange={handleHideViewedChange}
        />
      </header>

      {batchNotice !== null ? (
        <p className="search-page__batch-notice" role="status">
          {batchNotice}
        </p>
      ) : null}
      {batchError !== null ? (
        <p className="search-page__view-error" role="alert">
          {batchError}
        </p>
      ) : null}

      {selectMode ? (
        <BatchDownloadBar
          selectedCount={selectedPosts.length}
          estimateLabel={selectedEstimateLabel}
          busy={batchBusy}
          onDownloadSelected={() => requestBatch(selectedPosts)}
          onClearSelection={clearSelection}
          onExitSelectMode={handleToggleSelectMode}
        />
      ) : null}

      <section className="search-page__content">
        {error !== null && posts.length === 0 ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : posts.length > 0 ? (
          <PostGrid
            posts={visiblePosts}
            viewedIds={viewedIds}
            favoritedIds={favoriteIds}
            selectedKeys={selectedKeys}
            loading={loading}
            onNearEnd={() => void loadMore(false)}
            onUnderfilled={handleUnderfilled}
            onToggleFavorite={toggleFavorite}
            onToggleSelect={selectMode ? handleToggleSelect : undefined}
            onContextMenu={handleCardContextMenu}
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

      {contextMenu !== null ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              id: 'select',
              label: '多选',
              onSelect: () => setSelectMode(true)
            }
          ]}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      {pendingBatch !== null ? (
        <ConfirmDialog
          title="批量下载确认"
          confirmLabel={`下载 ${pendingBatch.length} 张`}
          busy={batchBusy}
          onConfirm={() => {
            void runBatch(pendingBatch);
          }}
          onCancel={() => {
            if (!batchBusy) setPendingBatch(null);
          }}
        >
          <p>
            共 {pendingBatch.length} 张，预估体积 {pendingEstimateLabel}。
          </p>
          <p>将按每次最多 100 张分批加入队列，沿用当前命名模板与去重规则。</p>
        </ConfirmDialog>
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
