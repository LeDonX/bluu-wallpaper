import { SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { ViewsInput } from '@shared/ipc-contract';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG；03 §6.2 单次最多 100 个 id */
const viewsInputSchema = z.object({
  site: z.enum(SITE_IDS),
  postIds: z.array(z.number().int().positive()).min(1).max(100)
});

export function parseViewsInput(raw: unknown): ViewsInput {
  const parsed = viewsInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '已看参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }
  return parsed.data;
}
