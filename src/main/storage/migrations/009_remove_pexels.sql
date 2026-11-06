-- 迁移 009：移除 pexels 支持后清理本地残留数据
-- 该站点已不再提供 API 申请，历史收藏/已看/下载/关注记录不再有对应适配器

DELETE FROM favorites WHERE site = 'pexels';
DELETE FROM post_views WHERE site = 'pexels';
DELETE FROM download_tasks WHERE site = 'pexels';
DELETE FROM posts WHERE site = 'pexels';
DELETE FROM subscriptions WHERE site = 'pexels';
DELETE FROM subscription_posts WHERE site = 'pexels';
