-- 迁移 007：关注动态（03 §6.1 / 07 DR-069）
-- 关注按站点隔离；initialized 表示首次成功拉取是否完成，last_seen_post_id 为已读游标
-- 时间字段均为 epoch 毫秒（05 §7 / DR-014）

CREATE TABLE subscriptions (
  site TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  initialized INTEGER NOT NULL DEFAULT 0,
  last_seen_post_id INTEGER NOT NULL DEFAULT 0,
  last_checked_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, tag)
) WITHOUT ROWID;

CREATE TABLE subscription_posts (
  site TEXT NOT NULL,
  tag TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  unread INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site, tag, post_id)
) WITHOUT ROWID;

CREATE INDEX idx_subscription_posts_seen ON subscription_posts(site, first_seen_at);
CREATE INDEX idx_subscription_posts_unread ON subscription_posts(site, unread);
