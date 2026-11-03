import { join } from 'node:path';

import { applyHostmap } from '@main/network/hostmap';
import { openDatabase, type SqlDatabase } from '@main/storage/db';
import { app } from 'electron';

let database: SqlDatabase | null = null;

/**
 * 启动最早阶段执行（app ready 之前）：注入域名映射等开关。
 * 配置改动需重启应用才生效（DR-004 / DR-013）。
 */
export function bootstrap(): void {
  applyHostmap();
}

/** app ready 后调用：打开 userData 下的数据库并执行迁移（幂等） */
export function initStorage(): void {
  if (database) return;
  database = openDatabase(join(app.getPath('userData'), 'bluu.db'));
}

export function closeStorage(): void {
  database?.close();
  database = null;
}

/** IPC 处理器在 initStorage 之后注册，此处直接取已初始化的连接 */
export function getDatabase(): SqlDatabase {
  if (database === null) throw new Error('数据库尚未初始化');
  return database;
}
