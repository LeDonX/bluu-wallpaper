import type { BooruApi, ImageProgress } from '@shared/ipc-contract';
import { IPC_CHANNELS } from '@shared/ipc-contract';
import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

/** 只暴露白名单方法，不暴露 ipcRenderer 本体（05 §2） */
const api: BooruApi = {
  platform: process.platform,
  arch: process.arch,
  searchPosts: (input) => ipcRenderer.invoke(IPC_CHANNELS.postsSearch, input),
  suggestTags: (input) => ipcRenderer.invoke(IPC_CHANNELS.tagsSuggest, input),
  loadImage: (input) => ipcRenderer.invoke(IPC_CHANNELS.imagesFetch, input),
  onImageProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: ImageProgress): void => {
      listener(progress);
    };
    ipcRenderer.on(IPC_CHANNELS.imagesProgress, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.imagesProgress, handler);
    };
  },
  markViews: (input) => ipcRenderer.invoke(IPC_CHANNELS.viewsMark, input),
  listViews: (input) => ipcRenderer.invoke(IPC_CHANNELS.viewsList, input)
};

contextBridge.exposeInMainWorld('booru', api);
