import { join } from 'node:path';

import { bootstrap, closeStorage, initStorage } from '@main/bootstrap';
import { registerIpcHandlers } from '@main/ipc/registry';
import {
  DEFAULT_WINDOW_SIZE,
  MIN_WINDOW_SIZE,
  WINDOW_BACKGROUND_COLOR
} from '@shared/constants';
import { app, BrowserWindow, dialog, nativeTheme, shell } from 'electron';

// 单实例锁必须在 ready 之前申请：拿不到锁说明已有实例在运行
const hasSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    show: false,
    backgroundColor: WINDOW_BACKGROUND_COLOR,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow = window;

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  // 外链一律不在应用内打开，交给系统浏览器
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/** 第二次启动时还原并聚焦已有窗口，不再创建新窗口 */
function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  // 开关注入必须先于 app ready，否则对 Chromium 网络栈无效
  bootstrap();

  // 暗色主题为默认（02-UX-Design §1）
  nativeTheme.themeSource = 'dark';

  app.on('second-instance', () => {
    focusMainWindow();
  });

  void app.whenReady().then(() => {
    // 数据库迁移失败属于不可恢复错误，明确告知后退出，不静默降级
    try {
      initStorage();
    } catch (error) {
      dialog.showErrorBox(
        '数据库初始化失败',
        error instanceof Error ? error.message : String(error)
      );
      app.quit();
      return;
    }

    app.setAppUserModelId('com.bluu.app');
    registerIpcHandlers();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    closeStorage();
  });
}
