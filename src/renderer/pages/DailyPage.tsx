import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { ImageViewer } from '@renderer/components/ImageViewer';
import type { AppError } from '@shared/errors';
import { createAppError } from '@shared/errors';
import type { Post } from '@shared/models';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './DailyPage.module.css';

/** DR-076：Bing 是当前唯一具备 daily 能力的站点 */
const DAILY_SITE = 'bing' as const;

/** 卡片日期文案；createdAt 已按本地零点归一化，直接按本地时区格式化 */
export function formatDailyDate(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export interface DailyPageProps {
  /** 页面常驻挂载（App 用 hidden 切换），首次激活时才请求，避免启动即发网络请求 */
  active: boolean;
}

/**
 * 02 §4 / T-52：每日壁纸独立页，固定展示 Bing 最近 8 天壁纸（日期倒序）。
 * 不占用搜索页；点击卡片打开统一查看器，查看与下载能力沿查看器复用。
 */
export function DailyPage({ active }: DailyPageProps): ReactElement {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<number>>(() => new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const loadedRef = useRef(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const result = await window.booru.listDaily({ site: DAILY_SITE });
      if (requestSeq.current !== seq) return;
      if (!result.ok) {
        setError(result.error);
        setPosts([]);
        return;
      }
      setPosts(result.data.posts);
    } catch {
      if (requestSeq.current !== seq) return;
      setError(createAppError('NETWORK', '每日壁纸加载失败，请检查网络后重试'));
      setPosts([]);
    } finally {
      if (requestSeq.current === seq) setLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async (): Promise<void> => {
    try {
      const result = await window.booru.listFavorites({ site: DAILY_SITE });
      if (!result.ok) return;
      setFavoriteIds(new Set(result.data.posts.map((post) => post.id)));
    } catch {
      // 收藏状态只影响按钮高亮，读取失败不阻断每日壁纸展示
    }
  }, []);

  useEffect(() => {
    if (!active || loadedRef.current) return;
    loadedRef.current = true;
    void load();
    void loadFavorites();
  }, [active, load, loadFavorites]);

  const toggleFavorite = useCallback((post: Post): void => {
    void (async () => {
      try {
        const result = await window.booru.toggleFavorite({ site: post.site, post });
        if (!result.ok) {
          setActionError(result.error.message);
          return;
        }
        setFavoriteIds((previous) => {
          const next = new Set(previous);
          if (result.data.favorited) next.add(post.id);
          else next.delete(post.id);
          return next;
        });
      } catch {
        setActionError('收藏操作失败，请稍后重试');
      }
    })();
  }, []);

  const current = viewerIndex !== null ? posts[viewerIndex] : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>每日壁纸</h1>
          <p className={styles.subtitle}>Bing 每日壁纸 · 最近 8 天，按日期倒序</p>
        </div>
      </header>

      {actionError !== null ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      <div className={styles.content}>
        {error !== null ? (
          <ErrorState
            error={error}
            onRetry={() => {
              void load();
            }}
          />
        ) : loading && posts.length === 0 ? (
          <div className="state-view">
            <p className="state-view__description">正在加载每日壁纸…</p>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState title="暂时没有每日壁纸" description="稍后重试，或检查网络连接。" />
        ) : (
          <div className={styles.grid}>
            {posts.map((post) => {
              const date = formatDailyDate(post.createdAt);
              return (
                <article key={`${post.site}-${post.id}`} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardOpen}
                    aria-label={`查看 ${date} 的每日壁纸`}
                    onClick={() => {
                      setViewerIndex(posts.indexOf(post));
                    }}
                  >
                    <span className={styles.cardImage}>
                      <img
                        src={post.previewUrl}
                        alt={`${date} 每日壁纸`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </span>
                  </button>
                  <div className={styles.cardMeta}>
                    <p className={styles.cardDate}>{date}</p>
                    {post.source === undefined ? null : (
                      <p className={styles.cardCopyright} title={post.source}>
                        {post.source}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {current === undefined ? null : (
        <ImageViewer
          posts={posts}
          index={viewerIndex ?? 0}
          favorited={favoriteIds.has(current.id)}
          onToggleFavorite={toggleFavorite}
          onIndexChange={(index) => {
            setViewerIndex(index);
          }}
          onClose={() => {
            setViewerIndex(null);
          }}
          onTagSearch={() => {
            // Bing 壁纸没有标签体系，查看器内的标签搜索入口保持惰性
          }}
        />
      )}
    </div>
  );
}
