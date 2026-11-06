import type { TlsCertificateInfo } from '@main/diagnostics/probes';
import type { SiteId } from '@shared/constants';
import {
  DIAG_ITEM_LABELS,
  type DiagItem,
  type DiagItemId,
  type DiagReport,
  type DiagStatus
} from '@shared/diagnostics';
import { type HostmapConfig, isValidIPv4 } from '@shared/hostmap';
import { PROXY_MODE_LABELS, type ProxyStatus } from '@shared/proxy';
import { siteBaseUrl } from '@shared/sites';

export const TCP_TIMEOUT_MS = 5_000;
export const TLS_TIMEOUT_MS = 8_000;

/** 02 §10 / DR-067：六项探测全部可注入，单测不访问真实网络 */
export interface DiagnosticsDeps {
  readHostmap(): HostmapConfig;
  getProxyStatus(): ProxyStatus;
  hasClearance(site: SiteId): Promise<boolean>;
  resolveHost(host: string): Promise<string[]>;
  tcpProbe(target: string, timeoutMs: number): Promise<void>;
  tlsProbe(target: string, servername: string, timeoutMs: number): Promise<TlsCertificateInfo>;
  /** 配置中的下载目录；空串表示使用 `defaultDownloadDir` */
  getDownloadDir(): string;
  defaultDownloadDir: string;
  isUsableDirectory(path: string): boolean;
  /** 仅用于未配置的默认目录：缺失时按首次下载行为创建，返回创建后是否可用 */
  prepareDirectory?(path: string): boolean;
  now?(): number;
}

