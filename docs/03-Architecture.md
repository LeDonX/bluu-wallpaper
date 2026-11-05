# Bluu（蓝噗）架构文档

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 日期 | 2026-11-03 |
| 关联 | 01-PRD.md、02-UX-Design.md、04-Task-Plan.md |

---

## 1. 技术选型

### 1.1 主框架对比

| 维度 | Electron 33 | Tauri 2 |
|---|---|---|
| Cloudflare 挑战 | 完整 Chromium，隐藏窗口过验证、cookie 可读写 | WebView2 能力受限，cookie 提取需额外桥接 |
| 域名 IP 覆盖 | `--host-resolver-rules` 官方支持 | 需改 WebView2 启动参数，可用但脆弱 |
| 请求栈一致性 | `session.fetch` 与窗口同栈，UA/fingerprint 一致 | Rust reqwest 与 WebView2 分离，cookie 需手工同步 |
| 体积 | ~150MB 安装包 | ~10MB |
| 内存 | ~200MB 起 | ~80MB 起 |

**决策：Electron。** 本产品 80% 的复杂度在网络层（CF 挑战 + DNS 污染），体积和内存不是主要矛盾。

### 1.2 其他选型

| 领域 | 选择 | 理由 |
|---|---|---|
| 构建 | electron-vite | 主/预加载/渲染三端统一，HMR 快 |
| UI | React 18 + TypeScript + CSS Modules（原生 CSS，DR-018） | 零 UI 库依赖，作用域隔离 |
| 状态 | React 组件内状态（`useState` / ref） | 页面常驻挂载，跨页数据由主进程维护，当前无需额外状态库 |
| 虚拟列表 | @tanstack/react-virtual | 瀑布流可控 |
| 数据库 | better-sqlite3 | 同步 API，主进程使用方便，需 Electron ABI 匹配的原生二进制 |
| 校验 | zod | IPC 边界校验 |
| 日志 | 尚未引入 electron-log（见 §9） | 日志落盘仍为待办，不在当前依赖中 |
| 打包 | electron-builder（NSIS x64 + portable） | per-user 安装免管理员 |

---

## 2. 进程模型

```
┌───────────────────────── Main（Node）─────────────────────────┐
│ 网络内核 │ 站点适配器 │ 下载器 │ SQLite │ 设置 │ 日志 │ 诊断     │
└───────────────▲───────────────────────────────┬───────────────┘
                │ IPC (contextBridge, 类型化)     │
┌───────────────┴───────────────┐   ┌─────────────▼─────────────┐
│ Preload（白名单 API）          │   │ 隐藏 BrowserWindow（CF）   │
└───────────────▲───────────────┘   └───────────────────────────┘
                │
┌───────────────┴───────────────────────────────────────────────┐
│ Renderer（React）：页面、虚拟列表、查看器、设置                 │
└───────────────────────────────────────────────────────────────┘
```

约束：

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`
- 渲染层**不直接发网络请求**，全部经 IPC 到主进程
- 图片经 `images:fetch` 由主进程流式读取，渲染层用 `blob:` 展示并做内存缓存（DR-028）；未使用 `booru://thumb` 自定义协议（缩略图缓存仍为待办，DR-016）

---

## 3. 目录结构

> 2026-11-05/T-33 按仓库实际文件核对；未列出的目录（如 `diag/`、`renderer/store/`、`download/resume.ts`）尚未创建。

