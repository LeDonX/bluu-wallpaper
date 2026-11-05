import type { ReactElement, ReactNode } from 'react';

import styles from './SettingsSection.module.css';

export interface SettingsSectionProps {
  /** h2 的 id，供 aria-labelledby 关联 */
  id: string;
  title: string;
  children: ReactNode;
}

/** 02 §14.1 设置分组：统一标题、边框与间距，不承载业务逻辑 */
export function SettingsSection({ id, title, children }: SettingsSectionProps): ReactElement {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {children}
    </section>
  );
}
