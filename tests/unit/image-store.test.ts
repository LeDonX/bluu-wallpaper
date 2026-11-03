import type { Result } from '@shared/errors';
import type { ImageBinary, ImageFetchInput, ImageProgress } from '@shared/ipc-contract';
import { describe, expect, it } from 'vitest';

import { createImageStore } from '../../src/renderer/image-store';

interface PendingRequest {
  input: ImageFetchInput;
  resolve(result: Result<ImageBinary>): void;
}

function createFakeApi() {
  const pending: PendingRequest[] = [];
  const listeners = new Set<(progress: ImageProgress) => void>();

  return {
    api: {
      loadImage: (input: ImageFetchInput): Promise<Result<ImageBinary>> =>
        new Promise((resolve) => {
          pending.push({ input, resolve });
        }),
      onImageProgress: (listener: (progress: ImageProgress) => void): (() => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }
    },
    pending,
    emit(progress: ImageProgress): void {
      for (const listener of [...listeners]) listener(progress);
    },
    listenerCount(): number {
      return listeners.size;
    }
  };
}

const success = (bytes: number): Result<ImageBinary> => ({
  ok: true,
  data: { mimeType: 'image/jpeg', bytes: new ArrayBuffer(bytes) }
});

const failure = (message: string): Result<ImageBinary> => ({
  ok: false,
  error: { code: 'NETWORK', message, retryable: true }
});

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createStore = () => {
  const fake = createFakeApi();
  const revoked: string[] = [];
  let created = 0;
  const store = createImageStore({
    api: fake.api,
    maxEntries: 2,
    createObjectUrl: () => {
      created += 1;
      return `blob:test-${created}`;
    },
    revokeObjectUrl: (url) => {
      revoked.push(url);
    }
  });
  return { store, ...fake, revoked };
};

const URL_A = 'https://files.yande.re/image/a.jpg';
const URL_B = 'https://files.yande.re/image/b.jpg';
const URL_C = 'https://files.yande.re/image/c.jpg';

describe('查看器图片状态机（DR-028）', () => {
  it('load 进入 loading、订阅进度事件，重复 load 不再发请求', async () => {
    const { store, pending, listenerCount } = createStore();

    let notifications = 0;
    const unsubscribe = store.subscribe(URL_A, () => {
      notifications += 1;
    });

    store.load(URL_A);
    store.load(URL_A);

    expect(store.getSnapshot(URL_A).phase).toBe('loading');
    expect(pending).toHaveLength(1);
    expect(listenerCount()).toBe(1);
    expect(notifications).toBe(1);
    unsubscribe();
  });

  it('进度事件按 requestId 更新已加载字节', async () => {
    const { store, pending, emit } = createStore();

    let notifications = 0;
    const unsubscribe = store.subscribe(URL_A, () => {
      notifications += 1;
    });
    store.load(URL_A);

    const request = pending[0];
    if (request === undefined) throw new Error('missing request');
    emit({ requestId: request.input.requestId, loaded: 40, total: 100 });

    expect(store.getSnapshot(URL_A)).toMatchObject({ phase: 'loading', loaded: 40, total: 100 });
    expect(notifications).toBe(2);

    // 未知 requestId 不干扰当前条目
    emit({ requestId: 'unknown', loaded: 90, total: 100 });
    expect(store.getSnapshot(URL_A).loaded).toBe(40);
    unsubscribe();
  });

  it('加载成功生成 blob URL，loaded 为实际字节数', async () => {
    const { store, pending } = createStore();

    const unsubscribe = store.subscribe(URL_A, () => undefined);
    store.load(URL_A);

    const request = pending[0];
    if (request === undefined) throw new Error('missing request');
    request.resolve(success(100));
    await flush();

    const snapshot = store.getSnapshot(URL_A);
    expect(snapshot).toMatchObject({ phase: 'ready', loaded: 100 });
    expect(snapshot.objectUrl).toBe('blob:test-1');
    unsubscribe();
  });

  it('失败后进入 error，可再次 load 重试', async () => {
    const { store, pending } = createStore();

    store.load(URL_A);
    const first = pending[0];
    if (first === undefined) throw new Error('missing request');
    first.resolve(failure('boom'));
    await flush();

    expect(store.getSnapshot(URL_A)).toMatchObject({ phase: 'error', error: { message: 'boom' } });

    store.load(URL_A);
    expect(pending).toHaveLength(2);
    expect(store.getSnapshot(URL_A).phase).toBe('loading');
  });

  it('完成后的旧进度事件被忽略', async () => {
    const { store, pending, emit } = createStore();

    store.load(URL_A);
    const request = pending[0];
    if (request === undefined) throw new Error('missing request');
    request.resolve(success(30));
    await flush();

    emit({ requestId: request.input.requestId, loaded: 10, total: 30 });
    expect(store.getSnapshot(URL_A)).toMatchObject({ phase: 'ready', loaded: 30 });
  });

  it('超过上限时淘汰最久未用且无订阅的图片并释放 blob URL', async () => {
    const { store, pending, revoked } = createStore();

    for (const url of [URL_A, URL_B, URL_C]) {
      store.load(url);
      const request = pending.at(-1);
      if (request === undefined) throw new Error('missing request');
      request.resolve(success(10));
      await flush();
    }

    expect(store.getSnapshot(URL_A).phase).toBe('idle');
    expect(store.getSnapshot(URL_B).phase).toBe('ready');
    expect(store.getSnapshot(URL_C).phase).toBe('ready');
    expect(revoked).toEqual(['blob:test-1']);
  });

  it('空地址不订阅、不加载', () => {
    const { store, pending, listenerCount } = createStore();

    const unsubscribe = store.subscribe('', () => undefined);
    store.load('');

    expect(pending).toHaveLength(0);
    expect(listenerCount()).toBe(0);
    expect(store.getSnapshot('').phase).toBe('idle');
    unsubscribe();
  });

  it('clear 释放全部 blob URL 并停止进度订阅', async () => {
    const { store, pending, revoked, listenerCount } = createStore();

    store.load(URL_A);
    store.load(URL_B);
    for (const request of pending) request.resolve(success(10));
    await flush();

    expect(listenerCount()).toBe(1);
    store.clear();

    expect(revoked).toHaveLength(2);
    expect(store.getSnapshot(URL_A).phase).toBe('idle');
    expect(listenerCount()).toBe(0);
  });
});
