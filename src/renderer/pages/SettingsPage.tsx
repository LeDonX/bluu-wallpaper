import { ErrorState } from '@renderer/components/ErrorState';
import { ProgressBar } from '@renderer/components/ProgressBar';
import { SITE_IDS, type SiteId } from '@shared/constants';
import { MAX_BLACKLIST_TAGS, splitBlacklistText } from '@shared/content';
import {
  type DownloadConfig,
  MAX_DOWNLOAD_CONCURRENCY,
  MIN_DOWNLOAD_CONCURRENCY
} from '@shared/downloads';
import { type AppError, createAppError } from '@shared/errors';
import type { HostMapEntry } from '@shared/hostmap';
import { PROXY_MODE_LABELS, type ProxyMode, type ProxyStatus } from '@shared/proxy';
import type { Settings } from '@shared/settings';
import { resolveDownloadDirLabel } from '@shared/settings';
import type { UpdateState } from '@shared/updates';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { IpMapEditor } from '../components/IpMapEditor';
import { SettingsSection } from '../components/SettingsSection';
import { Switch } from '../components/Switch';
import styles from './SettingsPage.module.css';

const SITE_LABELS: Record<SiteId, string> = {
  yande: 'yande.re',
  konachan: 'konachan.com'
};

/** 首版搜索页与已看/收藏写入固定为 yande（T-28 前无站点切换） */
const CURRENT_SITE: SiteId = 'yande';

type ClearTarget = 'current' | 'all';

const TARGET_LABELS: Record<ClearTarget, string> = {
  current: `当前站点（${SITE_LABELS[CURRENT_SITE]}）`,
  all: `全部站点（${SITE_IDS.map((site) => SITE_LABELS[site]).join(' + ')}）`
};

type SectionId = 'network' | 'downloads' | 'content' | 'privacy' | 'update';

const SAVED_NOTICE: Record<SectionId, string> = {
  network: '网络设置已保存',
  downloads: '下载设置已保存，后续入队任务按新设置执行',
  content: '内容设置已保存',
  privacy: '',
  update: ''
};

interface Feedback {
  notice?: string;
  error?: string;
}

function describeCleared(views: number, favorites: number): string {
  if (views === 0 && favorites === 0) return '没有可清除的记录';
  return `已清除 ${views} 条已看记录、${favorites} 条收藏记录`;
}

function SectionFeedback({ value }: { value: Feedback | undefined }): ReactElement | null {
  if (value === undefined) return null;
  return (
    <>
      {value.notice !== undefined ? (
        <p className={styles.notice} role="status">
          {value.notice}
        </p>
      ) : null}
      {value.error !== undefined ? (
        <p className={styles.error} role="alert">
          {value.error}
        </p>
      ) : null}
    </>
  );
}

function proxyDescription(status: ProxyStatus | null): string {
  if (status === null) return '代理状态：读取中…';
  const effective =
    status.effective === null ? '未知' : PROXY_MODE_LABELS[status.effective as ProxyMode];
  const base = `已配置：${PROXY_MODE_LABELS[status.configured]} · 实际生效：${effective}`;
  return status.fallback ? `${base} · ${status.reason ?? '代理不可用，已回退直连'}` : base;
}

/** DR-066：自动更新状态文案；错误与不支持的原因由主进程回传 */
function describeUpdate(state: UpdateState | null): string {
  if (state === null) return '正在读取更新状态…';
  switch (state.phase) {
    case 'idle':
      return '尚未检查更新';
    case 'checking':
      return '正在检查更新…';
    case 'not-available':
      return `已是最新版本（v${state.currentVersion}）`;
    case 'available':
      return `发现新版本 v${state.version ?? ''}，下载完成后重启即可生效`;
    case 'downloading': {
      const percent =
        state.progress === null ? '' : ` ${Math.round(state.progress.percent)}%`;
      return `正在下载更新${percent}…`;
    }
    case 'downloaded':
      return `新版本 v${state.version ?? ''} 已下载，重启应用后生效`;
    case 'error':
      return state.message ?? '检查更新失败，请稍后重试';
    case 'unsupported':
      return state.message ?? '当前版本不支持自动更新';
    default: {
      const exhaustive: never = state.phase;
      return exhaustive;
    }
  }
}