export interface DiagnosticsService {
  run(site: SiteId): Promise<DiagReport>;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** 站点根地址只用于取主机名；诊断对象始终是站点主域 */
function hostForSite(site: SiteId): string {
  return new URL(siteBaseUrl(site)).hostname;
}

export function createDiagnosticsService(deps: DiagnosticsDeps): DiagnosticsService {
  const now = deps.now ?? Date.now;

  const makeItem = (
    id: DiagItemId,
    startedAt: number,
    status: DiagStatus,
    detail: string,
    advice: string | null = null
  ): DiagItem => ({
    id,
    label: DIAG_ITEM_LABELS[id],
    status,
    detail,
    advice,
    durationMs: Math.max(0, now() - startedAt)
  });

  /**
   * 启用 hostmap 时 TCP/TLS 直接探测映射 IP，与 Chromium 实际链路一致；
   * 未启用或缺少条目时退回系统 DNS 解析结果（DR-067）。
   */
  const runDns = async (
    host: string,
    hostmap: HostmapConfig
  ): Promise<{ item: DiagItem; target: string }> => {
    const startedAt = now();
    const mapped = hostmap.enabled
      ? hostmap.entries.find((entry) => entry.host === host && isValidIPv4(entry.ip))
      : undefined;

    if (mapped !== undefined) {
      return {
        item: makeItem('dns', startedAt, 'ok', `应用内映射 ${host} → ${mapped.ip}`),
        target: mapped.ip
      };
    }

    let addresses: string[] = [];
    try {
      addresses = await deps.resolveHost(host);
    } catch {
      addresses = [];
    }

    if (addresses.length > 0) {
      const detail = hostmap.enabled
        ? `未配置映射，系统解析 ${addresses.join('、')}`
        : `系统解析 ${addresses.join('、')}`;
      return { item: makeItem('dns', startedAt, 'ok', detail), target: host };
    }

    return {
      item: makeItem(
        'dns',
        startedAt,
        'fail',
        `无法解析 ${host}`,
        hostmap.enabled ? '请检查 IP 映射条目，或关闭映射后重启应用' : '请检查网络连接后重试'
      ),
      target: host
    };
  };

  const runTcp = async (target: string): Promise<DiagItem> => {
    const startedAt = now();
    try {
      await deps.tcpProbe(target, TCP_TIMEOUT_MS);
      return makeItem('tcp', startedAt, 'ok', `已连接 ${target}:443`);
    } catch (error) {
      return makeItem(
        'tcp',
        startedAt,
        'fail',
        `无法连接 ${target}:443（${errorMessage(error)}）`,
        'IP 不可达，请更换映射 IP 或配置代理'
      );
    }
  };

  const runTls = async (target: string, host: string): Promise<DiagItem> => {
    const startedAt = now();
    try {
      const certificate = await deps.tlsProbe(target, host, TLS_TIMEOUT_MS);
      const cn =
        certificate.subjectCn === null || certificate.subjectCn === ''
          ? '未提供'
          : certificate.subjectCn;
      return makeItem('tls', startedAt, 'ok', `证书校验通过（${host}，CN=${cn}）`);
    } catch (error) {
      return makeItem(
        'tls',
        startedAt,
        'fail',
        `证书校验失败（${errorMessage(error)}）`,
        '证书异常，可能存在中间人；请检查代理或关闭 IP 映射后重试'
      );
    }
  };

  const runProxy = (): DiagItem => {
    const startedAt = now();
    const status = deps.getProxyStatus();
    const effective =
      status.effective === null ? '未知' : PROXY_MODE_LABELS[status.effective];
    const detail = `已配置：${PROXY_MODE_LABELS[status.configured]} · 实际生效：${effective}`;

    if (status.fallback) {
      const reason = status.reason ?? '代理不可用，已回退直连';
      return makeItem('proxy', startedAt, 'warn', `${detail} · ${reason}`, reason);
    }
    if (status.effective === null) {
      return makeItem(
        'proxy',
        startedAt,
        'warn',
        detail,
        '代理规则未生效，请到设置页检查代理配置'
      );
    }
    return makeItem('proxy', startedAt, 'ok', detail);
  };

  const runCloudflare = async (site: SiteId): Promise<DiagItem> => {
    const startedAt = now();
    if (site === 'yande') {
      return makeItem('cf', startedAt, 'skipped', '该站点无 Cloudflare 挑战');
    }

    let hasClearance = false;
    try {
      hasClearance = await deps.hasClearance(site);
    } catch {
      hasClearance = false;
    }

    if (hasClearance) {
      return makeItem('cf', startedAt, 'ok', '已取得 cf_clearance，验证结果可复用');
    }
    return makeItem(
      'cf',
      startedAt,
      'warn',
      '尚未取得 cf_clearance',
      '首次访问 konachan 时应用会自动验证；仍失败请重启应用后重试'
    );
  };

  const runDisk = (): DiagItem => {
    const startedAt = now();
    const configured = deps.getDownloadDir().trim();
    const dir = configured === '' ? deps.defaultDownloadDir : configured;

    if (deps.isUsableDirectory(dir)) {
      return makeItem('disk', startedAt, 'ok', `目录可用：${dir}`);
    }
    // 新装应用尚未下载过时默认目录可能不存在；与 DR-059 首次下载行为保持一致
    if (configured === '' && deps.prepareDirectory !== undefined && deps.prepareDirectory(dir)) {
      return makeItem('disk', startedAt, 'ok', `目录可用：${dir}`);
    }
    return makeItem(
      'disk',
      startedAt,
      'fail',
      `目录不可用：${dir}`,
      '请在设置页重新选择可写的下载目录'
    );
  };

  return {
    run: async (site) => {
      const ranAt = now();
      const host = hostForSite(site);
      const hostmap = deps.readHostmap();

      // DNS 结果决定 TCP/TLS 探测目标；其余四项互不依赖，并行执行缩短等待
      const dns = await runDns(host, hostmap);
      const [tcp, tls, proxy, cf, disk] = await Promise.all([
        runTcp(dns.target),
        runTls(dns.target, host),
        Promise.resolve(runProxy()),
        runCloudflare(site),
        Promise.resolve(runDisk())
      ]);

      return { site, ranAt, items: [dns.item, tcp, tls, proxy, cf, disk] };
    }
  };
}
