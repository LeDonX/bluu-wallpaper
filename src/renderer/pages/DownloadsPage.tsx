import { ConfirmDialog } from '@renderer/components/ConfirmDialog';
import { EmptyState } from '@renderer/components/EmptyState';
import { ErrorState } from '@renderer/components/ErrorState';
import { TaskList } from '@renderer/components/TaskList';
import {
  applyDownloadProgress,
  type DownloadAction,
  type DownloadTask,
  downloadTaskTitle
} from '@shared/downloads';
import { type AppError, createAppError } from '@shared/errors';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './DownloadsPage.module.css';

/** 02 §7 / T-26：下载任务列表。数据来自 `downloads:list`，增量更新靠 `downloads:progress` */
export function DownloadsPage(): ReactElement {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<DownloadTask | null>(null);
  const [clearPrompt, setClearPrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reloadTimer = useRef<number | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await window.booru.listDownloads();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTasks(result.data);
      setError(null);
    } catch {
      // 本地任务表读取异常：保留重试入口（DR-052）
      setError(createAppError('DB', '下载任务读取失败', { retryable: true }));
    } finally {
      setLoading(false);
    }
  }, []);

  // 未知任务的 queued 事件说明本地列表还没拉到它，合并一次列表（150ms 去抖）
  const scheduleReload = useCallback((): void => {
    if (reloadTimer.current !== null) return;
    reloadTimer.current = window.setTimeout(() => {
      reloadTimer.current = null;
      void load();
    }, 150);
  }, [load]);

  useEffect(() => {
    // 首次读取放到下一个 tick，避免在 effect 同步阶段触发 setState（React 19 规则）
    const initialTimer = window.setTimeout(() => {
      void load();
    }, 0);
    const unsubscribe = window.booru.onDownloadProgress((event) => {
      // queued 可能来自初始列表尚未覆盖到的任务，去抖补拉一次完整列表
      if (event.status === 'queued') scheduleReload();
      setTasks((current) => applyDownloadProgress(current, event));
    });
    return () => {
      window.clearTimeout(initialTimer);
      unsubscribe();
      if (reloadTimer.current !== null) {
        window.clearTimeout(reloadTimer.current);
        reloadTimer.current = null;
      }
    };
  }, [load, scheduleReload]);

  const handleAction = useCallback((task: DownloadTask, action: DownloadAction): void => {
    setBusyId(task.id);
    setActionError(null);
    void (async () => {
      try {
        const result = await window.booru.controlDownload({ taskId: task.id, action });
        if (!result.ok) {
          setActionError(result.error.message);
          return;
        }
        if (result.data.status === null) {
          setTasks((current) => current.filter((item) => item.id !== task.id));
        } else {
          const status = result.data.status;
          setTasks((current) =>
            current.map((item) => (item.id === task.id ? { ...item, status } : item))
          );
        }
      } catch {
        setActionError('下载操作失败，请重试');
      } finally {
        setBusyId(null);
      }
    })();
  }, []);

  // DR-043：打开任务所在文件夹；主进程按最终文件 / `.part` / 目录依次尝试
  const handleReveal = useCallback((task: DownloadTask): void => {
    setActionError(null);
    void (async () => {
      try {
        const result = await window.booru.revealDownload({ taskId: task.id });
        if (!result.ok) setActionError(result.error.message);
      } catch {
        setActionError('无法打开下载文件夹');
      }
    })();
  }, []);

  // DR-044：先检查文件是否存在；不存在直接删记录，存在则弹窗询问
  const handleDelete = useCallback((task: DownloadTask): void => {
    setBusyId(task.id);
    setActionError(null);
    void (async () => {
      try {
        const result = await window.booru.deleteDownload({ taskId: task.id });
        if (!result.ok) {
          setActionError(result.error.message);
          return;
        }
        if (result.data.removed) {
          setTasks((current) => current.filter((item) => item.id !== task.id));
        } else {
          setDeletePrompt(task);
        }
      } catch {
        setActionError('删除任务失败，请重试');
      } finally {
        setBusyId(null);
      }
    })();
  }, []);

  const finishDelete = useCallback((task: DownloadTask, deleteFile: boolean): void => {
    setDeleting(true);
    setActionError(null);
    void (async () => {
      try {
        const result = await window.booru.deleteDownload({ taskId: task.id, deleteFile });
        if (!result.ok) {
          setActionError(result.error.message);
          return;
        }
        setTasks((current) => current.filter((item) => item.id !== task.id));
        setDeletePrompt(null);
      } catch {
        setActionError('删除任务失败，请重试');
      } finally {
        setDeleting(false);
      }
    })();
  }, []);

  const finishClear = useCallback((): void => {
    setDeleting(true);
    setActionError(null);
    void (async () => {
      try {
        const result = await window.booru.clearDownloads();
        if (!result.ok) {
          setActionError(result.error.message);
          return;
        }
        setTasks([]);
      } catch {
        setActionError('清空任务失败，请重试');
      } finally {
        setDeleting(false);
        setClearPrompt(false);
      }
    })();
  }, []);

  const activeCount = tasks.filter((task) => task.status === 'downloading').length;
  const queuedCount = tasks.filter((task) => task.status === 'queued').length;
  const pausedCount = tasks.filter((task) => task.status === 'paused').length;
  const failedCount = tasks.filter((task) => task.status === 'failed').length;
  const orderedTasks = [...tasks].reverse();

  return (
    <section className={styles.page} aria-label="下载">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>下载</h1>
          <p className={styles.summary}>
            共 {tasks.length} 项 · 进行中 {activeCount + queuedCount} · 已暂停 {pausedCount} · 失败{' '}
            {failedCount}
          </p>
        </div>
        <button
          type="button"
          className={styles.clearButton}
          disabled={loading || deleting || tasks.length === 0}
          onClick={() => setClearPrompt(true)}
        >
          清空任务列表
        </button>
      </header>

      {error !== null && orderedTasks.length === 0 ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void load();
          }}
        />
      ) : error !== null ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}
      {actionError !== null ? (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.hint}>正在读取下载任务…</p>
      ) : orderedTasks.length === 0 ? (
        // 读取失败时上方已渲染 ErrorState，避免同时出现"暂无任务"的空态（DR-052）
        error === null ? (
          <EmptyState
            title="暂无下载任务"
            description="在图片详情中按 D 或点击“下载”，任务会出现在这里，可暂停、恢复或取消。"
          />
        ) : null
      ) : (
        <TaskList
          tasks={orderedTasks}
          busyId={busyId}
          onAction={handleAction}
          onReveal={handleReveal}
          onDelete={handleDelete}
        />
      )}

      {deletePrompt !== null ? (
        <ConfirmDialog
          title="删除任务"
          confirmLabel="删除文件和记录"
          secondaryLabel="仅删除记录"
          busy={deleting}
          onConfirm={() => finishDelete(deletePrompt, true)}
          onSecondary={() => finishDelete(deletePrompt, false)}
          onCancel={() => setDeletePrompt(null)}
        >
          <p>「{downloadTaskTitle(deletePrompt)}」的本地文件已存在。</p>
          <p>要同时删除已下载的文件，还是只删除任务记录？</p>
        </ConfirmDialog>
      ) : null}

      {clearPrompt ? (
        <ConfirmDialog
          title="清空任务列表"
          confirmLabel="清空记录"
          busy={deleting}
          onConfirm={finishClear}
          onCancel={() => setClearPrompt(false)}
        >
          <p>将删除全部 {tasks.length} 条任务记录。</p>
          <p>已下载的文件会保留，未完成的分片会被清理。</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
