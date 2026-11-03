# Bluu（蓝噗）进度与协作看板

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 更新日期 | 2026-11-03 |
| 维护规则 | **每个会话开始先读本文件，结束前必须更新** |

---

## 1. 使用协议

1. 会话开始时：读 `04-Task-Plan.md` + 本文件，确认要做的任务状态为 `todo` 且依赖已完成
2. 只领一个任务（最多两个强相关任务），把状态改为 `doing` 并写会话标识
3. 结束前：状态改为 `done` / `blocked`，在"会话记录"追加一条
4. 若改动共享文件（`shared/ipc-contract.ts`、`styles/tokens.css`、DB 迁移），必须在记录中注明
5. 若发现设计与现实不符，先改文档再改代码

状态定义：

| 状态 | 含义 |
|---|---|
| `todo` | 未开始，可领取 |
| `doing` | 进行中，禁止其他会话领取 |
| `blocked` | 被前置或风险阻塞，需写明原因 |
| `done` | 已按验收标准完成 |

---

## 2. 任务状态板

### 文档（已完成）

| ID | 产出 | 状态 |
|---|---|---|
| D-01 | 01-PRD.md | done |
| D-02 | 02-UX-Design.md（含组件清单与 token） | done |
| D-03 | 03-Architecture.md | done |
| D-04 | 04-Task-Plan.md | done |
| D-05 | 05-Conventions.md | done |
| D-06 | 06-API-Contract.md + fixtures | done |
| D-07 | 07-Progress.md | done |
| D-08 | 08-Dev-Setup.md | done |
| D-09 | 09-Test-Cases.md | done |
| D-10 | 10-UI-Shell-Plan.md（界面外壳重构技术方案） | done |

### M0 骨架

| ID | 任务 | 状态 | 会话 | 备注 |
|---|---|---|---|---|
| T-01 | electron-vite + React + TS 初始化 | done | 2026-11-03/3 | 用户本地人工验证通过；架构展示已改为 platform + arch |
| T-02 | ESLint/Prettier/strict/别名 | done | 2026-11-03/4 | 依赖 T-01 |
| T-03 | electron-builder NSIS x64 | done | 2026-11-03/13 | NSIS 免管理员 + portable 已产出并烟测启动；纯净 Win11 安装验收待人工 |
| T-04 | 单实例与窗口基础 | done | 2026-11-03/12 | 单实例锁 + 1280×860/1024×720 + 暗色默认；双开聚焦与外观待本地人工确认 |

### M1 网络内核

| ID | 任务 | 状态 | 会话 | 备注 |
|---|---|---|---|---|
| T-05 | hostmap + host-resolver-rules | done | 2026-11-03/8 | `config.json` 可读写；注入覆盖两站主站与 files/assets；映射失效可回退直连（DR-013） |
| T-06 | 每站点 session | done | 2026-11-03/9 | 统一 `sessions.ts`；两站分区隔离且跨启动保留；未覆盖默认 UA（DR-011） |
| T-07 | HTTP 层（限速/重试/错误分类） | done | 2026-11-03/10 | 令牌桶 2 req/s；Result + AppError；yande `ses.fetch`、konachan CF 通道（DR-010） |
| T-08 | **CF 通行证 spike** | done | 2026-11-03/6 | `cloudflare.ts` 已实现并烟测：首次访问自动过 CF、clearance 可复用；konachan 走窗口内 fetch（DR-010），不覆盖 UA（DR-011） |
| T-09 | 代理支持 | todo | — | HTTP/SOCKS5 |
| T-10 | 网络单测 | done | 2026-11-03/11 | `tests/mock/server.ts`（随机端口 + `/__stats`）；TC-13~17 集成用例 6 条 |

### M2 搜索闭环（yande）

| ID | 任务 | 状态 | 备注 |
|---|---|---|---|
| T-11 | 查询解析器 | done | 2026-11-03/14；02 §2.4 语法全覆盖，17 条单测 |
| T-12 | moebooru 适配器 | done | 2026-11-03/15；归一化 + page/id 游标分页，10 条 fixtures 单测 |
| T-13 | SQLite 初始化 + 迁移 001 | done | 2026-11-03/16；P-05 已验证（ABI 130）；迁移幂等 + 事务回滚有单测与 Electron 烟测 |
| T-14 | 搜索页 + 虚拟网格 | done | 2026-11-03/17；IPC + 虚拟网格 + 无限滚动，单测覆盖去重与入参校验 |
| T-15 | 标签联想 | done | 2026-11-03/18；`tags:suggest` + 本地缓存优先 + 300ms 防抖 + chip 补全，新增单测 21 条 |
| T-16 | R18 默认关闭 | done | 2026-11-03/19；`config.json` 的 `content.allowExplicit` 默认 false，自动附加 `-rating:e`（DR-023） |

### M3 浏览与状态

| ID | 任务 | 状态 | 备注 |
|---|---|---|---|
| T-17 | 查看器 | done | 2026-11-03/22 | 缩放/拖动/切图/Esc/自动加载原图与字节进度（DR-028）；D/F/O 延后（DR-024）；dev Referer 裂图已修（DR-025） |
| T-18 | 已看标记 + post_views | done | 2026-11-03/28 | 迁移 002 + `views:mark` / `views:list`，乐观变暗与重启恢复；失败回滚并提示（DR-029） |
| T-19 | 三态角标 | todo | |
| T-20 | 隐藏已看 + 补页 | todo | 注意补页上限 5 |
| T-21 | 收藏 | todo | |
| T-22 | 清除浏览记录 | todo | |

### M4 下载

| ID | 任务 | 状态 | 备注 |
|---|---|---|---|
| T-23 | 下载队列 | todo | |
| T-24 | 断点续传 | todo | Range 回退策略 |
| T-25 | md5 校验与命名 | todo | |
| T-26 | 下载页 | todo | |
| T-27 | 批量入口 | todo | |

### M5 双站与发布

| ID | 任务 | 状态 | 备注 |
|---|---|---|---|
| T-28 | konachan 适配 + CF 通道 | todo | 依赖 T-08 |
| T-29 | 榜单页 | todo | popular 固定 40 条 |
| T-30 | 设置页 | todo | |
| T-31 | 错误态与空态 | todo | |
| T-32 | 打包验收 | todo | 纯净 Win11 测试 |
| T-33 | 文档同步 | todo | |

### P1

| ID | 任务 | 状态 |
|---|---|---|
| T-34 | 诊断页 | todo |
| T-35 | 自动更新 | todo |
| T-36 | 搜索历史 | todo |
| T-37 | 标签黑名单 | todo |

---

## 3. 决策记录

