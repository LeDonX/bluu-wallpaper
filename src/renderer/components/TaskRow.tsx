import {
  canApplyAction,
  type DownloadAction,
  downloadProgressRatio,
  downloadStatusLabel,
  type DownloadTask,
  downloadTaskTitle,
  formatByteSize
} from '@shared/downloads';
import type { ReactElement } from 'react';

import { ProgressBar } from './ProgressBar';
import styles from './TaskRow.module.css';

export interface TaskRowProps {
  task: DownloadTask;
  /** 当前行有操作在途时禁用按钮，避免重复提交 */
  busy: boolean;
  onAction(task: DownloadTask, action: DownloadAction): void;
  /** DR-043：打开任务所在文件夹并选中文件 */
  onReveal(task: DownloadTask): void;
  /** DR-044：删除任务（文件存在时由页面询问删文件还是只删记录） */
  onDelete(task: DownloadTask): void;
}

const ACTIONS: { action: DownloadAction; label: string }[] = [
  { action: 'pause', label: '暂停' },
  { action: 'resume', label: '恢复' },
  { action: 'retry', label: '重试' },
  { action: 'cancel', label: '取消' }
];

/** 02 §14.1 / T-26：单条下载任务，进度条 + 状态 + 暂停/恢复/重试/取消 */
export function TaskRow({ task, busy, onAction, onReveal, onDelete }: TaskRowProps): ReactElement {
  const ratio = downloadProgressRatio(task);
  const statusLabel = downloadStatusLabel(task.status, ratio);
  const sizeLabel =
    task.bytesTotal > 0
      ? `${formatByteSize(task.bytesDone)} / ${formatByteSize(task.bytesTotal)}`
      : formatByteSize(task.bytesDone);

  return (
    <article className={styles.row} data-status={task.status}>
      <div className={styles.header}>
        <p className={styles.title} title={task.destPath}>
          {downloadTaskTitle(task)}
        </p>
        <p className={styles.status}>{statusLabel}</p>
      </div>

      <ProgressBar ratio={ratio} label={`${downloadTaskTitle(task)} 下载进度`} />

      <div className={styles.footer}>
        <span className={styles.meta}>
          {task.site} · #{task.postId} · {sizeLabel}
        </span>
        <span className={styles.actions}>
          <button
            type="button"
            className={styles.actionButton}
            data-action="reveal"
            title={task.destPath}
            onClick={() => onReveal(task)}
          >
            打开所在文件夹
          </button>
          {ACTIONS.filter((item) => canApplyAction(task.status, item.action)).map((item) => (
            <button
              key={item.action}
              type="button"
              className={styles.actionButton}
              data-action={item.action}
              disabled={busy}
              onClick={() => onAction(task, item.action)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.actionButton}
            data-action="delete"
            disabled={busy}
            onClick={() => onDelete(task)}
          >
            删除
          </button>
        </span>
      </div>

      {task.error !== null ? (
        <p className={styles.error} role="alert">
          {task.error}
        </p>
      ) : null}
    </article>
  );
}
