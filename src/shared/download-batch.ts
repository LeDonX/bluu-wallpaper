import type { SiteId } from '@shared/constants';
import type {
  DownloadEnqueueInput,
  DownloadEnqueueResult
} from '@shared/downloads';
import { formatByteSize } from '@shared/downloads';
import type { Result } from '@shared/errors';
import type { Post } from '@shared/models';

/** 02 §7.5：超过该数量弹确认框 */
export const DOWNLOAD_CONFIRM_THRESHOLD = 50;

/** 03 §7：`downloads:enqueue` 单次最多 100 张，批量入口按此分片 */
export const DOWNLOAD_BATCH_SIZE = 100;

export function shouldConfirmBatch(count: number): boolean {
  return count > DOWNLOAD_CONFIRM_THRESHOLD;
}

/** 按固定大小切片；末片允许不足，空数组返回空切片列表 */
export function splitDownloadBatch<T>(items: readonly T[], size = DOWNLOAD_BATCH_SIZE): T[][] {
  const step = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += step) {
    chunks.push(items.slice(index, index + step));
  }
  return chunks;
}

/** 02 §7.5 / DR-038：预估体积取 `Post.fileSize`，缺失或非正数计入未知 */
export interface BatchSizeEstimate {
  bytes: number;
  unknownCount: number;
}

export function estimateBatchSize(posts: readonly Pick<Post, 'fileSize'>[]): BatchSizeEstimate {
  let bytes = 0;
  let unknownCount = 0;
  for (const post of posts) {
    if (!Number.isFinite(post.fileSize) || post.fileSize <= 0) unknownCount += 1;
    else bytes += post.fileSize;
  }
  return { bytes, unknownCount };
}

/** 02 §7.5：全部未知显示"未知"，部分未知标注数量，避免把不完整求和当成精确值 */
export function formatBatchSize(estimate: BatchSizeEstimate): string {
  if (estimate.unknownCount === 0) return formatByteSize(estimate.bytes);
  if (estimate.bytes === 0) return '未知';
  return `约 ${formatByteSize(estimate.bytes)}（${estimate.unknownCount} 张未知）`;
}

/** 03 §7 / DR-038：批量提交汇总，失败按整片计入 */
export interface DownloadBatchSummary {
  requested: number;
  added: number;
  skipped: number;
  failed: number;
}

export type EnqueueDownloads = (
  input: DownloadEnqueueInput
) => Promise<Result<DownloadEnqueueResult>>;

/**
 * 按 ≤100 分片提交；单片失败或抛异常只影响该片，后续分片继续。
 * 不改动 T-25 的模板、校验与去重语义，`skipped` 直接透传入队结果（DR-038）。
 */
export async function enqueueDownloadBatch(
  posts: readonly Post[],
  site: SiteId,
  enqueue: EnqueueDownloads
): Promise<DownloadBatchSummary> {
  const summary: DownloadBatchSummary = {
    requested: posts.length,
    added: 0,
    skipped: 0,
    failed: 0
  };

  for (const chunk of splitDownloadBatch(posts)) {
    try {
      const result = await enqueue({ site, posts: chunk });
      if (result.ok) {
        summary.added += result.data.taskIds.length;
        summary.skipped += result.data.skipped;
      } else {
        summary.failed += chunk.length;
      }
    } catch {
      summary.failed += chunk.length;
    }
  }

  return summary;
}

export function describeBatchSummary(summary: DownloadBatchSummary): string {
  return `已加入 ${summary.added} 项，已跳过 ${summary.skipped} 项，失败 ${summary.failed} 项`;
}