| ID | 决策 | 理由 | 影响 |
|---|---|---|---|
| DR-001 | Electron 33 而非 Tauri | CF 通行、cookie、host-resolver-rules 能力 | 体积 ~150MB |
| DR-002 | 已看标记独立表 `post_views`，点开即标记 | 不与元数据 upsert 冲突；语义明确 | 需补页逻辑 |
| DR-003 | R18 默认关闭，自动附加 `-rating:e` | 合规与默认安全 | 用户可显式开启 |
| DR-004 | 应用内 IP 映射（`--host-resolver-rules`） | 不依赖系统 hosts 与浏览器 DoH | 映射变更需重启 |
| DR-005 | 所有请求走 `ses.fetch`，隐藏窗口过 CF | UA/fingerprint/cookie 一致 | 禁止混用 axios；konachan 为例外，见 DR-010 |
| DR-006 | `rating` 单字符映射为 safe/questionable/explicit | 实测 API 返回 `s/q/e` | 适配器必须转换 |
| DR-007 | `assets.yande.re` 与主站同 IP `198.251.89.183` | 实测 200 且证书有效；旧 `198.98.54.92` 不可用 | 映射表需含 assets |
| DR-008 | `popular_recent` 按固定 40 条处理 | 实测 `limit` 被忽略 | 榜单本地分页 |
| DR-009 | 首版仅 Windows x64 | 用户范围明确 | 不做 32 位/ARM |
| DR-010 | konachan 的 API 请求改走隐藏窗口上下文 fetch（`webContents.executeJavaScript` 内 `fetch`），yande 仍用 `ses.fetch` | 实测：同一 persist session 已有 `cf_clearance` 时，`ses.fetch` 连续 3 次仍 403 挑战页；窗口内 fetch 返回 200 + 3 条 post | 网络层需按站点选择通道；窗口请求串行化并加超时 |
| DR-011 | 不覆盖 Electron 默认 UA | 覆盖为 Chrome 124 UA 后与 Client Hints（Chromium 130）不一致，60s 仍循环挑战；默认 UA 11s 通过 | 取消"统一 UA 覆盖"，T-06 改为保留默认 UA（如需固定，UA 与 CH 版本必须一致） |
| DR-012 | 不调用 `app.disableHardwareAcceleration()` | 禁用 GPU 后挑战页 JS 报错，60s 未取得 clearance；开启硬件加速 11s 通过 | 应用启动不得禁用硬件加速，低配机可能出现挑战变慢 |
| DR-013 | 配置固定存 `userData/config.json`；首次启动写入默认 hostmap，默认启用映射；映射失效时将 `hostmap.enabled` 置 false 并重启即回退直连 | 满足"配置可读写 + 可回退直连"；启动阶段同步读取才能保证 `--host-resolver-rules` 在 app ready 前注入 | 配置改动必须重启生效，后续设置页需提示 |
| DR-014 | `posts.created_at` 采用 INTEGER（epoch 毫秒），修正 03 §6.1 原写的 `TEXT` | 05 §7 规定应用内时间统一 epoch 毫秒 number，06 规定适配器把 API 秒 ×1000；`TEXT` 与全链路类型冲突 | 03 §6.1 同步改为 `INTEGER`；SQLite 的 INTEGER 可容纳该量级毫秒值 |
| DR-015 | T-14 的界面用原生 CSS（新增 `styles/tokens.css`），虚拟网格为等高行虚拟化，未引入 Tailwind 与瀑布流库 | 仓库自 T-01 起就是原生 CSS，T-14 只做搜索页；引入 Tailwind 需要改构建链并重写既有组件，属于无关重构。行虚拟化是 @tanstack/react-virtual 的成熟用法，可满足 1000 项无白屏 | 05 §1 的 Tailwind 约定暂未落地，02 §2.2 的瀑布流视觉暂以等高网格替代；需在后续 UI 任务统一后修订 05/02 |
| DR-016 | T-14 预览图直接使用站点 `preview_url`，CSP `img-src` 白名单加入 `https://assets.yande.re` 与 `https://files.yande.re` | `booru://thumb` 缩略图缓存协议尚未实现（T-17 之后），不放开图片域名则网格全部裂图 | 缩略图缓存任务需把图片地址与 CSP 切回 `booru://`；CSP 仅放行指定域名，未使用通配 `https:` |
| DR-017 | 窗口完全自绘：`frame: false` + 自绘最小化/最大化/关闭按钮 | 用户明确要求；避免 `titleBarOverlay` 的系统按钮样式限制 | 失去 Win11 悬停最大化按钮的贴边菜单（已确认接受）；需自绘按钮与最大化状态事件；拖边分屏待 T-38 实测 |
| DR-018 | 样式改为 CSS Modules（原生 CSS + 作用域），修订 05 §1 的 Tailwind 约定 | 与 DR-015 同路线；Vite 原生支持、零新增依赖；多页面下消除全局类冲突 | 05 §1/§4 已同步；`index.css` 按组件拆分；组件新增 `*.module.css` |
| DR-019 | 主题为亮色默认 + 暗色 + 可扩展预设 + 自定义配色，颜色由 `shared/theme.ts` 生成 CSS 变量 | 未来会有更多预设与自定义强调色；避免在 CSS 写死颜色 | 颜色迁出 `tokens.css`；新增预设/自定义只改 `theme.ts`；持久化与选择器归 T-30 |
| DR-020 | 资源用 lucide-react 图标、自绘 logo/app icon、站点图片为主，不引外链装饰图与在线图标字体 | 无设计资源交付；离线可用、许可干净、体积可控 | 新增 `lucide-react`；`build/` 图标由脚本生成；CSP 不新增域名（遵守 DR-016） |
| DR-021 | 路由用 react-router-dom 的 HashRouter，UI 状态用 zustand | 生产 `file://` 下只有 hash 路由可靠；zustand 为 05 §6 既定 | 新增两项运行时依赖；`App` 改为壳层 + 路由 |
| DR-022 | 布局尺寸单一来源：`shared/layout-metrics.ts` 定义，渲染时注入 CSS 变量 | 虚拟滚动需要 TS 数值，CSS 需要变量，双写会漂移 | `PostGrid` 改读 `LAYOUT_METRICS`；移除 CSS 的 `280px` 硬编码；单测锁定 |
| DR-023 | T-16 的 R18 开关先落在 `userData/config.json` 的 `content.allowExplicit`（默认 `false`），在 `posts:search` handler 拼接查询前应用；暂不实现 `settings:get/set` IPC | 03 §7 的 settings 契约尚未实现，但其归属 T-30；本任务只需持久化与搜索过滤，复用 DR-013 的同步配置读写可避免提前定义整组设置项。过滤规则为：未开启 R18 且用户未显式写 `rating:` / `-rating:` 时追加 `-rating:e`，任何显式 rating token 均不覆盖。编号顺延至 023，避开 `10-UI-Shell-Plan` 待并入的 DR-017~DR-022 | 切换开关需人工编辑 `config.json`（T-30 前无开关 UI）；`PostPage.r18Filtered` 用于渲染层提示"已过滤 R18" |
| DR-024 | T-17 查看器首版只接入缩放/拖动/切图/Esc 关闭/原图加载与标签点击搜索；快捷键 `D`（下载）、`F`（收藏）、`O`（浏览器打开）延后到 T-23 / T-21 | 下载与收藏分别属于 T-23 / T-21，提前接入会产生跨任务半成品；浏览器打开需在主进程调用 `shell.openExternal` 并校验域名，新增 IPC channel 必须先登记 03 §7，超出 T-17 验收 | 02 §5.3 的 D/F/O 键与信息栏"下载/收藏/复制链接/在浏览器打开"按钮暂不出现；后续任务实现时同步补 03 §7 契约 |
| DR-025 | 站点图片统一加 `referrerPolicy="no-referrer"`。实测：`files.yande.re` 对非本站 Referer 返回 307 并跳转到 `https://yande.re/post/show?md5=…`（HTML 页面），导致 `pnpm dev`（源为 `http://localhost:5173`）下查看器 sample 裂图；`assets.yande.re` 预览图不校验 Referer | 06 §1 只记录了图片域名可用，未记录热链校验。开发环境必然带 localhost Referer，不抑制则查看器不可用；每次请求都带 referrer 会让生产环境也依赖站点策略 | 所有远程 `<img>`（PostCard 预览、查看器 sample 与原图）显式声明 `referrerPolicy="no-referrer"`；新增图片组件时同样处理，并在 06 §1 补热链说明 |
| DR-026 | 搜索网格改为自适应比例的虚拟化瀑布流：卡片高度 = clamp(列宽 × 原图高宽比, 140, 420)，列宽 200–260px，按最短列分配；用列内累计偏移 + 按 y 排序索引二分定位可视项，绝对定位渲染，替代等高行虚拟化 | 用户要求按图片原比例展示并限制极值；02 §2.2 原本就是瀑布流；`Post.width/height` 已由适配器提供，可精确计算，无需测量；避免引入第三方瀑布流库 | 仅取代 DR-015 的"等高行虚拟化"部分，原生 CSS 结论不变；`LAYOUT_METRICS` 移除 `post-card-height`；`PostGrid` 需重写；列数变化时滚动锚点可能偏移，需验收 |
| DR-027 | 默认背景采用 CSS 浮动光斑：4 个大尺寸径向渐变圆，静态 `blur`，仅用 `transform` / `opacity` 做 28–42s 漂移与呼吸；不引入 Canvas/WebGL 或第三方背景库 | 用户指定该动效为默认背景；CSS 零依赖、可随主题换色、可用 `prefers-reduced-motion` 降级；只动合成属性，避免重排 | 光斑层 `pointer-events:none`、`aria-hidden`；窗口失焦暂停；Mica 下压低透明度；P4 验证滚动帧率 |
| DR-029 | T-18 新增 IPC `views:list`（`{site, postIds[]}` → 已看 `postIds`）；`views:mark` 返回 `Result<null>`；`post_views` 用迁移 002 单独建表 | 03 §6.2 要求"批量查询已看状态"但 §7 只列了 `views:mark` / `views:stats` / `views:clear`，缺少批量读取通道；重启后网格要恢复变暗必须批量查询。单条 `views:stats` 留给查看器信息栏（02 §5.2），本任务不提前实现。迁移 001 已在用户库应用，只能新增 002，不能改 001 | 03 §7 补 `views:list` 行；重启恢复状态可自动化验证；T-19/T-20 直接复用该通道 |
| DR-028 | 查看器取消 8MB 阈值与"加载原图"按钮：打开即并行加载 sample 与 file，file 就绪后替换；两种图片统一走新 IPC `images:fetch`（主进程 `ses.fetch` 流式读取，事件 `images:progress` 节流报告字节进度），渲染层用 `blob:` 展示并做最多 3 张 LRU 内存缓存；`img-src` 增加 `blob:`。不预取邻居，不再从渲染层直连图片域名 | 用户明确要求自动加载原图并显示明确进度。`<img>` 无法暴露下载字节数；渲染层 `fetch` 受 CORS 限制，只有主进程流式读取能给出真实百分比（05 §2 网络仅在 main）；改用 blob 也顺带规避 DR-025 的 Referer 热链问题 | 新增 IPC 契约（03 §7）与 `blob:` CSP；大图（≤64MB）经 IPC 复制 ArrayBuffer 有内存峰值；切图频繁时旧请求不取消，仅忽略过期结果；后续 T-23 下载器可复用该流式读取 |
| DR-030 | 产品名定为 **Bluu（蓝噗）**：`Bluu` 为 blue 的可爱拉长拼写，中文「蓝噗」取鲨鱼吐泡拟声；品牌角色为原创圆身蓝鲨「噗噗」。`appId` / `productName` / 窗口标题统一为 Bluu / 蓝噗，`author` 为 LeDon；数据库文件改为 `userData/bluu.db`；内部技术命名（`window.booru`、`BooruApi`、`booru://`、IPC 前缀）保持不变 | 用户确定以可爱蓝鲨角色为中心，且希望名字与个人 ID `LeDon` 有关；品牌与领域术语分离可避免全量 API/协议回归，用户可见处仍统一 | Electron `userData` 目录随应用名变为 `%APPDATA%\bluu`；未发布，不写自动迁移代码，旧 `%APPDATA%\booru-desktop` 的 `config.json`、`booru.db`（改名为 `bluu.db`）与 `Partitions` 手工复制；发布前需做 Bluu / 蓝噗 商标与撞名检索 |

---

## 4. 已知问题与待验证

