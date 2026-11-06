import type { ProxyStatus } from '@shared/proxy';
import { sitesWithCapability } from '@shared/sites';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { DailyPage } from './pages/DailyPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';

const PAGES = [
  // T-59 / DR-088：榜单与搜索合并为首页，榜单类型入口放在首页工具条
  // T-60 / DR-089：诊断并入设置，导航只保留首页 / 每日壁纸 / 收藏 / 下载 / 设置
  { id: 'home', label: '首页' },
  { id: 'daily', label: '每日壁纸' },
  { id: 'favorites', label: '收藏' },
  { id: 'downloads', label: '下载' },
  { id: 'settings', label: '设置' }
] as const;

type PageId = (typeof PAGES)[number]['id'];

/** DR-076 / T-53：入口按能力表驱动，没有任何站点具备每日壁纸能力时导航不出现该项 */
const NAV_PAGES = PAGES.filter(
  (item) => item.id !== 'daily' || sitesWithCapability('daily').length > 0
);

/**
 * 外壳任务（T-38~）落地前的最小导航：首页（搜索 + 榜单，T-59）/ 每日壁纸（T-52）/ 收藏 / 下载 / 设置（含诊断，T-60）。
 * 页面保持挂载（仅切换 hidden），既保留首页与收藏状态，也让清除记录事件能即时刷新隐藏页面（T-22）。
 */
export function App(): ReactElement {
  const [page, setPage] = useState<PageId>('home');
  const [proxyAlert, setProxyAlert] = useState<string | null>(null);

  // DR-039：代理不可用时主进程回退直连，这里只负责把原因显示出来
  useEffect(() => {
    let active = true;
    const applyStatus = (status: ProxyStatus): void => {
      if (!active) return;
      setProxyAlert(status.fallback ? (status.reason ?? '代理不可用，已回退直连') : null);
    };

    window.booru
      .getNetworkStatus()
      .then((result) => {
        if (result.ok) applyStatus(result.data);
      })
      .catch(() => {
        // 状态只用于提示，读取失败不阻塞界面
      });
    const unsubscribe = window.booru.onNetworkStatus(applyStatus);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="主导航">
        {NAV_PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="app-nav__item"
            aria-pressed={page === item.id}
            onClick={() => {
              setPage(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {proxyAlert !== null ? (
        <div className="app-network-alert" role="alert">
          <span>{proxyAlert}</span>
          <button
            type="button"
            className="app-network-alert__close"
            aria-label="关闭提示"
            onClick={() => {
              setProxyAlert(null);
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="app-body">
        <div className="app-page" hidden={page !== 'home'}>
          <SearchPage />
        </div>
        <div className="app-page" hidden={page !== 'daily'}>
          <DailyPage active={page === 'daily'} />
        </div>
        <div className="app-page" hidden={page !== 'favorites'}>
          <FavoritesPage />
        </div>
        <div className="app-page" hidden={page !== 'downloads'}>
          <DownloadsPage />
        </div>
        <div className="app-page" hidden={page !== 'settings'}>
          <SettingsPage />
        </div>
      </div>
    </div>
  );
}
