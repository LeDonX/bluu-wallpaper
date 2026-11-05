import type { DownloadProgressEvent } from '@shared/downloads';
import type {
  BooruApi,
  ImageProgress,
  SettingsDestinationChangedEvent,
  ViewsUpdatedEvent
} from '@shared/ipc-contract';
import { IPC_CHANNELS } from '@shared/ipc-contract';
import type { ProxyStatus } from '@shared/proxy';
import type { UpdateState } from '@shared/updates';
import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

/** 只暴露白名单方法，不暴露 ipcRenderer 本体（05 §2） */
const api: BooruApi = {
  platform: process.platform,
  arch: process.arch,
  searchPosts: (input) => ipcRenderer.invoke(IPC_CHANNELS.postsSearch, input),
  listRankings: (input) => ipcRenderer.invoke(IPC_CHANNELS.postsRankings, input),
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
  listViews: (input) => ipcRenderer.invoke(IPC_CHANNELS.viewsList, input),
  clearViews: (input) => ipcRenderer.invoke(IPC_CHANNELS.viewsClear, input),
  onViewsUpdated: (listener) => {
    const handler = (_event: IpcRendererEvent, update: ViewsUpdatedEvent): void => {
      listener(update);
    };
    ipcRenderer.on(IPC_CHANNELS.viewsUpdated, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.viewsUpdated, handler);
    };
  },
  toggleFavorite: (input) => ipcRenderer.invoke(IPC_CHANNELS.favoritesToggle, input),
  listFavorites: (input) => ipcRenderer.invoke(IPC_CHANNELS.favoritesList, input),
  enqueueDownloads: (input) => ipcRenderer.invoke(IPC_CHANNELS.downloadsEnqueue, input),
  controlDownload: (input) => ipcRenderer.invoke(IPC_CHANNELS.downloadsControl, input),
  revealDownload: (input) => ipcRenderer.invoke(IPC_CHANNELS.downloadsReveal, input),
  deleteDownload: (input) => ipcRenderer.invoke(IPC_CHANNELS.downloadsDelete, input),
  clearDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.downloadsClear),
  listDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.downloadsList),
  onDownloadProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: DownloadProgressEvent): void => {
      listener(progress);
    };
    ipcRenderer.on(IPC_CHANNELS.downloadsProgress, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.downloadsProgress, handler);
    };
  },
  getNetworkStatus: () => ipcRenderer.invoke(IPC_CHANNELS.networkStatus),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  setSettings: (input) => ipcRenderer.invoke(IPC_CHANNELS.settingsSet, input),
  pickDownloadDirectory: (input) => ipcRenderer.invoke(IPC_CHANNELS.settingsPickDownloadDir, input),
  onDestinationChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, event: SettingsDestinationChangedEvent): void => {
      listener(event);
    };
    ipcRenderer.on(IPC_CHANNELS.settingsDestinationChanged, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.settingsDestinationChanged, handler);
    };
  },
  listSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.searchHistoryList),
  recordSearchHistory: (input) => ipcRenderer.invoke(IPC_CHANNELS.searchHistoryRecord, input),
  deleteSearchHistory: (input) => ipcRenderer.invoke(IPC_CHANNELS.searchHistoryDelete, input),
  clearSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.searchHistoryClear),
  getUpdateState: () => ipcRenderer.invoke(IPC_CHANNELS.updatesGetState),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.updatesCheck),
  downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updatesDownload),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updatesInstall),
  onUpdateStatus: (listener) => {
    const handler = (_event: IpcRendererEvent, state: UpdateState): void => {
      listener(state);
    };
    ipcRenderer.on(IPC_CHANNELS.updatesStatus, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.updatesStatus, handler);
    };
  },
  onNetworkStatus: (listener) => {
    const handler = (_event: IpcRendererEvent, status: ProxyStatus): void => {
      listener(status);
    };
    ipcRenderer.on(IPC_CHANNELS.networkStatusChanged, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.networkStatusChanged, handler);
    };
  }
};

contextBridge.exposeInMainWorld('booru', api);
