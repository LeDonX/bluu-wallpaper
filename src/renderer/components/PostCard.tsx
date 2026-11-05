import type { Post } from '@shared/models';
import type { MouseEvent, ReactElement } from 'react';

import { BadgeStack } from './BadgeStack';

const RATING_LABELS: Record<Post['rating'], string> = {
  safe: '安全',
  questionable: '可疑',
  explicit: '限制级'
};

export interface PostCardProps {
  post: Post;
  /** 02 §6.2：已看只降低缩略图透明度与饱和度，不改卡片尺寸 */
  viewed: boolean;
  /** 02 §6.2 / T-21：★ 角标数据源，与已看状态独立 */
  favorited?: boolean;
  /** 02 §7.1 / T-27：多选态由页面维护，卡片只展示与上报 */
  selected?: boolean;
  /** 提供时在卡片左上角显示收藏切换按钮；点击不会打开查看器 */
  onToggleFavorite?(post: Post): void;
  /** 多选模式下显示勾选框；`shiftKey` 供页面做连选（DR-039：仅在 hover/focus 时可见） */
  onToggleSelect?(post: Post, shiftKey: boolean): void;
  /** 提供时右键打开卡片菜单（DR-046），坐标用于定位） */
  onContextMenu?(x: number, y: number): void;
  onOpen(post: Post): void;
}

/**
 * 02 §2.2：卡片只展示缩略图与信息条，不含网络/DB 逻辑。
 * 根节点为容器，打开按钮与收藏/多选按钮平级，避免按钮嵌套（T-21 / T-27）。
 */
export function PostCard({
  post,
  viewed,
  favorited = false,
  selected = false,
  onToggleFavorite,
  onToggleSelect,
  onContextMenu,
  onOpen
}: PostCardProps): ReactElement {
  const firstTag = post.tags[0]?.name ?? 'post';
  // DR-048 / DR-049：多选态只负责勾选，收藏按钮不渲染，卡片也不响应 hover/focus 揭示
  const selectMode = onToggleSelect !== undefined;
  const cardClassName = [
    'post-card',
    viewed ? 'post-card--viewed' : '',
    selected ? 'post-card--selected' : '',
    selectMode ? 'post-card--select-mode' : ''
  ]
    .filter((name) => name !== '')
    .join(' ');

  const handleToggle = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onToggleFavorite?.(post);
  };

  const handleToggleSelect = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onToggleSelect?.(post, event.shiftKey);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    if (onContextMenu === undefined) return;
    event.preventDefault();
    onContextMenu(event.clientX, event.clientY);
  };

  return (
    <div
      className={cardClassName}
      data-viewed={viewed ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        className="post-card__open"
        aria-label={
          onToggleSelect === undefined
            ? `查看 ${firstTag} #${post.id}${viewed ? '（已看过）' : ''}`
            : `${selected ? '取消选择' : '选择'} ${firstTag} #${post.id}`
        }
        onClick={(event) => {
          // DR-047：多选期间点击卡片即切换选中，不再打开查看器
          if (onToggleSelect !== undefined) {
            onToggleSelect(post, event.shiftKey);
            return;
          }
          onOpen(post);
        }}
      >
        <div className="post-card__image">
          <img
            src={post.previewUrl}
            alt={`${firstTag} #${post.id}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="post-card__meta">
          <span>
            {post.width}×{post.height}
          </span>
          <span className="post-card__meta-end">
            <span
              className="post-card__rating"
              data-rating={post.rating}
              aria-label={`分级：${RATING_LABELS[post.rating]}`}
              title={RATING_LABELS[post.rating]}
            />
            <span title="评分">★ {post.score}</span>
          </span>
        </div>
      </button>

      {/* 已看只用降低亮度表达，不再渲染 ✓ 角标（DR-045）；收藏由左上角 ☆/★ 承担 */}
      <BadgeStack
        className="post-card__badges"
        favorited={onToggleFavorite === undefined ? favorited : false}
      />

      {onToggleFavorite !== undefined && !selectMode ? (
        <button
          type="button"
          className="post-card__favorite"
          data-favorited={favorited ? 'true' : undefined}
          aria-pressed={favorited}
          aria-label={favorited ? `取消收藏 #${post.id}` : `收藏 #${post.id}`}
          title={favorited ? '取消收藏' : '收藏'}
          onClick={handleToggle}
        >
          <span aria-hidden="true">{favorited ? '★' : '☆'}</span>
        </button>
      ) : null}

      {onToggleSelect !== undefined ? (
        <button
          type="button"
          className="post-card__select"
          data-selected={selected ? 'true' : undefined}
          aria-pressed={selected}
          aria-label={selected ? `取消选择 #${post.id}` : `选择 #${post.id}`}
          title={selected ? '取消选择' : '选择（Shift 连选）'}
          onClick={handleToggleSelect}
        >
          <span aria-hidden="true">{selected ? '✓' : ''}</span>
        </button>
      ) : null}
    </div>
  );
}
