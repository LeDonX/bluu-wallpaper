import { ALL_SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import { FAVORITE_SORTS } from '@shared/favorites';
import type { FavoriteListInput, FavoriteToggleInput } from '@shared/ipc-contract';
import { RATINGS } from '@shared/models';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG；Post 快照字段与 03 §5.2 对齐 */
const postTagSchema = z.object({ name: z.string(), type: z.string() });

const postSchema = z.object({
  site: z.enum(ALL_SITE_IDS),
  id: z.number().int().positive(),
  md5: z.string(),
  previewUrl: z.string(),
  sampleUrl: z.string(),
  fileUrl: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  fileSize: z.number().int().nonnegative(),
  rating: z.enum(RATINGS),
  score: z.number().int(),
  tags: z.array(postTagSchema).max(500),
  createdAt: z.number().int().nonnegative(),
  source: z.string().optional()
});

const toggleSchema = z
  .object({ site: z.enum(ALL_SITE_IDS), post: postSchema })
  .superRefine((value, context) => {
    // 快照站点必须与入参一致，避免收藏记到错误站点
    if (value.post.site !== value.site) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'post.site 与 site 不一致',
        path: ['post', 'site']
      });
    }
  });

const listSchema = z.object({
  site: z.enum(ALL_SITE_IDS),
  query: z.string().max(200).optional(),
  sort: z.enum(FAVORITE_SORTS).optional()
});

function fail(message: string, detail: string): AppErrorException {
  return new AppErrorException(createAppError('CONFIG', message, { detail }));
}

export function parseFavoriteToggleInput(raw: unknown): FavoriteToggleInput {
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    throw fail(
      '收藏参数无效',
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }
  return parsed.data;
}

export function parseFavoriteListInput(raw: unknown): FavoriteListInput {
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    throw fail(
      '收藏查询参数无效',
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }
  const query = parsed.data.query?.trim();
  return {
    site: parsed.data.site,
    ...(query !== undefined && query !== '' ? { query } : {}),
    ...(parsed.data.sort !== undefined ? { sort: parsed.data.sort } : {})
  };
}
