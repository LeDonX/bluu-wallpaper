import { useImageSnapshot } from '@renderer/hooks/useImageSnapshot';
import {
  downloadProgressRatio,
  downloadSource,
  type DownloadStatus,
  downloadStatusLabel,
  type DownloadVariant
} from '@shared/downloads';
import type { Post } from '@shared/models';
import {
  resetViewerTransform,
  stepIndex,
  stepZoom,
  type ViewerTransform,
  zoomAtPoint
} from '@shared/viewer';
import type { MouseEvent, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ImageProgress } from './ImageProgress';
import styles from './ImageViewer.module.css';
import { InfoPanel } from './InfoPanel';
import { ZoomLayer } from './ZoomLayer';

export interface ImageViewerProps {
  posts: readonly Post[];
  index: number;
  /** T-21：当前图片是否已收藏，与已看状态独立 */
  favorited: boolean;
  onToggleFavorite(post: Post): void;
  onIndexChange(index: number): void;
  onClose(): void;
  onTagSearch(name: string): void;
}

interface ImageLoadErrorProps {
  title: string;
  message?: string;
  onRetry(): void;
}

/** T-23：当前图片的下载任务状态；切换图片后只展示匹配 postId 的那一条 */
interface DownloadNotice {
  postId: number;
  taskId: string;
  status: DownloadStatus;
  bytesDone: number;
  bytesTotal: number;
  error: string | null;
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
 * 下载（T-23）与浏览器打开（尚无 IPC 通道）留待对应任务（07 DR-024）；
 * 收藏（T-21）已接入 F 键与信息栏按钮。
 */
export function ImageViewer({
  posts,
  index,
  favorited,
  onToggleFavorite,
  onIndexChange,
  onClose,
  onTagSearch
}: ImageViewerProps): ReactElement | null {
  const post = posts[index];
  const currentSite = post?.site;
  const currentPostId = post?.id;
  const sample = useImageSnapshot(post?.sampleUrl ?? '');
  const original = useImageSnapshot(post?.fileUrl ?? '');
  const [transform, setTransform] = useState<ViewerTransform>(resetViewerTransform);
  const [infoOpen, setInfoOpen] = useState(true);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null);
  const [downloadError, setDownloadError] = useState<{ postId: number; message: string } | null>(
    null
  );
  /** DR-050：当前图片已完成的任务，存在时信息栏改为展示打开文件夹与重新下载 */
  const [downloadedTask, setDownloadedTask] = useState<{
    postId: number;
    taskId: string;
  } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // DR-050：切图时查询该图是否已有完成任务；异步查询避免同步 setState
  useEffect(() => {
    if (currentSite === undefined || currentPostId === undefined) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await window.booru.listDownloads();
          if (!active || !result.ok) return;
          const match = result.data.find(
            (task) =>
              task.site === currentSite &&
              task.postId === currentPostId &&
              task.status === 'done'
          );
          setDownloadedTask(
            match === undefined ? null : { postId: currentPostId, taskId: match.id }
          );
        } catch {
          if (active) setDownloadedTask(null);
        }
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currentSite, currentPostId]);

  // 02 §5.3 / T-23：D 键与信息栏按钮都走同一入队逻辑，结果与进度在信息栏展示
  const handleDownload = useCallback(
    (target: Post, force = false, variant?: DownloadVariant): void => {
      // DR-051：未指定格式时由设置页“批量默认格式”决定，键盘快捷键同样适用
      const source = downloadSource(target, variant ?? 'original');
      setDownloadError(null);
      void (async () => {
        try {
          const result = await window.booru.enqueueDownloads({
            site: target.site,
            posts: [target],
            ...(force ? { force: true } : {}),
            ...(variant !== undefined ? { variant } : {})
          });
          if (!result.ok) {
            setDownloadError({ postId: target.id, message: result.error.message });
            return;
          }
          const taskId = result.data.taskIds[0];
          if (taskId === undefined) {
            setDownloadError({
              postId: target.id,
              // 02 §7.4 / DR-037：md5 或同尺寸文件命中时被跳过，不走失败提示
              message: result.data.skipped > 0 ? '该图片已下载，已跳过' : '下载入队失败'
            });
            return;
          }
          setDownloadNotice({
            postId: target.id,
            taskId,
            status: 'queued',
            bytesDone: 0,
            bytesTotal: source.size,
            error: null
          });
        } catch {
          setDownloadError({ postId: target.id, message: '下载入队失败' });
        }
      })();
    },
    []
  );

  // 03 §7：只订阅当前图片的任务，避免切图时串状态
  useEffect(() => {
    return window.booru.onDownloadProgress((event) => {
      setDownloadNotice((current) => {
        if (current === null || current.taskId !== event.taskId) return current;
        return {
          postId: current.postId,
          taskId: event.taskId,
          status: event.status,
          bytesDone: event.bytesDone,
          bytesTotal: event.bytesTotal,
          error: event.error
        };
      });
      // DR-050：下载完成后当前图片立即切换为“打开所在文件夹”
      if (
        event.status === 'done' &&
        event.site === currentSite &&
        event.postId === currentPostId
      ) {
        setDownloadedTask({ postId: event.postId, taskId: event.taskId });
      }
    });
  }, [currentSite, currentPostId]);

  const handleReveal = useCallback(
    (target: Post): void => {
      const taskId =
        downloadedTask !== null && downloadedTask.postId === target.id
          ? downloadedTask.taskId
          : null;
      if (taskId === null) return;
      setDownloadError(null);
      void (async () => {
        try {
          const result = await window.booru.revealDownload({ taskId });
          if (!result.ok) {
            setDownloadError({ postId: target.id, message: result.error.message });
          }
        } catch {
          setDownloadError({ postId: target.id, message: '无法打开下载文件夹' });
        }
      })();
    },
    [downloadedTask]
  );

  const handleRedownload = useCallback(
    (target: Post, variant?: DownloadVariant): void => {
      handleDownload(target, true, variant);
    },
    [handleDownload]
  );

  const handleDownloadVariant = useCallback(
    (target: Post, variant?: DownloadVariant): void => {
      handleDownload(target, false, variant);
    },
    [handleDownload]
  );

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
        case 'f':
        case 'F':
          if (post === undefined) break;
          event.preventDefault();
          onToggleFavorite(post);
          break;
        case 'd':
        case 'D':
          if (post === undefined) break;
          event.preventDefault();
          // DR-050：已下载的图片按“重新下载”处理，避免直接命中跳过
          handleDownload(post, downloadedTask !== null && downloadedTask.postId === post.id);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    downloadedTask,
    handleDownload,
    index,
    onClose,
    onIndexChange,
    onToggleFavorite,
    post,
    postCount
  ]);

  if (post === undefined) return null;

  const firstTag = post.tags[0]?.name ?? 'post';
  const sampleReady = sample.phase === 'ready' && sample.objectUrl !== null;
  const originalReady = original.phase === 'ready' && original.objectUrl !== null;
  const hasOriginal = post.fileUrl !== '';
  const originalPending =
    hasOriginal && !originalReady && (original.phase === 'idle' || original.phase === 'loading');
  const showLoader = !sampleReady && !originalReady;

  const isDownloaded = downloadedTask !== null && downloadedTask.postId === post.id;
  const activeDownload =
    downloadNotice !== null && downloadNotice.postId === post.id ? downloadNotice : null;
  const downloadRatio = activeDownload === null ? null : downloadProgressRatio(activeDownload);
  const downloadStatus =
    activeDownload === null
      ? null
      : downloadStatusLabel(activeDownload.status, downloadRatio);
  const downloadFailure =
    activeDownload?.status === 'failed'
      ? activeDownload.error
      : downloadError !== null && downloadError.postId === post.id
        ? downloadError.message
        : null;

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

          {infoOpen ? (
            <InfoPanel
              post={post}
              favorited={favorited}
              onToggleFavorite={onToggleFavorite}
              downloadStatus={downloadStatus}
              downloadRatio={downloadRatio}
              downloadFailure={downloadFailure}
              downloaded={isDownloaded}
              onDownload={handleDownloadVariant}
              onReveal={handleReveal}
              onRedownload={handleRedownload}
              onTagSearch={onTagSearch}
            />
          ) : null}
        </div>

        <footer className={styles.hintBar}>
          <span>{Math.round(transform.zoom * 100)}%</span>
          <span>← → 切换</span>
          <span>Space 复位</span>
          <span>+ - 缩放</span>
          <span>F 收藏</span>
          <span>D 下载</span>
          <span>Esc 关闭</span>
        </footer>
      </div>
    </div>
  );
}
