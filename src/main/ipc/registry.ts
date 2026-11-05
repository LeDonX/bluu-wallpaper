import { join } from 'node:path';

import { getDatabase } from '@main/bootstrap';
import { createDestinationGuard, isUsableDirectory } from '@main/download/destination';
import { createDownloadQueue, type DownloadTransport } from '@main/download/queue';
import { createDownloadsClearHandler } from '@main/ipc/handlers/downloads-clear';
import { createDownloadsControlHandler } from '@main/ipc/handlers/downloads-control';
import { createDownloadsDeleteHandler } from '@main/ipc/handlers/downloads-delete';
import { createDownloadsEnqueueHandler } from '@main/ipc/handlers/downloads-enqueue';
import { createDownloadsListHandler } from '@main/ipc/handlers/downloads-list';
import { createDownloadsRevealHandler } from '@main/ipc/handlers/downloads-reveal';
import { createFavoritesListHandler } from '@main/ipc/handlers/favorites-list';
import { createFavoritesToggleHandler } from '@main/ipc/handlers/favorites-toggle';
import { createImagesFetchHandler } from '@main/ipc/handlers/images-fetch';
import { createPostsRankingsHandler } from '@main/ipc/handlers/posts-rankings';
import { createPostsSearchHandler } from '@main/ipc/handlers/posts-search';
import { createSearchHistoryClearHandler } from '@main/ipc/handlers/search-history-clear';
import { createSearchHistoryDeleteHandler } from '@main/ipc/handlers/search-history-delete';
import { createSearchHistoryListHandler } from '@main/ipc/handlers/search-history-list';
import { createSearchHistoryRecordHandler } from '@main/ipc/handlers/search-history-record';
import { createSettingsGetHandler } from '@main/ipc/handlers/settings-get';
import { createSettingsPickDownloadDirHandler } from '@main/ipc/handlers/settings-pick-download-dir';
import { createSettingsSetHandler } from '@main/ipc/handlers/settings-set';
import { createTagsSuggestHandler } from '@main/ipc/handlers/tags-suggest';
import { createViewsClearHandler } from '@main/ipc/handlers/views-clear';
import { createViewsListHandler } from '@main/ipc/handlers/views-list';
import { createViewsMarkHandler } from '@main/ipc/handlers/views-mark';
import { getConfigPath, readConfig, writeConfig } from '@main/network/hostmap';
import type { ImageTransport } from '@main/network/image-loader';
import { applyProxyConfig, getProxyStatus, onProxyStatusChange } from '@main/network/proxy';
import { getSession } from '@main/network/sessions';
import { getSiteAdapter } from '@main/sites/adapters';
import { createDownloadsStore } from '@main/storage/downloads';
import { createFavoritesStore } from '@main/storage/favorites';
import { createHistoryStore } from '@main/storage/history';
import { createSearchHistoryStore } from '@main/storage/search-history';
import { createTagCache } from '@main/storage/tags';
import { createViewsStore } from '@main/storage/views';
import { createUpdateService, type UpdateUpdater } from '@main/update/service';
import { imageHostSite } from '@shared/constants';
import type { DownloadProgressEvent } from '@shared/downloads';
import {
  IPC_CHANNELS,
  type SettingsDestinationChangedEvent,
  type ViewsUpdatedEvent
} from '@shared/ipc-contract';
import type { UpdateState } from '@shared/updates';
import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions,shell } from 'electron';
import { autoUpdater } from 'electron-updater';

/** DR-028：图片与站点共用 session，才能继承 hostmap / cookie / 代理配置 */
const imageTransport: ImageTransport = (url, signal) => {
  const site = imageHostSite(new URL(url).hostname) ?? 'yande';
  return getSession(site).fetch(url, { signal });
};

/** DR-035：下载需透传 `Range` 请求头，同样走站点 session 以继承 hostmap / cookie */
const downloadTransport: DownloadTransport = (url, init) => {
  const site = imageHostSite(new URL(url).hostname) ?? 'yande';
  return getSession(site).fetch(url, init);
};

