import initSql from './001_init.sql?raw';
import viewsSql from './002_views.sql?raw';

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

/** 迁移按 id 升序追加；已执行的 id 记录在 schema_migrations，重复启动不会重放 */
export const MIGRATIONS: readonly Migration[] = [
  { id: 1, name: '001_init', sql: initSql },
  { id: 2, name: '002_views', sql: viewsSql }
];
