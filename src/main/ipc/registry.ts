import { getDatabase } from '@main/bootstrap';
import { createImagesFetchHandler } from '@main/ipc/handlers/images-fetch';
import { createPostsSearchHandler } from '@main/ipc/handlers/posts-search';
import { createTagsSuggestHandler } from '@main/ipc/handlers/tags-suggest';
import { createViewsListHandler } from '@main/ipc/handlers/views-list';
import { createViewsMarkHandler } from '@main/ipc/handlers/views-mark';
import { getConfigPath, readConfig } from '@main/network/hostmap';
import type { ImageTransport } from '@main/network/image-loader';
import { getSession } from '@main/network/sessions';
import { getYandeAdapter } from '@main/sites/yande';
import { createTagCache } from '@main/storage/tags';
import { createViewsStore } from '@main/storage/views';
import { imageHostSite } from '@shared/constants';
import { IPC_CHANNELS } from '@shared/ipc-contract';
import { ipcMain } from 'electron';

/** DR-028：图片与站点共用 session，才能继承 hostmap / cookie / 代理配置 */
const imageTransport: ImageTransport = (url, signal) => {
  const site = imageHostSite(new URL(url).hostname) ?? 'yande';
  return getSession(site).fetch(url, { signal });
};

/** 主进程 IPC 注册入口；新增 channel 需同步 03 §7 契约表（05 §5） */
export function registerIpcHandlers(): void {
  const searchPosts = createPostsSearchHandler(getYandeAdapter(), {
    // 07 DR-023：每次请求读取最新配置，开关改动无需重启即可生效
    isExplicitAllowed: () => readConfig(getConfigPath()).content.allowExplicit
  });
  const suggestTags = createTagsSuggestHandler({
    adapter: getYandeAdapter(),
    cache: createTagCache(getDatabase())
  });
  const fetchImage = createImagesFetchHandler(imageTransport);
  const views = createViewsStore(getDatabase());
  const markViews = createViewsMarkHandler(views);
  const listViews = createViewsListHandler(views);
  ipcMain.handle(IPC_CHANNELS.postsSearch, (_event, raw: unknown) => searchPosts(raw));
  ipcMain.handle(IPC_CHANNELS.tagsSuggest, (_event, raw: unknown) => suggestTags(raw));
  ipcMain.handle(IPC_CHANNELS.viewsMark, (_event, raw: unknown) => markViews(raw));
  ipcMain.handle(IPC_CHANNELS.viewsList, (_event, raw: unknown) => listViews(raw));
  ipcMain.handle(IPC_CHANNELS.imagesFetch, (event, raw: unknown) =>
    fetchImage(raw, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.imagesProgress, progress);
      }
    })
  );
}
