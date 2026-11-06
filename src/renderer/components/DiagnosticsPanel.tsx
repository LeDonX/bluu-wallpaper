import { SITE_IDS, type SiteId } from '@shared/constants';
import {
  DIAG_STATUS_LABELS,
  type DiagReport,
  formatDiagReport,
  formatDiagTimestamp,
  summarizeDiagStatus
} from '@shared/diagnostics';
import { type AppError, createAppError } from '@shared/errors';
import { SITE_LABELS } from '@shared/sites';
import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './DiagnosticsPanel.module.css';

/** 剪贴板 API 在部分渲染环境不可用，退回隐藏 textarea + execCommand */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走回退方案
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

/**
 * 02 §10 / T-34 / T-60：一键运行六项诊断并展示逐项结果与建议；
 * 探测全部在主进程执行，本组件只负责触发与展示（05 §2），嵌入设置页「诊断」分组。
 */
export function DiagnosticsPanel(): ReactElement {
  const [site, setSite] = useState<SiteId>('yande');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagReport | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    if (running) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await window.booru.runDiagnostics({ site });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReport(result.data);
    } catch {
      setError(createAppError('NETWORK', '诊断失败，请稍后重试', { retryable: true }));
    } finally {
      setRunning(false);
    }
  };

  const copyReport = async (): Promise<void> => {
    if (report === null) return;
    const copied = await copyToClipboard(formatDiagReport(report));
    setNotice(copied ? '诊断报告已复制到剪贴板' : '复制失败，请手动选择报告文本');
  };

  const summary = report === null ? null : summarizeDiagStatus(report.items);

  return (
    <div className={styles.container}>
      <p className={styles.hint}>
        检查 DNS、TCP 连接、TLS 证书、代理、Cloudflare 与下载目录；诊断只读，不修改任何设置。
      </p>

      <div className={styles.controls}>
        <div className={styles.tabs} role="group" aria-label="诊断站点">
          {SITE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.tab}
              aria-pressed={site === id}
              disabled={running}
              onClick={() => {
                setSite(id);
                setReport(null);
                setError(null);
                setNotice(null);
              }}
            >
              {SITE_LABELS[id]}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={running}
            onClick={() => {
              void run();
            }}
          >
            {running ? '正在诊断…' : '开始诊断'}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={report === null}
            onClick={() => {
              void copyReport();
            }}
          >
            复制报告
          </button>
        </div>
      </div>

      {error !== null ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : null}
      {notice !== null ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {report === null || summary === null ? (
        <p className={styles.hint}>
          {running
            ? '正在检测，DNS 与 TLS 探测最长约 8 秒…'
            : `已选择 ${SITE_LABELS[site]}，点击「开始诊断」运行六项检查。`}
        </p>
      ) : (
        <section aria-label="诊断结果">
          <div className={styles.summary}>
            <span>
              {SITE_LABELS[report.site]} · {formatDiagTimestamp(report.ranAt)}
            </span>
            <span>
              通过 {summary.ok} · 警告 {summary.warn} · 失败 {summary.fail} · 已跳过{' '}
              {summary.skipped}
            </span>
          </div>
          <ul className={styles.items}>
            {report.items.map((item) => (
              <li key={item.id} className={styles.item} data-status={item.status}>
                <div className={styles.itemHead}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.itemStatus} data-status={item.status}>
                    {DIAG_STATUS_LABELS[item.status]}
                  </span>
                  <span className={styles.itemDuration}>{item.durationMs}ms</span>
                </div>
                <p className={styles.itemDetail}>{item.detail}</p>
                {item.advice === null ? null : (
                  <p className={styles.itemAdvice}>建议：{item.advice}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
