import { ALL_SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { DailyListInput } from '@shared/ipc-contract';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG */
const dailyInputSchema = z.object({
  site: z.enum(ALL_SITE_IDS)
});

export function parseDailyListInput(raw: unknown): DailyListInput {
  const parsed = dailyInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '每日壁纸参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }
  return parsed.data;
}
