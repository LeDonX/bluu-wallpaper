import type { SiteId } from '@shared/constants';

/**
 * `persist:` 前缀让分区数据落盘，cookie（含 `cf_clearance`）跨启动保留（03 §4.2）。
 */
export const SESSION_PARTITION_PREFIX = 'persist:';

export function sessionPartition(site: SiteId): string {
  return `${SESSION_PARTITION_PREFIX}${site}`;
}