| ID | 问题 | 影响 | 验证方式 | 关联任务 |
|---|---|---|---|---|
| P-01 | CF 自动通行验证 | 已验证通过（2026-11-03），但暴露 `ses.fetch` 不可用 | 最小脚本 `scripts/spike-cf.cjs`：隐藏窗口 11s 取到 `cf_clearance`；窗口内 fetch 200 | T-08 |
| P-02 | konachan 字段结构未实测 | 适配器可能字段不符 | 本地网络跑通后抓真实响应 | T-28 |
| P-03 | `popular_recent` 的 `period` 是否生效未验证 | 榜单周期可能不准 | 对比 1d/1w/1m 结果差异 | T-29 |
| P-04 | `files.konachan.com` 图片是否需 cookie | 下载可能 403 | 用带 cookie 与非 cookie 各测一次 | T-28 |
| P-05 | better-sqlite3 在 Electron 下 ABI 兼容 | ~~可能导致启动失败~~ 已验证（2026-11-03 会话 16）：Electron 33（ABI 130）加载预编译包并 SELECT 成功 | `scripts/spike-sqlite.cjs`；应用两次启动后 `schema_migrations` 仅 1 条 | T-13 |
| P-06 | page 参数上限未知（1001 仍有效） | 深度翻页策略 | 抽样测 2001/5001 | T-12 |
| P-07 | 站点限速阈值未实测 | 可能触发 429 | 逐步加压观察响应码 | T-07 |
| P-08 | 本执行环境内 Electron GUI 启动崩溃（0xC0000005） | 无法自动验证窗口渲染 | 本地桌面手动 `pnpm dev`；最小空应用同样崩溃，`ELECTRON_RUN_AS_NODE` 正常 | T-01 / T-04 / T-08 |
| P-09 | hostmap 映射的真实网络生效性未验证 | 映射 IP 失效时两站不可用 | 本地桌面启用映射访问两站；失败则 `hostmap.enabled=false` 重启回退 | T-05 |
| P-10 | 查看器的 sample 首屏时间、滚轮锚点缩放/拖动/双击复位手感、快捷键与 Esc 关闭未在窗口内验证 | 交互与 1s 首屏目标可能不达标 | 本地桌面 `pnpm dev` 打开查看器目视与计时 | T-17 |

---

## 5. 会话记录

> 格式固定，追加在下方。示例：

```
### 2026-11-03 会话 1
- 任务: T-01
- 改动文件: package.json, electron.vite.config.ts, src/main/index.ts
- 决策: 采用 electron-vite 默认三端结构
- 验证: pnpm dev 启动成功；窗口正常渲染
- 遗留: 无
- 下一步: T-02
```

<!-- 新记录从这里往下追加 -->

