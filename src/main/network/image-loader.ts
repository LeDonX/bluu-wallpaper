import { imageHostSite } from '@shared/constants';
import { createAppError, type Result } from '@shared/errors';
import type { ImageBinary, ImageFetchInput, ImageProgress } from '@shared/ipc-contract';

/** DR-028：单张图最长等待 60s，超过 64MB 中止，避免无上限内存占用 */
export const IMAGE_TIMEOUT_MS = 60_000;
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const PROGRESS_INTERVAL_MS = 100;

export interface ImageTransportResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type ImageTransport = (
  url: string,
  signal: AbortSignal
) => Promise<ImageTransportResponse>;

export interface ImageFetchOptions {
  transport: ImageTransport;
  onProgress?(progress: ImageProgress): void;
  timeoutMs?: number;
  now?(): number;
}

/** 03 §7 / DR-028：只允许 https 与白名单图片域名，防止 IPC 被当作任意代理 */
export function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && imageHostSite(url.hostname) !== null;
  } catch {
    return false;
  }
}

export async function fetchImageBytes(
  input: ImageFetchInput,
  options: ImageFetchOptions
): Promise<Result<ImageBinary>> {
  if (!isAllowedImageUrl(input.url)) {
    return {
      ok: false,
      error: createAppError('CONFIG', '图片地址不受支持', {
        detail: '仅允许 https 且属于已配置图片域名的地址'
      })
    };
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? IMAGE_TIMEOUT_MS;
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let lastReport: number | null = null;
  const now = options.now ?? (() => Date.now());
  const report = (loaded: number, total: number | null, force = false): void => {
    if (options.onProgress === undefined) return;
    const current = now();
    if (!force && lastReport !== null && current - lastReport < PROGRESS_INTERVAL_MS) return;
    lastReport = current;
    options.onProgress({ requestId: input.requestId, loaded, total });
  };

  try {
    const response = await options.transport(input.url, controller.signal);
    if (!response.ok) {
      return {
        ok: false,
        error: createAppError('NETWORK', '图片加载失败，请检查网络后重试', {
          detail: `HTTP ${response.status}`,
          retryable: response.status === 429 || response.status >= 500
        })
      };
    }

    const total = parseContentLength(response.headers.get('content-length'));
    const mimeType = normalizeMimeType(response.headers.get('content-type'));

    if (response.body === null) {
      const buffer = await response.arrayBuffer();
      report(buffer.byteLength, buffer.byteLength, true);
      return { ok: true, data: { mimeType, bytes: buffer } };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;

      loaded += value.byteLength;
      if (loaded > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          error: createAppError('DOWNLOAD', '图片体积超出限制', {
            detail: `> ${MAX_IMAGE_BYTES} bytes`
          })
        };
      }

      chunks.push(value);
      report(loaded, total);
    }

    report(loaded, total, true);
    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { ok: true, data: { mimeType, bytes: bytes.buffer } };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        error: createAppError('TIMEOUT', '图片加载超时，请重试', { detail: `${timeoutMs}ms` })
      };
    }

    return {
      ok: false,
      error: createAppError('NETWORK', '图片加载失败，请检查网络后重试', {
        detail: error instanceof Error ? error.message : String(error)
      })
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseContentLength(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function normalizeMimeType(raw: string | null): string {
  if (raw === null) return 'application/octet-stream';
  const [type] = raw.split(';');
  return type === undefined || type.trim() === '' ? 'application/octet-stream' : type.trim();
}
