import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';

import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 可选的中立操作，例如“仅删除记录”（DR-044） */
  secondaryLabel?: string;
  /** 提交在途时禁用按钮，避免重复入队 */
  busy?: boolean;
  children?: ReactNode;
  onConfirm(): void;
  onSecondary?(): void;
  onCancel(): void;
}

/** 02 §14.1：基础确认弹窗；Esc 关闭，确认按钮默认聚焦 */
export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel = '取消',
  secondaryLabel,
  busy = false,
  children,
  onConfirm,
  onSecondary,
  onCancel
}: ConfirmDialogProps): ReactElement {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
      >
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        <div id="confirm-dialog-body" className={styles.body}>
          {children}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          {secondaryLabel !== undefined && onSecondary !== undefined ? (
            <button
              type="button"
              className={styles.cancel}
              onClick={onSecondary}
              disabled={busy}
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? '提交中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
