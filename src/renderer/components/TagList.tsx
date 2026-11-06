import type { PostTag, TagType } from '@shared/models';
import { isTagType } from '@shared/models';
import type { ReactElement } from 'react';

import styles from './ImageViewer.module.css';

const TAG_TYPE_LABELS: Record<TagType, string> = {
  general: '常规',
  artist: '画师',
  copyright: '作品',
  character: '角色'
};

export interface TagListProps {
  tags: readonly PostTag[];
  onTagSearch(name: string): void;
  /** 07 DR-069：提供时在每个标签旁显示「＋」关注入口 */
  onFollowTag?(name: string): void;
  followedTags?: ReadonlySet<string>;
  followPendingTag?: string | null;
}

/** 02 §5.2：标签点击即搜，交给父级发起新查询；关注入口与搜索按钮平级，避免按钮嵌套 */
export function TagList({
  tags,
  onTagSearch,
  onFollowTag,
  followedTags,
  followPendingTag = null
}: TagListProps): ReactElement {
  if (tags.length === 0) {
    return <p className={styles.emptyValue}>无标签</p>;
  }

  return (
    <ul className={styles.tagList}>
      {tags.map((tag) => {
        const label = isTagType(tag.type) ? TAG_TYPE_LABELS[tag.type] : TAG_TYPE_LABELS.general;
        const followed = followedTags?.has(tag.name.toLowerCase()) === true;
        const pending = followPendingTag === tag.name;
        return (
          <li key={tag.name} className={styles.tagRow}>
            <button
              type="button"
              className={styles.tagItem}
              data-type={tag.type}
              title={`搜索标签 ${tag.name}`}
              onClick={() => onTagSearch(tag.name)}
            >
              {tag.name}
              <span className={styles.tagType}>{label}</span>
            </button>
            {onFollowTag !== undefined ? (
              <button
                type="button"
                className={styles.tagFollow}
                data-followed={followed ? 'true' : undefined}
                disabled={followed || pending}
                aria-label={followed ? `已关注 ${tag.name}` : `关注 ${tag.name}`}
                title={followed ? '已关注' : '关注该标签'}
                onClick={() => onFollowTag(tag.name)}
              >
                {followed ? '已关注' : pending ? '…' : '＋'}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
