import { AppErrorException, createAppError } from '@shared/errors';
import type { SearchHistoryInput } from '@shared/ipc-contract';
import { normalizeSearchQuery } from '@shared/search-history';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验；归一化后为空视为非法（DR-055） */
const searchHistoryInputSchema = z.object({
  query: z.string().min(1)
});

export function parseSearchHistoryInput(raw: unknown): SearchHistoryInput {
  const parsed = searchHistoryInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppErrorException(
      createAppError('CONFIG', '搜索历史参数无效', {
        detail: parsed.error.issues.map((issue) => issue.message).join('; ')
      })
    );
  }

  const query = normalizeSearchQuery(parsed.data.query);
  if (query === null) {
    throw new AppErrorException(createAppError('CONFIG', '搜索历史参数无效'));
  }
  return { query };
}