```
booru-desktop/
├── electron.vite.config.ts
├── package.json
├── electron-builder.yml
├── docs/
├── fixtures/
├── src/
│   ├── main/
│   │   ├── index.ts                 应用入口、单实例、窗口
│   │   ├── bootstrap.ts             开关注入、DB 初始化等启动流程
│   │   ├── network/
│   │   │   ├── hostmap.ts           域名→IP 配置与启动注入
│   │   │   ├── sessions.ts          每站点 session 管理
│   │   │   ├── cloudflare.ts        CF 通行证状态机
│   │   │   ├── http.ts              限速、重试、超时、错误分类
│   │   │   ├── http-site.ts         站点 HTTP 客户端单例（yande / konachan 通道分流）
│   │   │   ├── rate-limiter.ts      令牌桶
│   │   │   ├── image-loader.ts      images:fetch 流式读取
│   │   │   └── proxy.ts             代理应用、复检、探测与回退
│   │   ├── sites/
│   │   │   ├── moebooru.ts          公共实现（搜索 / 榜单 / 联想 / 归一化）
│   │   │   ├── adapters.ts          按站点缓存的适配器单例（yande / konachan，DR-057）
│   │   │   └── query.ts             搜索语法解析
│   │   ├── download/
│   │   │   ├── queue.ts             并发调度、续传、校验、暂停、重试、删除
│   │   │   └── destination.ts       入队前目录校验与选择框接线（DR-059）
│   │   ├── update/
│   │   │   └── service.ts           自动更新状态机与 electron-updater 接线（DR-066）
│   │   ├── storage/
│   │   │   ├── db.ts                连接、迁移执行
│   │   │   ├── migrations/001_init.sql ~ 005_downloads_md5.sql
│   │   │   └── downloads.ts / favorites.ts / history.ts / tags.ts / views.ts
│   │   ├── ipc/
│   │   │   ├── registry.ts          channel 注册与依赖接线
│   │   │   ├── *-input.ts           zod 入参 schema
│   │   │   └── handlers/            posts / tags / views / favorites / downloads / settings / images
│   ├── preload/
│   │   └── index.ts                 contextBridge 暴露 booru API
│   ├── renderer/
│   │   ├── App.tsx                  顶部五页导航（外壳 T-38~ 前的最小实现）
│   │   ├── image-store.ts           blob 图片缓存（最多 3 张）
│   │   ├── hooks/useImageSnapshot.ts
│   │   ├── pages/                   Search / Ranking / Favorites / Downloads / Settings
│   │   ├── components/              PostGrid / PostCard / SearchBar / ImageViewer / Zoom / 任务与设置组件
│   │   └── styles/                  tokens.css + index.css
│   └── shared/                      纯类型/常量/纯函数（ipc-contract、models、downloads、settings、proxy、
│                                    rankings、selection、error-guidance、viewer、badges、updates 等）
└── tests/
    ├── unit/                        查询解析、命名模板、适配器（fixtures）、队列、handler、纯函数
    ├── integration/                 本地 mock server（限速/重试/CF 识别）
    └── mock/server.ts
```

---

## 4. 网络内核（核心模块）

### 4.1 域名 IP 覆盖

启动最早阶段注入，**先于任何请求**：

```ts
// bootstrap.ts
const rules = hostMap.toChromiumRules();
// "MAP konachan.com 104.21.4.105, MAP files.konachan.com 104.21.4.105,
//  MAP assets.yande.re 198.251.89.183, MAP files.yande.re 198.251.88.76"
if (rules) app.commandLine.appendSwitch('host-resolver-rules', rules);
```

要点：

- 只覆盖配置表内的域名，其余域名正常解析
- 用户改映射后需重启；设置页给出提示
- 该开关对 Chromium 网络栈生效，**与系统 hosts、浏览器 DoH 都无关**
- TLS 校验仍按 SNI 主机名，因此映射到任意 Cloudflare 边缘 IP 都能通过证书校验

### 4.2 每站点独立 session

```ts
const ses = session.fromPartition(`persist:${site}`); // yande / konachan
// 不调用 setUserAgent：覆盖 UA 会与 Client Hints 不一致，CF 挑战无法通过（DR-011）
```

- cookie、HTTP 缓存、代理配置相互隔离
- `persist:` 前缀保证 cookie（含 `cf_clearance`）跨启动保留
- 实现入口 `main/network/sessions.ts#getSession`，分区名由 `shared/sessions.ts#sessionPartition` 唯一生成
- 会话内不可落盘的 cookie（无 `expirationDate`）重启即失效，需持久化的 cookie 由站点下发带过期时间

### 4.3 Cloudflare 通行证状态机

```
idle ──request──> normal
normal ──403 + challenge──> acquiring
acquiring ──cookie found──> ready ──retry──> normal
acquiring ──timeout/失败──> failed（提示用户手动验证）
```

实现：

```ts
async function acquireClearance(site: SiteId): Promise<void> {
  const ses = getSession(site);
  const existing = await ses.cookies.get({ name: 'cf_clearance' });
  if (existing.length) return;

  const win = new BrowserWindow({
    show: false,
    webPreferences: { partition: `persist:${site}` },
  });
  await win.loadURL(siteBaseUrl(site));      // 触发挑战并自动求解
  await pollCookie(ses, 'cf_clearance', 25_000); // 轮询，命中即返回
  win.destroy();
}
```

关键约束：

- **UA 必须与 API 请求完全一致**（`ses.setUserAgent` 统一设置）；但实测**不得覆盖 Electron 默认 UA**，否则 UA 与 Client Hints 版本不一致会导致挑战循环（07 DR-011）
- 所有请求走 Electron 网络栈，不混用 node 的 `https` / `axios`：yande 用 `ses.fetch`；konachan 的 `ses.fetch` 实测仍被 CF 403，改用隐藏窗口上下文 fetch（07 DR-010）
- 应用**不得禁用硬件加速**（`app.disableHardwareAcceleration()`），否则挑战脚本执行失败（07 DR-012）
- 全局单飞锁：同一站点并发触发时只开一个窗口
- 失败后提供"手动验证"按钮（显示窗口让用户点击）

### 4.4 HTTP 层

