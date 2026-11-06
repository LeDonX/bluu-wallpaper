import {
  createDiagnosticsService,
  type DiagnosticsDeps,
  TCP_TIMEOUT_MS,
  TLS_TIMEOUT_MS
} from '@main/diagnostics/service';
import { createDiagRunHandler } from '@main/ipc/handlers/diag-run';
import type { DiagReport } from '@shared/diagnostics';
import { formatDiagReport, summarizeDiagStatus } from '@shared/diagnostics';
import type { ProxyStatus } from '@shared/proxy';
import { describe, expect, it, vi } from 'vitest';

const directStatus: ProxyStatus = {
  configured: 'direct',
  effective: 'direct',
  fallback: false,
  reason: null
};

const yandeHostmap = {
  enabled: true,
  entries: [{ host: 'yande.re', ip: '198.251.89.183' }]
};

function makeDeps(overrides: Partial<DiagnosticsDeps> = {}): DiagnosticsDeps {
  let clock = 1_000;
  return {
    readHostmap: () => yandeHostmap,
    getProxyStatus: () => directStatus,
    hasClearance: async () => false,
    resolveHost: async () => [],
    tcpProbe: async () => undefined,
    tlsProbe: async () => ({ subjectCn: 'yande.re', subjectAltNames: 'DNS:yande.re' }),
    getDownloadDir: () => '/data/downloads',
    defaultDownloadDir: '/default/downloads',
    isUsableDirectory: () => true,
    prepareDirectory: () => false,
    now: () => {
      clock += 10;
      return clock;
    },
    ...overrides
  };
}

describe('formatDiagReport', () => {
  const report: DiagReport = {
    site: 'konachan',
    ranAt: new Date(2026, 10, 6, 15, 4, 5).getTime(),
    items: [
      {
        id: 'dns',
        label: 'DNS 解析',
        status: 'ok',
        detail: '系统解析 1.2.3.4',
        advice: null,
        durationMs: 12
      },
      {
        id: 'tcp',
        label: 'TCP 443',
        status: 'fail',
        detail: '无法连接 104.21.4.105:443（连接超时）',
        advice: 'IP 不可达，请更换映射 IP 或配置代理',
        durationMs: 5_000
      }
    ]
  };

  it('包含站点、时间、汇总、逐项结果与建议', () => {
    const text = formatDiagReport(report);

    expect(text).toContain('站点：konachan.com');
    expect(text).toContain('时间：2026-11-06 15:04:05');
    expect(text).toContain('通过 1 · 警告 0 · 失败 1 · 已跳过 0');
    expect(text).toContain('【DNS 解析】通过（12ms）');
    expect(text).toContain('【TCP 443】失败（5000ms）');
    expect(text).toContain('建议：IP 不可达，请更换映射 IP 或配置代理');
  });

  it('summarizeDiagStatus 按状态计数', () => {
    expect(summarizeDiagStatus(report.items)).toEqual({
      ok: 1,
      warn: 0,
      fail: 1,
      skipped: 0
    });
  });
});

