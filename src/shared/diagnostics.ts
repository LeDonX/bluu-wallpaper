import type { SiteId } from '@shared/constants';
import { SITE_LABELS } from '@shared/sites';

/** 02 §10 / 07 §6：诊断固定六项；07 验收以「磁盘」替代原设计的「限速」（DR-067） */
export const DIAG_ITEM_IDS = ['dns', 'tcp', 'tls', 'proxy', 'cf', 'disk'] as const;

export type DiagItemId = (typeof DIAG_ITEM_IDS)[number];

export const DIAG_STATUSES = ['ok', 'warn', 'fail', 'skipped'] as const;

export type DiagStatus = (typeof DIAG_STATUSES)[number];

export interface DiagItem {
  id: DiagItemId;
  label: string;
  status: DiagStatus;
  /** 面向用户的一句话结果 */
  detail: string;
  /** 失败或警告时的下一步建议；正常项为 null */
  advice: string | null;
  durationMs: number;
}

export interface DiagReport {
  site: SiteId;
  /** epoch 毫秒（05 §7） */
  ranAt: number;
  items: DiagItem[];
}

/** `diag:run` 入参：每次针对一个站点运行六项检测 */
export interface DiagRunInput {
  site: SiteId;
}

export const DIAG_ITEM_LABELS: Record<DiagItemId, string> = {
  dns: 'DNS 解析',
  tcp: 'TCP 443',
  tls: 'TLS 证书',
  proxy: '代理',
  cf: 'Cloudflare',
  disk: '下载目录'
};

export const DIAG_STATUS_LABELS: Record<DiagStatus, string> = {
  ok: '通过',
  warn: '警告',
  fail: '失败',
  skipped: '已跳过'
};

export interface DiagSummary {
  ok: number;
  warn: number;
  fail: number;
  skipped: number;
}

export function summarizeDiagStatus(items: DiagItem[]): DiagSummary {
  const summary: DiagSummary = { ok: 0, warn: 0, fail: 0, skipped: 0 };
  for (const item of items) summary[item.status] += 1;
  return summary;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** 报告时间使用本地时区，便于用户直接反馈（与 05 §7 的 epoch ms 存储不同） */
export function formatDiagTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 02 §10「一键复制报告」的纯文本格式，不依赖窗口环境，便于单测 */
export function formatDiagReport(report: DiagReport): string {
  const summary = summarizeDiagStatus(report.items);
  const lines: string[] = [
    'LePic 网络诊断报告',
    `站点：${SITE_LABELS[report.site]}`,
    `时间：${formatDiagTimestamp(report.ranAt)}`,
    `结果：通过 ${summary.ok} · 警告 ${summary.warn} · 失败 ${summary.fail} · 已跳过 ${summary.skipped}`,
    ''
  ];

  for (const item of report.items) {
    lines.push(`【${item.label}】${DIAG_STATUS_LABELS[item.status]}（${item.durationMs}ms）`);
    lines.push(`结果：${item.detail}`);
    if (item.advice !== null) lines.push(`建议：${item.advice}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