```ts
interface HttpOptions {
  site: SiteId;
  url: string;
  method?: 'GET';
  timeoutMs?: number;   // 默认 20s
  retries?: number;     // 默认 2
}
```

- **限速**：每站点令牌桶 1–2 req/s，超限排队而非报错
- **重试**：429 / 5xx / 网络错误，指数退避 1s→2s→4s，尊重 `Retry-After`
- **错误分类**：`NETWORK` / `TIMEOUT` / `RATE_LIMITED` / `CF_CHALLENGE` / `NOT_FOUND` / `SERVER`
- **识别 CF**：403 且响应体包含 `Just a moment` / `cf-chl` 特征

### 4.5 代理

```ts
ses.setProxy({ mode: 'fixed_servers', proxyRules: 'socks5://127.0.0.1:1080' });
```

- 支持直连 / HTTP / SOCKS5，配置存 `config.json#network.proxy`（`{mode, host, port}`），改动重启生效（DR-039）
- 应用后对两站 session 逐个 `setProxy`，并用 `resolveProxy(url)` 复检实际生效模式
- 规则非法、复检无法识别或返回 `DIRECT` 时立即回退直连
- 非直连时启动后探测一次站点 API（`/post.json?limit=1`，8s 超时、0 重试）；仅 `NETWORK` / `TIMEOUT` 判定不可达并回退，429 / 5xx / CF 视为代理可用
- 回退原因经 `network:status` 读取、`network:status-changed` 广播，界面横幅提示
- 代理编辑 UI 已由设置页提供（DR-040）；T-09 保证应用、复检、回退与提示

### 4.6 降级策略

| 场景 | 行为 |
|---|---|
| 映射 IP 不可达 | 依次尝试备用 IP 列表，全部失败则提示换 IP / 用代理 |
| CF 自动验证失败 | 转手动验证窗口 |
| 站点整体不可达 | 顶部横幅提示，其他站点不受影响 |

---

## 5. 站点适配层

```ts
export interface MoebooruAdapter {
  readonly id: SiteId;
  readonly baseUrl: string;
  search(q: ParsedQuery, cursor?: SearchCursor): Promise<PostPage>;
  /** DR-041：date 为可序列化的 `{year, month, day}`，避免 `Date` 跨 IPC；热门忽略 date */
  rankings(kind: RankingKind, date: RankingDate | undefined, cursor?: SearchCursor): Promise<PostPage>;
  suggestTags(prefix: string, limit?: number): Promise<TagSuggestion[]>;
}
```

`MoebooruAdapter` 实现公共逻辑，两个站点仅注入 `baseUrl` 与网络策略（konachan 走 CF 通道）。`main/sites/adapters.ts#getSiteAdapter(site)` 按 `SiteId` 缓存单例；IPC handler 注入 `getAdapter(site)` 后在每次请求时按入参站点取用（T-28 / DR-057）。

### 5.1 端点映射

| 能力 | 端点 |
|---|---|
| 搜索 | `/post.json?tags=&page=&limit=100` |
| 游标翻页 | `/post.json?tags=<原查询> id:<lastId>&limit=100` |
| 热门 | `/post/popular_recent.json?period=1d`（DR-041：固定 40 条、忽略 `limit`/`page`，只取第 1 页） |
| 日榜 | `/post/popular_by_day.json?year=&month=&day=&limit=100&page=` |
| 周榜 | `/post/popular_by_week.json?year=&month=&day=&limit=100&page=` |
| 月榜 | `/post/popular_by_month.json?year=&month=&limit=100&page=` |
| 标签 | `/tag.json?name=<prefix>*&limit=10` |
| 评论 | `/comment.json?post_id=` |

### 5.2 归一化 Post

```ts
interface Post {
  site: SiteId;
  id: number;
  md5: string;
  previewUrl: string;
  sampleUrl: string;
  fileUrl: string;
  /** DR-051：PNG 原图帖子可能带独立 JPEG 压缩版；与 fileUrl 相同或大小为 0 视为无独立版本 */
  jpegUrl?: string;
  jpegFileSize?: number;
  width: number;
  height: number;
  fileSize: number;
  rating: 'safe' | 'questionable' | 'explicit';  // API 返回 s/q/e，适配器映射
  score: number;
  tags: { name: string; type: string }[];        // API 返回空格字符串，type 为整数
  createdAt: number;                             // epoch 毫秒（05 §7）：API 的 epoch 秒 ×1000
  source?: string;
}
```

归一化三条硬规则（详见 06-API-Contract.md）：

1. `rating`：`s → safe`、`q → questionable`、`e → explicit`
2. `created_at`：epoch 秒 × 1000
3. 丢弃 `status !== 'active'` 的条目

适配器负责把 moebooru 的 `tags` 字符串（空格分隔）解析为带类型标签；类型可来自 `/tag.json` 缓存，缺失时标为 `general`。

