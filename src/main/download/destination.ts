import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createAppError, type Result } from '@shared/errors';

export interface DestinationGuardDeps {
  /** 当前配置中的下载目录；空串表示使用默认目录（DR-040） */
  readDestinationDir: () => string;
  /** `userData/downloads`，缺失时自动创建，不打扰用户 */
  defaultDir: string;
  /** 弹出目录选择框；用户取消时返回 null */
  pickDirectory: (current: string) => Promise<string | null>;
  /** 持久化到 `config.json` 并让队列热更新；抛错时视为保存失败 */
  applyDestination: (dir: string) => void;
}

export type DestinationGuard = () => Promise<Result<void>>;

/**
 * 目录存在、确实是文件夹且可写才算可用。
 * DR-063：删掉文件夹后 Windows 可能立即重建同名"已知文件夹"，仅查存在会误判为可用，
 * 因此再加一次可写探测（创建并删除临时文件），探测失败即视为不可用并弹选择框。
 */
export function isUsableDirectory(path: string): boolean {
  try {
    if (!existsSync(path) || !statSync(path).isDirectory()) return false;
    return canWriteDirectory(path);
  } catch {
    return false;
  }
}

function canWriteDirectory(path: string): boolean {
  const probe = join(path, `.bluu-write-probe-${process.pid}`);
  try {
    writeFileSync(probe, '');
    return true;
  } catch {
    return false;
  } finally {
    rmSync(probe, { force: true });
  }
}

/**
 * DR-059：`downloads:enqueue` 前的目录校验。配置目录不可用（盘符未接入、被删除、
 * 指向文件）时弹出目录选择框，选中后写回设置并继续入队；取消则返回可读错误。
 */
export function createDestinationGuard(deps: DestinationGuardDeps): DestinationGuard {
  return async () => {
    const configured = deps.readDestinationDir().trim();
    const current = configured || deps.defaultDir;

    if (isUsableDirectory(current)) return { ok: true, data: undefined };

    if (configured === '') {
      try {
        mkdirSync(current, { recursive: true });
      } catch {
        // 默认目录创建失败时同样走选择框
      }
      if (isUsableDirectory(current)) return { ok: true, data: undefined };
    }

    const picked = await deps.pickDirectory(current);
    if (picked === null) {
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '未选择下载目录，下载未开始', {
          detail: `当前目录不可用：${current}`
        })
      };
    }

    try {
      mkdirSync(picked, { recursive: true });
    } catch (error) {
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '所选下载目录不可用，请重新选择', {
          detail: `${picked}：${error instanceof Error ? error.message : String(error)}`
        })
      };
    }

    if (!isUsableDirectory(picked)) {
      return {
        ok: false,
        error: createAppError('DOWNLOAD', '所选下载目录不可用，请重新选择', {
          detail: picked
        })
      };
    }

    try {
      deps.applyDestination(picked);
    } catch (error) {
      return {
        ok: false,
        error: createAppError('CONFIG', '下载目录已选择但保存失败，请到设置页重试', {
          detail: error instanceof Error ? error.message : String(error),
          cause: error
        })
      };
    }

    return { ok: true, data: undefined };
  };
}
