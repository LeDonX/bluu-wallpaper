import type { Post } from '@shared/models';
import { postSelectionKey } from '@shared/selection';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PostCard } from './PostCard';

const COLUMN_MIN_WIDTH = 220; // 02 §2.2 / §12：列宽 220–260
const GAP = 12;
const CARD_HEIGHT = 280;
const NEAR_END_PX = 300; // 02 §2.2：触底 300px 触发加载

export interface PostGridProps {
  posts: readonly Post[];
  viewedIds: ReadonlySet<number>;
  /** T-21：★ 角标数据源，与已看集合独立 */
  favoritedIds: ReadonlySet<number>;
  /** DR-069：关注动态未读集合，命中时卡片右上角显示红点 */
  unreadIds?: ReadonlySet<number>;
  /** T-27 / DR-039：多选键集合；仅在开启多选（传入 onToggleSelect）时渲染勾选框 */
  selectedKeys?: ReadonlySet<string>;
  loading: boolean;
  onNearEnd(): void;
  /** 02 §6.3：内容填不满视口时上报，供隐藏已看自动补页 */
  onUnderfilled?(): void;
  onToggleFavorite(post: Post): void;
  onToggleSelect?(post: Post, shiftKey: boolean): void;
  /** 右键卡片菜单（DR-046），坐标透传给页面 */
  onContextMenu?(x: number, y: number): void;
  onOpen(post: Post): void;
}

/**
 * 行虚拟化网格：只渲染可视行，支撑 1000+ 项滚动（03 §1.2 @tanstack/react-virtual）。
 * 卡片等高是行虚拟化的前提，瀑布流留待后续统一（07 DR-015）。
 */
export function PostGrid({
  posts,
  viewedIds,
  favoritedIds,
  unreadIds,
  selectedKeys,
  loading,
  onNearEnd,
  onUnderfilled,
  onToggleFavorite,
  onToggleSelect,
  onContextMenu,
  onOpen
}: PostGridProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    setViewportWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setViewportWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((viewportWidth + GAP) / (COLUMN_MIN_WIDTH + GAP)));

  const rows = useMemo(() => {
    const result: Post[][] = [];
    for (let index = 0; index < posts.length; index += columns) {
      result.push(posts.slice(index, index + columns));
    }
    return result;
  }, [columns, posts]);

  // 02 §6.3：过滤后内容填不满视口时不会产生滚动事件，需主动上报以便自动补页
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (element.scrollHeight - element.clientHeight < NEAR_END_PX) onUnderfilled?.();
  }, [posts.length, columns, viewportWidth, onUnderfilled]);

  // @tanstack/react-virtual 的 hook 返回值无法被 React Compiler 安全 memoize，官方 API 无法规避
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: 4
  });

  const handleScroll = (): void => {
    const element = scrollRef.current;
    if (!element) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_END_PX) onNearEnd();
  };

  return (
    <div className="post-grid" ref={scrollRef} onScroll={handleScroll}>
      <div className="post-grid__spacer" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (row === undefined) return null;

          return (
            <div
              key={virtualRow.key}
              className="post-grid__row"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
              }}
            >
              {row.map((post) => (
                <PostCard
                  key={`${post.site}:${post.id}`}
                  post={post}
                  viewed={viewedIds.has(post.id)}
                  favorited={favoritedIds.has(post.id)}
                  unread={unreadIds?.has(post.id) === true}
                  selected={selectedKeys?.has(postSelectionKey(post)) === true}
                  onToggleFavorite={onToggleFavorite}
                  onToggleSelect={onToggleSelect}
                  onContextMenu={onContextMenu}
                  onOpen={onOpen}
                />
              ))}
            </div>
          );
        })}
      </div>
      {/* DR-090：固定高度加载槽常驻占位，加载文案只切换内容，避免触底时滚动区域高度变化导致列表抖动 */}
      <div
        className="post-grid__loading"
        data-loading={loading ? 'true' : 'false'}
        role="status"
      >
        {loading ? '正在加载更多…' : ''}
      </div>
    </div>
  );
}