### 5.3 查询解析

解析失败抛出 `QueryError`，由渲染层展示，不发起请求。解析结果保留原始字符串用于游标翻页。

`posts:search` 在解析前先应用内容过滤：R18 关闭（`config.json#content.allowExplicit=false`）且用户未显式写 `rating:` 时自动追加 `-rating:e`，显式 rating token 不被覆盖（07 DR-023 / 02 §2.4）。随后应用标签黑名单（`config.json#content.blacklist`，DR-056）：逐项追加 `-tag`，与用户已写的同名 `-tag` 去重（大小写不敏感），空查询不拼接也不请求；配置每次请求时从磁盘读取，保存即生效。追加数量通过 `PostPage#blacklistFiltered` 回传。

榜单端点（`posts:rankings`）不支持 tags 参数，R18 与黑名单均在返回结果上本地过滤（DR-041 / DR-056）：先按 R18 丢弃 explicit，再按黑名单丢弃命中任一排除标签的条目，`blacklistFiltered` 只统计后者。

---

## 6. 存储设计

### 6.1 SQLite 结构

```sql
-- 迁移 001：元数据与标签缓存
CREATE TABLE posts (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  md5 TEXT,
  preview_url TEXT,
  sample_url TEXT,
  file_url TEXT,
  width INTEGER, height INTEGER, file_size INTEGER,
  rating TEXT, score INTEGER,
  tags_json TEXT,
  created_at INTEGER,            -- epoch 毫秒（05 §7 / 07 DR-014）
  cached_at INTEGER,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;

-- 迁移 002：已看记录（DR-029）
CREATE TABLE post_views (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  viewed_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;
CREATE INDEX idx_views_last ON post_views(site, last_at);

-- 迁移 003：收藏（DR-032）
CREATE TABLE favorites (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;
CREATE INDEX idx_favorites_added ON favorites(site, added_at);

-- 迁移 004 + 005：下载任务；md5 由 005 追加（DR-034 / DR-037）
CREATE TABLE download_tasks (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  md5 TEXT,                       -- 迁移 005：校验基准；JPEG 变体任务为空（DR-051）
  dest_path TEXT NOT NULL,
  status TEXT NOT NULL,           -- queued|downloading|paused|verifying|done|failed
  bytes_done INTEGER DEFAULT 0,
  bytes_total INTEGER DEFAULT 0,
  retries INTEGER DEFAULT 0,
  error TEXT,
  created_at INTEGER, updated_at INTEGER
);
CREATE INDEX idx_tasks_status ON download_tasks(status, created_at);
CREATE INDEX idx_tasks_md5 ON download_tasks(site, md5, status);

-- 迁移 001：标签联想缓存
CREATE TABLE tag_cache (
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  count INTEGER,
  PRIMARY KEY (site, name)
) WITHOUT ROWID;

-- 迁移 006：搜索历史（T-36 / DR-055）
CREATE TABLE search_history (
  query TEXT PRIMARY KEY,
  last_used_at INTEGER NOT NULL,  -- epoch 毫秒，保证最近使用优先（05 §7）
  use_count INTEGER NOT NULL DEFAULT 1
) WITHOUT ROWID;
CREATE INDEX idx_search_history_last ON search_history(last_used_at);
```

> 当前未建 `sites` 表；站点标识由代码常量 `SITE_IDS` 提供。迁移 006 已建 `search_history`（T-36 / DR-055）。

### 6.2 批量查询已看状态

```sql
SELECT post_id FROM post_views
WHERE site = ? AND post_id IN (/* 100 个占位符 */);
```

better-sqlite3 同步执行，毫秒级。渲染层用 `Set<number>` 缓存当前结果集，乐观更新后回写。

### 6.3 缓存策略

- 缩略图磁盘缓存（`%LOCALAPPDATA%\bluu\thumbs`，LRU 2GB）尚未实现，`booru://thumb` 协议同属待办（DR-016）
- 元数据：当前不写搜索结果的 `posts` 快照（仅收藏时由 `favorites:toggle` 写入），因此没有 TTL 刷新逻辑；收藏页只读本地快照
- 查看器图片：渲染层内存缓存最多 3 张（`image-store.ts`），磁盘不缓存
- HTTP 缓存由 session 自带，不额外做

---

## 7. IPC 契约

`src/shared/ipc-contract.ts` 定义 channel 与类型，主进程注册时用 zod 校验入参。

