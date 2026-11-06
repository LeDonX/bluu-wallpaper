import { SITE_IDS } from '@shared/constants';
import { AppErrorException, createAppError } from '@shared/errors';
import type {
  FollowsAddInput,
  FollowsMarkReadInput,
  FollowsRemoveInput,
  FollowsSiteInput
} from '@shared/ipc-contract';
import { normalizeFollowTag } from '@shared/subscriptions';
import { z } from 'zod';

/** 05 §5 / DR-069：IPC 入参一律 zod 校验；标签规则与 `normalizeFollowTag` 保持一致 */
const tagSchema = z.string().refine((value) => normalizeFollowTag(value) !== null, {
  message: '标签不能为空、含空白、超过 100 字符、以 - 开头或含 :'
});

const siteSchema = z.enum(SITE_IDS);

const siteObjectSchema = z.object({ site: siteSchema });

const tagObjectSchema = z.object({ site: siteSchema, tag: tagSchema });

const markReadSchema = z.object({
  site: siteSchema,
  tag: tagSchema.optional(),
  postIds: z.array(z.number().int().positive()).min(1).max(100).optional()
});

function fail(message: string, error: z.ZodError): AppErrorException {
  return new AppErrorException(
    createAppError('CONFIG', message, {
      detail: error.issues.map((issue) => issue.message).join('; ')
    })
  );
}

export function parseFollowsSiteInput(raw: unknown): FollowsSiteInput {
  const parsed = siteObjectSchema.safeParse(raw);
  if (!parsed.success) throw fail('关注参数无效', parsed.error);
  return parsed.data;
}

export function parseFollowsAddInput(raw: unknown): FollowsAddInput {
  const parsed = tagObjectSchema.safeParse(raw);
  if (!parsed.success) throw fail('关注标签无效', parsed.error);
  return parsed.data;
}

export function parseFollowsRemoveInput(raw: unknown): FollowsRemoveInput {
  const parsed = tagObjectSchema.safeParse(raw);
  if (!parsed.success) throw fail('取消关注参数无效', parsed.error);
  return parsed.data;
}

export function parseFollowsMarkReadInput(raw: unknown): FollowsMarkReadInput {
  const parsed = markReadSchema.safeParse(raw);
  if (!parsed.success) throw fail('标记已读参数无效', parsed.error);
  return {
    site: parsed.data.site,
    ...(parsed.data.tag !== undefined ? { tag: parsed.data.tag } : {}),
    ...(parsed.data.postIds !== undefined ? { postIds: parsed.data.postIds } : {})
  };
}