describe('createDiagnosticsService', () => {
  it('hostmap 命中时直接使用映射 IP，且不触发系统 DNS', async () => {
    const resolveHost = vi.fn(async () => [] as string[]);
    const tcpProbe = vi.fn(async () => undefined);
    const tlsProbe = vi.fn(async () => ({ subjectCn: 'yande.re', subjectAltNames: null }));
    const diagnostics = createDiagnosticsService(
      makeDeps({ resolveHost, tcpProbe, tlsProbe })
    );

    const report = await diagnostics.run('yande');

    expect(resolveHost).not.toHaveBeenCalled();
    expect(tcpProbe).toHaveBeenCalledWith('198.251.89.183', TCP_TIMEOUT_MS);
    expect(tlsProbe).toHaveBeenCalledWith('198.251.89.183', 'yande.re', TLS_TIMEOUT_MS);
    expect(report.items.map((item) => item.id)).toEqual([
      'dns',
      'tcp',
      'tls',
      'proxy',
      'cf',
      'disk'
    ]);
    expect(report.items[0]).toMatchObject({
      status: 'ok',
      detail: expect.stringContaining('应用内映射 yande.re → 198.251.89.183')
    });
    expect(report.items[3]).toMatchObject({ status: 'ok' });
    expect(report.items[4]).toMatchObject({ status: 'skipped' });
    expect(report.items[5]).toMatchObject({ status: 'ok' });
  });

  it('hostmap 关闭时回退系统解析，TCP/TLS 使用域名', async () => {
    const resolveHost = vi.fn(async () => ['1.2.3.4']);
    const tcpProbe = vi.fn(async () => undefined);
    const diagnostics = createDiagnosticsService(
      makeDeps({
        readHostmap: () => ({ enabled: false, entries: [] }),
        resolveHost,
        tcpProbe
      })
    );

    const report = await diagnostics.run('yande');

    expect(resolveHost).toHaveBeenCalledWith('yande.re');
    expect(tcpProbe).toHaveBeenCalledWith('yande.re', TCP_TIMEOUT_MS);
    expect(report.items[0]).toMatchObject({
      status: 'ok',
      detail: expect.stringContaining('系统解析 1.2.3.4')
    });
  });

  it('DNS 解析为空时给出失败与建议，但仍继续 TCP/TLS 探测', async () => {
    const tcpProbe = vi.fn(async () => undefined);
    const diagnostics = createDiagnosticsService(
      makeDeps({
        readHostmap: () => ({ enabled: false, entries: [] }),
        resolveHost: async () => [],
        tcpProbe
      })
    );

    const report = await diagnostics.run('yande');

    expect(report.items[0]).toMatchObject({ status: 'fail', advice: expect.any(String) });
    expect(tcpProbe).toHaveBeenCalledWith('yande.re', TCP_TIMEOUT_MS);
  });

  it('TCP 与 TLS 探测异常分别归为失败项，不中断整份报告', async () => {
    const diagnostics = createDiagnosticsService(
      makeDeps({
        tcpProbe: async () => {
          throw new Error('ECONNREFUSED');
        },
        tlsProbe: async () => {
          throw new Error('certificate has expired');
        },
        getProxyStatus: () => ({
          configured: 'socks5',
          effective: 'direct',
          fallback: true,
          reason: '系统未使用配置的代理，已回退直连'
        })
      })
    );

    const report = await diagnostics.run('yande');

    expect(report.items).toHaveLength(6);
    expect(report.items[1]).toMatchObject({ status: 'fail', advice: expect.any(String) });
    expect(report.items[1]?.detail).toContain('ECONNREFUSED');
    expect(report.items[2]).toMatchObject({ status: 'fail', advice: expect.any(String) });
    expect(report.items[2]?.detail).toContain('certificate has expired');
  });

  it('代理回退时标记警告并复用回退原因作为建议', async () => {
    const diagnostics = createDiagnosticsService(
      makeDeps({
        getProxyStatus: () => ({
          configured: 'http',
          effective: 'direct',
          fallback: true,
          reason: '代理不可达，已回退直连'
        })
      })
    );

    const report = await diagnostics.run('yande');

    expect(report.items[3]).toMatchObject({
      status: 'warn',
      advice: '代理不可达，已回退直连'
    });
    expect(report.items[3]?.detail).toContain('已配置：HTTP 代理 · 实际生效：直连');
  });

  it('konachan 的 Cloudflare 项按 cf_clearance 判定，yande 跳过', async () => {
    const hasClearance = vi.fn(async () => false);
    const konachan = createDiagnosticsService(
      makeDeps({
        hasClearance,
        readHostmap: () => ({ enabled: false, entries: [] }),
        resolveHost: async () => ['1.2.3.4']
      })
    );

    const report = await konachan.run('konachan');
    expect(hasClearance).toHaveBeenCalledWith('konachan');
    expect(report.items[4]).toMatchObject({ status: 'warn', advice: expect.any(String) });

    const withClearance = createDiagnosticsService(makeDeps({ hasClearance: async () => true }));
    const cleared = await withClearance.run('konachan');
    expect(cleared.items[4]).toMatchObject({ status: 'ok' });

    const yandeHasClearance = vi.fn(async () => true);
    const yande = createDiagnosticsService(makeDeps({ hasClearance: yandeHasClearance }));
    const yandeReport = await yande.run('yande');
    expect(yandeHasClearance).not.toHaveBeenCalled();
    expect(yandeReport.items[4]).toMatchObject({ status: 'skipped' });
  });

  it('未配置的默认目录缺失时先创建再判定，与首次下载行为一致', async () => {
    const prepareDirectory = vi.fn(() => true);
    const diagnostics = createDiagnosticsService(
      makeDeps({
        getDownloadDir: () => '',
        defaultDownloadDir: '/default/downloads',
        isUsableDirectory: () => false,
        prepareDirectory
      })
    );

    const report = await diagnostics.run('yande');

    expect(prepareDirectory).toHaveBeenCalledWith('/default/downloads');
    expect(report.items[5]).toMatchObject({ status: 'ok' });
  });

  it('下载目录为空时使用默认目录，不可写则失败并提示重选', async () => {
    const diagnostics = createDiagnosticsService(
      makeDeps({
        getDownloadDir: () => '   ',
        defaultDownloadDir: '/default/downloads',
        isUsableDirectory: () => false
      })
    );

    const report = await diagnostics.run('yande');

    expect(report.items[5]).toMatchObject({
      status: 'fail',
      detail: '目录不可用：/default/downloads',
      advice: '请在设置页重新选择可写的下载目录'
    });
  });
});

describe('diag:run handler', () => {
  const report: DiagReport = {
    site: 'yande',
    ranAt: 1_000,
    items: []
  };

  it('合法入参调用服务并返回报告', async () => {
    const run = vi.fn(async () => report);
    const result = await createDiagRunHandler({ run })({ site: 'konachan' });

    expect(run).toHaveBeenCalledWith('konachan');
    expect(result).toEqual({ ok: true, data: report });
  });

  it('未知站点返回 CONFIG，不调用服务', async () => {
    const run = vi.fn(async () => report);
    const result = await createDiagRunHandler({ run })({ site: 'danbooru' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONFIG');
    expect(run).not.toHaveBeenCalled();
  });

  it('服务意外异常映射为 NETWORK', async () => {
    const result = await createDiagRunHandler({
      run: async () => {
        throw new Error('boom');
      }
    })({ site: 'yande' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK');
      expect(result.error.detail).toContain('boom');
    }
  });
});
