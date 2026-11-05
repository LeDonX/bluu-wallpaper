-- 迁移 005：下载任务增加 md5 校验基准（03-Architecture §6.1 / 07 DR-037）
-- 历史任务该列为 NULL，队列按"跳过校验"处理，避免旧任务在重启后续跑时被误判失败

ALTER TABLE download_tasks ADD COLUMN md5 TEXT;

CREATE INDEX idx_tasks_md5 ON download_tasks(site, md5, status);
