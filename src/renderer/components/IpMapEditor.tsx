import type { HostMapEntry } from '@shared/hostmap';
import type { ReactElement } from 'react';

import styles from './IpMapEditor.module.css';

export interface IpMapEditorProps {
  entries: HostMapEntry[];
  disabled?: boolean;
  onChange(entries: HostMapEntry[]): void;
}

/** 02 §9 / §14.1：IP 映射表编辑，仅维护草稿，校验与落盘由设置页/主进程负责 */
export function IpMapEditor({ entries, disabled, onChange }: IpMapEditorProps): ReactElement {
  const update = (index: number, patch: Partial<HostMapEntry>): void => {
    onChange(entries.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));
  };

  const remove = (index: number): void => {
    onChange(entries.filter((_entry, position) => position !== index));
  };

  return (
    <div className={styles.root}>
      <div className={styles.head} aria-hidden="true">
        <span>域名</span>
        <span>IP</span>
        <span />
      </div>
      {entries.map((entry, index) => (
        <div className={styles.row} key={`row-${index}`}>
          <input
            className={styles.input}
            value={entry.host}
            disabled={disabled}
            aria-label={`第 ${index + 1} 条映射的域名`}
            onChange={(event) => {
              update(index, { host: event.target.value });
            }}
          />
          <input
            className={styles.input}
            value={entry.ip}
            disabled={disabled}
            aria-label={`第 ${index + 1} 条映射的 IP`}
            onChange={(event) => {
              update(index, { ip: event.target.value });
            }}
          />
          <button
            type="button"
            className={styles.remove}
            disabled={disabled}
            aria-label={`删除第 ${index + 1} 条映射`}
            onClick={() => {
              remove(index);
            }}
          >
            删除
          </button>
        </div>
      ))}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.add}
          disabled={disabled}
          onClick={() => {
            onChange([...entries, { host: '', ip: '' }]);
          }}
        >
          添加一条
        </button>
      </div>
    </div>
  );
}
