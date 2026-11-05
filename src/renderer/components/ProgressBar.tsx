import type { ReactElement } from 'react';

import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  /** 0–1；null 表示总量未知，显示不定进度 */
  ratio: number | null;
  label: string;
}

/** 02 §14.1 / T-26：下载任务与查看器共用的进度条，不定进度用循环高光表示 */
export function ProgressBar({ ratio, label }: ProgressBarProps): ReactElement {
  const percent = ratio === null ? null : Math.round(ratio * 100);
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      data-indeterminate={percent === null ? 'true' : undefined}
    >
      <div
        className={styles.fill}
        data-indeterminate={percent === null ? 'true' : undefined}
        style={percent === null ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
