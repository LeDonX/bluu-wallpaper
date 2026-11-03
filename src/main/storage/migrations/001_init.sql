-- 迁移 001：基础元数据表（字段见 03-Architecture §6.1）
-- created_at 为 epoch 毫秒（05 §7 / 07 DR-014）

CREATE TABLE posts (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  md5 TEXT,
  preview_url TEXT,
  sample_url TEXT,
  file_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  rating TEXT,
  score INTEGER,
  tags_json TEXT,
  created_at INTEGER,
  cached_at INTEGER,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;

CREATE TABLE tag_cache (
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  count INTEGER,
  PRIMARY KEY (site, name)
) WITHOUT ROWID;
