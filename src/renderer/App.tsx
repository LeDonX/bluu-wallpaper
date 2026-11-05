import type { SiteId } from '@shared/constants';
import type { ProxyStatus } from '@shared/proxy';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { DownloadsPage } from './pages/DownloadsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { RankingPage } from './pages/RankingPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';

const PAGES = [
  { id: 'search', label: '搜索' },
  { id: 'rankings', label: '榜单' },
  { id: 'favorites', label: '收藏' },
  { id: 'downloads', label: '下载' },
  { id: 'settings', label: '设置' }
] as const;

type PageId = (typeof PAGES)[number]['id'];

/**
 * 外壳任务（T-38~）落地前的最小导航：搜索 / 榜单 / 收藏 / 下载 / 设置。
 * 页面保持挂载（仅切换 hidden），既保留搜索与收藏状态，也让清除记录事件能即时刷新隐藏页面（T-22）。
 */
export function App(): ReactElement {
  const [page, setPage] = useState<PageId>('search');
  const [proxyAlert, setProxyAlert] = useState<string | null>(null);
  // DR-041 / DR-057：榜单查看器点击标签后切到搜索页，并带上来源站点
  const [searchRequest, setSearchRequest] = useState<{
    query: string;
    site: SiteId;
    seq: number;
  } | null>(null);

  const handleSearchTag = (name: string, site: SiteId): void => {
    setSearchRequest((previous) => ({ query: name, site, seq: (previous?.seq ?? 0) + 1 }));
    setPage('search');
  };

  // DR-039：代理不可用时主进程回退直连，这里只负责把原因显示出来
  useEffect(() => {
    let active = true;
    const applyStatus = (status: ProxyStatus): void => {
      if (!active) return;
      setProxyAlert(status.fallback ? status.reason ?? '代理不可用，已回退直连' : null);
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
        {PAGES.map((item) => (
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
        <div className="app-page" hidden={page !== 'search'}>
          <SearchPage externalQuery={searchRequest ?? undefined} />
        </div>
        <div className="app-page" hidden={page !== 'rankings'}>
          <RankingPage onSearchTag={handleSearchTag} />
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
