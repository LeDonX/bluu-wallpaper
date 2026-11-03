import { createImageStore, type ImageSnapshot, type ImageStore } from '@renderer/image-store';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ImageSnapshotState = ImageSnapshot & { retry(): void };

let imageStore: ImageStore | null = null;

/** 渲染层单例；延迟创建，避免测试环境在 import 阶段访问 window（05 §2） */
function getImageStore(): ImageStore {
  if (imageStore === null) {
    imageStore = createImageStore({ api: window.booru });
  }
  return imageStore;
}

/** 订阅单张图片的加载状态，并在挂载/切图时触发懒加载（DR-028） */
export function useImageSnapshot(url: string): ImageSnapshotState {
  const store = getImageStore();
  const subscribe = useCallback(
    (listener: () => void) => {
      return store.subscribe(url, listener);
    },
    [store, url]
  );
  const getSnapshot = useCallback(() => store.getSnapshot(url), [store, url]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    store.load(url);
  }, [store, url]);

  const retry = useCallback(() => {
    store.load(url);
  }, [store, url]);

  return { ...snapshot, retry };
}
