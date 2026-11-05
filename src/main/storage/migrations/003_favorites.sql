-- 迁移 003：收藏（字段见 03-Architecture §6.1 / 07 DR-032）
-- added_at 为收藏时间，epoch 毫秒（05 §7）；收藏与已看（post_views）完全独立

CREATE TABLE favorites (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;

CREATE INDEX idx_favorites_added ON favorites(site, added_at);
