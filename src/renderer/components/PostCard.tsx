import type { Post } from '@shared/models';
import type { ReactElement } from 'react';

const RATING_LABELS: Record<Post['rating'], string> = {
  safe: '安全',
  questionable: '可疑',
  explicit: '限制级'
};

export interface PostCardProps {
  post: Post;
  /** 02 §6.2：已看只降低缩略图透明度与饱和度，不改卡片尺寸 */
  viewed: boolean;
  onOpen(post: Post): void;
}

/** 02 §2.2：卡片只展示缩略图与信息条，不含网络/DB 逻辑 */
export function PostCard({ post, viewed, onOpen }: PostCardProps): ReactElement {
  const firstTag = post.tags[0]?.name ?? 'post';

  return (
    <button
      type="button"
      className={viewed ? 'post-card post-card--viewed' : 'post-card'}
      aria-label={`查看 ${firstTag} #${post.id}${viewed ? '（已看过）' : ''}`}
      data-viewed={viewed ? 'true' : undefined}
      onClick={() => onOpen(post)}
    >
      <div className="post-card__image">
        <img
          src={post.previewUrl}
          alt={`${firstTag} #${post.id}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
        <span
          className="post-card__rating"
          data-rating={post.rating}
          aria-label={`分级：${RATING_LABELS[post.rating]}`}
          title={RATING_LABELS[post.rating]}
        />
      </div>
      <div className="post-card__meta">
        <span title="评分">★ {post.score}</span>
        <span>
          {post.width}×{post.height}
        </span>
      </div>
    </button>
  );
}
