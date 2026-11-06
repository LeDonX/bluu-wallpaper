import { join } from 'node:path';

import { bootstrap, closeStorage, initStorage } from '@main/bootstrap';
import { refreshFollowsOnStartup, registerIpcHandlers } from '@main/ipc/registry';
import { getConfigPath, readConfig } from '@main/network/hostmap';
import { prewarmKonachan } from '@main/network/http-site';
import { applyProxyConfig } from '@main/network/proxy';
import { resolveWindowBounds, WINDOW_BACKGROUND_COLOR } from '@shared/constants';
import { app, BrowserWindow, dialog, nativeTheme, screen, shell } from 'electron';

// 单实例锁必须在 ready 之前申请：拿不到锁说明已有实例在运行
const hasSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  // DR-080：按主屏可用区域收敛，小屏 / 高 DPI 下默认尺寸不超出屏幕
  const bounds = resolveWindowBounds(screen.getPrimaryDisplay().workAreaSize);
  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: bounds.minWidth,
    minHeight: bounds.minHeight,
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
    if (mainWindow !== window) return;
    mainWindow = null;
    // DR-060：konachan 的隐藏 CF 窗口一直存在，`window-all-closed` 不会触发，
    // 关闭主窗口即视为退出应用（macOS 保持常驻）
    if (process.platform !== 'darwin') app.quit();
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

  void app.whenReady().then(async () => {
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

    // DR-039：代理只能在 app ready 后应用；复检与探测不阻塞窗口创建
    await applyProxyConfig(readConfig(getConfigPath()).network.proxy);

    app.setAppUserModelId('com.lepic.app');
    registerIpcHandlers();
    createMainWindow();
    // DR-068：主窗口先展示，随后后台完成 konachan 的 CF 验证，用户点进 konachan 时通常已就绪
    prewarmKonachan();
    // DR-069：错开 CF 预热与搜索首屏，延迟 3s 后台刷新关注；失败静默
    setTimeout(() => {
      refreshFollowsOnStartup();
    }, 3000);

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
