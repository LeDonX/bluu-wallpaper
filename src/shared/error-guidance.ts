import type { ErrorCode } from '@shared/constants';
import type { AppError } from '@shared/errors';

/**
 * 02 §2.5 / 05 §4：按错误码给出面向用户的下一步引导。
 * 只说明"能做什么"，不重复主进程已给出的失败原因，技术细节仍由 `detail` 折叠展示。
 */
const GUIDANCE: Record<ErrorCode, string> = {
  NETWORK: '请检查网络连接与代理设置后重试。',
  TIMEOUT: '网络较慢或站点无响应，请稍后重试。',
  RATE_LIMITED: '请求过快，已自动降速，请稍后重试。',
  CF_CHALLENGE: '请稍后重试；若反复失败，可重启应用或检查网络。',
  NOT_FOUND: '该内容可能已被删除，请返回列表重新搜索。',
  SERVER: '站点暂时不可用，请稍后重试。',
  PARSE: '请检查查询语法后重新输入。',
  DB: '本地数据读写失败，可重试；持续失败请重启应用。',
  DOWNLOAD: '可在下载页对失败任务单独重试。',
  CONFIG: '请到设置页检查配置后重试。'
};

export function describeErrorGuidance(error: AppError): string {
  return GUIDANCE[error.code];
}
