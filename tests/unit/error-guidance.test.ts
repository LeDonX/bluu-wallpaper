import { ERROR_CODES, type ErrorCode } from '@shared/constants';
import { describeErrorGuidance } from '@shared/error-guidance';
import { createAppError } from '@shared/errors';
import { describe, expect, it } from 'vitest';

/** DR-052：错误码 → 下一步引导必须覆盖全部错误码，且文案非空 */
describe('describeErrorGuidance 错误引导', () => {
  it('覆盖全部错误码并返回非空中文引导', () => {
    for (const code of ERROR_CODES) {
      const guidance = describeErrorGuidance(createAppError(code, '失败原因'));
      expect(guidance.length).toBeGreaterThan(0);
    }
  });

  it('限流提示稍后重试（02 §2.5 / DR-052）', () => {
    const guidance = describeErrorGuidance(createAppError('RATE_LIMITED', '请求过于频繁'));
    expect(guidance).toContain('稍后重试');
  });

  it('CF 验证失败提示重试与检查网络', () => {
    const guidance = describeErrorGuidance(createAppError('CF_CHALLENGE', 'Cloudflare 验证未通过'));
    expect(guidance).toContain('重试');
    expect(guidance).toContain('网络');
  });

  it('网络错误提示检查网络与代理', () => {
    const guidance = describeErrorGuidance(createAppError('NETWORK', '网络请求失败'));
    expect(guidance).toContain('网络');
    expect(guidance).toContain('代理');
  });

  it('解析失败提示检查查询语法，下载失败指向下载页', () => {
    expect(describeErrorGuidance(createAppError('PARSE', '查询无法解析'))).toContain('语法');
    expect(describeErrorGuidance(createAppError('DOWNLOAD', '下载失败'))).toContain('下载页');
  });

  it('引导只依赖错误码，不受 message 与 retryable 影响', () => {
    const code: ErrorCode = 'CONFIG';
    const retryable = describeErrorGuidance(createAppError(code, '配置无效', { retryable: true }));
    const blocked = describeErrorGuidance(createAppError(code, '配置无效', { retryable: false }));
    expect(retryable).toBe(blocked);
  });
});
