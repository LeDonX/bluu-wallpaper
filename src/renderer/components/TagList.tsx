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
}

/** 02 §5.2：标签点击即搜，交给父级发起新查询 */
export function TagList({ tags, onTagSearch }: TagListProps): ReactElement {
  if (tags.length === 0) {
    return <p className={styles.emptyValue}>无标签</p>;
  }

  return (
    <ul className={styles.tagList}>
      {tags.map((tag) => {
        const label = isTagType(tag.type) ? TAG_TYPE_LABELS[tag.type] : TAG_TYPE_LABELS.general;
        return (
          <li key={tag.name}>
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
          </li>
        );
      })}
    </ul>
  );
}
