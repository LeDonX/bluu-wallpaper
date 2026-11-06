import { parseDiagInput } from '@main/ipc/diag-input';
import type { SiteId } from '@shared/constants';
import type { DiagReport } from '@shared/diagnostics';
import { type Result, toAppError } from '@shared/errors';

export interface DiagRunHandlerDeps {
  run(site: SiteId): Promise<DiagReport>;
}

/** 03 §7 / T-34：诊断入口；单项探测失败已由服务归一化为报告项，这里只兜底意外异常 */
export function createDiagRunHandler(
  deps: DiagRunHandlerDeps
): (raw: unknown) => Promise<Result<DiagReport>> {
  return async (raw) => {
    try {
      const input = parseDiagInput(raw);
      return { ok: true, data: await deps.run(input.site) };
    } catch (error) {
      return { ok: false, error: toAppError(error, 'NETWORK') };
    }
  };
}
