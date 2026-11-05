import { type DownloadVariant, hasJpegVariant } from '@shared/downloads';
import type { Post } from '@shared/models';
import { formatFileSize } from '@shared/viewer';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import styles from './ImageViewer.module.css';
import { ProgressBar } from './ProgressBar';
import { TagList } from './TagList';

const RATING_LABELS: Record<Post['rating'], string> = {
  safe: '安全',
  questionable: '可疑',
  explicit: '限制级'
};

export interface InfoPanelProps {
  post: Post;
  /** 02 §5.3 / T-21：收藏状态与切换，与已看独立 */
  favorited: boolean;
  onToggleFavorite(post: Post): void;
  /** 02 §5.3 / T-23：下载入队与当前任务状态文案 */
  downloadStatus: string | null;
  /** T-26：当前任务进度；null 表示总量未知，显示不定进度 */
  downloadRatio: number | null;
  downloadFailure: string | null;
  /** DR-050：已下载时展示“打开所在文件夹”与“重新下载”，不再展示“下载” */
  downloaded: boolean;
  /** DR-051：站点提供独立 JPG 时由按钮展开二级菜单，`variant` 表示用户所选格式 */
  onDownload(post: Post, variant?: DownloadVariant): void;
  onReveal(post: Post): void;
  onRedownload(post: Post, variant?: DownloadVariant): void;
  onTagSearch(name: string): void;
}

/** 02 §5.2：右侧信息栏，只展示元信息与标签入口，不直接发请求 */
export function InfoPanel({
  post,
  favorited,
  onToggleFavorite,
  downloadStatus,
  downloadRatio,
  downloadFailure,
  downloaded,
  onDownload,
  onReveal,
  onRedownload,
  onTagSearch
}: InfoPanelProps): ReactElement {
  const hasVariants = hasJpegVariant(post);
  /** DR-051：菜单记录所属图片 id，切换图片后自动收起，避免显示上一张的选项 */
  const [menuPostId, setMenuPostId] = useState<number | null>(null);
  const menuOpen = hasVariants && menuPostId === post.id;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuPostId(null);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // 菜单打开时 Esc 只收起菜单，并阻止冒泡到查看器的关闭处理
      event.preventDefault();
      event.stopPropagation();
      setMenuPostId(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [menuOpen]);

  const toggleMenu = (): void => {
    setMenuPostId(menuOpen ? null : post.id);
  };

  const selectVariant = (variant: DownloadVariant): void => {
    setMenuPostId(null);
    if (downloaded) onRedownload(post, variant);
    else onDownload(post, variant);
  };

  const variantMenu = (
    <div
      className={`${styles.downloadVariantMenu}${downloaded ? ` ${styles.downloadVariantMenuCompact}` : ''}`}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className={styles.variantItem}
        onClick={() => selectVariant('original')}
      >
        <span>原图</span>
        <span className={styles.variantSize}>{formatFileSize(post.fileSize)}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.variantItem}
        onClick={() => selectVariant('jpeg')}
      >
        <span>较小 JPG</span>
        <span className={styles.variantSize}>{formatFileSize(post.jpegFileSize ?? 0)}</span>
      </button>
    </div>
  );

  return (
    <aside className={styles.infoPanel} aria-label="图片信息">
      <button
        type="button"
        className={styles.favoriteButton}
        data-favorited={favorited ? 'true' : undefined}
        aria-pressed={favorited}
        onClick={() => onToggleFavorite(post)}
      >
        <span aria-hidden="true">{favorited ? '★' : '☆'}</span>
        {favorited ? '取消收藏' : '收藏'}
      </button>

      {downloaded ? (
        <div className={styles.downloadActions}>
          <button
            type="button"
            className={styles.downloadButton}
            onClick={() => onReveal(post)}
          >
            打开所在文件夹
          </button>
          {hasVariants ? (
            <div ref={menuRef} className={styles.downloadMenu}>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={toggleMenu}
              >
                重新下载 <span aria-hidden="true">▾</span>
              </button>
              {menuOpen ? variantMenu : null}
            </div>
          ) : (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => onRedownload(post)}
            >
              重新下载
            </button>
          )}
        </div>
      ) : hasVariants ? (
        <div ref={menuRef} className={styles.downloadMenu}>
          <button
            type="button"
            className={styles.downloadButton}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            <span aria-hidden="true">↓</span>
            下载
            <span aria-hidden="true" className={styles.menuCaret}>
              ▾
            </span>
          </button>
          {menuOpen ? variantMenu : null}
        </div>
      ) : (
        <button type="button" className={styles.downloadButton} onClick={() => onDownload(post)}>
          <span aria-hidden="true">↓</span>
          下载
        </button>
      )}
      {downloadStatus !== null ? (
        <div className={styles.downloadProgress}>
          <p className={styles.downloadStatus} role="status">
            {downloadStatus}
          </p>
          <ProgressBar ratio={downloadRatio} label="当前图片下载进度" />
        </div>
      ) : null}
      {downloadFailure !== null ? (
        <p className={styles.downloadError} role="alert">
          {downloadFailure}
        </p>
      ) : null}

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
          <dd className={styles.sourceValue}>
            {post.source !== undefined && post.source !== '' ? post.source : '—'}
          </dd>
        </div>
      </dl>

      <section className={styles.tagSection} aria-label="标签">
        <h3 className={styles.infoHeading}>标签</h3>
        <TagList tags={post.tags} onTagSearch={onTagSearch} />
      </section>
    </aside>
  );
}
