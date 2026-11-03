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
| UI | React 18 + TypeScript + Tailwind + Radix Primitives | 组件可控、可访问性好 |
| 状态 | Zustand | 轻量，适合列表与选择态 |
| 虚拟列表 | @tanstack/react-virtual | 瀑布流可控 |
| 数据库 | better-sqlite3 | 同步 API，主进程使用方便，需 electron-rebuild |
| 校验 | zod | IPC 边界校验 |
| 日志 | electron-log | 落盘 + 轮转 |
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
- 图片通过自定义协议 `booru://thumb/<site>/<id>` 由主进程从缓存目录读取，避免暴露文件路径

---

## 3. 目录结构

```
booru-desktop/
├── electron.vite.config.ts
├── package.json
├── electron-builder.yml
├── docs/
├── src/
│   ├── main/
│   │   ├── index.ts                 应用入口、单实例、窗口
│   │   ├── bootstrap.ts             启动流程（开关注入、DB 迁移、session 初始化）
│   │   ├── network/
│   │   │   ├── hostmap.ts           域名→IP 配置与启动注入
│   │   │   ├── sessions.ts          每站点 session 管理
│   │   │   ├── cloudflare.ts        CF 通行证状态机
│   │   │   ├── http.ts              限速、重试、超时、错误分类
│   │   │   └── proxy.ts             代理应用
│   │   ├── sites/
│   │   │   ├── moebooru.ts          公共实现
│   │   │   ├── yande.ts             yande 站点单例
│   │   │   ├── konachan.ts
│   │   │   └── query.ts             搜索语法解析
│   │   ├── download/
│   │   │   ├── queue.ts             并发调度、暂停、重试
│   │   │   ├── resume.ts            Range 断点续传
│   │   │   ├── naming.ts            模板渲染与文件名清洗
│   │   │   └── verify.ts            md5 校验
│   │   ├── storage/
│   │   │   ├── db.ts                连接、迁移执行
│   │   │   ├── migrations/001_init.sql
│   │   │   ├── posts.ts / views.ts / favorites.ts / tasks.ts / tags.ts
│   │   │   └── thumbcache.ts        缩略图 LRU
│   │   ├── ipc/
│   │   │   ├── registry.ts          channel 注册（zod 校验在 search-input.ts）
│   │   │   ├── search-input.ts      posts:search 入参 schema
│   │   │   └── handlers/posts-search.ts  纯逻辑处理（适配器注入，可离线测）
│   │   └── diag/
│   │       └── check.ts             DNS / TCP / TLS / CF / 代理检测
│   ├── preload/
│   │   └── index.ts                 contextBridge 暴露 booru API
│   ├── renderer/
│   │   ├── pages/                   Search / Rankings / Favorites / Downloads / Settings / Viewer
│   │   ├── components/              PostGrid / PostCard / TagInput / Viewer / TaskList
│   │   ├── store/                   zustand slices
│   │   └── styles/
│   └── shared/
│       ├── ipc-contract.ts          channel 与参数/返回类型（主/渲染共用）
│       ├── models.ts                Post / PostPage / Rating 等跨进程类型
│       ├── posts.ts                 翻页合并去重（纯函数）
│       └── constants.ts
└── tests/
    ├── unit/                        query parser、naming、adapter（fixtures）
    └── e2e/                         Playwright electron
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
ses.setProxy({ proxyRules: 'socks5://127.0.0.1:1080' });
```

- 支持直连 / HTTP / SOCKS5
- 切换后重新探测（`ses.resolveProxy(url)`）
- 代理失败自动回退直连并提示

### 4.6 降级策略

| 场景 | 行为 |
|---|---|
| 映射 IP 不可达 | 依次尝试备用 IP 列表，全部失败则提示换 IP / 用代理 |
| CF 自动验证失败 | 转手动验证窗口 |
| 站点整体不可达 | 顶部横幅提示，其他站点不受影响 |

---

## 5. 站点适配层

```ts
export interface SiteAdapter {
  readonly id: SiteId;
  readonly baseUrl: string;
  search(q: ParsedQuery, cursor?: Cursor): Promise<PostPage>;
  rankings(kind: RankingKind, date?: Date): Promise<PostPage>;
  suggestTags(prefix: string): Promise<TagSuggestion[]>;
  fileUrl(post: Post): string;
  sampleUrl(post: Post): string;
}
```

`MoebooruAdapter` 实现公共逻辑，两个站点仅注入 `baseUrl` 与网络策略（konachan 走 CF 通道）。

### 5.1 端点映射

| 能力 | 端点 |
|---|---|
| 搜索 | `/post.json?tags=&page=&limit=100` |
| 游标翻页 | `/post.json?tags=<原查询> id:<lastId>&limit=100` |
| 热门 | `/post/popular_recent?period=1d\|1w\|1m` |
| 日榜 | `/post/popular_by_day?year=&month=&day=` |
| 周榜 | `/post/popular_by_week?year=&month=&day=` |
| 月榜 | `/post/popular_by_month?year=&month=` |
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

`posts:search` 在解析前先应用内容过滤：R18 关闭（`config.json#content.allowExplicit=false`）且用户未显式写 `rating:` 时自动追加 `-rating:e`，显式 rating token 不被覆盖（07 DR-023 / 02 §2.4）。

---

## 6. 存储设计

### 6.1 SQLite 结构

