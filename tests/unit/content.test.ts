import {
  applyBlacklistFilter,
  applyR18Filter,
  DEFAULT_CONTENT_CONFIG,
  isPostBlacklisted,
  MAX_BLACKLIST_TAGS,
  normalizeBlacklist,
  normalizeBlacklistTag,
  parseContentConfig,
  splitBlacklistText
} from '@shared/content';
import { describe, expect, it } from 'vitest';

describe('content 配置解析', () => {
  it('缺失或非法输入回落到默认（R18 关闭、黑名单为空）', () => {
    expect(parseContentConfig(undefined)).toEqual(DEFAULT_CONTENT_CONFIG);
    expect(parseContentConfig('not-an-object')).toEqual(DEFAULT_CONTENT_CONFIG);
    expect(parseContentConfig([])).toEqual(DEFAULT_CONTENT_CONFIG);
  });

  it('非布尔 allowExplicit 回落到关闭，合法值原样保留', () => {
    expect(parseContentConfig({ allowExplicit: 'yes' })).toEqual({
      allowExplicit: false,
      blacklist: []
    });
    expect(parseContentConfig({ allowExplicit: true })).toEqual({
      allowExplicit: true,
      blacklist: []
    });
    expect(parseContentConfig({ allowExplicit: false })).toEqual({
      allowExplicit: false,
      blacklist: []
    });
  });

  it('黑名单只保留合法字符串项，归一化并去重', () => {
    expect(parseContentConfig({ allowExplicit: false })).toMatchObject({ blacklist: [] });
    expect(
      parseContentConfig({ blacklist: ['  LowRes ', 'LOWRES', 'bad id', 'rating:e', '-foo', 42] })
    ).toEqual({ allowExplicit: false, blacklist: ['lowres'] });
    expect(parseContentConfig({ blacklist: 'lowres' })).toMatchObject({ blacklist: [] });
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

describe('标签黑名单归一化（DR-056）', () => {
  it('trim + 小写，非法项返回 null', () => {
    expect(normalizeBlacklistTag('  LowRes ')).toBe('lowres');
    expect(normalizeBlacklistTag('')).toBeNull();
    expect(normalizeBlacklistTag('bad id')).toBeNull();
    expect(normalizeBlacklistTag('-foo')).toBeNull();
    expect(normalizeBlacklistTag('rating:e')).toBeNull();
    expect(normalizeBlacklistTag('rating:')).toBeNull();
  });

  it('去重并保留首次出现顺序，超过上限截断', () => {
    expect(normalizeBlacklist(['LowRes', 'lowres', 'bad_id', ''])).toEqual(['lowres', 'bad_id']);
    const many = Array.from({ length: MAX_BLACKLIST_TAGS + 5 }, (_, index) => `tag${index}`);
    expect(normalizeBlacklist(many)).toHaveLength(MAX_BLACKLIST_TAGS);
  });

  it('文本按空白与逗号切分并丢弃空项', () => {
    expect(splitBlacklistText(' lowres, bad_id\n\nfoo  ')).toEqual(['lowres', 'bad_id', 'foo']);
    expect(splitBlacklistText('   ')).toEqual([]);
  });
});

describe('applyBlacklistFilter', () => {
  it('逐项追加 -tag 并回传追加数量', () => {
    expect(applyBlacklistFilter('hatsune', ['lowres', 'bad_id'])).toEqual({
      query: 'hatsune -lowres -bad_id',
      excluded: 2
    });
  });

  it('与用户已有的 -tag 去重且大小写不敏感', () => {
    expect(applyBlacklistFilter('hatsune -LowRes', ['lowres'])).toEqual({
      query: 'hatsune -LowRes',
      excluded: 0
    });
    expect(applyBlacklistFilter('hatsune -lowres', ['lowres', 'bad_id'])).toEqual({
      query: 'hatsune -lowres -bad_id',
      excluded: 1
    });
  });

  it('黑名单为空或查询为空时原样返回', () => {
    expect(applyBlacklistFilter('hatsune', [])).toEqual({ query: 'hatsune', excluded: 0 });
    expect(applyBlacklistFilter('   ', ['lowres'])).toEqual({ query: '   ', excluded: 0 });
  });
});

describe('isPostBlacklisted', () => {
  const tags = (...names: string[]) => ({
    tags: names.map((name) => ({ name, type: 'general' as const }))
  });

  it('命中任一标签（大小写不敏感）即视为命中', () => {
    expect(isPostBlacklisted(tags('LowRes', 'sample'), ['lowres'])).toBe(true);
    expect(isPostBlacklisted(tags('sample'), ['lowres'])).toBe(false);
    expect(isPostBlacklisted(tags('sample'), [])).toBe(false);
  });
});
