import { ALL_SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { TagsSuggestInput } from '@shared/ipc-contract';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG；02 §3 要求至少 2 字符才联想 */
const suggestInputSchema = z.object({
  site: z.enum(ALL_SITE_IDS),
  prefix: z.string().trim().min(2).max(100)
});

export function parseSuggestInput(raw: unknown): TagsSuggestInput {
  const parsed = suggestInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '联想参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }
  return parsed.data;
}
