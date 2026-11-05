-- 迁移 006：搜索历史（03 §6.1 / 07 DR-055）
-- 查询串跨站点共享；last_used_at 为 epoch 毫秒（05 §7）

CREATE TABLE search_history (
  query TEXT PRIMARY KEY,
  last_used_at INTEGER NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1
) WITHOUT ROWID;

CREATE INDEX idx_search_history_last ON search_history(last_used_at);
