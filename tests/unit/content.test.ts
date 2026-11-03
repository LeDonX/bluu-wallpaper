import { applyR18Filter, DEFAULT_CONTENT_CONFIG, parseContentConfig } from '@shared/content';
import { describe, expect, it } from 'vitest';

describe('content 配置解析', () => {
  it('缺失或非法输入回落到默认（R18 关闭）', () => {
    expect(parseContentConfig(undefined)).toEqual(DEFAULT_CONTENT_CONFIG);
    expect(parseContentConfig('not-an-object')).toEqual(DEFAULT_CONTENT_CONFIG);
    expect(parseContentConfig([])).toEqual(DEFAULT_CONTENT_CONFIG);
  });

  it('非布尔 allowExplicit 回落到关闭，合法值原样保留', () => {
    expect(parseContentConfig({ allowExplicit: 'yes' })).toEqual({ allowExplicit: false });
    expect(parseContentConfig({ allowExplicit: true })).toEqual({ allowExplicit: true });
    expect(parseContentConfig({ allowExplicit: false })).toEqual({ allowExplicit: false });
  });
});

describe('applyR18Filter', () => {
  it('R18 关闭且无 rating 意图时追加 -rating:e', () => {
    expect(applyR18Filter('hatsune', false)).toEqual({
      query: 'hatsune -rating:e',
      filtered: true
    });
  });

  it('多空白与首尾空白归一后追加', () => {
    expect(applyR18Filter('  hatsune   -miku  ', false)).toEqual({
      query: 'hatsune -miku -rating:e',
      filtered: true
    });
  });

  it('显式 rating 单字符或全称、大小写与正负向均不覆盖', () => {
    for (const query of ['rating:q', 'rating:e', 'Rating:E', 'rating:explicit', '-rating:s']) {
      expect(applyR18Filter(query, false)).toEqual({ query, filtered: false });
    }
  });

  it('R18 开启时原样返回且不标记过滤', () => {
    expect(applyR18Filter('hatsune', true)).toEqual({ query: 'hatsune', filtered: false });
    expect(applyR18Filter('', true)).toEqual({ query: '', filtered: false });
  });

  it('开关未开启时也不会重复追加用户已写的 -rating:e', () => {
    expect(applyR18Filter('hatsune -rating:e', false)).toEqual({
      query: 'hatsune -rating:e',
      filtered: false
    });
  });
});
