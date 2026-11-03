import type { ReactElement, ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/** 02 §2.5 / §11：空态给出原因与下一步动作 */
export function EmptyState({ title, description, children }: EmptyStateProps): ReactElement {
  return (
    <div className="state-view">
      <p className="state-view__title">{title}</p>
      <p className="state-view__description">{description}</p>
      {children}
    </div>
  );
}