```sql
CREATE TABLE sites (
  id TEXT PRIMARY KEY,            -- yande / konachan
  base_url TEXT NOT NULL
);

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

CREATE TABLE post_views (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  viewed_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;
CREATE INDEX idx_views_last ON post_views(site, last_at);

CREATE TABLE favorites (
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (site, post_id)
) WITHOUT ROWID;

CREATE TABLE download_tasks (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  dest_path TEXT NOT NULL,
  status TEXT NOT NULL,           -- queued|downloading|paused|verifying|done|failed
  bytes_done INTEGER DEFAULT 0,
  bytes_total INTEGER DEFAULT 0,
  retries INTEGER DEFAULT 0,
  error TEXT,
  created_at INTEGER, updated_at INTEGER
);
CREATE INDEX idx_tasks_status ON download_tasks(status, created_at);

CREATE TABLE tag_cache (
  site TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  count INTEGER,
  PRIMARY KEY (site, name)
) WITHOUT ROWID;

CREATE TABLE search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  query TEXT NOT NULL,
  used_at INTEGER NOT NULL
);
```

### 6.2 批量查询已看状态

```sql
SELECT post_id FROM post_views
WHERE site = ? AND post_id IN (/* 100 个占位符 */);
```

better-sqlite3 同步执行，毫秒级。渲染层用 `Set<number>` 缓存当前结果集，乐观更新后回写。

### 6.3 缓存策略

- 缩略图：`%LOCALAPPDATA%\bluu\thumbs`，LRU 上限 2GB
- 元数据：`posts` 表 TTL 7 天，命中则先用缓存再后台刷新
- HTTP 缓存由 session 自带，不额外做

---

## 7. IPC 契约

`src/shared/ipc-contract.ts` 定义 channel 与类型，主进程注册时用 zod 校验入参。

| channel | 参数 | 返回 |
|---|---|---|
| `posts:search` | `{site, query, page?, lastId?}` | `PostPage`（`page` 与 `lastId` 二选一，都缺省取第 1 页） |
| `images:fetch` | `{requestId, url}` | `{mimeType, bytes: ArrayBuffer}`（仅 `https:` 且图片域名白名单；主进程流式读取并发送进度事件） |
| `posts:rankings` | `{site, kind, date?}` | `PostPage` |
| `tags:suggest` | `{site, prefix}` | `TagSuggestion[]` |
| `views:mark` | `{site, postIds[]}`（1–100 个） | `Result<null>`（成功即 `ok`） |
| `views:list` | `{site, postIds[]}`（1–100 个） | `number[]`（其中已看过的 `postId`） |
| `views:stats` | `{site, postId}` | `{count, firstAt}` |
| `views:clear` | `{site?}` | `{ok}` |
| `favorites:toggle` | `{site, postId}` | `{favorited}` |
| `favorites:list` | `{site, query?}` | `PostPage` |
| `downloads:enqueue` | `{site, posts[], template}` | `{taskIds[]}` |
| `downloads:control` | `{taskId, action}` | `{ok}` |
| `downloads:list` | — | `DownloadTask[]` |
| `settings:get` / `settings:set` | — | `Settings` |
| `diag:run` | — | `DiagReport` |
| `cf:manualVerify` | `{site}` | `{ok}` |

事件（主→渲染）：`downloads:progress`、`cf:status`、`views:updated`、`images:progress`（`{requestId, loaded, total|null}`，约 100ms 节流）。

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

---

## 9. 日志与诊断

- `electron-log` 写 `%APPDATA%\bluu\logs`，单文件 5MB 轮转
- 记录：请求 URL（脱敏）、状态码、耗时、CF 状态、下载结果
- 诊断报告聚合：DNS 期望/实际、各映射 IP 的 TCP 结果、TLS 证书主体、CF cookie 是否存在、代理可达性

---

## 10. 构建与发布

```yaml
# electron-builder.yml
appId: com.bluu.app
productName: Bluu
directories:
  output: release
files:
  - out/**
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

- 原生模块（better-sqlite3）通过 `electron-builder install-app-deps` 重建
- 未签名安装包会触发 SmartScreen 提示；后续可加代码签名
- 自动更新（P1）：electron-updater + GitHub Release

---

## 11. 安全设计

| 面 | 措施 |
|---|---|
| 渲染层 | 关闭 node 集成、启用 sandbox；CSP `img-src` 允许 `'self' data: blob:` 与两站图片域名（DR-016）；其余资源仅 `booru://` |
| 外链 | `setWindowOpenHandler` 一律 `deny`，需打开浏览器时走 `shell.openExternal` 并校验域名 |
| 导航 | `will-navigate` 拦截非本地导航 |
| 文件 | 下载文件名清洗（`\/:*?"<>|`），限制长度，禁止 `..` |
| IPC | zod 校验参数，白名单 channel |
| 隐私 | 不采集遥测；日志不含 cookie 明文 |

---

## 12. 测试

| 层次 | 工具 | 覆盖 |
|---|---|---|
| 单元 | Vitest | 查询解析、命名模板、moebooru 响应归一化（离线 fixtures） |
| 集成 | Vitest + msw/本地 mock server | 分页游标、限速、重试、错误分类 |
| E2E | Playwright `_electron` | 启动、搜索、打开查看器、标记、下载到临时目录 |
| 网络冒烟 | 手动脚本 | yande / konachan 真实请求各 1 次（不纳入 CI） |

约束：CI 中不访问真实站点，避免限流与不稳定。

---

## 13. 风险与应对

| 风险 | 技术应对 |
|---|---|
| CF 策略变化 | 状态机可切换到手动验证；保留 cookie 导入/导出 |
| IP 映射失效 | 备用 IP 列表 + 诊断页测速 + 用户可编辑 |
| better-sqlite3 编译失败 | 固定 Electron 版本，CI 缓存；备选 `node:sqlite` |
| 大图内存 | 查看器只保留当前与相邻两张，其余释放 |
| 渲染层卡顿 | 虚拟列表 + 缩略图尺寸上限 + `content-visibility` |
