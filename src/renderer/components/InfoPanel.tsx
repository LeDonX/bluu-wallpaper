import type { Post } from '@shared/models';
import { formatFileSize } from '@shared/viewer';
import type { ReactElement } from 'react';

import styles from './ImageViewer.module.css';
import { TagList } from './TagList';

const RATING_LABELS: Record<Post['rating'], string> = {
  safe: '安全',
  questionable: '可疑',
  explicit: '限制级'
};

export interface InfoPanelProps {
  post: Post;
  onTagSearch(name: string): void;
}

/** 02 §5.2：右侧信息栏，只展示元信息与标签入口，不直接发请求 */
export function InfoPanel({ post, onTagSearch }: InfoPanelProps): ReactElement {
  return (
    <aside className={styles.infoPanel} aria-label="图片信息">
      <dl className={styles.metaList}>
        <div className={styles.metaRow}>
          <dt>尺寸</dt>
          <dd>
            {post.width}×{post.height}
          </dd>
        </div>
        <div className={styles.metaRow}>
          <dt>文件大小</dt>
          <dd>{formatFileSize(post.fileSize)}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>评分</dt>
          <dd>★ {post.score}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>分级</dt>
          <dd data-rating={post.rating}>{RATING_LABELS[post.rating]}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>上传时间</dt>
          <dd>{new Date(post.createdAt).toLocaleString('zh-CN')}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>来源</dt>
          <dd className={styles.sourceValue}>{post.source !== undefined && post.source !== '' ? post.source : '—'}</dd>
        </div>
      </dl>

      <section className={styles.tagSection} aria-label="标签">
        <h3 className={styles.infoHeading}>标签</h3>
        <TagList tags={post.tags} onTagSearch={onTagSearch} />
      </section>
    </aside>
  );
}
