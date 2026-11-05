/** 07 DR-066 / T-35：自动更新状态机与渲染层共用的纯类型与辅助函数 */

export const UPDATE_PHASES = [
  'idle',
  'checking',
  'not-available',
  'available',
  'downloading',
  'downloaded',
  'error',
  /** 未打包的开发模式或便携版：没有安装器上下文，不提供自动更新 */
  'unsupported'
] as const;

export type UpdatePhase = (typeof UPDATE_PHASES)[number];

export interface UpdateProgress {
  /** 0–100，来自 electron-updater，越界时截断 */
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

/** 主进程维护的更新状态；每次变化通过 `updates:status` 全量广播 */
export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  /** 可下载 / 下载中 / 已下载的新版本号 */
  version: string | null;
  releaseNotes: string | null;
  progress: UpdateProgress | null;
  /** 面向用户的说明文案（失败原因或不支持的原因） */
  message: string | null;
  /** 技术细节，仅用于排障，界面不直接展示 */
  detail: string | null;
  /** 最近一次检查完成的时间（epoch ms）；未检查过为 null */
  checkedAt: number | null;
}

export interface UpdateProgressInput {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateInfoInput {
  version: string;
  releaseNotes?: string | Array<{ version: string; note: string | null }> | null;
}

export function initialUpdateState(currentVersion: string): UpdateState {
  return {
    phase: 'idle',
    currentVersion,
    version: null,
    releaseNotes: null,
    progress: null,
    message: null,
    detail: null,
    checkedAt: null
  };
}

/** electron-updater 的 percent 是 0–100 浮点，异常值统一截断后再给界面 */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function normalizeProgress(input: UpdateProgressInput): UpdateProgress {
  const total = Number.isFinite(input.total) && input.total > 0 ? input.total : 0;
  const transferred = Number.isFinite(input.transferred) && input.transferred > 0
    ? Math.min(input.transferred, total > 0 ? total : input.transferred)
    : 0;
  return {
    percent: clampPercent(input.percent),
    transferred,
    total,
    bytesPerSecond: Number.isFinite(input.bytesPerSecond) && input.bytesPerSecond > 0
      ? input.bytesPerSecond
      : 0
  };
}

/** GitHub 渠道的 releaseNotes 可能是字符串或多版本数组，统一成可读文本 */
export function normalizeReleaseNotes(
  notes: UpdateInfoInput['releaseNotes']
): string | null {
  if (typeof notes === 'string') {
    const trimmed = notes.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (!Array.isArray(notes)) return null;
  const lines = notes
    .map((entry) => {
      const note = (entry.note ?? '').trim();
      return note === '' ? entry.version : `${entry.version}: ${note}`;
    })
    .filter((line) => line !== '');
  return lines.length === 0 ? null : lines.join('\n');
}