### 2026-11-03 会话 2
- 任务: T-01
- 改动文件: package.json、pnpm-workspace.yaml、electron.vite.config.ts、tsconfig.json / tsconfig.node.json / tsconfig.web.json、eslint.config.mjs、vitest.config.ts、.gitignore、src/main/index.ts、src/preload/index.ts、src/renderer/{index.html, main.tsx, App.tsx, env.d.ts, styles/index.css}、src/shared/constants.ts、tests/unit/constants.test.ts
- 决策: 按 03/08 目录结构与 DR-001 固定 Electron 33.4.11 + React 18.3.1 + electron-vite 2.3.0；lint/typecheck/test 基础脚本先行落地（T-02 仍保留 Prettier、路径别名与完整 lint 规则）；pnpm 11 通过 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies` 批准 electron/esbuild 构建脚本
- 验证: `pnpm lint` 通过（实际覆盖 10 个文件）；`pnpm typecheck` 通过；`pnpm test` 2/2 通过；`pnpm build` 主/预加载/渲染三端均构建成功
- 环境: 本机 Node v24.13.0、pnpm 11.7.0（高于 08 文档的 Node 20.x / pnpm 9.x，未影响校验）；Electron 二进制经 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 安装
- 遗留: `pnpm dev` 在当前执行环境启动即崩溃（0xC0000005，最小空应用同样复现），窗口渲染需在本地桌面人工验证；未通过前 T-01 保持 blocked
- 下一步: 人工验证通过后 T-01 转 done，再领 T-02

### 2026-11-03 会话 3
- 任务: T-01（收尾）
- 改动文件: src/preload/index.ts、src/renderer/env.d.ts、src/renderer/App.tsx
- 决策: `process.platform` 在 Windows 上恒为 `win32`，与位数无关；位数改用 `process.arch` 展示，避免误判为 32 位应用
- 验证: 用户本地桌面人工验证窗口渲染通过；`pnpm lint` / `pnpm typecheck` / `pnpm test` 全部通过
- 遗留: 无
- 下一步: T-02

### 2026-11-03 会话 4
- 任务: T-02（工程规范）
- 改动文件: package.json、pnpm-lock.yaml、eslint.config.mjs、.prettierrc.json（新增）、.prettierignore（新增）、tsconfig.json / tsconfig.node.json / tsconfig.web.json、electron.vite.config.ts、vitest.config.ts、src/renderer/App.tsx、src/renderer/main.tsx、src/main/index.ts、src/renderer/env.d.ts、tests/unit/constants.test.ts（Prettier 统一格式）；docs/08-Dev-Setup.md
- 决策: Prettier 采用 05 约定的 2 空格 / 单引号 / 分号 / 行宽 100，`trailingComma: none`（与既有代码一致）；ESLint 在 typescript-eslint recommended 基础上启用 `consistent-type-imports`、`no-explicit-any`、`simple-import-sort`、renderer 段 react-hooks 与 `no-console`，并以 `eslint-config-prettier/flat` 收尾避免规则冲突；别名定为 `@shared/*`、`@main/*`、`@renderer/*`，在 tsconfig、electron-vite、vitest 四处同步
- 依赖: 新增 devDependencies `prettier 3.9.10`、`eslint-config-prettier 10.1.8`、`@eslint/js 9.39.5`（须与 ESLint 9 主版本对齐）、`globals 17.14.0`、`eslint-plugin-react-hooks 7.1.1`、`eslint-plugin-simple-import-sort 14.0.0`
- 验证: `pnpm lint` 通过（6 处 import 排序已自动修复后复跑通过）；`pnpm typecheck` 通过（node + web 两套 tsconfig）；`pnpm test` 2/2 通过（测试改用 `@shared/constants`，同时验证别名在 Vitest 生效）；`pnpm format:check` 通过；`pnpm build` 三端构建成功（同时验证 Vite 别名）
- 备注: `eslint .` 会同时校验 `electron.vite.config.ts` / `vitest.config.ts`；构建期间 electron-vite 生成的临时 `electron.vite.config.*.mjs` 会在结束后自动清理，不纳入版本控制
- 遗留: 无
- 下一步: T-03（打包配置，可在本环境用 CLI 产出 exe）；T-08 仍需在用户本地桌面人工验证

### 2026-11-03 会话 5
- 任务: T-08（CF 通行证 spike，仅本地验证阶段）
- 改动文件: scripts/spike-cf.cjs（新增，临时验证脚本）、eslint.config.mjs（typescript-eslint 规则限定到 ts/tsx，并给 scripts 目录补 node globals）；docs/06-API-Contract.md、docs/07-Progress.md
- 决策: 见新增 DR-010（konachan API 走窗口上下文 fetch）与 DR-011（不覆盖默认 UA）；DR-005 对 konachan 失效
- 验证: 全新 `persist:` 分区、隐藏窗口、硬件加速开启：首次访问 11s 自动取得 `cf_clearance` 与 `session_konachan-com`；复用已有分区时 2–3s 命中；`ses.fetch` 连续 3 次仍 403 挑战页；窗口内 `fetch` 返回 200、3 条 post（firstId=410384）；`window.loadURL(API_URL)` 同样 200
- 环境: 本环境 Electron 33.4.11 可正常启动 GUI/隐藏窗口（P-08 未复现，与旧会话结论不同）；直连 konachan.com 可用，无需 host-resolver 映射
- 遗留: 生产 `cloudflare.ts` 状态机与窗口请求通道未实现；窗口内请求的串行化/超时/释放策略待设计
- 下一步: 继续 T-08 实现（按 DR-010/DR-011），随后 T-05 hostmap（映射降级为备用路径）

### 2026-11-03 会话 6
- 任务: T-08（生产实现 `cloudflare.ts`）
- 改动文件: src/shared/cf.ts（新增：`cf_clearance` 常量、`CfStatus`、挑战判定）、src/main/network/cloudflare.ts（新增：CF 通道）、tests/unit/cf.test.ts（新增）；docs/03-Architecture.md、docs/07-Progress.md
- 实现: 隐藏窗口 `show:false` + persist 分区；`ensureClearance` 幂等单飞（先查 cookie，缺失才加载挑战页并 1s 轮询，默认 25s 上限）；`fetchText` 在页面上下文执行 `fetch` 并串行化（DR-010）；请求超时 30s；403 挑战时清除 cookie、重过一次挑战再重试一次；窗口关闭复位状态；`will-quit` 自动销毁
- 决策: 新增 DR-012（不得禁用硬件加速）；DR-011 落地为"不调用 `ses.setUserAgent`"
- 修复: 复用已有 clearance 时窗口停留在 `about:blank`，页面内 fetch 跨源失败导致请求卡死；已在请求前补 `ensurePage()` 加载站点页，并给 `executeJavaScript` 加超时。该问题由复用分区冒烟发现
- 验证: `pnpm lint` / `pnpm typecheck` / `pnpm test`（5/5，含 3 条 CF 判定用例）全部通过；`pnpm build` 成功；用 esbuild 等价的 vite 打包出临时 CJS 在真实 Electron 冒烟：全新分区 `ensureClearance` 8.6s、API 200 + 3 条 post；复用分区 `ensureClearance` 96ms、API 200 + 3 条 post，`cfStatus=ready`
- 备注: 冒烟用的 `.tmp` 打包产物与脚本已删除；scripts/spike-cf.cjs 保留作为复验工具
- 遗留: 站点层尚未接入该通道（T-07/T-12）；窗口常驻内存与失败后"手动验证"UI 仍待接入
- 下一步: T-05（hostmap）

### 2026-11-03 会话 7
- 任务: 文档维护（自动接续机制）
- 改动文件: docs/07-Progress.md
- 内容: §6 改为结构化字段 `NEXT_TASK` / `NEXT_REASON` / `NEXT_ACCEPTANCE` / `NEXT_DEPENDS` / `NEXT_MANUAL`，并规定字段缺失、与看板冲突或依赖未满足时必须停止询问
- 下一步: 按 §6 字段执行

### 2026-11-03 会话 8
- 任务: T-05（hostmap + host-resolver-rules）
- 改动文件: src/shared/hostmap.ts（新增）、src/main/network/hostmap.ts（新增）、src/main/bootstrap.ts（新增）、src/main/index.ts、tests/unit/hostmap.test.ts（新增）、docs/07-Progress.md
- 决策: DR-013：配置固定 `userData/config.json`，首次启动写入默认映射；默认启用映射，失效时置 `hostmap.enabled=false` 并重启回退直连；规则串在 shared 纯函数生成，主进程只负责读写与注入
- 验证: `pnpm lint` / `pnpm typecheck` 通过；`pnpm test` 12/12（其中 hostmap 7 条）；`pnpm build` 主/预加载/渲染三端成功；Electron 冒烟（临时 userData，产物已删）：`config.json` 自动生成 5 条、`getSwitchValue('host-resolver-rules')` 与规则串一致、`enabled=false` 时规则为空
- 遗留: 映射的真实网络生效性未验证（P-09）；设置页尚未暴露 hostmap 开关（T-30）
- 下一步: T-06（每站点 session）

### 2026-11-03 会话 9
- 任务: T-06（每站点 session）
- 改动文件: src/shared/sessions.ts（新增）、src/main/network/sessions.ts（新增）、src/main/network/cloudflare.ts、tests/unit/sessions.test.ts（新增）、scripts/spike-sessions.cjs（新增，验证工具）、docs/03-Architecture.md、docs/04-Task-Plan.md、docs/07-Progress.md
- 决策: 分区名由 `shared/sessions.ts#sessionPartition` 唯一生成（`persist:${site}`），主进程 `getSession` 做单例缓存；`cloudflare.ts` 移除自带 `partition` 选项，统一复用 `getSession`，隐藏窗口仍绑定同一分区；不调用 `setUserAgent`（DR-011）；未新增依赖
- 验证: `pnpm lint` 通过（首轮 1 处 import 排序，`--fix` 后复跑通过）；`pnpm typecheck` 通过；`pnpm test` 15/15 通过（新增 sessions 3 条）；Electron 烟测 `scripts/spike-sessions.cjs`（临时 userData 分 write/verify 两进程）：分区命名、默认 UA、跨分区隔离、默认分区隔离、重启后 cookie 保留共 13 项全 PASS
- 修复: 烟测首次 verify 失败，原因是 `cookies.set` 未设 `expirationDate` 属会话 cookie 不落盘；补过期时间后通过（仅验证脚本改动，产品代码无此问题）
- 遗留: 真实站点 `cf_clearance` 跨重启保留仍需本地桌面验证（P-08）；HTTP 层尚未接入
- 下一步: T-07（HTTP 层）

### 2026-11-03 会话 10
- 任务: T-07（HTTP 层：限速/重试/超时/错误分类）
- 改动文件: src/shared/errors.ts（新增）、src/shared/http.ts（新增）、src/shared/sites.ts（新增）、src/main/network/rate-limiter.ts（新增）、src/main/network/http.ts（新增）、src/main/network/http-site.ts（新增）、tests/unit/http.test.ts（新增）、tests/unit/rate-limiter.test.ts（新增）、docs/07-Progress.md
- 决策: 核心逻辑与 Electron 接线拆两层——`http.ts` 只依赖注入的 `HttpTransport`（离线可测），`http-site.ts` 负责站点单例接线（yande `ses.fetch`、konachan 复用 `cloudflare.ts` 通道）；统一 `AppError`/`Result` 信封，内部用 `AppErrorException` 表达已分类失败；限速默认 2 req/s、burst 1，重试（默认 2 次）同样经过令牌桶；`Retry-After` 优先于 1s→2s→4s 指数退避；CF 失败不重试（通道内已重过一次挑战），404/4xx 不重试
- 验证: `pnpm lint` 通过（1 处 import 排序 `--fix` 后复跑通过）；`pnpm typecheck` 通过（node + web）；`pnpm test` 29/29 通过（新增 HTTP 11 条、限速 3 条；50 次请求虚拟时钟用时 24.5s，持续速率 2/s）
- 遗留: 真实站点限速阈值未实测（P-07）；konachan 窗口通道真实请求需本地网络（P-08）；退避期间的 UI 状态事件（`RATE_LIMITED` 提示）未实现，待 T-31；HTTP 客户端尚未被适配器使用（T-12）
- 下一步: T-10（网络单测：本地 mock server）

### 2026-11-03 会话 11
- 任务: T-10（网络单测：本地 mock server）
- 改动文件: tests/mock/server.ts（新增）、tests/integration/network.test.ts（新增）、vitest.config.ts、src/main/network/http.ts、docs/09-Test-Cases.md、docs/07-Progress.md
- 决策: mock server 用请求头 `x-scenario` 切换场景，单端口即可覆盖全部用例；`/__stats` 不统计自身，避免污染限速采样；`createHttpClient` 增加可选 `baseUrl`（默认仍 `siteBaseUrl`）作为集成测试接缝，站点单例不受影响；CF 通行后的重发由 `cloudflare.ts` 通道负责（DR-010），集成用例以"首次 `CF_CHALLENGE`、取得通行后再次请求 200"两次调用覆盖，HTTP 层本身不重试 CF；`vitest` 纳入 `tests/integration/**`
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 35/35 通过（7 个文件，新增集成 6 条：`/__stats` 契约 + TC-13 9.65s / TC-14 3.04s / TC-15 / TC-16 / TC-17）
- 遗留: 09 §2 的 fixtures 切片、`/file/:md5`、`slow-body` / `bad-md5` / `no-range` 场景未实现（留 T-12 / T-24）；TC-14 的 `RATE_LIMITED` UI 状态事件待 T-31；真实站点限速阈值未实测（P-07）
- 下一步: T-04（单实例与窗口基础）

### 2026-11-03 会话 12
- 任务: T-04（单实例与窗口基础）
- 改动文件: src/main/index.ts、src/shared/constants.ts、tests/unit/constants.test.ts、docs/07-Progress.md
- 决策: 单实例锁在 app ready 前申请，拿不到锁的进程直接 `app.quit()`；`second-instance` 时对已有窗口 `restore` → `show` → `focus`，不新建窗口；窗口默认 1280×860、最小 1024×720 收敛到 `shared/constants.ts`（避免主进程散落魔法数字，并加单测锁定 02 §1）；`nativeTheme.themeSource = 'dark'` 在 ready 前设置，窗口底色 `#0f1115` 防首帧白闪；未新增依赖
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 36/36 通过（constants 新增 1 条窗口尺寸断言）；`pnpm build` 三端成功；Electron 双开烟测（`--user-data-dir` 指向临时目录）：首进程存活且窗口句柄存在（标题 `Booru Desktop`），二次启动 20s 内 `exitcode=0` 且首进程仍存活，二次启动后窗口句柄不变、前台进程即首进程（`foreground_is_first=true`），临时 profile 生成 `config.json`（证明参数生效）
- 遗留: 最小尺寸拖拽下限、暗色外观与首帧无白闪需本地桌面人工确认（P-08 环境无法目视）；烟测临时目录已删除
- 下一步: T-03（electron-builder 打包）

### 2026-11-03 会话 13
- 任务: T-03（electron-builder NSIS x64）
- 改动文件: electron-builder.yml（新增）、package.json（`dist` 脚本、`author`、devDependency electron-builder 26.18.0）、pnpm-workspace.yaml（`allowBuilds.electron-winstaller: false`）、docs/07-Progress.md
- 决策: 目标固定 `win` 的 `nsis`(x64) + `portable`(x64)；NSIS 用 `perMachine:false` + `allowElevation:false` + `oneClick:false`（可改目录），装到 `%LOCALAPPDATA%`，免管理员提权；产物名沿用 electron-builder 默认 `Booru Desktop Setup 0.1.0.exe` / `Booru Desktop 0.1.0.exe`，与 08 文档一致；`files` 仅 `out/**` + `package.json`，`asarUnpack: **/*.node` 为后续原生模块预留；暂不设图标（用 Electron 默认）与签名（内测预期）
- 依赖: 新增 devDependency `electron-builder 26.18.0`（T-03 打包必需，未引入第二套工具链）；`electron-winstaller` 的 build 脚本仅服务 Squirrel 目标，本项目不用，在 pnpm 11 的 `allowBuilds` 中显式置 false
- 验证: `pnpm build` 三端成功；`pnpm dist` 成功产出 `release/Booru Desktop Setup 0.1.0.exe`（83.9MB，blockmap 同时生成）与 `release/Booru Desktop 0.1.0.exe`（76.7MB）；打包产物烟测（`--user-data-dir` 指向临时目录）：`win-unpacked/Booru Desktop.exe` 启动后主窗口标题 `Booru Desktop`、窗口句柄存在；二次启动 1s 内退出码 0 且首实例窗口句柄不变（单实例生效）；临时 profile 自动生成 `config.json`（hostmap 默认链路可用）；临时 profile 已删除
- 环境: 本环境 electron/NSIS 工具链下载通过 `ELECTRON_MIRROR` 与 `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 npmmirror，仅会话内设置，未写入仓库
- 格式: 新增 `electron-builder.yml` 已 Prettier 通过；`pnpm format:check` 仍有 4 个既有文件未格式化（`src/main/index.ts`、`tests/mock/server.ts`、`tests/integration/network.test.ts`、`tests/unit/constants.test.ts`），非本任务引入，按"不改无关代码"保留
- 遗留: 应用图标缺失、未签名（SmartScreen 预期拦截）；暗色外观与首帧无白闪需人工目视；纯净 Windows 11 安装/卸载验收待人工
- 下一步: T-11（查询解析器）

