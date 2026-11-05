import { createAppError, type Result } from '@shared/errors';
import {
  initialUpdateState,
  normalizeProgress,
  normalizeReleaseNotes,
  type UpdateInfoInput,
  type UpdateProgressInput,
  type UpdateState
} from '@shared/updates';

/** 07 DR-066：只依赖 electron-updater 实际用到的方法，便于单测注入假实现 */
export interface UpdateUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'checking-for-update', listener: () => void): void;
  on(event: 'update-available', listener: (info: UpdateInfoInput) => void): void;
  on(event: 'update-not-available', listener: (info: UpdateInfoInput) => void): void;
  on(event: 'update-downloaded', listener: (info: UpdateInfoInput) => void): void;
  on(event: 'download-progress', listener: (progress: UpdateProgressInput) => void): void;
}

export interface UpdateServiceOptions {
  updater: UpdateUpdater;
  currentVersion: string;
  isPackaged: boolean;
  isPortable: boolean;
  /** 状态变化回调；主进程据此向所有窗口广播 `updates:status` */
  onStateChange?: (state: UpdateState) => void;
  now?: () => number;
}

export interface UpdateService {
  getState(): UpdateState;
  check(): Promise<Result<UpdateState>>;
  download(): Promise<Result<UpdateState>>;
  install(): Result<null>;
}

const CHECK_FAILED = '检查更新失败，请稍后重试';
const DOWNLOAD_FAILED = '下载更新失败，请稍后重试';

/**
 * 03 §7 / DR-066：自动更新状态机。
 * 只支持 NSIS 安装版；开发模式与便携版返回 `unsupported`，不抛错。
 */
export function createUpdateService(options: UpdateServiceOptions): UpdateService {
  const { updater } = options;
  const now = options.now ?? (() => Date.now());
  const unsupportedReason = !options.isPackaged
    ? '开发模式不支持自动更新，请在安装版中使用'
    : options.isPortable
      ? '便携版不支持自动更新，请使用安装版'
      : null;

  let state: UpdateState = initialUpdateState(options.currentVersion);
  if (unsupportedReason !== null) {
    state = { ...state, phase: 'unsupported', message: unsupportedReason };
  }

  const emit = (): void => {
    options.onStateChange?.(state);
  };

  const patch = (next: Partial<UpdateState>): void => {
    state = { ...state, ...next };
    emit();
  };

  // patch 通过闭包改写 state，读取当前值走函数可避免 TS 保留旧的类型收窄
  const current = (): UpdateState => state;

  const failureDetail = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  // 下载由用户手动触发；退出时若已下载则自动安装，避免"已下载但未安装"的悬置状态
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;

  updater.on('checking-for-update', () => {
    patch({ phase: 'checking', message: null, detail: null, progress: null });
  });

  updater.on('update-available', (info) => {
    patch({
      phase: 'available',
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      progress: null,
      message: null,
      detail: null,
      checkedAt: now()
    });
  });

  updater.on('update-not-available', () => {
    patch({
      phase: 'not-available',
      version: null,
      releaseNotes: null,
      progress: null,
      message: null,
      detail: null,
      checkedAt: now()
    });
  });

  updater.on('download-progress', (progress) => {
    patch({
      phase: 'downloading',
      progress: normalizeProgress(progress),
      message: null,
      detail: null
    });
  });

  updater.on('update-downloaded', (info) => {
    patch({
      phase: 'downloaded',
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      progress:
        state.progress === null ? null : { ...state.progress, percent: 100, bytesPerSecond: 0 },
      message: null,
      detail: null
    });
  });

  updater.on('error', (error) => {
    const downloading = state.phase === 'downloading';
    patch({
      phase: 'error',
      message: downloading ? DOWNLOAD_FAILED : CHECK_FAILED,
      detail: failureDetail(error),
      progress: null,
      ...(downloading ? {} : { checkedAt: now() })
    });
  });

  return {
    getState: () => state,

    check: async () => {
      if (state.phase === 'unsupported') return { ok: true, data: state };
      // 检查或下载进行中再次点击不应并发发起第二个请求
      if (state.phase === 'checking' || state.phase === 'downloading') {
        return { ok: true, data: state };
      }
      patch({
        phase: 'checking',
        version: null,
        releaseNotes: null,
        progress: null,
        message: null,
        detail: null
      });
      try {
        await updater.checkForUpdates();
        // 正常情况下事件已驱动状态；若无事件则显式失败，避免界面卡在"正在检查"
        if (current().phase === 'checking') {
          patch({ phase: 'error', message: CHECK_FAILED, checkedAt: now() });
        }
      } catch (error) {
        patch({
          phase: 'error',
          message: CHECK_FAILED,
          detail: failureDetail(error),
          progress: null,
          checkedAt: now()
        });
      }
      return { ok: true, data: state };
    },

    download: async () => {
      if (state.phase === 'unsupported') return { ok: true, data: state };
      if (state.phase === 'downloading') return { ok: true, data: state };
      if (state.phase !== 'available') {
        return {
          ok: false,
          error: createAppError('CONFIG', '当前没有可下载的更新')
        };
      }
      patch({ phase: 'downloading', progress: null, message: null, detail: null });
      try {
        await updater.downloadUpdate();
        if (current().phase === 'downloading') {
          patch({ phase: 'error', message: DOWNLOAD_FAILED, progress: null });
        }
      } catch (error) {
        patch({
          phase: 'error',
          message: DOWNLOAD_FAILED,
          detail: failureDetail(error),
          progress: null
        });
      }
      return { ok: true, data: state };
    },

    install: () => {
      if (state.phase !== 'downloaded') {
        return { ok: false, error: createAppError('CONFIG', '更新尚未下载完成') };
      }
      updater.quitAndInstall(false, true);
      return { ok: true, data: null };
    }
  };
}
