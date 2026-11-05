import { resolveBadges } from '@shared/badges';
import type { ReactElement } from 'react';

import styles from './BadgeStack.module.css';

export interface BadgeStackProps {
  viewed?: boolean;
  downloaded?: boolean;
  favorited?: boolean;
  /** 外部布局/显隐钩子；只拼接 class，不改角标内容（DR-039） */
  className?: string;
}

/**
 * 02 §6.2 / §14.3：右上角横排状态角标。
 * ↓（T-23）与 ★（T-21）暂无数据源，调用方不传即不渲染；避免出现空角标。
 */
export function BadgeStack({
  viewed,
  downloaded,
  favorited,
  className
}: BadgeStackProps): ReactElement | null {
  const badges = resolveBadges({ viewed, downloaded, favorited });
  if (badges.length === 0) return null;

  return (
    <span className={[styles.stack, className ?? ''].filter(Boolean).join(' ')}>
      {badges.map((badge) => (
        <span
          key={badge.kind}
          className={styles.badge}
          data-badge={badge.kind}
          role="img"
          aria-label={badge.label}
          title={badge.label}
        >
          <span aria-hidden="true">{badge.glyph}</span>
        </span>
      ))}
    </span>
  );
}