### 2026-11-03 会话 14
- 任务: T-11（查询解析器）
- 改动文件: src/main/sites/query.ts（新增）、tests/unit/query.test.ts（新增）、docs/07-Progress.md
- 决策: 解析器按 03 §3 放在 `main/sites/query.ts`，保持纯函数无 Electron 依赖；失败抛 `QueryError`（映射 `PARSE`、`retryable=false`、中文 message + 原 token 作 detail），由 IPC 边界转 `Result` 信封，符合 03 §5.3 与 05 §4；`ParsedQuery.raw` 保留用户原文供 T-12 拼 `id:` 游标；`rating` 单字符 `s/q/e` 与全称统一映射为 `safe/questionable/explicit`（DR-006）；额外支持 `-rating:e` 并单独归入 `excludedRatings`，作为 T-16 R18 默认过滤的语法基础；内置前缀（rating/score/width/order/id）之外的 `x:y` 按普通标签保留，贴合原站行为；除 `rating` 外的 `-prefix:` 排除式报错而非静默转标签；`order` 重复指定报错；空串返回空查询，是否允许提交由调用方决定
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 53/53 通过（新增 query 17 条，覆盖普通标签隐式 AND、排除、rating 全映射、`-rating:e`、score/width 五种比较符、id、order、综合查询、空串，以及 8 类非法输入的中文错误与 `PARSE` 错误码）
- 遗留: 解析结果尚未接入适配器/IPC（T-12）；R18 自动附加 `-rating:e` 的实际拼装待 T-16
- 下一步: T-12（moebooru 适配器）

### 2026-11-03 会话 15
- 任务: T-12（moebooru 适配器）
- 改动文件: src/main/sites/types.ts（新增）、src/main/sites/moebooru.ts（新增）、tests/unit/moebooru.test.ts（新增）、package.json / pnpm-lock.yaml（新增运行时依赖 zod 3.25.76）、docs/03-Architecture.md（§5.2 `createdAt` 与 05 §7 对齐为 epoch 毫秒 number）、docs/09-Test-Cases.md（TC-10~12 归属修正）、docs/07-Progress.md
- 决策: `createMoebooruAdapter({ site, client })` 注入 `HttpClient`，fixtures 可完全离线验证；响应体按 05 §3 以 `unknown` + zod 校验（zod 为 03 §1.2 既定选型，本任务仅新增这一个运行时依赖）；`tags` 用 `ParsedQuery.raw` 原样拼接，`id:` 游标追加且不叠加 page；归一化顺序为过滤 `status` → rating 映射 → `created_at` ×1000；非法 JSON / 结构异常 / 未知 rating 统一 `PARSE`（不可重试）；空数组返回空页；tag 类型暂全为 general（T-15 接 `/tag.json` 后补齐）
- 验证: `pnpm lint` 通过（首轮 1 处 import 排序，`--fix` 后复跑通过）；`pnpm typecheck` 通过（node + web）；`pnpm test` 63/63 通过（新增 moebooru 10 条：三条归一化规则、空数组、page 游标、id: 游标、by-id fixture、非法 JSON、未知 rating、网络错误透传）
- 遗留: 适配器尚未接入站点单例与 IPC（T-14）；rankings / suggestTags / fileUrl 未实现（T-29 / T-15）；真实站点请求不在本任务验收内（P-07 仍待实测）
- 下一步: T-13（SQLite 初始化），先完成 P-05 better-sqlite3 ABI 重建验证

### 2026-11-03 会话 16
- 任务: T-13（SQLite 初始化 + 迁移 001）
- 改动文件: src/main/storage/migrations/001_init.sql（新增）、src/main/storage/migrations/index.ts（新增，`?raw` 导入 SQL）、src/main/storage/migrations/sql-modules.d.ts（新增）、src/main/storage/db.ts（新增）、src/main/bootstrap.ts、src/main/index.ts、tests/unit/db.test.ts（新增）、scripts/spike-sqlite.cjs（新增，验证工具）、package.json / pnpm-lock.yaml（新增 better-sqlite3 11.10.0 依赖与 @types/better-sqlite3 9.6.0）、docs/03-Architecture.md（§6.1 created_at 改 INTEGER）、docs/08-Dev-Setup.md（§6 补镜像下载预编译包）、docs/07-Progress.md
- 决策: 迁移 001 只建 posts 与 tag_cache（03 §6.1），其余表留给对应任务；迁移记录用 `schema_migrations` 表，执行时逐条显式事务（`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`），重复启动只跳过不重放；`db.ts` 通过最小 `SqlDatabase` 接口隔离驱动，生产用 better-sqlite3，单测用 Node 自带 `node:sqlite` 验证同一套 SQL 与执行器（better-sqlite3 按 Electron ABI 重建后在 Node 测试进程无法加载）；DB 固定 `userData/booru.db`，`whenReady` 初始化、`will-quit` 关闭，初始化失败弹框后退出；新增 DR-014（`posts.created_at` 由 03 §6.1 的 TEXT 修正为 INTEGER）
- 依赖: 新增运行时依赖 `better-sqlite3 11.10.0`（03 §1.2 既定选型）与 devDependency `@types/better-sqlite3 9.6.0`；本环境 Node 24 无对应 node 预编译包，安装用 `--ignore-scripts`，随后从 npmmirror 取 `better-sqlite3-v11.10.0-electron-v130-win32-x64.tar.gz` 解压到包目录（GitHub 直连失败）
- 验证: P-05 通过——`pnpm exec electron scripts/spike-sqlite.cjs` 在真实 Electron 进程加载 better-sqlite3（ABI 130）并执行 SELECT、验证 ROLLBACK 不落库；`pnpm build` 三端成功（`?raw` 内联生效）；Electron 端到端烟测（`--user-data-dir` 临时目录）两次启动均存活且生成 `booru.db`，`SPIKE_DB_FILE` 复查：表 `posts / schema_migrations / tag_cache` 齐全、迁移记录仅 `1:001_init`（幂等）、`posts.created_at` 为 INTEGER；`pnpm lint` / `pnpm typecheck` 通过；`pnpm test` 67/67 通过（新增 db 4 条：建表字段、重复迁移、事务回滚、事务提交）
- 遗留: 单测在 Node 20（无 `node:sqlite`）会自动跳过 DB 用例，真实 DB 由 `scripts/spike-sqlite.cjs` 覆盖；`pnpm install` 不会自动为 Electron 重建 better-sqlite3，需按 08 §2 执行 `install-app-deps`；`posts` / `tag_cache` 尚无读写 API（T-14 / T-15 再接）
- 下一步: T-14（搜索页 + 虚拟网格）

### 2026-11-03 会话 17
- 任务: T-14（搜索页 + 虚拟网格）
- 改动文件: src/shared/models.ts（新增：Post/PostPage/Rating 等跨进程类型）、src/shared/ipc-contract.ts（新增：`posts:search` channel、`PostsSearchInput`、`BooruApi`）、src/shared/posts.ts（新增：翻页合并去重）、src/main/sites/query.ts、src/main/sites/moebooru.ts（类型迁到 shared）、src/main/sites/types.ts（删除，内容并入 shared/models.ts）、src/main/sites/yande.ts（新增：yande 适配器单例）、src/main/ipc/search-input.ts（新增：zod 入参）、src/main/ipc/handlers/posts-search.ts（新增：纯逻辑 handler）、src/main/ipc/registry.ts（新增：`ipcMain.handle`）、src/main/index.ts（ready 后注册 IPC）、src/preload/index.ts（暴露 `searchPosts`）、src/renderer/env.d.ts、src/renderer/App.tsx、src/renderer/pages/SearchPage.tsx（新增）、src/renderer/components/{SearchBar,PostGrid,PostCard,EmptyState,ErrorState}.tsx（新增）、src/renderer/styles/{tokens.css（新增）,index.css}、src/renderer/index.html（CSP 图片白名单）、package.json / pnpm-lock.yaml（新增 `@tanstack/react-virtual 3.13.12`）、tests/unit/{posts,posts-search}.test.ts（新增）、docs/03-Architecture.md、docs/07-Progress.md
- 决策: 新增 DR-015（原生 CSS + 等高行虚拟化，暂不引 Tailwind/瀑布流库）与 DR-016（预览图直连站点域名并放行 CSP）；`Post` 等跨进程类型统一放 `shared/models.ts`（renderer 不得 import main，05 §2）；IPC 拆成 `search-input.ts`（zod）与 `handlers/posts-search.ts`（注入适配器），保证离线可测；`page` 与 `lastId` 二选一，空查询直接返回空页不发请求（09 TC-06）；渲染层用请求序号丢弃过期响应、`loadingRef` 防触底重复请求；新搜索重置列表，翻页按 `site+id` 去重后追加
- 依赖: 新增运行时依赖 `@tanstack/react-virtual 3.13.12`（03 §1.2 既定选型），未引入 Tailwind、zustand 等其他技术栈
- 验证: `pnpm lint` 通过（tanstack hook 的 React Compiler 警告已按官方 API 事实加定点 disable，最终 0 error / 0 warning）；`pnpm typecheck` 通过（node + web）；`pnpm test` 78/78 通过（12 个文件，新增 posts 3 条、posts-search 8 条）；`pnpm build` 三端成功（renderer 40 modules，CSS 4.97 kB）
- 遗留: 真实站点搜索与虚拟滚动流畅度需本地桌面目视（P-07/P-08 类限制）；预览图依赖映射域名的真实连通性（P-09）；瀑布流与 booru:// 缩略图缓存按 DR-015/DR-016 留待后续；`posts` 表尚未写入（搜索结果不落库）
- 下一步: T-15（标签联想）