/** DR-059：下载目录无效时弹原生选择框；取消返回 null */
async function pickDownloadDirectory(current: string): Promise<string | null> {
  const owner = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options: OpenDialogOptions = {
    title: '选择下载目录',
    properties: ['openDirectory', 'createDirectory'],
    ...(isUsableDirectory(current) ? { defaultPath: current } : {})
  };
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0] ?? null;
}

/** 主进程 IPC 注册入口；新增 channel 需同步 03 §7 契约表（05 §5） */
export function registerIpcHandlers(): void {
  // DR-039：代理状态变化（如探测到不可达后回退）广播给所有窗口
  onProxyStatusChange((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.networkStatusChanged, status);
      }
    }
  });
  ipcMain.handle(IPC_CHANNELS.networkStatus, () => ({ ok: true, data: getProxyStatus() }));

  const searchPosts = createPostsSearchHandler({
    // 07 DR-057：按入参站点路由到 yande / konachan 适配器
    getAdapter: getSiteAdapter,
    // 07 DR-023：每次请求读取最新配置，开关改动无需重启即可生效
    isExplicitAllowed: () => readConfig(getConfigPath()).content.allowExplicit,
    // 07 DR-056：黑名单保存后同样立即生效
    getBlacklist: () => readConfig(getConfigPath()).content.blacklist
  });
  const listRankings = createPostsRankingsHandler({
    getAdapter: getSiteAdapter,
    // DR-041：榜单也遵循同一 R18 开关
    isExplicitAllowed: () => readConfig(getConfigPath()).content.allowExplicit,
    getBlacklist: () => readConfig(getConfigPath()).content.blacklist
  });
  const suggestTags = createTagsSuggestHandler({
    getAdapter: getSiteAdapter,
    cache: createTagCache(getDatabase())
  });
  const fetchImage = createImagesFetchHandler(imageTransport);
  const views = createViewsStore(getDatabase());
  const markViews = createViewsMarkHandler(views);
  const listViews = createViewsListHandler(views);
  const clearHistory = createViewsClearHandler(createHistoryStore(getDatabase()));
  // DR-055：搜索历史与已看/收藏独立，只读写 search_history
  const searchHistory = createSearchHistoryStore(getDatabase());
  const listSearchHistory = createSearchHistoryListHandler(searchHistory);
  const recordSearchHistory = createSearchHistoryRecordHandler(searchHistory);
  const deleteSearchHistory = createSearchHistoryDeleteHandler(searchHistory);
  const clearSearchHistory = createSearchHistoryClearHandler(searchHistory);
  const favorites = createFavoritesStore(getDatabase());
  const toggleFavorite = createFavoritesToggleHandler(favorites);
  const listFavorites = createFavoritesListHandler(favorites);
  const configPath = getConfigPath();
  const defaultDownloadDir = join(app.getPath('userData'), 'downloads');
  const initialSettings = readConfig(configPath);
  /** DR-063：队列在写盘失败时回调此槽位，实际处理函数在队列创建后接线 */
  const destinationRepair: { request: (() => Promise<string | null>) | null } = { request: null };
  const downloads = createDownloadQueue({
    store: createDownloadsStore(getDatabase()),
    transport: downloadTransport,
    // DR-040：目录/模板/并发读 `config.json#downloads`，空目录回落到 userData/downloads
    destinationDir: initialSettings.downloads.destinationDir || defaultDownloadDir,
    template: initialSettings.downloads.template,
    // DR-051：批量下载沿用设置页的默认格式
    format: initialSettings.downloads.format,
    concurrency: initialSettings.downloads.concurrency,
    // DR-063：写盘失败且目录不可用时弹框重选目录，选中后由队列迁移任务并重试
    requestDestination: () => destinationRepair.request?.() ?? Promise.resolve(null),
    onProgress: (event: DownloadProgressEvent) => {
      // 03 §7：进度走 send/on 事件，向所有窗口广播
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.downloadsProgress, event);
      }
    }
  });
  /** DR-059/DR-061：写回下载目录、热更新队列并广播给设置页 */
  const applyDownloadDestination = (dir: string): void => {
    const config = readConfig(configPath);
    writeConfig(configPath, {
      ...config,
      downloads: { ...config.downloads, destinationDir: dir }
    });
    downloads.updateConfig({
      destinationDir: dir,
      template: config.downloads.template,
      format: config.downloads.format,
      concurrency: config.downloads.concurrency
    });
    // DR-061：设置页常驻挂载，草稿不会自动重读，用广播同步显示为实际写回目录
    const event: SettingsDestinationChangedEvent = { destinationDir: dir };
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.settingsDestinationChanged, event);
      }
    }
  };
  // DR-059：入队前校验下载目录，无效时弹选择框；选中后写回配置并热更新队列
  const ensureDownloadDestination = createDestinationGuard({
    readDestinationDir: () => readConfig(configPath).downloads.destinationDir,
    defaultDir: defaultDownloadDir,
    pickDirectory: pickDownloadDirectory,
    applyDestination: applyDownloadDestination
  });
  /**
   * DR-063：下载写盘时发现目录不可用，弹框重选目录并写回配置。
   * 同一时刻只弹一个框，其它并发失败的任务复用同一结果。
   */
  let destinationRepairInFlight: Promise<string | null> | null = null;
  destinationRepair.request = (): Promise<string | null> => {
    if (destinationRepairInFlight !== null) return destinationRepairInFlight;
    const pending = (async () => {
      const current = readConfig(configPath).downloads.destinationDir.trim() || defaultDownloadDir;
      const picked = await pickDownloadDirectory(current).catch(() => null);
      if (picked === null || !isUsableDirectory(picked)) return null;
      applyDownloadDestination(picked);
      return picked;
    })();
    destinationRepairInFlight = pending.finally(() => {
      destinationRepairInFlight = null;
    });
    return destinationRepairInFlight;
  };
  const enqueueDownloads = createDownloadsEnqueueHandler(downloads, ensureDownloadDestination);
  const controlDownload = createDownloadsControlHandler(downloads);
  const listDownloads = createDownloadsListHandler(downloads);
  const revealDownload = createDownloadsRevealHandler({
    list: () => downloads.list(),
    showItemInFolder: (path) => shell.showItemInFolder(path),
    openPath: (path) => shell.openPath(path)
  });
  const deleteDownload = createDownloadsDeleteHandler(downloads);
  const clearDownloads = createDownloadsClearHandler(downloads);
  const getSettings = createSettingsGetHandler({
    read: () => readConfig(configPath),
    defaultDownloadDir
  });
  const setSettings = createSettingsSetHandler({
    read: () => readConfig(configPath),
    write: (settings) => {
      writeConfig(configPath, settings);
    },
    defaultDownloadDir,
    applyProxy: (proxy) => applyProxyConfig(proxy),
    applyDownloads: (config) => {
      downloads.updateConfig({
        destinationDir: config.destinationDir || defaultDownloadDir,
        template: config.template,
        format: config.format,
        concurrency: config.concurrency
      });
    }
  });
  // DR-061：设置页"选择文件夹"，草稿目录可用时对话框从该目录打开
  const pickSettingsDownloadDir = createSettingsPickDownloadDirHandler({
    pickDirectory: pickDownloadDirectory,
    isUsableDirectory,
    fallbackDir: () => {
      const configured = readConfig(configPath).downloads.destinationDir.trim();
      return configured !== '' ? configured : defaultDownloadDir;
    }
  });
  // 上次进程中断的任务（downloading/verifying）恢复为队列态并继续（DR-034）
  downloads.recover();

  // DR-066：自动更新仅在安装版可用，状态变化广播给所有窗口（设置页常驻订阅）
  const broadcastUpdateState = (state: UpdateState): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.updatesStatus, state);
    }
  };
  const updates = createUpdateService({
    // electron-updater 的事件类型比本服务用到的字段更宽，按最小接口注入
    updater: autoUpdater as unknown as UpdateUpdater,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    isPortable: process.env['PORTABLE_EXECUTABLE_DIR'] !== undefined,
    onStateChange: broadcastUpdateState
  });

  ipcMain.handle(IPC_CHANNELS.postsSearch, (_event, raw: unknown) => searchPosts(raw));
  ipcMain.handle(IPC_CHANNELS.postsRankings, (_event, raw: unknown) => listRankings(raw));
  ipcMain.handle(IPC_CHANNELS.tagsSuggest, (_event, raw: unknown) => suggestTags(raw));
  ipcMain.handle(IPC_CHANNELS.viewsMark, (_event, raw: unknown) => markViews(raw));
  ipcMain.handle(IPC_CHANNELS.viewsList, (_event, raw: unknown) => listViews(raw));
  ipcMain.handle(IPC_CHANNELS.viewsClear, async (_event, raw: unknown) => {
    const result = await clearHistory(raw);
    // 05 §6：清除成功后通知所有窗口同步已看/收藏缓存（DR-033）
    if (result.ok) {
      const event: ViewsUpdatedEvent = { site: result.data.site };
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.viewsUpdated, event);
      }
    }
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.favoritesToggle, (_event, raw: unknown) => toggleFavorite(raw));
  ipcMain.handle(IPC_CHANNELS.favoritesList, (_event, raw: unknown) => listFavorites(raw));
  ipcMain.handle(IPC_CHANNELS.downloadsEnqueue, (_event, raw: unknown) => enqueueDownloads(raw));
  ipcMain.handle(IPC_CHANNELS.downloadsControl, (_event, raw: unknown) => controlDownload(raw));
  ipcMain.handle(IPC_CHANNELS.downloadsReveal, (_event, raw: unknown) => revealDownload(raw));
  ipcMain.handle(IPC_CHANNELS.downloadsDelete, (_event, raw: unknown) => deleteDownload(raw));
  ipcMain.handle(IPC_CHANNELS.downloadsClear, () => clearDownloads());
  ipcMain.handle(IPC_CHANNELS.downloadsList, (_event, raw: unknown) => listDownloads(raw));
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => getSettings());
  ipcMain.handle(IPC_CHANNELS.settingsSet, (_event, raw: unknown) => setSettings(raw));
  ipcMain.handle(IPC_CHANNELS.settingsPickDownloadDir, (_event, raw: unknown) =>
    pickSettingsDownloadDir(raw)
  );
  ipcMain.handle(IPC_CHANNELS.searchHistoryList, () => listSearchHistory());
  ipcMain.handle(IPC_CHANNELS.searchHistoryRecord, (_event, raw: unknown) =>
    recordSearchHistory(raw)
  );
  ipcMain.handle(IPC_CHANNELS.searchHistoryDelete, (_event, raw: unknown) =>
    deleteSearchHistory(raw)
  );
  ipcMain.handle(IPC_CHANNELS.searchHistoryClear, () => clearSearchHistory());
  ipcMain.handle(IPC_CHANNELS.updatesGetState, () => ({ ok: true, data: updates.getState() }));
  ipcMain.handle(IPC_CHANNELS.updatesCheck, () => updates.check());
  ipcMain.handle(IPC_CHANNELS.updatesDownload, () => updates.download());
  ipcMain.handle(IPC_CHANNELS.updatesInstall, () => updates.install());
  ipcMain.handle(IPC_CHANNELS.imagesFetch, (event, raw: unknown) =>
    fetchImage(raw, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.imagesProgress, progress);
      }
    })
  );
}