| channel | 参数 | 返回 |
|---|---|---|
| `posts:search` | `{site, query, page?, lastId?}` | `PostPage`（`page` 与 `lastId` 二选一，都缺省取第 1 页） |
| `images:fetch` | `{requestId, url}` | `{mimeType, bytes: ArrayBuffer}`（仅 `https:` 且图片域名白名单；主进程流式读取并发送进度事件） |
| `posts:rankings` | `{site, kind, date?, page?}`（`kind` 为 `popular` / `day` / `week` / `month`；`date` 为期榜必填的 `{year, month, day}`，DR-041；两站均支持，DR-057） | `PostPage`（`r18Filtered` 表示因 R18 关闭而过滤了 explicit 条目；`blacklistFiltered` 为本地按黑名单丢弃的条目数，DR-056） |
| `tags:suggest` | `{site, prefix}` | `TagSuggestion[]` |
| `views:mark` | `{site, postIds[]}`（1–100 个） | `Result<null>`（成功即 `ok`） |
| `views:list` | `{site, postIds[]}`（1–100 个） | `number[]`（其中已看过的 `postId`） |
| `views:clear` | `{site?}`（缺省为全部站点，DR-033） | `Result<{site, clearedViews, clearedFavorites}>` |
| `favorites:toggle` | `{site, post}`（Post 快照，DR-032） | `{favorited}` |
| `favorites:list` | `{site, query?, sort?}`（`sort` 为 `added` / `score`） | `PostPage`（仅本地 `posts` 快照，不请求站点） |
| `downloads:enqueue` | `{site, posts[], template?, force?, variant?}`（posts 1–100，`fileUrl` 与 `jpegUrl` 均须 https 且图片域名白名单；`template` 缺省用默认模板；`force` 为重新下载，DR-050；`variant` 为 `original` / `jpeg`，缺省取设置页 `downloads.format`，DR-051） | `{taskIds[], skipped}`（已下载同一地址 / 同尺寸文件 / 同批重复被跳过时 `skipped` 计数；同身份未结束任务复用并回传原 id，DR-037 / DR-042 / DR-051）。入队前经 `download/destination.ts` 的 guard 校验目录，无效时弹系统选择框并写回设置，取消返回 `DOWNLOAD`「未选择下载目录，下载未开始」（DR-059） |
| `downloads:control` | `{taskId, action}`（`pause` / `resume` / `retry` / `cancel`） | `{taskId, status}`（`cancel` 后 `status` 为 `null`，DR-034） |
| `downloads:reveal` | `{taskId}` | `Result<null>`（依次尝试选中最终文件 / `.part` / 只打开目录，DR-043） |
| `downloads:delete` | `{taskId, deleteFile?}` | `{taskId, fileExisted, removed, deletedFile}`（`deleteFile` 缺省时只检查，存在则返回 `removed:false` 由界面询问，DR-044） |
| `downloads:clear` | — | `{removed}`（清空任务记录并清理 `.part`，保留最终文件，DR-044） |
| `downloads:list` | — | `DownloadTask[]` |
| `network:status` | — | `Result<ProxyStatus>`（`{configured, effective, fallback, reason}`，DR-039） |
| `settings:get` | — | `Result<SettingsSnapshot>`（`{settings, defaultDownloadDir}`，DR-040） |
| `settings:set` | `Settings`（`hostmap` / `network` / `downloads` / `content` 全量，zod + 语义校验；`content.blacklist` 保存前归一化为小写并去重，DR-056） | `Result<SettingsSetResult>`（`{settings, defaultDownloadDir, proxyStatus, restartRequired}`；非法值返回 `CONFIG`） |
| `settings:pick-download-dir` | `{current?}`（设置页草稿目录，可用时作为对话框起始目录，DR-061） | `Result<string \| null>`（取消返回 `null`；非法入参返回 `CONFIG`） |
| `settings:destination-changed`（主→渲染广播） | `{destinationDir}`（下载入队前目录校验写回设置后广播，DR-061） | — |
| `search-history:list` | — | `Result<string[]>`（最近使用优先，最多 50 条，DR-055） |
| `search-history:record` | `{query}`（trim 并折叠连续空白后须非空） | `Result<string[]>`（UPSERT 后返回更新列表，超过 50 条自动截断） |
| `search-history:delete` | `{query}` | `Result<string[]>`（删除单条后返回更新列表） |
| `search-history:clear` | — | `Result<{removed}>`（清空全部搜索历史） |
| `updates:get-state` | — | `Result<UpdateState>`（`{phase, currentVersion, version, releaseNotes, progress, message, detail, checkedAt}`，DR-066） |
| `updates:check` | — | `Result<UpdateState>`（手动检查；开发模式/便携版返回 `phase:'unsupported'`，不报错） |
| `updates:download` | — | `Result<UpdateState>`（须先处于 `available`，否则返回 `CONFIG`；进度经 `updates:status` 推送） |
| `updates:install` | — | `Result<null>`（须处于 `downloaded`；调用 `quitAndInstall(false, true)` 重启安装） |

