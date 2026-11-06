import type { SqlDatabase } from '@main/storage/db';
import type { AnySiteId } from '@shared/constants';
import { isAnySiteId } from '@shared/constants';
import type { DownloadStatus, DownloadTask } from '@shared/downloads';

/** 02 §7.2 / 03 §6.1：`download_tasks` 的读写，队列只通过本模块改状态 */
export interface DownloadsStore {
  create(input: CreateDownloadTask): DownloadTask;
  get(id: string): DownloadTask | null;
  /** 按创建时间升序，供队列按 FIFO 取任务 */
  list(): DownloadTask[];
  updateProgress(id: string, bytesDone: number, bytesTotal: number, now: number): void;
  setStatus(
    id: string,
    status: DownloadStatus,
    error: string | null,
    bytes: { done: number; total: number } | null,
    now: number
  ): void;
  delete(id: string): void;
  /** DR-062：下载目录变更后，把已完成任务迁到新目录并重新排队 */
  relocate(id: string, input: RelocateDownloadTask, now: number): void;
  /** 启动时把上次进程中断的 downloading/verifying 重置为 queued，返回条数 */
  resetInterrupted(now: number): number;
  /** 02 §7.4：该站点是否已成功下过同一 md5（DR-037） */
  findCompletedMd5(site: AnySiteId, md5: string): boolean;
}

export interface CreateDownloadTask {
  id: string;
  site: AnySiteId;
  postId: number;
  url: string;
  md5: string | null;
  destPath: string;
  bytesTotal: number;
  now: number;
}

export interface RelocateDownloadTask {
  url: string;
  md5: string | null;
  destPath: string;
  bytesTotal: number;
}

interface TaskRow {
  id: string;
  site: string;
  post_id: number;
  url: string;
  md5: string | null;
  dest_path: string;
  status: string;
  bytes_done: number | null;
  bytes_total: number | null;
  retries: number | null;
  error: string | null;
  created_at: number | null;
  updated_at: number | null;
}

const STATUSES: readonly string[] = [
  'queued',
  'downloading',
  'paused',
  'verifying',
  'done',
  'failed'
];

function isStatus(value: string): value is DownloadStatus {
  return STATUSES.includes(value);
}

/** 数据库里的站点由入队时校验过的站点标识写入；异常值按 yande 读回，避免整表不可用 */
function toSite(value: string): AnySiteId {
  return isAnySiteId(value) ? value : 'yande';
}

function toTask(row: TaskRow): DownloadTask {
  return {
    id: row.id,
    site: toSite(row.site),
    postId: row.post_id,
    url: row.url,
    md5: row.md5,
    destPath: row.dest_path,
    status: isStatus(row.status) ? row.status : 'failed',
    bytesDone: row.bytes_done ?? 0,
    bytesTotal: row.bytes_total ?? 0,
    retries: row.retries ?? 0,
    error: row.error,
    createdAt: row.created_at ?? 0,
    updatedAt: row.updated_at ?? 0
  };
}

const SELECT_COLUMNS = `
  id, site, post_id, url, md5, dest_path, status,
  bytes_done, bytes_total, retries, error, created_at, updated_at
`;

export function createDownloadsStore(database: SqlDatabase): DownloadsStore {
  const insert = database.prepare(
    `INSERT INTO download_tasks (
      id, site, post_id, url, md5, dest_path, status,
      bytes_done, bytes_total, retries, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, 0, NULL, ?, ?)`
  );
  const selectOne = database.prepare(`SELECT ${SELECT_COLUMNS} FROM download_tasks WHERE id = ?`);
  const selectAll = database.prepare(
    `SELECT ${SELECT_COLUMNS} FROM download_tasks ORDER BY created_at ASC, id ASC`
  );
  const updateProgressStmt = database.prepare(
    `UPDATE download_tasks SET bytes_done = ?, bytes_total = ?, updated_at = ? WHERE id = ?`
  );
  const updateStatusStmt = database.prepare(
    `UPDATE download_tasks SET status = ?, error = ?, bytes_done = COALESCE(?, bytes_done),
      bytes_total = COALESCE(?, bytes_total), updated_at = ? WHERE id = ?`
  );
  const deleteStmt = database.prepare('DELETE FROM download_tasks WHERE id = ?');
  const relocateStmt = database.prepare(
    `UPDATE download_tasks SET url = ?, md5 = ?, dest_path = ?, bytes_total = ?,
      status = 'queued', bytes_done = 0, error = NULL, updated_at = ? WHERE id = ?`
  );
  const completedMd5Stmt = database.prepare(
    `SELECT 1 AS found FROM download_tasks
      WHERE site = ? AND md5 = ? AND status = 'done' LIMIT 1`
  );
  const resetStmt = database.prepare(
    `UPDATE download_tasks SET status = 'queued', bytes_done = 0, error = NULL, updated_at = ?
      WHERE status IN ('downloading', 'verifying')`
  );

  return {
    create(input) {
      insert.run(
        input.id,
        input.site,
        input.postId,
        input.url,
        input.md5,
        input.destPath,
        input.bytesTotal,
        input.now,
        input.now
      );
      const row = selectOne.get(input.id) as TaskRow | undefined;
      if (row === undefined) throw new Error('下载任务写入后读取失败');
      return toTask(row);
    },
    get(id) {
      const row = selectOne.get(id) as TaskRow | undefined;
      return row === undefined ? null : toTask(row);
    },
    list() {
      return (selectAll.all() as TaskRow[]).map(toTask);
    },
    updateProgress(id, bytesDone, bytesTotal, now) {
      updateProgressStmt.run(bytesDone, bytesTotal, now, id);
    },
    setStatus(id, status, error, bytes, now) {
      updateStatusStmt.run(
        status,
        error,
        bytes === null ? null : bytes.done,
        bytes === null ? null : bytes.total,
        now,
        id
      );
    },
    delete(id) {
      deleteStmt.run(id);
    },
    relocate(id, input, now) {
      relocateStmt.run(input.url, input.md5, input.destPath, input.bytesTotal, now, id);
    },
    resetInterrupted(now) {
      const result = resetStmt.run(now) as { changes?: number };
      return result.changes ?? 0;
    },
    findCompletedMd5(site, md5) {
      return completedMd5Stmt.get(site, md5) !== undefined;
    }
  };
}
