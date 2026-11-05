-- 迁移 004：下载任务（字段见 03-Architecture §6.1 / 07 DR-034）
-- 时间列为 epoch 毫秒（05 §7）；dest_path 为最终落盘绝对路径，下载中写 <dest_path>.part

CREATE TABLE download_tasks (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  dest_path TEXT NOT NULL,
  status TEXT NOT NULL,
  bytes_done INTEGER DEFAULT 0,
  bytes_total INTEGER DEFAULT 0,
  retries INTEGER DEFAULT 0,
  error TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE INDEX idx_tasks_status ON download_tasks(status, created_at);