> 上表与 `src/shared/ipc-contract.ts#IPC_CHANNELS` 一一对应（2026-11-05/T-33 核对）。`views:stats`、`diag:run`、`cf:manualVerify` 与 `cf:status` 尚未实现（分别随查看器信息栏统计、T-34 诊断页、CF 手动验证任务落地），不得提前在渲染层调用。

事件（主→渲染）：`downloads:progress`（`{taskId, site, postId, status, bytesDone, bytesTotal, error}`，按任务约 200ms 节流，状态变化时强制上报）、`views:updated`（`{site: SiteId | null}`，`null` 表示全部站点；清除记录成功后广播，DR-033）、`images:progress`（`{requestId, loaded, total|null}`，约 100ms 节流）、`network:status-changed`（`ProxyStatus`，代理回退后广播，DR-039）、`updates:status`（`UpdateState` 全量，每次状态变化与下载进度广播，DR-066）。`cf:status` 为设计预留，当前无广播。

---

## 8. 下载器

```
enqueue → 队列（每站点独立）
  → 取任务 → 建立 .part 文件
  → ses.fetch(url, { Range: bytes=N- })
  → 流式写盘，节流上报进度（200ms）
  → 完成后 md5 校验
  → 重命名落盘（模板）
  → 更新状态，触发下一任务
```

- 并发默认 3，上限 6；下载不计入 API 限速（图床独立）
- 暂停：中止当前流，保留 `.part`
- 恢复：读文件大小作为 `Range` 起点；服务器不支持（返回 200）则清空重下
- 磁盘预检：剩余空间 < 预估 1.2 倍时拒绝入队
- 失败分类：403 → 触发 CF 刷新；404 → 标记失效；网络 → 重试 N 次

> T-23 落地范围（DR-034）：迁移 004 建 `download_tasks`；队列按站点独立计数，并发读 `config.json#downloads.concurrency`（1–6，默认 3）；任务流式写 `<dest_path>.part`，完成后经 `verifying` 直接转 `done`（md5 归 T-25）；暂停保留 `.part`，恢复/重试在 T-23 从 0 重下（已由 T-24 替换为 `Range` 续传），取消删除任务行与 `.part`；下载目录暂为 `userData/downloads`（设置页归 T-30），文件名为占位 `{postId}.{ext}`（模板归 T-25）；进程重启把 `downloading`/`verifying` 重置为 `queued` 并继续。磁盘预检、403/CF 刷新与失败重试次数仍待后续任务。

> T-25 落地范围（DR-037 / DR-043 / DR-064）：入队时按模板渲染相对路径（默认 `{md5}.{ext}`，非法字符清洗、长度上限 120 回落 `{md5}.{ext}` 紧凑路径），`download_tasks` 由迁移 005 追加 `md5` 列；`finalize` 先对 `.part` 流式计算 md5，与任务 md5 一致才 `verifying → done`，不一致删除 `.part` 与最终文件并进入 `failed`；已 `done` 的相同 `site+md5`、或目标路径同尺寸文件在入队时跳过。模板可在设置中修改、去重策略与 02 §7.4 对齐；DR-051 后 JPEG 变体任务不写 md5。

> T-30 落地范围（DR-040）：`settings:get` / `settings:set` 读写 `config.json` 四组配置；设置页保存后下载队列通过 `updateConfig` 热更新目录/模板/并发（仅影响后续入队），代理立即复用 `applyProxyConfig`，R18 随 `content.allowExplicit` 即时生效；IP 映射改动写盘但不重建 session，返回 `restartRequired` 提示重启。

> T-24 落地范围（DR-035）：`DownloadTransport` 改为 `(url, { signal, headers })`，恢复/重试/重启时读 `<dest_path>.part` 大小 `N` 并发 `Range: bytes=N-`；`206` 以追加模式写并以 `N + content-length` 计总进度，`200`（服务器忽略 Range）清空 `.part` 从头下载，`416` 且已有 `.part` 视为本地文件完整直接进入 `verifying`；`bytes_done` 在调度与恢复时先回填为文件大小；暂停落状态前校验本协程仍是活动协程且库中状态仍为 `paused`，避免快速"暂停→恢复"被旧协程回写 `paused`。md5 校验、模板命名与下载页仍归 T-25 / T-26。

> 多格式与任务身份（DR-042 / DR-043 / DR-050 / DR-051）：任务身份为 `site + postId` 或 `site + md5` 的未结束任务复用；已完成判定与实际下载地址（`task.url`）绑定，原图与 JPG 变体可同时存在且互不跳过；`variant='jpeg'` 的任务不写 md5（与 PNG 共享站点 md5），完整性依靠 `Content-Length` 与最终文件大小；`force` 重新下载复用原任务并覆盖最终文件，不产生 `(1)` 副本；取消/删除仅在无其它任务引用同一 `dest_path` 时删文件。

