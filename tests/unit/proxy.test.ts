import {
  buildProxyRules,
  DEFAULT_PROXY_CONFIG,
  defaultNetworkConfig,
  judgeProxyFallback,
  parseNetworkConfig,
  parseProxyConfig,
  parseProxyResolution
} from '@shared/proxy';
import { describe, expect, it } from 'vitest';

describe('代理规则组装', () => {
  it('直连不生成规则串', () => {
    expect(buildProxyRules({ ...DEFAULT_PROXY_CONFIG, mode: 'direct' })).toBe('');
  });

  it('HTTP 与 SOCKS5 生成带协议的规则串', () => {
    expect(buildProxyRules({ mode: 'http', host: '127.0.0.1', port: 8080 })).toBe(
      'http://127.0.0.1:8080'
    );
    expect(buildProxyRules({ mode: 'socks5', host: 'proxy.local', port: 1080 })).toBe(
      'socks5://proxy.local:1080'
    );
  });

  it('地址或端口非法时返回空串，交由回退判定处理', () => {
    expect(buildProxyRules({ mode: 'http', host: 'bad host', port: 8080 })).toBe('');
    expect(buildProxyRules({ mode: 'http', host: '127.0.0.1', port: 0 })).toBe('');
    expect(buildProxyRules({ mode: 'socks5', host: '127.0.0.1', port: 70000 })).toBe('');
    expect(buildProxyRules({ mode: 'http', host: 'http://proxy', port: 8080 })).toBe('');
  });
});

describe('代理配置解析', () => {
  it('缺失或非对象回落到直连默认值', () => {
    expect(parseProxyConfig(undefined)).toEqual(DEFAULT_PROXY_CONFIG);
    expect(parseProxyConfig('not-an-object')).toEqual(DEFAULT_PROXY_CONFIG);
    expect(parseProxyConfig([])).toEqual(DEFAULT_PROXY_CONFIG);
    expect(parseNetworkConfig(undefined)).toEqual(defaultNetworkConfig());
  });

  it('保留合法模式、地址与端口，并清理首尾空格', () => {
    expect(parseProxyConfig({ mode: 'socks5', host: ' 10.0.0.2 ', port: 1080 })).toEqual({
      mode: 'socks5',
      host: '10.0.0.2',
      port: 1080
    });
  });

  it('非法模式回落到直连，非法地址与端口回落到默认值', () => {
    expect(parseProxyConfig({ mode: 'pac', host: '127.0.0.1', port: 8080 })).toEqual({
      mode: 'direct',
      host: '127.0.0.1',
      port: 8080
    });
    expect(parseProxyConfig({ mode: 'http', host: 'bad host', port: 8080 })).toEqual({
      mode: 'http',
      host: DEFAULT_PROXY_CONFIG.host,
      port: 8080
    });
    expect(parseProxyConfig({ mode: 'http', host: '127.0.0.1', port: 1.5 })).toEqual({
      mode: 'http',
      host: '127.0.0.1',
      port: DEFAULT_PROXY_CONFIG.port
    });
  });

  it('network 分组缺失 proxy 时使用默认代理配置', () => {
    expect(parseNetworkConfig({})).toEqual({ proxy: DEFAULT_PROXY_CONFIG });
  });
});

describe('resolveProxy 结果解析', () => {
  it('识别直连、HTTP 与 SOCKS5', () => {
    expect(parseProxyResolution('DIRECT')).toBe('direct');
    expect(parseProxyResolution('PROXY 127.0.0.1:8080')).toBe('http');
    expect(parseProxyResolution('SOCKS5 127.0.0.1:1080')).toBe('socks5');
    expect(parseProxyResolution('SOCKS 127.0.0.1:1080')).toBe('socks5');
  });

  it('多条目取第一条，无法识别返回 null', () => {
    expect(parseProxyResolution('PROXY 127.0.0.1:8080; DIRECT')).toBe('http');
    expect(parseProxyResolution('QUIC')).toBeNull();
    expect(parseProxyResolution('')).toBeNull();
  });
});

describe('代理回退判定', () => {
  const base = { mode: 'http', rulesValid: true, resolution: 'http', probe: 'skipped' } as const;

  it('直连永远不需要回退', () => {
    expect(
      judgeProxyFallback({ ...base, mode: 'direct', rulesValid: false, resolution: null })
    ).toEqual({ fallback: false, reason: null });
  });

  it('规则非法、未生效、被系统忽略都回退并给出原因', () => {
    expect(judgeProxyFallback({ ...base, rulesValid: false })).toEqual({
      fallback: true,
      reason: '代理地址无效，已回退直连'
    });
    expect(judgeProxyFallback({ ...base, resolution: null })).toEqual({
      fallback: true,
      reason: '代理规则未生效，已回退直连'
    });
    expect(judgeProxyFallback({ ...base, resolution: 'direct' })).toEqual({
      fallback: true,
      reason: '系统未使用配置的代理，已回退直连'
    });
    expect(judgeProxyFallback({ ...base, mode: 'socks5' })).toEqual({
      fallback: true,
      reason: '代理未按配置生效，已回退直连'
    });
  });

  it('探测不可达才回退；探测通过或跳过均保持代理', () => {
    expect(judgeProxyFallback({ ...base, probe: 'unreachable' })).toEqual({
      fallback: true,
      reason: '代理不可达，已回退直连'
    });
    expect(judgeProxyFallback({ ...base, probe: 'ok' })).toEqual({ fallback: false, reason: null });
    expect(judgeProxyFallback(base)).toEqual({ fallback: false, reason: null });
  });
});
