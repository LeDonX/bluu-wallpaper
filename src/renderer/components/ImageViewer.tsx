import { useImageSnapshot } from '@renderer/hooks/useImageSnapshot';
import type { Post } from '@shared/models';
import {
  resetViewerTransform,
  stepIndex,
  stepZoom,
  type ViewerTransform,
  zoomAtPoint
} from '@shared/viewer';
import type { MouseEvent, ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import { ImageProgress } from './ImageProgress';
import styles from './ImageViewer.module.css';
import { InfoPanel } from './InfoPanel';
import { ZoomLayer } from './ZoomLayer';

export interface ImageViewerProps {
  posts: readonly Post[];
  index: number;
  onIndexChange(index: number): void;
  onClose(): void;
  onTagSearch(name: string): void;
}

interface ImageLoadErrorProps {
  title: string;
  message?: string;
  onRetry(): void;
}

function ImageLoadError({ title, message, onRetry }: ImageLoadErrorProps): ReactElement {
  return (
    <div className={styles.loadError} role="alert">
      <p className={styles.loadErrorTitle}>{title}</p>
      {message !== undefined ? <p className={styles.loadErrorDetail}>{message}</p> : null}
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        重试
      </button>
    </div>
  );
}

/**
 * 02 §5：查看器。DR-028 起打开即并行懒加载预览图与原图，
 * 原图就绪后无缝替换预览图，并在两处展示字节级进度。
 * 下载（T-23）、收藏（T-21）与浏览器打开（尚无 IPC 通道）留待对应任务（07 DR-024）。
 */
export function ImageViewer({
  posts,
  index,
  onIndexChange,
  onClose,
  onTagSearch
}: ImageViewerProps): ReactElement | null {
  const post = posts[index];
  const sample = useImageSnapshot(post?.sampleUrl ?? '');
  const original = useImageSnapshot(post?.fileUrl ?? '');
  const [transform, setTransform] = useState<ViewerTransform>(resetViewerTransform);
  const [infoOpen, setInfoOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const postCount = posts.length;
  const previousIndex = stepIndex(index, -1, postCount);
  const nextIndex = stepIndex(index, 1, postCount);

  // 打开时把焦点交给对话框，Esc/方向键才有稳定的作用域（02 §13）
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowLeft': {
          event.preventDefault();
          const target = stepIndex(index, -1, postCount);
          if (target !== null) {
            setTransform(resetViewerTransform());
            onIndexChange(target);
          }
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          const target = stepIndex(index, 1, postCount);
          if (target !== null) {
            setTransform(resetViewerTransform());
            onIndexChange(target);
          }
          break;
        }
        case ' ':
          event.preventDefault();
          setTransform(resetViewerTransform());
          break;
        case '+':
        case '=':
          event.preventDefault();
          setTransform((current) =>
            zoomAtPoint(current, stepZoom(current.zoom, 1), { x: 0, y: 0 }, { x: 0, y: 0 })
          );
          break;
        case '-':
          event.preventDefault();
          setTransform((current) =>
            zoomAtPoint(current, stepZoom(current.zoom, -1), { x: 0, y: 0 }, { x: 0, y: 0 })
          );
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [index, onClose, onIndexChange, postCount]);

  if (post === undefined) return null;

  const firstTag = post.tags[0]?.name ?? 'post';
  const sampleReady = sample.phase === 'ready' && sample.objectUrl !== null;
  const originalReady = original.phase === 'ready' && original.objectUrl !== null;
  const hasOriginal = post.fileUrl !== '';
  const originalPending =
    hasOriginal && !originalReady && (original.phase === 'idle' || original.phase === 'loading');
  const showLoader = !sampleReady && !originalReady;

  const handlePrev = (): void => {
    if (previousIndex === null) return;
    setTransform(resetViewerTransform());
    onIndexChange(previousIndex);
  };

  const handleNext = (): void => {
    if (nextIndex === null) return;
    setTransform(resetViewerTransform());
    onIndexChange(nextIndex);
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="图片查看器">
      <div className={styles.dialog} ref={dialogRef} tabIndex={-1}>
        <header className={styles.header}>
          <span className={styles.counter}>
            {index + 1} / {postCount}
          </span>
          <button
            type="button"
            className={styles.headerButton}
            aria-pressed={infoOpen}
            onClick={() => {
              setInfoOpen((previous) => !previous);
            }}
          >
            {infoOpen ? '收起信息' : '展开信息'}
          </button>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="关闭查看器"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.body} onClick={handleOverlayClick}>
          <button
            type="button"
            className={styles.navButton}
            aria-label="上一张"
            disabled={previousIndex === null}
            onClick={handlePrev}
          >
            ‹
          </button>

          <ZoomLayer
            sampleSrc={sampleReady ? sample.objectUrl : null}
            originalSrc={originalReady ? original.objectUrl : null}
            alt={`${firstTag} #${post.id}`}
            transform={transform}
            onTransformChange={setTransform}
            onReset={() => {
              setTransform(resetViewerTransform());
            }}
          >
            {showLoader ? (
              <div className={styles.loadOverlay}>
                {sample.phase === 'error' ? (
                  <ImageLoadError
                    title="预览图加载失败"
                    message={sample.error?.message}
                    onRetry={sample.retry}
                  />
                ) : (
                  <ImageProgress
                    label="正在加载预览图"
                    loaded={sample.loaded}
                    total={sample.total}
                    showText={false}
                  />
                )}
              </div>
            ) : null}

            {originalPending || original.phase === 'error' ? (
              <div className={styles.originalStatus}>
                {originalPending ? (
                  <ImageProgress
                    label="正在加载原图"
                    loaded={original.loaded}
                    total={original.total}
                    totalFallback={post.fileSize}
                  />
                ) : (
                  <ImageLoadError
                    title="原图加载失败"
                    message={original.error?.message}
                    onRetry={original.retry}
                  />
                )}
              </div>
            ) : null}
          </ZoomLayer>

          <button
            type="button"
            className={styles.navButton}
            aria-label="下一张"
            disabled={nextIndex === null}
            onClick={handleNext}
          >
            ›
          </button>

          {infoOpen ? <InfoPanel post={post} onTagSearch={onTagSearch} /> : null}
        </div>

        <footer className={styles.hintBar}>
          <span>{Math.round(transform.zoom * 100)}%</span>
          <span>← → 切换</span>
          <span>Space 复位</span>
          <span>+ - 缩放</span>
          <span>Esc 关闭</span>
        </footer>
      </div>
    </div>
  );
}
