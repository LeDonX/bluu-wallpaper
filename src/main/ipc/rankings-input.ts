import { ALL_SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type { PostsRankingsInput } from '@shared/ipc-contract';
import { RANKING_KINDS } from '@shared/rankings';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG */
const rankingDateSchema = z.object({
  year: z.number().int().min(2005).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31)
});

const rankingsInputSchema = z
  .object({
    site: z.enum(ALL_SITE_IDS),
    kind: z.enum(RANKING_KINDS),
    date: rankingDateSchema.optional(),
    page: z.number().int().min(1).optional()
  })
  // 02 §4 / DR-041：热门没有日期，日/周/月榜必须带日期
  .refine((value) => value.kind === 'popular' || value.date !== undefined, {
    message: '该榜单需要日期'
  });

export function parseRankingsInput(raw: unknown): PostsRankingsInput {
  const parsed = rankingsInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '榜单参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }
  return parsed.data;
}
