import { formatFileSize, progressPercent } from '@shared/viewer';
import type { ReactElement } from 'react';

import styles from './ImageProgress.module.css';

export interface ImageProgressProps {
  label: string;
  loaded: number;
  total: number | null;
  /** Content-Length 缺失时用站点元数据兜底，仍缺失则展示不确定进度 */
  totalFallback?: number | null;
  tone?: 'default' | 'danger';
  /** 关闭文本说明，只保留进度条（查看器中心的预览进度） */
  showText?: boolean;
}

/** 02 §5.1 / DR-028：字节级进度；无总长时退化为不确定进度条 */
export function ImageProgress({
  label,
  loaded,
  total,
  totalFallback = null,
  tone = 'default',
  showText = true
}: ImageProgressProps): ReactElement {
  const effectiveTotal = total ?? totalFallback;
  const percent = progressPercent(loaded, effectiveTotal);

  return (
    <div
      className={styles.progress}
      data-tone={tone}
      data-indeterminate={percent === null}
      data-textless={!showText}
    >
      {showText ? (
        <div className={styles.progressHead}>
          <span className={styles.progressLabel}>
            {label}
            {percent !== null ? ` ${percent}%` : ''}
          </span>
          <span className={styles.progressBytes}>
            {percent !== null && effectiveTotal !== null
              ? `${formatFileSize(loaded)} / ${formatFileSize(effectiveTotal)}`
              : `已加载 ${formatFileSize(loaded)}`}
          </span>
        </div>
      ) : null}
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={percent === null ? undefined : 100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? `已加载 ${formatFileSize(loaded)}` : undefined}
      >
        <span
          className={styles.progressFill}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