> 目录失效与自愈（DR-063）：`download/destination.ts#isUsableDirectory` 在"存在且是文件夹"之外追加可写探测（临时文件创建后删除），覆盖 Windows 删除已知文件夹后立即重建、但写入仍失败的场景。队列 `run()` 写盘前 `mkdirSync(dirname(partPath), {recursive:true})` 重建父目录；捕获 `ENOENT`/`EPERM`/`EACCES`/`EROFS`/`ENOTDIR`/`ENOSPC` 时调用 `DownloadQueueOptions#requestDestination`（主进程弹目录选择框并写回配置，同一时刻复用同一次弹框结果），由 `store.relocate` 把任务迁到新目录（保留原子路径）并重新排队；取消才落 `failed`，文案区分"下载目录不可用"与"磁盘空间不足"。网络/HTTP 错误保持原失败文案，不弹目录框。

---

## 9. 日志与诊断

- **日志落盘尚未实现**：当前项目未引入 electron-log，渲染层也无 console 残留；05 §8 的必记字段、轮转与脱敏规则为待落地的规范
- 诊断（DNS / TCP / TLS / CF / 代理）归 T-34，对应 `diag:run` 尚未实现；当前排障依赖设置页状态与错误卡片错误码

---

## 10. 构建与发布

```yaml
# electron-builder.yml（与仓库当前文件一致）
appId: com.bluu.app
productName: Bluu
copyright: Copyright © 2026 LeDon
directories:
  output: release
  buildResources: build
files:
  - out/**
  - package.json
asar: true
asarUnpack:
  - '**/*.node'
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
nsis:
  perMachine: false          # per-user：安装到 %LOCALAPPDATA%\Programs\bluu
  allowElevation: false      # 不触发管理员提权
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Bluu
  deleteAppDataOnUninstall: false   # 卸载保留用户数据
publish:
  provider: github
  owner: LeDonX
  repo: bluu-wallpaper             # DR-066：自动更新走 GitHub Release
```

打包事实与前置条件（DR-053，2026-11-05 会话 57 实测）：

- 产物为 `release/Bluu Setup 0.1.0.exe`（NSIS per-user 安装包）与 `release/Bluu 0.1.0.exe`（portable）；旧工程名产物已删除，安装/验收以这两个文件名为准
- `out/main` 由 `externalizeDepsPlugin` 保留为 `require(...)`，因此 `better-sqlite3`、`zod`、`@tanstack/react-virtual`（以及 react / react-dom）必须打进 `app.asar`；验收基线为新 `app.asar` 971 项
- `asarUnpack: '**/*.node'` 把 `better_sqlite3.node` 解包到 `app.asar.unpacked\node_modules\better-sqlite3\build\Release\`；`.node` 必须匹配 Electron 33 的 ABI 130
- 打包机需具备 VS Build Tools，或提前放入 npmmirror 的 `better-sqlite3-v11.10.0-electron-v130-win32-x64` 预编译包（本次采用后者）。无法重建时应使用 `--config.npmRebuild=false`，否则 `@electron/rebuild` 失败会删除已有二进制并打出不可用的包
- 卸载口径：`perMachine:false` + `deleteAppDataOnUninstall:false`，卸载只删除安装目录，`%APPDATA%\bluu`（`config.json`、`bluu.db`、站点 `Partitions`）按设计保留，不应视为残留
- 未配置应用图标（使用 Electron 默认图标）、未配置代码签名，安装时会出现 SmartScreen 提示
- 自动更新（T-35 / DR-066）：使用 `electron-updater`，`publish.provider=github` 会在打包时生成 `app-update.yml`，并在 `release/` 产出 `latest.yml`；发布时需把 `latest.yml` 与 `Bluu Setup x.y.z.exe`（及 blockmap）一起上传到 GitHub Release。**仅 NSIS 安装版支持**；portable 版与 `pnpm dev`（未打包）在设置页显示"不支持"说明。`autoDownload=false`，检查/下载/安装由用户手动触发；`autoInstallOnAppQuit=true`，下载完成后退出应用也会安装。未签名安装包的升级链路仍需真机验证（见 07 §6）
- 打包环境注意（本机无 Visual Studio）：`electron-builder` 默认会对 `better-sqlite3` 执行 `npmRebuild`，缺少 MSVC 时会在 node-gyp 阶段失败。先确保 `better-sqlite3/build/Release/better_sqlite3.node` 为 Electron ABI 版本（可从已生成的 `release/win-unpacked/resources/app.asar.unpacked/...` 恢复），再用 `pnpm exec electron-builder --win --publish always --config.npmRebuild=false` 打包；发布命令需要用户级环境变量 `GH_TOKEN`（`Contents: Read and write`），electron-builder 先创建 Draft Release，需把 Draft 发布为正式 Release 后 `electron-updater` 才能读取 `latest.yml`

---

## 11. 安全设计

| 面 | 措施 |
|---|---|
| 渲染层 | `contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`；**CSP 尚未配置**（DR-016 计划的 `img-src` 白名单未落地） |
| 外链 | `setWindowOpenHandler` 一律 `deny`；`https://` 链接交给 `shell.openExternal`，其余协议不打开 |
| 导航 | 尚无 `will-navigate` 拦截（窗口仅加载本地页面或 dev server） |
| 文件 | 下载文件名清洗（`\/:*?"<>|`），限制长度，禁止 `..` |
| IPC | zod 校验参数，白名单 channel |
| 隐私 | 不采集遥测；日志落盘尚未实现，未来接入时必须脱敏 cookie 与 `cf_clearance` |

