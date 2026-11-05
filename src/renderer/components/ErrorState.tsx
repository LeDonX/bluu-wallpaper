import { describeErrorGuidance } from '@shared/error-guidance';
import type { AppError } from '@shared/errors';
import type { ReactElement } from 'react';

export interface ErrorStateProps {
  error: AppError;
  onRetry(): void;
}

/**
 * 02 §2.5：错误卡片展示中文原因、错误码与下一步引导，技术细节折叠（05 §4）。
 * 引导只按 `code` 派生（`shared/error-guidance.ts`），不解析 message（DR-052）。
 */
export function ErrorState({ error, onRetry }: ErrorStateProps): ReactElement {
  return (
    <div className="state-view state-view--error" role="alert">
      <p className="state-view__title">加载失败</p>
      <p className="state-view__description">{error.message}</p>
      <p className="state-view__guidance">{describeErrorGuidance(error)}</p>
      <p className="state-view__code">错误码：{error.code}</p>
      {error.detail === undefined ? null : (
        <details className="state-view__detail">
          <summary>详情</summary>
          <code>{error.detail}</code>
        </details>
      )}
      <button className="button" type="button" onClick={onRetry} disabled={!error.retryable}>
        {error.retryable ? '重试' : '暂不可重试'}
      </button>
    </div>
  );
}
