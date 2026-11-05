import type { DownloadAction, DownloadTask } from '@shared/downloads';
import type { ReactElement } from 'react';

import styles from './TaskList.module.css';
import { TaskRow } from './TaskRow';

export interface TaskListProps {
  tasks: DownloadTask[];
  busyId: string | null;
  onAction(task: DownloadTask, action: DownloadAction): void;
  onReveal(task: DownloadTask): void;
  onDelete(task: DownloadTask): void;
}

/** 02 §14.1 / T-26：任务列表容器，只负责滚动与渲染，不轮询（进度由事件推送） */
export function TaskList({
  tasks,
  busyId,
  onAction,
  onReveal,
  onDelete
}: TaskListProps): ReactElement {
  return (
    <div className={styles.list}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          busy={busyId === task.id}
          onAction={onAction}
          onReveal={onReveal}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