### 2026-11-03 会话 18
- 任务: T-15（标签联想）
- 改动文件: src/shared/models.ts（新增 `TAG_TYPES` / `TagType` / `TagSuggestion` / `tagTypeFromCode` / `isTagType`）、src/shared/tags.ts（新增：`activeToken` / `suggestPrefix` / `replaceActiveToken`）、src/shared/ipc-contract.ts（新增 `tags:suggest` channel、`TagsSuggestInput`、`suggestTags` API）、src/main/sites/moebooru.ts（新增 `suggestTags`、`buildTagSuggestPath`、`MOEBOORU_TAG_LIMIT`，JSON 解析抽 `parseJson`）、src/main/storage/tags.ts（新增 `createTagCache`）、src/main/ipc/suggest-input.ts（新增 zod 入参）、src/main/ipc/handlers/tags-suggest.ts（新增纯逻辑 handler）、src/main/ipc/registry.ts、src/main/bootstrap.ts（新增 `getDatabase`）、src/preload/index.ts、src/renderer/components/SearchBar.tsx（改为 chip + 联想下拉）、src/renderer/pages/SearchPage.tsx、src/renderer/styles/index.css、tests/unit/{moebooru,tag-input,tags-cache,tags-suggest}.test.ts、docs/07-Progress.md
- 决策: 联想分三层——适配器 `suggestTags`（zod 校验 + `type` 整数映射）、`storage/tags.ts` 本地 `tag_cache` 前缀查询、handler 编排"本地命中即返回，未命中请求远端并回写，空结果不写库"；`type` 映射与 `TagSuggestion` 放 `shared/models.ts` 供主/渲染共用（06 §4：0/1/3/4，未知按 general）；缓存前缀用 `LIKE ? ESCAPE '\'` 并转义 `%`/`_`，因为标签名大量含下划线且 `_` 在 LIKE 中是通配符；防抖 300ms 与请求序号放在渲染层 `SearchBar`，从 `onChange` 触发而非 `useEffect`（避免 `react-hooks/set-state-in-effect` 的级联渲染告警），所有关闭入口统一走 `cancelSuggest`；`Tab`/点击选中项追加为 chip，提交时 `chips + 剩余输入` 合并，`-tag` 与含 `:` 的语法 token 不参与联想；联想失败只清空下拉，不弹错误、不阻断搜索
- 验证: `pnpm lint` 通过（首轮 2 处报错：effect 内同步 setState + 测试 import 排序，已改为事件内调度并 `--fix` 后复跑通过）；`pnpm typecheck` 通过（node + web）；`pnpm test` 99/99 通过（15 个文件，新增 moebooru 联想 4 条、tag-input 5 条、tags-cache 6 条、tags-suggest 6 条；tags-cache 在 Node 24 用 `node:sqlite` 实测前缀/排序/隔离/转义）；`pnpm build` 三端成功（renderer 41 modules，CSS 6.77 kB）
- 遗留: 真实站点 `/tag.json` 与 300ms 防抖/键盘手感需本地桌面人工验证；`tag_cache` 只增不删、无 TTL/容量上限（后续设置页或清理任务再定策略）；本地命中时不会后台刷新远端（按 02 §3 的"命中即返回"实现）
- 下一步: T-16（R18 默认关闭）

### 2026-11-03 会话 19
- 任务: T-16（R18 默认关闭）
- 改动文件: src/shared/content.ts（新增：`ContentConfig` / `parseContentConfig` / `applyR18Filter`）、src/shared/models.ts（`PostPage.r18Filtered`）、src/main/network/hostmap.ts（`AppConfig.content` 读写）、src/main/ipc/handlers/posts-search.ts（解析前应用过滤并注入开关）、src/main/ipc/registry.ts（从 `config.json` 读取开关）、src/renderer/pages/SearchPage.tsx、src/renderer/styles/index.css、tests/unit/content.test.ts（新增）、tests/unit/posts-search.test.ts、docs/03-Architecture.md、docs/07-Progress.md
- 决策: 见 DR-023——R18 开关先存 `config.json` 的 `content.allowExplicit`（默认 false），在 handler 拼接查询前应用；任何显式 `rating:` / `-rating:` token（含大小写与正负向）都视为用户意图，不追加 `-rating:e`；不提前实现 `settings:get/set`（归属 T-30）。编号说明：另一会话的 `10-UI-Shell-Plan` 已预留 DR-017~DR-022（待确认），本任务改用 DR-023，避免 §3 重复
- 行为: 未开启且无 rating 意图时自动附加 `-rating:e`；`PostPage.r18Filtered` 标记自动过滤，搜索页据此显示"已过滤 R18（设置中可开启）"；开关每次请求读取配置，改 `config.json` 后重新搜索即可生效、无需重启
- 验证: `pnpm lint` 通过（首轮 `hostmap.ts` import 排序报错，`eslint --fix` + Prettier 后复跑通过）；`pnpm typecheck` 通过（node + web）；`pnpm test` 111/111 通过（16 个文件，新增 content 7 条、posts-search R18 5 条）
- 遗留: 真实站点 `-rating:e` 过滤效果需本地网络验证；T-30 前无开关 UI，只能人工编辑 `config.json`；搜索页 R18 提示的实际视觉需本地桌面确认
- 下一步: T-17（查看器）

### 2026-11-03 会话 20
- 任务: 界面外壳重构技术方案（非看板任务，产出 D-10）
- 改动文件: docs/10-UI-Shell-Plan.md（新增）、docs/07-Progress.md
- 决策: 方案含 DR-017~DR-022（标题栏保留系统按钮（`titleBarOverlay`）、样式改 CSS Modules 并修订 05 §1、亮色默认双主题、图标与图片资源策略、HashRouter + zustand、布局尺寸单一来源）；继承既有 DR-015（原生 CSS + 等高网格）与 DR-016（CSP 图片白名单）。待用户确认后并入 §3 决策记录
- 验证: 未改代码，不涉及 lint / typecheck / test
- 遗留: 设计图未提供；10 §13 有 5 项待确认；P3 会与 T-16/T-17 改动 `SearchPage` / `SearchBar` / `index.css`，需串行或登记文件归属
- 下一步: 业务看板按 T-16 推进；本方案确认后另立 T-38 窗口层 spike

### 2026-11-03 会话 21
- 任务: UI 外壳方案定稿（非看板任务，D-10 修订）
- 改动文件: docs/07-Progress.md、docs/05-Conventions.md、docs/10-UI-Shell-Plan.md
- 决策: 用户确认完全自绘窗口（接受失去悬停贴边菜单）、亮色默认 + 暗色 + 可扩展预设/自定义、需要 Mica、设计图未覆盖状态由默认矩阵补齐、样式采用 CSS Modules；DR-017~DR-022 已并入 §3，05 §1/§4 已同步为 CSS Modules
- 验证: 未改代码，不涉及 lint / typecheck / test
- 遗留: 设计图未提供（将用设计提示词生成）；T-38 需实测 `frame:false` 下 Mica 与拖边分屏/`Win+Z`
- 下一步: 业务看板按 T-17 推进；UI 轨道待设计稿到位后先做 T-38 窗口层 spike

### 2026-11-03 会话 22
- 任务: T-17（查看器）
- 改动文件: src/shared/viewer.ts（新增）、src/renderer/components/{ImageViewer,ZoomLayer,InfoPanel,TagList}.tsx（新增）、src/renderer/components/ImageViewer.module.css（新增）、src/renderer/components/{PostCard,PostGrid}.tsx、src/renderer/pages/SearchPage.tsx、src/renderer/styles/index.css、tests/unit/viewer.test.ts（新增）、docs/07-Progress.md
- 决策: 见 DR-024（首版不接入下载/收藏/浏览器打开）；缩放变换与切图/原图阈值/体积格式化抽到 `shared/viewer.ts` 纯函数，渲染层只维护状态；≤8MB 自动后台加载原图并在 `onLoad` 后无缝替换，>8MB 显示"加载原图"按钮（02 §5.1）；预加载左右各一张 sample，最多同时 3 张（02 §14.1）；查看器为搜索页上的模态浮层，标签点击关闭查看器并提交新搜索；新组件使用 CSS Modules（DR-018），卡片改为 `button` 以获得键盘可达性
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 119/119 通过（17 个文件，新增 viewer 8 条：缩放边界、锚点缩放、切图边界、邻居预加载、原图阈值、体积格式化）；`pnpm build` 三端成功（renderer 48 modules，CSS 12.17 kB）
- 遗留: sample 首屏时间、滚轮锚点/拖动/双击复位手感、快捷键与 Esc 关闭需本地桌面人工验证（P-10）；真实图片域名连通性依赖 P-09；D/F/O 与信息栏动作按钮按 DR-024 延后
- 下一步: T-18（已看标记 + post_views）

