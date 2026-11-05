import type { ReactElement } from 'react';

import styles from './BatchDownloadBar.module.css';

export interface BatchDownloadBarProps {
  selectedCount: number;
  /** 选中项预估体积文案；无选中时应为空 */
  estimateLabel: string;
  busy: boolean;
  onDownloadSelected(): void;
  onClearSelection(): void;
  onExitSelectMode(): void;
}

/**
 * 02 §7.1 / §14.1 / DR-046：多选浮条，`position: fixed` 悬浮在内容之上，
 * 不占据结果页布局空间；只在多选开启时渲染。
 */
export function BatchDownloadBar({
  selectedCount,
  estimateLabel,
  busy,
  onDownloadSelected,
  onClearSelection,
  onExitSelectMode
}: BatchDownloadBarProps): ReactElement {
  const summary =
    selectedCount > 0 ? `已选 ${selectedCount} 张 · 预估 ${estimateLabel}` : '多选已开启，悬停卡片可勾选';

  return (
    <aside className={styles.bar} aria-label="批量下载">
      <p className={styles.summary}>{summary}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onExitSelectMode} disabled={busy}>
          退出多选
        </button>
        {selectedCount > 0 ? (
          <>
            <button type="button" className={styles.ghost} onClick={onClearSelection} disabled={busy}>
              清除选择
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={onDownloadSelected}
              disabled={busy}
            >
              下载选中（{selectedCount}）
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
