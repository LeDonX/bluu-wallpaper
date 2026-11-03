import type { AppError } from '@shared/errors';
import type { BooruApi, ImageProgress } from '@shared/ipc-contract';

export type ImagePhase = 'idle' | 'loading' | 'ready' | 'error';

export interface ImageSnapshot {
  phase: ImagePhase;
  loaded: number;
  total: number | null;
  objectUrl: string | null;
  error: AppError | null;
}

interface ImageEntry {
  snapshot: ImageSnapshot;
  requestId: string | null;
  usedAt: number;
  listeners: Set<() => void>;
}

export interface ImageStoreOptions {
  api: Pick<BooruApi, 'loadImage' | 'onImageProgress'>;
  maxEntries?: number;
  createObjectUrl?(blob: Blob): string;
  revokeObjectUrl?(url: string): void;
}

export interface ImageStore {
  subscribe(url: string, listener: () => void): () => void;
  getSnapshot(url: string): ImageSnapshot;
  load(url: string): void;
  clear(): void;
}

const IDLE_SNAPSHOT: ImageSnapshot = Object.freeze({
  phase: 'idle',
  loaded: 0,
  total: null,
  objectUrl: null,
  error: null
});

/**
 * DR-028：查看器图片状态机。字节进度由主进程事件驱动，
 * 完成后生成 blob URL；最多保留 maxEntries 张（默认 3，02 §14.1）。
 * 工厂注入 API 便于离线单测。
 */
export function createImageStore(options: ImageStoreOptions): ImageStore {
  const maxEntries = options.maxEntries ?? 3;
  const createObjectUrl =
    options.createObjectUrl ?? ((blob: Blob): string => URL.createObjectURL(blob));
  const revokeObjectUrl =
    options.revokeObjectUrl ??
    ((url: string): void => {
      URL.revokeObjectURL(url);
    });

  const entries = new Map<string, ImageEntry>();
  const requests = new Map<string, string>();
  let sequence = 0;
  let subscribed = false;
  let disposeProgress: (() => void) | null = null;

  const notify = (entry: ImageEntry): void => {
    for (const listener of [...entry.listeners]) listener();
  };

  const touch = (entry: ImageEntry): void => {
    sequence += 1;
    entry.usedAt = sequence;
  };

  const evict = (): void => {
    const candidates = [...entries.entries()]
      .filter(([, entry]) => entry.listeners.size === 0 && entry.snapshot.objectUrl !== null)
      .sort((left, right) => left[1].usedAt - right[1].usedAt);

    while (entries.size > maxEntries && candidates.length > 0) {
      const candidate = candidates.shift();
      if (candidate === undefined) break;
      const [url, entry] = candidate;
      if (entry.snapshot.objectUrl !== null) revokeObjectUrl(entry.snapshot.objectUrl);
      entries.delete(url);
    }
  };

  const handleProgress = (progress: ImageProgress): void => {
    const url = requests.get(progress.requestId);
    if (url === undefined) return;

    const entry = entries.get(url);
    if (entry === undefined || entry.requestId !== progress.requestId) return;

    entry.snapshot = {
      ...entry.snapshot,
      loaded: progress.loaded,
      total: progress.total ?? entry.snapshot.total
    };
    notify(entry);
  };

  const ensureSubscription = (): void => {
    if (subscribed) return;
    disposeProgress = options.api.onImageProgress(handleProgress);
    subscribed = true;
  };

  const getOrCreateEntry = (url: string): ImageEntry => {
    const cached = entries.get(url);
    if (cached !== undefined) return cached;

    const entry: ImageEntry = {
      snapshot: IDLE_SNAPSHOT,
      requestId: null,
      usedAt: 0,
      listeners: new Set()
    };
    entries.set(url, entry);
    return entry;
  };

  const load = (url: string): void => {
    if (url === '') return;

    const existing = entries.get(url);
    if (
      existing !== undefined &&
      (existing.snapshot.phase === 'loading' || existing.snapshot.phase === 'ready')
    ) {
      touch(existing);
      return;
    }

    const entry = getOrCreateEntry(url);
    sequence += 1;
    const requestId = `img-${sequence}`;
    entry.requestId = requestId;
    entry.snapshot = { phase: 'loading', loaded: 0, total: null, objectUrl: null, error: null };
    touch(entry);
    notify(entry);
    requests.set(requestId, url);
    ensureSubscription();

    void options.api
      .loadImage({ requestId, url })
      .then((result) => {
        if (entry.requestId !== requestId) return;
        requests.delete(requestId);

        if (result.ok) {
          const objectUrl = createObjectUrl(
            new Blob([result.data.bytes], { type: result.data.mimeType })
          );
          entry.requestId = null;
          entry.snapshot = {
            phase: 'ready',
            loaded: result.data.bytes.byteLength,
            total: entry.snapshot.total,
            objectUrl,
            error: null
          };
          touch(entry);
          notify(entry);
          evict();
          return;
        }

        entry.requestId = null;
        entry.snapshot = { ...entry.snapshot, phase: 'error', error: result.error };
        notify(entry);
      })
      .catch((error: unknown) => {
        if (entry.requestId !== requestId) return;
        requests.delete(requestId);
        entry.requestId = null;
        entry.snapshot = {
          ...entry.snapshot,
          phase: 'error',
          error: {
            code: 'NETWORK',
            message: '图片加载失败，请检查网络后重试',
            detail: error instanceof Error ? error.message : String(error),
            retryable: true
          }
        };
        notify(entry);
      });
  };

  const subscribe = (url: string, listener: () => void): (() => void) => {
    if (url === '') return () => undefined;

    const entry = getOrCreateEntry(url);
    entry.listeners.add(listener);
    touch(entry);
    return () => {
      entry.listeners.delete(listener);
    };
  };

  const getSnapshot = (url: string): ImageSnapshot => entries.get(url)?.snapshot ?? IDLE_SNAPSHOT;

  const clear = (): void => {
    for (const entry of entries.values()) {
      if (entry.snapshot.objectUrl !== null) revokeObjectUrl(entry.snapshot.objectUrl);
    }
    entries.clear();
    requests.clear();
    if (disposeProgress !== null) disposeProgress();
    disposeProgress = null;
    subscribed = false;
  };

  return { subscribe, getSnapshot, load, clear };
}
