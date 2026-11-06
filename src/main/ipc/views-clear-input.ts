import { ALL_SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { ViewsClearInput } from '@shared/ipc-contract';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验；`site` 缺省表示全部站点（02 §6.4 / DR-033） */
const viewsClearInputSchema = z.object({
  site: z.enum(ALL_SITE_IDS).optional()
});

export function parseViewsClearInput(raw: unknown): ViewsClearInput {
  const parsed = viewsClearInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '清除记录参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }
  return parsed.data;
}
