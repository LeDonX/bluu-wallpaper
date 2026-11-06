import { SITE_IDS } from '@shared/constants';
import type { DiagRunInput } from '@shared/diagnostics';
import { AppErrorException, createAppError } from '@shared/errors';
import { z } from 'zod';

const diagInputSchema = z.object({
  site: z.enum(SITE_IDS)
});

/** 05 §5：`diag:run` 入参只接受站点标识，非法入参在触碰网络前拦截 */
export function parseDiagInput(raw: unknown): DiagRunInput {
  const parsed = diagInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '诊断参数无效', {
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')
      })
    );
  }
  return parsed.data;
}