/**
 * 02 §9 / 04 T-30：网络（代理 + IP 映射）、下载（目录/模板/并发）、内容（R18）、隐私四组。
 * 保存由主进程校验并落盘，页面只维护草稿与反馈（05 §6）。
 */
export function SettingsPage(): ReactElement {
  const [draft, setDraft] = useState<Settings | null>(null);
  const [defaultDownloadDir, setDefaultDownloadDir] = useState('');
  // DR-056：黑名单以文本编辑，保存时切成标签数组并交由主进程归一化
  const [blacklistText, setBlacklistText] = useState('');
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [feedback, setFeedback] = useState<Record<SectionId, Feedback | undefined>>({
    network: undefined,
    downloads: undefined,
    content: undefined,
    privacy: undefined,
    update: undefined
  });
  const [saving, setSaving] = useState<SectionId | null>(null);
  const [pickingDir, setPickingDir] = useState(false);
  const [loadError, setLoadError] = useState<AppError | null>(null);
  const [confirmingExplicit, setConfirmingExplicit] = useState(false);

  const [target, setTarget] = useState<ClearTarget>('current');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  // DR-066：更新状态由主进程维护，页面只订阅广播并展示
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [updateAction, setUpdateAction] = useState<'check' | 'download' | 'install' | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // DR-052：设置读取失败统一走 ErrorState 并提供重试
  const loadSettings = useCallback((): void => {
    window.booru
      .getSettings()
      .then((result) => {
        if (!result.ok) {
          setLoadError(result.error);
          return;
        }
        setDraft(result.data.settings);
        setDefaultDownloadDir(result.data.defaultDownloadDir);
        setBlacklistText(result.data.settings.content.blacklist.join('\n'));
      })
      .catch(() => {
        setLoadError(createAppError('CONFIG', '读取设置失败', { retryable: true }));
      });
  }, []);

  useEffect(() => {
    let active = true;
    // 首次读取放到下一个 tick，避免在 effect 同步阶段触发 setState（react-hooks/set-state-in-effect）
    const timer = window.setTimeout(() => {
      loadSettings();
    }, 0);

    window.booru
      .getNetworkStatus()
      .then((result) => {
        if (active && result.ok) setProxyStatus(result.data);
      })
      .catch(() => {
        // 代理状态仅用于展示，失败不影响设置编辑
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadSettings]);

  // DR-066：首次读取当前更新状态，之后只靠 `updates:status` 广播增量刷新
  useEffect(() => {
    let active = true;
    window.booru
      .getUpdateState()
      .then((result) => {
        if (active && result.ok) setUpdateState(result.data);
      })
      .catch(() => {
        // 更新状态仅用于展示，读取失败不影响其它设置
      });
    const unsubscribe = window.booru.onUpdateStatus((state) => {
      setUpdateState(state);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const setSectionFeedback = (section: SectionId, next: Feedback | undefined): void => {
    setFeedback((current) => ({ ...current, [section]: next }));
  };

  const save = async (section: SectionId, nextDraft?: Settings): Promise<void> => {
    const settings = nextDraft ?? draft;
    if (settings === null || saving !== null) return;
    setSaving(section);
    setSectionFeedback(section, undefined);

    try {
      const result = await window.booru.setSettings(settings);
      if (!result.ok) {
        setSectionFeedback(section, { error: result.error.message });
        return;
      }
      setDraft(result.data.settings);
      setDefaultDownloadDir(result.data.defaultDownloadDir);
      setBlacklistText(result.data.settings.content.blacklist.join('\n'));
      setProxyStatus(result.data.proxyStatus);
      const proxyError =
        section === 'network' && result.data.proxyStatus.fallback
          ? (result.data.proxyStatus.reason ?? '代理不可用，已回退直连')
          : undefined;
      const notice =
        section === 'network' && result.data.restartRequired
          ? '网络设置已保存；IP 映射改动需重启应用后生效'
          : SAVED_NOTICE[section];
      setSectionFeedback(section, { notice, error: proxyError });
    } catch {
      setSectionFeedback(section, { error: '保存设置失败' });
    } finally {
      setSaving(null);
    }
  };

  const updateDraft = (updater: (current: Settings) => Settings): void => {
    setDraft((current) => (current === null ? current : updater(current)));
  };

  const updateDownloadConfig = (patch: Partial<DownloadConfig>): void => {
    updateDraft((current) => ({ ...current, downloads: { ...current.downloads, ...patch } }));
  };

  // DR-061：下载时目录校验会把新目录写回设置，这里保持常驻页面的草稿同步
  useEffect(() => {
    return window.booru.onDestinationChanged((event) => {
      setDraft((current) =>
        current === null
          ? current
          : {
              ...current,
              downloads: { ...current.downloads, destinationDir: event.destinationDir }
            }
      );
      setFeedback((current) => ({
        ...current,
        downloads: { notice: `下载目录已更新为 ${event.destinationDir}` }
      }));
    });
  }, []);

  const pickDownloadDirectory = async (): Promise<void> => {
    if (draft === null || saving !== null || clearing || pickingDir) return;
    setPickingDir(true);
    setSectionFeedback('downloads', undefined);
    try {
      const result = await window.booru.pickDownloadDirectory({
        current: draft.downloads.destinationDir
      });
      if (!result.ok) {
        setSectionFeedback('downloads', { error: result.error.message });
        return;
      }
      if (result.data === null) return;
      updateDownloadConfig({ destinationDir: result.data });
      setSectionFeedback('downloads', { notice: '已选择目录，保存下载设置后生效' });
    } catch {
      setSectionFeedback('downloads', { error: '选择下载目录失败' });
    } finally {
      setPickingDir(false);
    }
  };

  const handleExplicitToggle = (checked: boolean): void => {
    if (checked) {
      setConfirmingExplicit(true);
      return;
    }
    const next =
      draft === null ? null : { ...draft, content: { ...draft.content, allowExplicit: false } };
    if (next === null) return;
    setDraft(next);
    void save('content', next);
  };

  const confirmExplicit = (): void => {
    if (draft === null) return;
    const next = { ...draft, content: { ...draft.content, allowExplicit: true } };
    setDraft(next);
    setConfirmingExplicit(false);
    void save('content', next);
  };

  const handleBlacklistChange = (value: string): void => {
    setBlacklistText(value);
    updateDraft((current) => ({
      ...current,
      content: { ...current.content, blacklist: splitBlacklistText(value) }
    }));
    setSectionFeedback('content', undefined);
  };

  const handleClear = async (): Promise<void> => {
    if (clearing) return;
    setClearing(true);
    setSectionFeedback('privacy', undefined);

    try {
      const result = await window.booru.clearViews(
        target === 'current' ? { site: CURRENT_SITE } : {}
      );
      if (!result.ok) {
        setSectionFeedback('privacy', { error: result.error.message });
        return;
      }
      setConfirmingClear(false);
      setSectionFeedback('privacy', {
        notice: describeCleared(result.data.clearedViews, result.data.clearedFavorites)
      });
    } catch {
      setSectionFeedback('privacy', { error: '清除浏览记录失败' });
    } finally {
      setClearing(false);
    }
  };

  // DR-066：检查 / 下载 / 安装均手动触发；结果状态由广播更新，返回值只用于前置失败提示
  const performUpdate = async (action: 'check' | 'download' | 'install'): Promise<void> => {
    if (updateAction !== null) return;
    setUpdateAction(action);
    setUpdateError(null);
    try {
      const result =
        action === 'check'
          ? await window.booru.checkForUpdates()
          : action === 'download'
            ? await window.booru.downloadUpdate()
            : await window.booru.installUpdate();
      if (!result.ok) {
        setUpdateError(result.error.message);
        return;
      }
      if (action !== 'install') setUpdateState(result.data);
    } catch {
      setUpdateError('更新操作失败，请稍后重试');
    } finally {
      setUpdateAction(null);
    }
  };

  if (draft === null) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>设置</h1>
          <p className={styles.subtitle}>{loadError === null ? '正在读取设置…' : '读取设置失败'}</p>
        </header>
        {loadError !== null ? (
          <ErrorState
            error={loadError}
            onRetry={() => {
              setLoadError(null);
              loadSettings();
            }}
          />
        ) : null}
      </main>
    );
  }

  const busy = saving !== null || clearing;
  const proxyDisabled = draft.network.proxy.mode === 'direct';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>设置</h1>
        <p className={styles.subtitle}>网络、下载、内容与本地数据</p>
      </header>

      <SettingsSection id="settings-network" title="网络">
        <div className={styles.item}>
          <h3 className={styles.itemTitle}>代理</h3>
          <p className={styles.description}>
            保存后立即对两个站点应用并复检；代理不可达时自动回退直连，顶部横幅会给出原因。
          </p>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>模式</span>
              <select
                className={styles.input}
                value={draft.network.proxy.mode}
                disabled={busy}
                onChange={(event) => {
                  const mode = event.target.value as ProxyMode;
                  updateDraft((current) => ({
                    ...current,
                    network: { proxy: { ...current.network.proxy, mode } }
                  }));
                }}
              >
                {(Object.keys(PROXY_MODE_LABELS) as ProxyMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {PROXY_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>地址</span>
              <input
                className={styles.input}
                value={draft.network.proxy.host}
                disabled={busy || proxyDisabled}
                onChange={(event) => {
                  const host = event.target.value;
                  updateDraft((current) => ({
                    ...current,
                    network: { proxy: { ...current.network.proxy, host } }
                  }));
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>端口</span>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={65535}
                value={draft.network.proxy.port}
                disabled={busy || proxyDisabled}
                onChange={(event) => {
                  const port = Number(event.target.value);
                  updateDraft((current) => ({
                    ...current,
                    network: { proxy: { ...current.network.proxy, port } }
                  }));
                }}
              />
            </label>
          </div>

          <p className={styles.status}>{proxyDescription(proxyStatus)}</p>
        </div>

        <div className={styles.item}>
          <h3 className={styles.itemTitle}>IP 映射</h3>
          <p className={styles.description}>
            应用内域名解析，不修改系统 hosts。默认覆盖两站主站与图片域名，改动需重启应用后生效。
          </p>
          <div className={styles.inlineControl}>
            <Switch
              checked={draft.hostmap.enabled}
              label="启用 IP 映射"
              disabled={busy}
              onChange={(checked) => {
                updateDraft((current) => ({
                  ...current,
                  hostmap: { ...current.hostmap, enabled: checked }
                }));
              }}
            />
          </div>
          <IpMapEditor
            entries={draft.hostmap.entries}
            disabled={busy}
            onChange={(entries: HostMapEntry[]) => {
              updateDraft((current) => ({ ...current, hostmap: { ...current.hostmap, entries } }));
            }}
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => {
              void save('network');
            }}
          >
            {saving === 'network' ? '正在保存…' : '保存网络设置'}
          </button>
        </div>
        <SectionFeedback value={feedback.network} />
      </SettingsSection>

      <SettingsSection id="settings-downloads" title="下载">
        <div className={styles.item}>
          <h3 className={styles.itemTitle}>任务设置</h3>
          <p className={styles.description}>
            改动保存后立即影响新入队的任务；已在下载或排队的任务保持原目录与文件名。
          </p>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>并发数</span>
              <input
                className={styles.input}
                type="number"
                min={MIN_DOWNLOAD_CONCURRENCY}
                max={MAX_DOWNLOAD_CONCURRENCY}
                value={draft.downloads.concurrency}
                disabled={busy}
                onChange={(event) => {
                  updateDownloadConfig({ concurrency: Number(event.target.value) });
                }}
              />
            </label>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="settings-download-dir">
                下载目录
              </label>
              <div className={styles.inputWithButton}>
                <input
                  id="settings-download-dir"
                  className={styles.input}
                  value={draft.downloads.destinationDir}
                  placeholder={resolveDownloadDirLabel('', defaultDownloadDir)}
                  disabled={busy}
                  onChange={(event) => {
                    updateDownloadConfig({ destinationDir: event.target.value });
                  }}
                />
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busy || pickingDir}
                  onClick={() => {
                    void pickDownloadDirectory();
                  }}
                >
                  {pickingDir ? '选择中…' : '选择文件夹…'}
                </button>
              </div>
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>批量默认格式</span>
              <select
                className={styles.input}
                value={draft.downloads.format}
                disabled={busy}
                onChange={(event) => {
                  // DR-051：查看器单张下载会另行询问，这里只决定批量入队
                  updateDownloadConfig({
                    format: event.target.value === 'jpeg' ? 'jpeg' : 'original'
                  });
                }}
              >
                <option value="original">原图</option>
                <option value="jpeg">较小 JPG</option>
              </select>
            </label>
          </div>

          <label className={styles.fieldWide}>
            <span className={styles.fieldLabel}>命名模板</span>
            <input
              className={styles.input}
              value={draft.downloads.template}
              disabled={busy}
              onChange={(event) => {
                updateDownloadConfig({ template: event.target.value });
              }}
            />
          </label>
          <p className={styles.description}>
            可用变量：{'{site}'} {'{rating}'} {'{artist}'} {'{copyright}'} {'{character}'} {'{id}'}{' '}
            {'{md5}'} {'{ext}'}
            ；留空表示使用默认目录。可点「选择文件夹」按系统对话框选择目录，保存后生效。批量默认格式用于多选与查询级下载；在查看器中单张下载时可选原图或较小的
            JPG，站点没有独立 JPG 版本时自动使用原图。
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={busy}
            onClick={() => {
              void save('downloads');
            }}
          >
            {saving === 'downloads' ? '正在保存…' : '保存下载设置'}
          </button>
        </div>
        <SectionFeedback value={feedback.downloads} />
      </SettingsSection>

      <SettingsSection id="settings-content" title="内容">
        <div className={styles.item}>
          <h3 className={styles.itemTitle}>R18 内容</h3>
          <p className={styles.description}>
            默认关闭时会自动在搜索中排除 explicit 分级；开启后立即生效，用户显式写的 rating
            条件不受影响。
          </p>
          <div className={styles.inlineControl}>
            <Switch
              checked={draft.content.allowExplicit}
              label="允许 R18（explicit）"
              disabled={busy}
              onChange={handleExplicitToggle}
            />
          </div>

          {confirmingExplicit ? (
            <div
              className={styles.confirm}
              role="alertdialog"
              aria-modal="false"
              aria-labelledby="settings-explicit-confirm-title"
            >
              <p id="settings-explicit-confirm-title" className={styles.confirmTitle}>
                确认开启 R18 内容？开启后搜索结果会包含 explicit 分级。
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={() => {
                    setConfirmingExplicit(false);
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={busy}
                  onClick={confirmExplicit}
                >
                  确认开启
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.item}>
          <h3 className={styles.itemTitle}>标签黑名单</h3>
          <p className={styles.description}>
            命中黑名单的图片会在搜索结果中被排除（以 -tag
            请求站点），榜单结果在本地过滤。每行或空格分隔一个标签，保存后立即生效。
          </p>
          <label className={styles.fieldWide}>
            <span className={styles.fieldLabel}>排除标签（最多 {MAX_BLACKLIST_TAGS} 个）</span>
            <textarea
              className={styles.textarea}
              rows={5}
              value={blacklistText}
              placeholder="例如：\nlowres\nbad_id\nartist_name"
              disabled={busy}
              onChange={(event) => {
                handleBlacklistChange(event.target.value);
              }}
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={busy}
              onClick={() => {
                void save('content');
              }}
            >
              {saving === 'content' ? '正在保存…' : '保存标签黑名单'}
            </button>
          </div>
        </div>
        <SectionFeedback value={feedback.content} />
      </SettingsSection>

      <SettingsSection id="settings-privacy" title="隐私">
        <div className={styles.item}>
          <h3 className={styles.itemTitle}>清除浏览记录</h3>
          <p className={styles.description}>
            清除本机保存的已看标记与收藏记录，不会删除图片元数据、标签缓存或站点数据。此操作不可撤销。
          </p>

          <div className={styles.options} role="radiogroup" aria-label="清除范围">
            {(['current', 'all'] as const).map((value) => (
              <label key={value} className={styles.option} data-disabled={clearing}>
                <input
                  type="radio"
                  name="clear-target"
                  value={value}
                  checked={target === value}
                  disabled={clearing}
                  onChange={() => {
                    setTarget(value);
                    setConfirmingClear(false);
                    setSectionFeedback('privacy', undefined);
                  }}
                />
                <span>{TARGET_LABELS[value]}</span>
              </label>
            ))}
          </div>

          {confirmingClear ? (
            <div
              className={styles.confirm}
              role="alertdialog"
              aria-modal="false"
              aria-labelledby="settings-clear-confirm-title"
            >
              <p id="settings-clear-confirm-title" className={styles.confirmTitle}>
                确认清除{TARGET_LABELS[target]}的已看与收藏记录？
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={clearing}
                  onClick={() => {
                    setConfirmingClear(false);
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={clearing}
                  onClick={() => {
                    void handleClear();
                  }}
                >
                  {clearing ? '正在清除…' : '确认清除'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={clearing}
                onClick={() => {
                  setConfirmingClear(true);
                  setSectionFeedback('privacy', undefined);
                }}
              >
                清除浏览记录
              </button>
            </div>
          )}
        </div>
        <SectionFeedback value={feedback.privacy} />
      </SettingsSection>

      <SettingsSection id="settings-update" title="关于与更新">
        <div className={styles.item}>
          <h3 className={styles.itemTitle}>自动更新</h3>
          <p className={styles.description}>
            自动更新仅支持安装版（NSIS），便携版请手动下载替换。检查、下载与重启安装均由你手动确认，更新失败不影响正常使用。
          </p>
          <p className={styles.status}>
            当前版本 v{updateState?.currentVersion ?? '—'} · {describeUpdate(updateState)}
          </p>

          {updateState?.phase === 'downloading' && updateState.progress !== null ? (
            <div className={styles.updateProgress}>
              <ProgressBar
                ratio={updateState.progress.percent / 100}
                label="更新下载进度"
              />
            </div>
          ) : null}

          <div className={styles.actions}>
            {updateState?.phase === 'downloaded' ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={updateAction !== null}
                onClick={() => {
                  void performUpdate('install');
                }}
              >
                {updateAction === 'install' ? '正在重启…' : '重启并安装'}
              </button>
            ) : updateState?.phase === 'available' ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={updateAction !== null}
                onClick={() => {
                  void performUpdate('download');
                }}
              >
                {updateAction === 'download' ? '正在下载…' : '下载更新'}
              </button>
            ) : updateState?.phase === 'downloading' ? (
              <button type="button" className={styles.secondaryButton} disabled>
                正在下载…
              </button>
            ) : (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={
                  updateAction !== null ||
                  updateState === null ||
                  updateState.phase === 'unsupported' ||
                  updateState.phase === 'checking'
                }
                onClick={() => {
                  void performUpdate('check');
                }}
              >
                {updateState?.phase === 'checking' || updateAction === 'check'
                  ? '正在检查…'
                  : '检查更新'}
              </button>
            )}
          </div>
          {updateError !== null ? (
            <p className={styles.error} role="alert">
              {updateError}
            </p>
          ) : null}
        </div>
      </SettingsSection>
    </main>
  );
}