### 2026-11-03 会话 23
- 任务: 设计稿评审与卡片布局决策（非看板任务，D-10 / D-02 修订）
- 改动文件: docs/02-UX-Design.md、docs/07-Progress.md、docs/10-UI-Shell-Plan.md
- 决策: 卡片按原图比例自适应并 clamp 140–420px、列宽 200–260px、最短列瀑布流 + 自定义虚拟化（DR-026）；标题栏取 42px；去掉山形装饰；应用名待定，代码先用常量占位
- 验证: 未改代码，不涉及 lint / typecheck / test
- 遗留: 亮色是否保留整窗渐变壁纸待确认（当前按低饱和处理）；`PostGrid` 的瀑布流重写在 P3 阶段进行
- 补充: 默认背景定为 CSS 浮动光斑（DR-027）；亮色空态/错误态参考图不再提供，按 token 推导
- 下一步: 业务看板按 T-18 推进；UI 轨道先做 T-38 窗口层 spike

### 2026-11-03 会话 24
- 任务: T-17 回归修复（查看器 sample 在 `pnpm dev` 下提示"图片加载失败"）
- 改动文件: src/renderer/components/ZoomLayer.tsx、src/renderer/components/PostCard.tsx、docs/06-API-Contract.md、docs/07-Progress.md
- 根因: 开发页源为 `http://localhost:5173`，Chromium 对图片请求携带该 Referer；`files.yande.re` 对非本站 Referer 返回 `307` 并跳转到 HTML 详情页，`<img>` 解码失败。`assets.yande.re` 预览图不校验 Referer，因此网格正常、查看器裂图（DR-025）
- 决策: 所有远程 `<img>`（PostCard 预览、查看器 sample 与原图）统一加 `referrerPolicy="no-referrer"`；不改主进程网络与 CSP
- 验证: Electron 探针（本地 HTTP 源 + 独立 session + cache-busting）：默认 Referer 收到 `307 text/html`、`naturalWidth=0`；`no-referrer` 收到 `200 image/jpeg`、`naturalWidth=1139`。`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` 均通过
- 遗留: 生产 `file://` 与本机映射下行为与探针一致；查看器交互仍需 P-10 人工复核
- 下一步: T-18（已看标记 + post_views）

### 2026-11-03 会话 25
- 任务: T-17 后续增强（DR-028：打开即自动加载原图 + 字节级加载进度）
- 改动文件: src/shared/{constants,ipc-contract,viewer}.ts、src/preload/index.ts、src/main/network/image-loader.ts（新增）、src/main/ipc/handlers/images-fetch.ts（新增）、src/main/ipc/registry.ts、src/renderer/image-store.ts（新增）、src/renderer/hooks/useImageSnapshot.ts（新增）、src/renderer/components/{ImageViewer,ZoomLayer,ImageProgress}.tsx、src/renderer/components/{ImageViewer,ImageProgress}.module.css、src/renderer/index.html、tests/unit/{viewer,image-loader,image-store}.test.ts、docs/{02-UX-Design,03-Architecture,06-API-Contract,07-Progress}.md
- 决策: 移除 8MB 阈值与"加载原图"按钮；点击卡片后并行加载 sample 与 file，file 就绪后无缝替换；两种图片统一走 `images:fetch`（主进程 `ses.fetch` 流式读取，`images:progress` 每 100ms 节流上报字节进度），渲染层生成 `blob:` 并做最多 3 张 LRU 缓存；`img-src` 增加 `blob:`；不预取邻居（DR-028）
- 安全: IPC 仅允许 `https:` 且属于 `IMAGE_HOSTS` 的图片域名；单图 60s 超时、64MB 上限；切图时旧请求不取消，过期结果按 requestId 丢弃
- 验证: `pnpm lint` 通过（首轮 ImageViewer import 排序报错，`eslint --fix` 后复跑通过）；`pnpm typecheck` 通过（node + web）；`pnpm test` 135/135 通过（19 个文件，viewer 8 条含 `progressPercent`，新增 image-loader 8 条、image-store 8 条）；`pnpm build` 三端成功（renderer 52 modules，CSS 15.37 kB）
- 遗留: 真实窗口内的进度条/原图替换/切图缓存/大图与断网重试需本地桌面人工验证；ArrayBuffer 经 IPC 复制存在内存峰值；图片请求未接入下载队列（T-23 可复用流式读取）
- 下一步: T-18（已看标记 + post_views）

### 2026-11-03 会话 26
- 任务: T-17 查看器加载 UI 调整（用户反馈）
- 改动文件: src/renderer/components/{ImageViewer,ZoomLayer}.tsx、src/renderer/components/ImageViewer.module.css、docs/02-UX-Design.md、docs/07-Progress.md
- 决策: 预览进度只保留居中一处，原图进度固定在预览区右上角（预览图就绪后位置不变）；原图就绪后改为同一 `<img>` 切换 `blob:` 地址，不再用绝对定位叠加两张图（修复原图与预览图重叠）
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 135/135 通过（19 个文件）；`pnpm build` 三端成功（renderer 282.82 kB，CSS 15.17 kB）
- 遗留: 真实窗口内需复核居中预览进度、右上角原图进度、原图替换无重叠与无闪烁
- 下一步: T-18（已看标记 + post_views）

### 2026-11-03 会话 27
- 任务: T-17 查看器预览进度去文本
- 改动文件: src/renderer/components/{ImageProgress,ImageViewer}.tsx、src/renderer/components/ImageProgress.module.css、docs/{02-UX-Design,07-Progress}.md
- 决策: `ImageProgress` 新增 `showText`（默认 true）；查看器中心的预览进度传 `showText={false}`，只保留无边框、无背景的进度条；右上角原图进度仍保留百分比与字节文本
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 135/135 通过（19 个文件）；`pnpm build` 三端成功（renderer 283.07 kB，CSS 15.43 kB）
- 遗留: 窗口内复核中心纯进度条在亮/暗主题下的可见性
- 下一步: T-18（已看标记 + post_views）

### 2026-11-03 会话 28
- 任务: T-18（已看标记 + post_views）
- 改动文件: src/main/storage/migrations/002_views.sql（新增）、src/main/storage/migrations/index.ts、src/main/storage/views.ts（新增）、src/main/ipc/views-input.ts（新增）、src/main/ipc/handlers/views-mark.ts（新增）、src/main/ipc/handlers/views-list.ts（新增）、src/main/ipc/registry.ts、src/shared/ipc-contract.ts（共享文件：新增 views:mark / views:list）、src/preload/index.ts、src/renderer/pages/SearchPage.tsx、src/renderer/components/PostGrid.tsx、src/renderer/components/PostCard.tsx、src/renderer/styles/index.css、tests/unit/db.test.ts、tests/unit/views.test.ts（新增）、tests/unit/views-handlers.test.ts（新增）、scripts/spike-sqlite.cjs、docs/03-Architecture.md、docs/07-Progress.md
- 决策: DR-029——新增 `views:list` 批量查询已看 id（03 §6.2 需要但 §7 缺通道），`views:mark` 返回 `Result<null>`，`post_views` 用迁移 002 建表（001 已在用户库应用，不可改）；`views:stats` / `views:clear` 留给后续任务
- 行为: 点击卡片即乐观加入已看集合并变暗（opacity 0.55 + saturate 0.8，hover / focus 恢复）；查看器 ←/→ 切图经 SearchPage 的 `onIndexChange` 包装逐张标记，`ImageViewer` 仍不直接碰 IPC；每次新搜索与翻页后 `views:list` 批量恢复，重启后状态保留；写入失败只回滚本次新增 id 并显示红字提示（已看过的历史状态不回滚），读取失败同样提示但不阻断浏览；乱序 `views:list` 响应按请求序号丢弃
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 149/149 通过（21 个文件，新增 views 6 条、views-handlers 8 条，含重启保留与迁移索引断言）；`pnpm build` 三端成功；Electron 真实 ABI 烟测（临时 userData 连续启动两次后用 `scripts/spike-sqlite.cjs` 复查）：`post_views / posts / schema_migrations / tag_cache` 齐全，迁移记录 `1:001_init, 2:002_views` 不重复（幂等），`posts.created_at` 为 INTEGER
- 遗留: 变暗效果、hover/focus 恢复、查看器切图逐张变暗需本地桌面人工确认；`view_count` 已累加但查看器"已看 N 次 · 首次日期"（`views:stats`）尚未接入；清除记录（`views:clear`）归 T-22
- 下一步: T-19（三态角标）

### 2026-11-03 会话 29
- 任务: 品牌命名与改名（非看板任务）
- 改动文件: package.json、electron-builder.yml、src/shared/constants.ts、src/renderer/index.html、src/main/index.ts、src/main/bootstrap.ts、scripts/spike-sqlite.cjs、docs/{01-PRD,02-UX-Design,03-Architecture,04-Task-Plan,05-Conventions,06-API-Contract,07-Progress,08-Dev-Setup,09-Test-Cases,10-UI-Shell-Plan}.md、docs/index.txt
- 决策: DR-030——产品名 **Bluu / 蓝噗**，角色为原创圆身蓝鲨「噗噗」；`appId=com.bluu.app`、`productName=Bluu`、`author=LeDon`、数据库 `userData/bluu.db`；`window.booru` / `BooruApi` / `booru://` / IPC 前缀等技术命名不跟随品牌，避免全量回归
- 改动: `APP_NAME='蓝噗'` 并新增 `APP_NAME_EN='Bluu'`；窗口标题与安装器/快捷方式名统一；02 §1.1 新增品牌与角色规范（配色、加载泡泡、角色出现位置）
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 149/149 通过（21 个文件）；`pnpm build` 三端成功（main 37.18 kB、preload 1.11 kB、renderer 52 modules / CSS 15.93 kB）
- 遗留: 旧 `%APPDATA%\booru-desktop` 到 `%APPDATA%\bluu` 的数据迁移被权限校验拦截，等待用户确认后执行（`config.json`、`booru.db`→`bluu.db`、`Partitions`）；品牌角色/图标未绘制（T-43）；发布前需 Bluu / 蓝噗 商标与撞名检索；真实窗口标题与安装包名需本地人工确认
- 下一步: T-19（三态角标）

