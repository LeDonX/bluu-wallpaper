import type { ChangeEvent, ReactElement } from 'react';

import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange(checked: boolean): void;
}

/** 02 §14.1 通用 `Switch`：原生 checkbox + 自绘轨道，保证键盘与读屏可用 */
export function Switch({ checked, label, disabled, onChange }: SwitchProps): ReactElement {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked);
  };

  return (
    <label
      className={styles.root}
      data-checked={checked}
      data-disabled={disabled ? 'true' : undefined}
    >
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  );
}
