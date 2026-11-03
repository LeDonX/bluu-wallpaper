import type { ErrorCode } from '@shared/constants';

/** 05 §4 的统一错误模型：主进程内部使用，IPC 层只透传该结构 */
export interface AppError {
  code: ErrorCode;
  message: string;
  detail?: string;
  retryable: boolean;
  cause?: unknown;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface AppErrorOptions {
  retryable?: boolean;
  detail?: string;
  cause?: unknown;
}

/** 各错误码的默认重试语义，调用方可按场景覆盖 */
const DEFAULT_RETRYABLE: Record<ErrorCode, boolean> = {
  NETWORK: true,
  TIMEOUT: true,
  RATE_LIMITED: true,
  CF_CHALLENGE: false,
  NOT_FOUND: false,
  SERVER: true,
  PARSE: false,
  DB: false,
  DOWNLOAD: true,
  CONFIG: false
};

export function createAppError(
  code: ErrorCode,
  message: string,
  options: AppErrorOptions = {}
): AppError {
  const error: AppError = {
    code,
    message,
    retryable: options.retryable ?? DEFAULT_RETRYABLE[code]
  };
  if (options.detail !== undefined) error.detail = options.detail;
  if (options.cause !== undefined) error.cause = options.cause;
  return error;
}

/**
 * 主进程内部允许抛 AppErrorException 表示"已分类的失败"，
 * 网络层在统一入口转成 Result 信封，避免上层解析错误文案。
 */
export class AppErrorException extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'AppErrorException';
    this.appError = appError;
  }
}

/** 未分类异常一律视为 NETWORK，保证失败路径不静默、可重试 */
export function toAppError(error: unknown, fallbackCode: ErrorCode = 'NETWORK'): AppError {
  if (error instanceof AppErrorException) return error.appError;
  const detail = error instanceof Error ? error.message : String(error);
  return createAppError(fallbackCode, '网络请求失败，请检查网络连接后重试', { detail });
}
