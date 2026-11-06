import {
  ALL_SITE_IDS,
  DEFAULT_WINDOW_SIZE,
  ERROR_CODES,
  imageHostSite,
  isProviderSiteId,
  MIN_WINDOW_SIZE,
  PROVIDER_SITE_IDS,
  resolveWindowBounds,
  SITE_IDS
} from '@shared/constants';
import {
  homeFeedFor,
  SITE_BASE_URLS,
  SITE_CAPABILITIES,
  SITE_LABELS,
  sitesWithCapability
} from '@shared/sites';
import { describe, expect, it } from 'vitest';

describe('shared constants', () => {
  it('站点顺序固定，避免持久化数据错位', () => {
    expect(SITE_IDS).toEqual(['yande', 'konachan']);
  });

  it('多源标识为 booru 站点在前、第三方图库在后（DR-070）', () => {
    expect(PROVIDER_SITE_IDS).toEqual(['wallhaven', 'bing']);
    expect(ALL_SITE_IDS).toEqual(['yande', 'konachan', 'wallhaven', 'bing']);
  });

  it('每个站点都有地址与界面名', () => {
    for (const site of ALL_SITE_IDS) {
      expect(SITE_BASE_URLS[site]).toMatch(/^https:\/\//);
      expect(SITE_LABELS[site].length).toBeGreaterThan(0);
    }
  });

  it('首页来源按站点能力推导（DR-085）', () => {
    expect(homeFeedFor('yande')).toBe('ranking');
    expect(homeFeedFor('konachan')).toBe('ranking');
    expect(homeFeedFor('wallhaven')).toBe('toplist');
    expect(homeFeedFor('bing')).toBeNull();
    expect(SITE_CAPABILITIES.wallhaven.toplist).toBe(true);
    expect(SITE_CAPABILITIES.yande.toplist).toBe(false);
  });

  it('能力表按站点差异声明（DR-070）', () => {
    expect(SITE_CAPABILITIES.yande).toMatchObject({
      search: true,
      rankings: true,
      suggest: true,
      resolutionFilter: true
    });
    expect(SITE_CAPABILITIES.konachan).toMatchObject({
      search: true,
      rankings: true,
      suggest: true,
      resolutionFilter: true
    });
    expect(SITE_CAPABILITIES.wallhaven).toMatchObject({
      search: true,
      rankings: false,
      suggest: false,
      needsKey: true,
      resolutionFilter: true
    });
    expect(SITE_CAPABILITIES.bing).toMatchObject({
      search: false,
      rankings: false,
      suggest: false,
      needsKey: false,
      daily: true,
      resolutionFilter: false
    });
  });

  it('能力表筛选驱动入口（T-53）', () => {
    expect(sitesWithCapability('search')).toEqual(['yande', 'konachan', 'wallhaven']);
    expect(sitesWithCapability('rankings')).toEqual(['yande', 'konachan']);
    expect(sitesWithCapability('suggest')).toEqual(['yande', 'konachan']);
    expect(sitesWithCapability('daily')).toEqual(['bing']);
    expect(sitesWithCapability('resolutionFilter')).toEqual(['yande', 'konachan', 'wallhaven']);
  });

  it('第三方站点判定用于密钥门禁（T-53）', () => {
    expect(isProviderSiteId('wallhaven')).toBe(true);
    expect(isProviderSiteId('bing')).toBe(true);
    expect(isProviderSiteId('yande')).toBe(false);
    expect(isProviderSiteId('pexels')).toBe(false);
    expect(isProviderSiteId('unknown')).toBe(false);
  });

  it('第三方图库图片域名映射到对应站点 session', () => {
    expect(imageHostSite('w.wallhaven.cc')).toBe('wallhaven');
    expect(imageHostSite('th.wallhaven.cc')).toBe('wallhaven');
    expect(imageHostSite('images.pexels.com')).toBeNull();
    expect(imageHostSite('www.bing.com')).toBe('bing');
    expect(imageHostSite('cn.bing.com')).toBe('bing');
    expect(imageHostSite('example.com')).toBeNull();
  });

  it('错误码不重复', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('主窗口设计尺寸锁定 02 §1（DR-080）：默认 1080×720、最小 800×560', () => {
    expect(DEFAULT_WINDOW_SIZE).toEqual({ width: 1080, height: 720 });
    expect(MIN_WINDOW_SIZE).toEqual({ width: 800, height: 560 });
  });

  it('大屏按设计尺寸启动，不随屏幕继续放大（DR-080）', () => {
    expect(resolveWindowBounds({ width: 2560, height: 1400 })).toEqual({
      width: 1080,
      height: 720,
      minWidth: 800,
      minHeight: 560
    });
  });

  it('小屏按可用区域 90% 收敛，窗口不超出屏幕（DR-080）', () => {
    // 1366×768 的 workArea 高度约 728（含任务栏）
    expect(resolveWindowBounds({ width: 1366, height: 728 })).toEqual({
      width: 1080,
      height: 655,
      minWidth: 800,
      minHeight: 560
    });
  });

  it('可用区域小于设计下限时，最小尺寸回落到区域本身（DR-080）', () => {
    expect(resolveWindowBounds({ width: 720, height: 480 })).toEqual({
      width: 720,
      height: 480,
      minWidth: 720,
      minHeight: 480
    });
  });
});
