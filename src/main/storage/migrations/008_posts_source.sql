-- 迁移 008：收藏快照持久化来源/署名（T-53）
-- 既有行 source 为 NULL，读取时按空字符串处理

ALTER TABLE posts ADD COLUMN source TEXT;
