import { AppErrorException, createAppError, type Result } from '@shared/errors';
import { z } from 'zod';

export interface SettingsPickDownloadDirDeps {
  /** 弹出系统目录选择框；取消返回 null */
  pickDirectory(current: string): Promise<string | null>;
  isUsableDirectory(path: string): boolean;
  /** 草稿目录不可用时对话框的起始目录（配置目录或应用默认目录） */
  fallbackDir(): string;
}

export type SettingsPickDownloadDirHandler = (raw: unknown) => Promise<Result<string | null>>;

const inputSchema = z.object({ current: z.string().optional() });

/**
 * DR-061：设置页"选择文件夹"。草稿目录可用时对话框直接从该目录打开；
 * 草稿为空或不可用时回退到配置目录/默认目录。取消返回 `data: null`，不算错误。
 */
export function createSettingsPickDownloadDirHandler(
  deps: SettingsPickDownloadDirDeps
): SettingsPickDownloadDirHandler {
  return async (raw) => {
    try {
      const parsed = inputSchema.safeParse(raw ?? {});
      if (!parsed.success) {
        throw new AppErrorException(
          createAppError('CONFIG', '下载目录参数无效', {
            detail: parsed.error.issues.map((issue) => issue.message).join('; ')
          })
        );
      }
      const current = (parsed.data.current ?? '').trim();
      const start = deps.isUsableDirectory(current) ? current : deps.fallbackDir();
      const picked = await deps.pickDirectory(start);
      return { ok: true, data: picked };
    } catch (error) {
      if (error instanceof AppErrorException) return { ok: false, error: error.appError };
      return {
        ok: false,
        error: createAppError('CONFIG', '选择下载目录失败', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }
  };
}
