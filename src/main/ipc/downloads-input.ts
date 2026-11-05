import { isAllowedImageUrl } from '@main/network/image-loader';
import { SITE_IDS } from '@shared/constants';
import {
  DOWNLOAD_ACTIONS,
  DOWNLOAD_VARIANTS,
  type DownloadControlInput,
  type DownloadEnqueueInput,
  type DownloadRemoveInput,
  type DownloadRevealInput
} from '@shared/downloads';
import { AppErrorException, createAppError } from '@shared/errors';
import { RATINGS } from '@shared/models';
import { z } from 'zod';

/** 05 §5：IPC 入参一律 zod 校验，失败返回 CONFIG；单次入队上限 100（T-27 批量确认前的最小保护） */
const DOWNLOAD_MAX_BATCH = 100;

const postTagSchema = z.object({ name: z.string(), type: z.string() });

const postSchema = z.object({
  site: z.enum(SITE_IDS),
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
  source: z.string().optional(),
  // DR-051：原图为 PNG 时站点提供的 JPEG 压缩版；可缺省，缺省视为没有独立版本
  jpegUrl: z.string().optional(),
  jpegFileSize: z.number().int().nonnegative().optional()
});

const enqueueSchema = z
  .object({
    site: z.enum(SITE_IDS),
    posts: z.array(postSchema).min(1).max(DOWNLOAD_MAX_BATCH),
    template: z.string().max(200).optional(),
    force: z.boolean().optional(),
    variant: z.enum(DOWNLOAD_VARIANTS).optional()
  })
  .superRefine((value, context) => {
    value.posts.forEach((post, index) => {
      if (post.site !== value.site) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'post.site 与 site 不一致',
          path: ['posts', index, 'site']
        });
      }
      // 03 §8：只允许 https 且属于已配置图片域名，避免把 IPC 当任意下载器
      if (!isAllowedImageUrl(post.fileUrl)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '图片地址不受支持',
          path: ['posts', index, 'fileUrl']
        });
      }
      // DR-051：JPEG 版本同样会被下载，地址必须走同一白名单
      if (post.jpegUrl !== undefined && post.jpegUrl !== '' && !isAllowedImageUrl(post.jpegUrl)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JPEG 图片地址不受支持',
          path: ['posts', index, 'jpegUrl']
        });
      }
    });
  });

const controlSchema = z.object({
  taskId: z.string().min(1).max(64),
  action: z.enum(DOWNLOAD_ACTIONS)
});

const revealSchema = z.object({
  taskId: z.string().min(1).max(64)
});

const removeSchema = z.object({
  taskId: z.string().min(1).max(64),
  deleteFile: z.boolean().optional()
});

function fail(message: string, detail: string): AppErrorException {
  return new AppErrorException(createAppError('CONFIG', message, { detail }));
}

export function parseDownloadEnqueueInput(raw: unknown): DownloadEnqueueInput {
  const parsed = enqueueSchema.safeParse(raw);
  if (!parsed.success) {
    throw fail('下载参数无效', parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  const template = parsed.data.template?.trim();
  return {
    site: parsed.data.site,
    posts: parsed.data.posts,
    ...(template !== undefined && template !== '' ? { template } : {}),
    ...(parsed.data.force === true ? { force: true } : {}),
    ...(parsed.data.variant !== undefined ? { variant: parsed.data.variant } : {})
  };
}

export function parseDownloadControlInput(raw: unknown): DownloadControlInput {
  const parsed = controlSchema.safeParse(raw);
  if (!parsed.success) {
    throw fail('下载操作参数无效', parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}

export function parseDownloadRevealInput(raw: unknown): DownloadRevealInput {
  const parsed = revealSchema.safeParse(raw);
  if (!parsed.success) {
    throw fail('下载任务参数无效', parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}

export function parseDownloadRemoveInput(raw: unknown): DownloadRemoveInput {
  const parsed = removeSchema.safeParse(raw);
  if (!parsed.success) {
    throw fail('删除任务参数无效', parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}