---

## 6. 下一步（自动接续）

> 新会话按以下字段自动领取任务；字段缺失、与 §2 看板冲突、依赖未满足时，**停止并询问，不要猜**。

- **NEXT_TASK**: `T-19`（三态角标）
- **NEXT_REASON**: T-18 已完成，`post_views`、`views:mark` 与 `views:list` 提供了 ✓ 已看态的可靠数据源。T-19 只需把角标从"变暗"升级为 `BadgeStack`（✓/↓/★ 固定顺序），↓（下载，T-23）与 ★（收藏，T-21）暂无数据源，组件先留出插槽并默认不渲染。领取前须注意：当前 `PostCard` 的 rating 色点在右上角，与 02 §6.2/§14.3"角标在右上角、评分在右下角"冲突，T-19 需按文档把 rating 色点移到右下角
- **NEXT_ACCEPTANCE**: 02 §6.2/§14.3：✓（灰蓝 `#6B7C93`）、↓（绿 `#3FA96B`）、★（琥珀 `#D9A441`）右上角横排，顺序 ✓→↓→★，最多 3 个；每枚角标带 `aria-label`；仅 ✓ 有数据源时只渲染 ✓，不出现空角标；已看仍保持 opacity 0.55 / saturate 0.8，hover/focus 恢复亮度而 ✓ 保留；卡片右下角保留评分
- **NEXT_DEPENDS**: T-18 done（已看集合 + `views:list`）；02 §6.2 / §14.3 / §13 已定义角标规格；↓/★ 的真实数据源依赖 T-23 / T-21，T-19 不提前接入
- **NEXT_MANUAL**: 角标是否遮挡缩略图主体、亮/暗主题下三角色对比度、hover/focus 恢复亮度且 ✓ 保留需本地桌面确认；不依赖真实站点网络

后续顺序（NEXT_TASK 完成后按此推进，并同步更新本字段）：

1. **T-19 三态角标**：✓ 接线 T-18，↓/★ 留待 T-23 / T-21（当前 NEXT_TASK）
2. **T-20 隐藏已看 + 补页**：复用 `views:list`，补页上限 5
3. **T-21 收藏** / **T-23 下载队列**
4. **T-28 konachan 适配**：需 T-23/T-29 与 P-02/P-04 真实响应实测后再领

> T-03 结论：`pnpm dist` 产出 `release/Booru Desktop Setup 0.1.0.exe`（NSIS per-user，免管理员）与 `release/Booru Desktop 0.1.0.exe`（portable）；`release/win-unpacked` 产物已烟测启动窗口与单实例；图标/签名与纯净 Win11 安装验收待人工。

> T-04 结论：单实例锁在 ready 前申请，二次启动直接退出并聚焦已有窗口；窗口默认 1280×860、最小 1024×720、`nativeTheme.themeSource='dark'`，尺寸常量在 `shared/constants.ts` 并有单测锁定。

> T-10 结论：`tests/mock/server.ts` 提供 `127.0.0.1` 随机端口与 `/__stats`（次数/时间戳），`x-scenario` 覆盖 ok / 429-3 / challenge-once / challenge-always / timeout；`createHttpClient` 支持注入 `baseUrl`，集成用例实测限速 1.97 req/s、429 按 `Retry-After: 1` 退避、CF 不重试、超时不挂起。
> T-07 结论：`createHttpClient` 返回 `Result` 信封，限速 2 req/s 且重试也过桶；429 优先 `Retry-After`；404 与 CF 失败不重试。`http-site.ts#getHttpClient` 为站点单例：yande 走 `ses.fetch`，konachan 走 `cloudflare.ts` 窗口通道（DR-010）。
> T-06 结论：分区名 `persist:yande` / `persist:konachan` 由 `sessionPartition` 唯一生成，`getSession` 单例复用；两站 cookie 隔离、跨进程重启保留均已烟测通过，未覆盖默认 UA。
> T-05 结论：hostmap 默认随启动注入，规则覆盖两站主站与 files/assets；映射失效时可改 `config.json` 后重启回退直连。P-01 已关闭：CF 自动通行成立，konachan 不能走 `ses.fetch`。
> T-11 结论：`main/sites/query.ts#parseQuery` 输出 `tags/excludedTags/ratings/excludedRatings/scores/widths/ids/order` 与 `raw`；非法输入抛 `QueryError`（`PARSE`、不可重试、中文文案）；`-rating:e` 已保留为 `excludedRatings`，T-16 可直接复用。
> T-12 结论：`main/sites/moebooru.ts#createMoebooruAdapter` 注入 `HttpClient`，`search` 支持 `{page}` 与 `{lastId}` 两种游标；归一化为 rating 全称映射、`createdAt` epoch 毫秒、过滤非 active；空数组返回空页，数据异常统一 `PARSE`。tag 类型暂为 general，待 T-15 接入 `/tag.json`。
> T-13 结论：`main/storage/db.ts#openDatabase` 在 `userData/booru.db` 上建库并执行迁移；`schema_migrations` 记录已应用 id，重复启动只跳过；迁移与写入均走 `withTransaction`（显式 `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`）。迁移 001 建 `posts`、`tag_cache`（`created_at` 为 INTEGER，DR-014）。P-05 已验证：Electron 33（ABI 130）可直接加载 better-sqlite3；`scripts/spike-sqlite.cjs` 可复验 ABI 与启动后的库结构。
> T-14 结论：`shared/ipc-contract.ts#IPC_CHANNELS.postsSearch` 经 preload 暴露为 `window.booru.searchPosts`，主进程 `main/ipc/handlers/posts-search.ts` 完成 zod 校验 → `parseQuery` → `getYandeAdapter().search`，失败统一 `Result` 信封；入参 `page`/`lastId` 二选一，空查询不发请求。渲染层 `SearchPage` 用 `PostGrid`（@tanstack/react-virtual 行虚拟化）滚动触底加载下页，按 `site+id` 去重（`shared/posts.ts#mergePosts`）；PARSE/网络错误展示中文原因 + 错误码与重试。DR-015/DR-016 记录了原生 CSS、等高网格与 CSP 图片白名单的取舍。
> T-15 结论：`tags:suggest` 经 `main/ipc/handlers/tags-suggest.ts` 编排：zod 校验（prefix ≥2、≤100）→ `storage/tags.ts#createTagCache` 本地前缀命中即返回 → 未命中调 `MoebooruAdapter.suggestTags`（`/tag.json?name=<prefix>*&limit=10`）并回写 `tag_cache`，空结果不写库，失败返回 `Result`。`shared/models.ts#tagTypeFromCode` 按 06 §4 映射 0/1/3/4，未知按 general。渲染层 `SearchBar` 在 `onChange` 里做 300ms 防抖 + 请求序号丢弃过期响应，`↑↓` 移动高亮、`Tab`/点击把标签补成 chip、`Esc`/失焦关闭，联想失败静默清空且不影响提交。
> T-16 结论：`shared/content.ts#applyR18Filter` 在 `posts:search` 解析前应用：R18 关闭（`config.json#content.allowExplicit=false`，默认）且用户未显式写 `rating:` / `-rating:` 时追加 `-rating:e`；显式 rating token 一律不覆盖。自动过滤由 `PostPage.r18Filtered` 回传，搜索页显示"已过滤 R18（设置中可开启）"。开关读取集中在 `main/ipc/registry.ts`，每次请求读配置（DR-023）。
> T-17 结论：`renderer/components/ImageViewer.tsx` 以模态浮层打开当前结果集，提供 `←/→` 切图（边界禁用）、`Space` 复位、`+/-` 缩放、`Esc` 关闭与信息栏收起；`ZoomLayer` 实现滚轮锚点缩放、放大后拖动与双击复位。缩放/切图/原图阈值逻辑集中在 `shared/viewer.ts` 纯函数并有 8 条单测；≤8MB 自动加载原图，>8MB 显示"加载原图"按钮；邻居 sample 预加载最多 2 张。D/F/O 与信息栏动作按钮按 DR-024 延后。
> T-18 结论：迁移 002 建 `post_views(site, post_id, viewed_at, last_at, view_count)` 与 `idx_views_last`（`viewed_at` 首次、`last_at` 最近，epoch 毫秒）；`main/storage/views.ts#createViewsStore` 提供 `mark`（UPSERT 累加 `view_count`）与 `listViewed`（03 §6.2 批量 IN 查询）。IPC 为 `views:mark`（`Result<null>`）与 `views:list`（已看 id 数组），入参 zod 限制 1–100 个 id、失败回滚并提示。渲染层 `SearchPage` 维护已看 `Set`，点击与查看器切图乐观变暗（`PostCard` opacity 0.55 / saturate 0.8，hover/focus 恢复），新页与重启后经 `views:list` 恢复，乱序响应按请求序号丢弃（DR-029）。
