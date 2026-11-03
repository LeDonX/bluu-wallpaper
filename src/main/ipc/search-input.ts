import { SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { PostsSearchInput } from '@shared/ipc-contract';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG */
const searchInputSchema = z
  .object({
    site: z.enum(SITE_IDS),
    query: z.string().max(500),
    page: z.number().int().min(1).optional(),
    lastId: z.number().int().min(1).optional()
  })
  .refine((value) => value.page === undefined || value.lastId === undefined, {
    message: 'page 与 lastId 只能二选一'
  });

export function parseSearchInput(raw: unknown): PostsSearchInput {
  const parsed = searchInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '搜索参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }
  return parsed.data;
}
