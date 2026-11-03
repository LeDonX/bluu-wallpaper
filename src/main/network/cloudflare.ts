import { getSession } from '@main/network/sessions';
import { CF_CLEARANCE_COOKIE, type CfStatus, isChallengeResponse } from '@shared/cf';
import type { SiteId } from '@shared/constants';
import { sessionPartition } from '@shared/sessions';
import { app, BrowserWindow } from 'electron';

const DEFAULT_CLEARANCE_TIMEOUT_MS = 25_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;

export interface CfChannelOptions {
  site: SiteId;
  baseUrl: string;
  clearanceTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export interface CfResponse {
  status: number;
  contentType: string;
  body: string;
}

export interface CfChannel {
  readonly site: SiteId;
  getStatus(): CfStatus;
  /** 幂等：已有 cf_clearance 直接返回；并发调用共享同一次获取流程 */
  ensureClearance(): Promise<void>;
  /** 在隐藏窗口的页面上下文发起请求，串行执行（DR-010） */
  fetchText(path: string): Promise<CfResponse>;
  destroy(): void;
}

interface WindowFetchResult {
  status: number;
  contentType: string;
  body: string;
}

const isWindowFetchResult = (value: unknown): value is WindowFetchResult => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.status === 'number' &&
    typeof record.contentType === 'string' &&
    typeof record.body === 'string'
  );
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * konachan 的 CF 通道：隐藏窗口过挑战 + 页面上下文 fetch（DR-010）。
 * 不覆盖 UA：Electron 默认 UA 才与 Client Hints 一致（DR-011）。
 */
export function createCfChannel(options: CfChannelOptions): CfChannel {
  const partition = sessionPartition(options.site);
  const ses = getSession(options.site);
  const clearanceTimeoutMs = options.clearanceTimeoutMs ?? DEFAULT_CLEARANCE_TIMEOUT_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  let status: CfStatus = 'idle';
  let acquiring: Promise<void> | null = null;
  let win: BrowserWindow | null = null;
  let pageReady = false;
  let queue: Promise<unknown> = Promise.resolve();

  const ensureWindow = (): BrowserWindow => {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      show: false,
      width: 1000,
      height: 800,
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // 后台窗口仍需执行挑战脚本与 fetch
        backgroundThrottling: false
      }
    });
    win.on('closed', () => {
      win = null;
      pageReady = false;
    });
    return win;
  };

  const pollClearance = async (): Promise<boolean> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < clearanceTimeoutMs) {
      const cookies = await ses.cookies.get({ name: CF_CLEARANCE_COOKIE });
      if (cookies.length > 0) return true;
      await sleep(POLL_INTERVAL_MS);
    }
    return false;
  };

  const loadChallengePage = async (): Promise<void> => {
    const target = ensureWindow();
    try {
      await withTimeout(target.loadURL(options.baseUrl), requestTimeoutMs, 'CF 挑战页加载超时');
    } catch {
      // 403 挑战页也会触发 loadURL 失败，继续轮询 cookie 即可
    }
    const url = target.isDestroyed() ? '' : target.webContents.getURL();
    // 空白页没有站点源，页面内 fetch 会被 CORS 拦截
    pageReady = url !== '' && !url.startsWith('about:');
  };

  /**
   * 复用已有 clearance 时窗口可能从未加载过站点页，必须补一次加载，
   * 否则页面内 fetch 处于 about:blank 源上会跨源失败。
   */
  const ensurePage = async (): Promise<void> => {
    if (pageReady) return;
    await loadChallengePage();
  };

  const acquire = async (): Promise<void> => {
    const existing = await ses.cookies.get({ name: CF_CLEARANCE_COOKIE });
    if (existing.length > 0) {
      status = 'ready';
      return;
    }

    status = 'acquiring';
    await loadChallengePage();
    if (!(await pollClearance())) {
      status = 'failed';
      throw new Error('CF 挑战未完成：未取得 cf_clearance');
    }
    status = 'ready';
  };

  const ensureClearance = (): Promise<void> => {
    if (!acquiring) {
      acquiring = acquire().finally(() => {
        acquiring = null;
      });
    }
    return acquiring;
  };

  const requestInWindow = async (url: string): Promise<WindowFetchResult> => {
    const target = ensureWindow();
    const script = `fetch(${JSON.stringify(url)}, {
      headers: { Accept: 'application/json' },
      credentials: 'include'
    }).then(async (response) => ({
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      body: await response.text()
    }))`;
    const raw: unknown = await withTimeout(
      target.webContents.executeJavaScript(script, true),
      requestTimeoutMs,
      '窗口请求超时'
    );
    if (!isWindowFetchResult(raw)) throw new Error('窗口请求返回了无法识别的结构');
    return raw;
  };

  const doFetch = async (path: string): Promise<CfResponse> => {
    await ensureClearance();
    await ensurePage();
    const url = new URL(path, options.baseUrl).toString();
    let result = await requestInWindow(url);

    if (isChallengeResponse(result.status, result.body)) {
      // clearance 被站点作废：清 cookie 后重新过一次挑战
      await ses.cookies.remove(options.baseUrl, CF_CLEARANCE_COOKIE).catch(() => undefined);
      status = 'acquiring';
      await loadChallengePage();
      if (!(await pollClearance())) {
        status = 'failed';
        throw new Error('CF 重新验证失败');
      }
      status = 'ready';
      result = await requestInWindow(url);
    }

    if (isChallengeResponse(result.status, result.body)) {
      status = 'failed';
      throw new Error('CF 挑战未通过：站点仍返回挑战页');
    }
    return result;
  };

  const fetchText = (path: string): Promise<CfResponse> => {
    // 串行化：同一窗口内的并发 fetch 会互相干扰挑战脚本
    const task = queue.then(() => doFetch(path));
    queue = task.catch(() => undefined);
    return task;
  };

  const destroy = (): void => {
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
    status = 'idle';
  };

  app.on('will-quit', destroy);

  return {
    site: options.site,
    getStatus: () => status,
    ensureClearance,
    fetchText,
    destroy
  };
}
