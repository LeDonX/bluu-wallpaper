import {
  DEFAULT_WINDOW_SIZE,
  ERROR_CODES,
  MIN_WINDOW_SIZE,
  SITE_IDS
} from '@shared/constants';
import { describe, expect, it } from 'vitest';

describe('shared constants', () => {
  it('站点顺序固定，避免持久化数据错位', () => {
    expect(SITE_IDS).toEqual(['yande', 'konachan']);
  });

  it('错误码不重复', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('主窗口尺寸锁定 02 §1：默认 1280×860、最小 1024×720', () => {
    expect(DEFAULT_WINDOW_SIZE).toEqual({ width: 1280, height: 860 });
    expect(MIN_WINDOW_SIZE).toEqual({ width: 1024, height: 720 });
  });
});
