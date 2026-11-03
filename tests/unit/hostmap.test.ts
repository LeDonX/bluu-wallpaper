import {
  buildResolverRules,
  DEFAULT_HOSTMAP,
  defaultHostmapConfig,
  isValidHostname,
  isValidIPv4,
  parseHostmapConfig
} from '@shared/hostmap';
import { describe, expect, it } from 'vitest';

describe('hostmap 映射串生成', () => {
  it('默认配置覆盖两站主站与 files/assets 域名', () => {
    const rules = buildResolverRules(defaultHostmapConfig());

    expect(rules).toBe(
      [
        'MAP yande.re 198.251.89.183',
        'MAP assets.yande.re 198.251.89.183',
        'MAP files.yande.re 198.251.88.76',
        'MAP konachan.com 104.21.4.105',
        'MAP files.konachan.com 104.21.4.105'
      ].join(', ')
    );
  });

  it('关闭开关时不生成规则，便于回退直连', () => {
    expect(buildResolverRules({ ...defaultHostmapConfig(), enabled: false })).toBe('');
  });

  it('非法主机名或 IP 的条目被丢弃，其余规则保留', () => {
    const rules = buildResolverRules({
      enabled: true,
      entries: [
        { host: 'yande.re', ip: '198.251.89.183' },
        { host: 'bad host', ip: '198.251.89.183' },
        { host: 'files.yande.re', ip: '198.251.88.760' },
        { host: 'assets.yande.re', ip: 'not-an-ip' }
      ]
    });

    expect(rules).toBe('MAP yande.re 198.251.89.183');
  });

  it('校验函数接受合法值并拒绝越界 IP', () => {
    expect(isValidHostname('files.yande.re')).toBe(true);
    expect(isValidHostname('-yande.re')).toBe(false);
    expect(isValidIPv4('198.251.89.183')).toBe(true);
    expect(isValidIPv4('198.251.89.256')).toBe(false);
    expect(isValidIPv4('198.251.89')).toBe(false);
  });
});

describe('hostmap 配置解析', () => {
  it('缺失或非法输入回落到默认配置', () => {
    expect(parseHostmapConfig(undefined)).toEqual(DEFAULT_HOSTMAP);
    expect(parseHostmapConfig('not-an-object')).toEqual(DEFAULT_HOSTMAP);
    expect(parseHostmapConfig([])).toEqual(DEFAULT_HOSTMAP);
  });

  it('保留用户开关与条目，并清理条目首尾空格', () => {
    const config = parseHostmapConfig({
      enabled: false,
      entries: [{ host: ' yande.re ', ip: ' 198.251.89.183 ' }]
    });

    expect(config).toEqual({
      enabled: false,
      entries: [{ host: 'yande.re', ip: '198.251.89.183' }]
    });
  });

  it('entries 缺失时沿用默认映射，enabled 仍按用户值', () => {
    expect(parseHostmapConfig({ enabled: false })).toEqual({
      enabled: false,
      entries: defaultHostmapConfig().entries
    });
  });
});