---

## 12. 测试

| 层次 | 工具 | 覆盖 |
|---|---|---|
| 单元 | Vitest（`tests/unit`，当前 40 个文件 / 344 条） | 查询解析、命名模板、moebooru 归一化（离线 fixtures）、队列、IPC handler、渲染层纯函数 |
| 集成 | Vitest + 本地 mock server（`tests/integration`、`tests/mock/server.ts`） | 分页游标、限速、重试、错误分类、CF 识别 |
| E2E | 尚未实现（无 Playwright 用例） | 窗口内流程依赖人工验收（04 §5 / 07 §6 NEXT_MANUAL） |
| 网络冒烟 | 手动脚本（`scripts/spike-cf.cjs` / `spike-sessions.cjs` / `spike-sqlite.cjs`） | yande / konachan 真实请求与 ABI 复验（不纳入 CI） |

约束：CI 中不访问真实站点，避免限流与不稳定。

---

## 13. 风险与应对

| 风险 | 技术应对 |
|---|---|
| CF 策略变化 | 状态机可切换到手动验证；保留 cookie 导入/导出 |
| IP 映射失效 | 备用 IP 列表 + 诊断页测速 + 用户可编辑 |
| better-sqlite3 编译失败 | 固定 Electron 版本（33 / ABI 130），打包前确认原生二进制；备选 `node:sqlite` |
| 大图内存 | 查看器只保留当前与相邻两张，其余释放 |
| 渲染层卡顿 | 虚拟列表 + 缩略图尺寸上限 + `content-visibility` |

---

## 14. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-03 | 初版：技术选型、进程模型、网络内核、存储与 IPC 契约 |
| 2026-11-05 | DR-058 / DR-059（会话 63）：§3 新增 `download/destination.ts`；§7 `downloads:enqueue` 补入队前目录校验与选择框 |
| 2026-11-05 | DR-061 / DR-062（会话 65）：§7 新增 `settings:pick-download-dir` 与 `settings:destination-changed` 广播；`downloads:enqueue` 在目录切换后迁移已完成任务到新目录 |
| 2026-11-05 | DR-063（会话 66）：§8 补充写盘目录失效的自愈——目录可用判定加可写探测；队列写 `.part` 前的 `mkdir` 重建、`requestDestination` 弹框重选与 `relocate` 迁移重试 |
| 2026-11-05 | DR-064（会话 67）：默认命名模板改为 `{md5}.{ext}`（去掉站点子目录），`parseDownloadConfig` 把 DR-043 默认值一并迁移到新默认值，自定义模板不变 |
| 2026-11-05 | T-28 / DR-057（会话 61）：§3 `sites/` 以 `adapters.ts` 替代 `yande.ts`；§5 补 `getSiteAdapter(site)` 与 handler 的站点路由；§7 `posts:rankings` 去掉"仅 yande"限制 |
| 2026-11-05 | T-33 文档同步（会话 58）：§1.2 改为 CSS Modules / React 本地状态 / 未引入 electron-log；§2 图片通道改为 `images:fetch` + `blob:`；§3 目录树按仓库实际文件重写；§5 适配器接口改为 `MoebooruAdapter` 并补 `jpegUrl` / `jpegFileSize`；§6.1 补迁移 002–005、移除未建的 `sites` / `search_history`；§6.3 标注缩略图缓存未实现；§7 按 `IPC_CHANNELS` 核对并标注未实现通道；§8 补多格式任务身份；§9 日志落盘未实现；§10 按实际 `electron-builder.yml` 与 DR-053 补产物名、依赖完整性、`asarUnpack`、ABI 130 与卸载数据口径；§12 改为单元 + 集成实测口径（无 E2E） |
| 2026-11-05 | T-35 / DR-066（会话 69）：§3 新增 `update/service.ts` 与 `shared/updates.ts`；§7 新增 `updates:get-state` / `check` / `download` / `install` 与 `updates:status` 广播；§10 补 `publish.provider=github`、`latest.yml` 发布要求、仅 NSIS 安装版可更新、`autoDownload=false` 与未签名链路待真机验证 |
