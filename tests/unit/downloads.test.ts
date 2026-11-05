import {
  applyDownloadProgress,
  canApplyAction,
  canTransition,
  downloadProgressRatio,
  downloadStatusLabel,
  type DownloadTask,
  downloadTaskTitle,
  formatByteSize,
  parseDownloadConfig
} from '@shared/downloads';
import { describe, expect, it } from 'vitest';

describe('下载状态机（02 §7.2）', () => {
  it('正常路径 queued → downloading → verifying → done', () => {
    expect(canTransition('queued', 'downloading')).toBe(true);
    expect(canTransition('downloading', 'verifying')).toBe(true);
    expect(canTransition('verifying', 'done')).toBe(true);
  });

  it('暂停与恢复、失败重试是合法迁移', () => {
    expect(canTransition('downloading', 'paused')).toBe(true);
    expect(canTransition('paused', 'queued')).toBe(true);
    expect(canTransition('failed', 'queued')).toBe(true);
  });

  it('禁止跳过校验或从完成态回退', () => {
    expect(canTransition('queued', 'done')).toBe(false);
    expect(canTransition('downloading', 'done')).toBe(false);
    expect(canTransition('done', 'queued')).toBe(false);
    expect(canTransition('done', 'failed')).toBe(false);
  });

  it('control 动作与状态匹配', () => {
    expect(canApplyAction('queued', 'pause')).toBe(true);
    expect(canApplyAction('downloading', 'pause')).toBe(true);
    expect(canApplyAction('paused', 'pause')).toBe(false);
    expect(canApplyAction('paused', 'resume')).toBe(true);
    expect(canApplyAction('failed', 'retry')).toBe(true);
    expect(canApplyAction('queued', 'retry')).toBe(false);
    expect(canApplyAction('done', 'cancel')).toBe(false);
    expect(canApplyAction('queued', 'cancel')).toBe(true);
  });
});

describe('下载并发配置（DR-034）', () => {
  it('1–6 的整数直接采用', () => {
    expect(parseDownloadConfig({ concurrency: 1 }).concurrency).toBe(1);
    expect(parseDownloadConfig({ concurrency: 4 }).concurrency).toBe(4);
    expect(parseDownloadConfig({ concurrency: 6 }).concurrency).toBe(6);
  });

  it('越界、非整数与缺失都回落到默认 3', () => {
    expect(parseDownloadConfig({ concurrency: 0 }).concurrency).toBe(3);
    expect(parseDownloadConfig({ concurrency: 7 }).concurrency).toBe(3);
    expect(parseDownloadConfig({ concurrency: 2.5 }).concurrency).toBe(3);
    expect(parseDownloadConfig({ concurrency: '3' }).concurrency).toBe(3);
    expect(parseDownloadConfig({}).concurrency).toBe(3);
    expect(parseDownloadConfig(null).concurrency).toBe(3);
  });

  it('目录与模板缺省为空目录 + 默认模板（DR-040）', () => {
    const config = parseDownloadConfig({ concurrency: 2 });
    expect(config.destinationDir).toBe('');
    expect(config.template).toContain('{md5}');
  });

  it('显式目录与模板原样保留，空白模板回落默认', () => {
    expect(
      parseDownloadConfig({ concurrency: 2, destinationDir: 'D:\\Bluu', template: '{id}.{ext}' })
    ).toMatchObject({ destinationDir: 'D:\\Bluu', template: '{id}.{ext}' });
    expect(parseDownloadConfig({ template: '   ' }).template).toContain('{md5}');
  });
});

describe('下载状态文案', () => {
  it('下载中按比例显示进度，未达 100% 时最多显示 99%', () => {
    expect(downloadStatusLabel('downloading', 0.456)).toContain('46%');
    expect(downloadStatusLabel('downloading', 1)).toContain('99%');
    expect(downloadStatusLabel('downloading', null)).toBe('正在下载');
  });

  it('其余状态使用固定中文文案', () => {
    expect(downloadStatusLabel('queued', null)).toBe('已加入下载队列');
    expect(downloadStatusLabel('paused', null)).toBe('已暂停');
    expect(downloadStatusLabel('verifying', null)).toBe('正在校验');
    expect(downloadStatusLabel('done', null)).toBe('下载完成');
    expect(downloadStatusLabel('failed', null)).toBe('下载失败');
  });
});

function makeTask(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: 'task-1',
    site: 'yande',
    postId: 42,
    url: 'https://files.yande.re/image/abc.png',
    md5: null,
    destPath: 'C:/downloads/yande/42.png',
    status: 'queued',
    bytesDone: 0,
    bytesTotal: 100,
    retries: 0,
    error: null,
    createdAt: 1793668940000,
    updatedAt: 1793668940000,
    ...overrides
  };
}

describe('下载页数据合并与展示（T-26）', () => {
  it('进度事件只更新匹配任务，保持顺序', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const next = applyDownloadProgress(tasks, {
      taskId: 'b',
      site: 'yande',
      postId: 42,
      status: 'downloading',
      bytesDone: 60,
      bytesTotal: 120,
      error: null
    });

    expect(next.map((task) => task.id)).toEqual(['a', 'b']);
    expect(next[0]).toEqual(tasks[0]);
    expect(next[1]).toMatchObject({ status: 'downloading', bytesDone: 60, bytesTotal: 120 });
    expect(tasks[1]?.status).toBe('queued');
  });

  it('未知任务的进度事件原样返回，触发页面补拉', () => {
    const tasks = [makeTask()];
    const next = applyDownloadProgress(tasks, {
      taskId: 'missing',
      site: 'yande',
      postId: 1,
      status: 'queued',
      bytesDone: 0,
      bytesTotal: 0,
      error: null
    });

    expect(next).toBe(tasks);
  });

  it('进度比例处理完成态、未知总量与越界值', () => {
    expect(downloadProgressRatio(makeTask({ status: 'done', bytesDone: 100 }))).toBe(1);
    expect(downloadProgressRatio(makeTask({ status: 'verifying', bytesDone: 100 }))).toBe(1);
    expect(downloadProgressRatio(makeTask({ status: 'downloading', bytesTotal: 0 }))).toBeNull();
    expect(downloadProgressRatio(makeTask({ status: 'queued', bytesTotal: 0 }))).toBe(0);
    expect(
      downloadProgressRatio(makeTask({ status: 'paused', bytesDone: 10, bytesTotal: 100 }))
    ).toBeCloseTo(0.1);
    expect(
      downloadProgressRatio(makeTask({ status: 'downloading', bytesDone: 300, bytesTotal: 100 }))
    ).toBe(1);
  });

  it('任务标题取落盘文件名，兼容 Windows 与 POSIX 路径', () => {
    expect(downloadTaskTitle(makeTask({ destPath: 'C:\\downloads\\yande\\42.png' }))).toBe(
      '42.png'
    );
    expect(downloadTaskTitle(makeTask({ destPath: '/downloads/yande/42.png' }))).toBe('42.png');
    expect(downloadTaskTitle(makeTask({ destPath: '' }))).toBe('#42');
  });

  it('字节大小格式化为 0 B、B、KB、MB', () => {
    expect(formatByteSize(0)).toBe('0 B');
    expect(formatByteSize(-1)).toBe('0 B');
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(1024)).toBe('1.0 KB');
    expect(formatByteSize(1024 * 1024)).toBe('1.0 MB');
  });
});
