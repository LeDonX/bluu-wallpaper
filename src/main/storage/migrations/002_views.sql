-- 迁移 002：已看标记（字段见 03-Architecture §6.1 / 07 DR-029）
-- viewed_at 为首次查看时间，last_at 为最近一次；时间统一 epoch 毫秒（05 §7）

CREATE TABLE post_views (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  viewed_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;

CREATE INDEX idx_views_last ON post_views(site, last_at);
