# Bluu（蓝噗）进度与协作看板

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 更新日期 | 2026-11-05 |
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
| T-09 | 代理支持 | done | 2026-11-04/42 | `config.json#network.proxy` 直连/HTTP/SOCKS5；`resolveProxy` 复检 + 启动探测，失败回退并横幅提示（DR-039） |
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
| T-19 | 三态角标 | done | 2026-11-04/30 | `shared/badges.ts` + `BadgeStack`（✓ 接线 T-18，↓/★ 留插槽）；rating 色点移入信息条右下角 |
| T-20 | 隐藏已看 + 补页 | done | 2026-11-04/33 | 渲染层过滤 + `onUnderfilled` 自动补页，上限 5（DR-031）；关闭开关即时恢复 |
| T-21 | 收藏 | done | 2026-11-04/34；迁移 003 + `favorites:toggle` / `favorites:list` + ★ 角标 + 收藏页 |
| T-22 | 清除浏览记录 | done | 2026-11-04/36 | 设置页最小入口 + 二次确认；`views:clear` 事务清理 `post_views` 与 `favorites`，`views:updated` 即时刷新（DR-033） |

### M4 下载

| ID | 任务 | 状态 | 备注 |
|---|---|---|---|
| T-23 | 下载队列 | done | 2026-11-04/37：迁移 004 + 状态机 + 并发 1–6 + 暂停/恢复/取消 + `downloads:*` IPC（DR-034） |
| T-24 | 断点续传 | done | 2026-11-04/38 会话 | `Range`/206 追加/200 回退/416 完成 + 重启续传；`bytes_done` 回填（DR-035） |
| T-25 | md5 校验与命名 | done | 2026-11-04/40：迁移 005 + 入队模板渲染 + 非法字符清洗 + md5 校验 + md5/同名去重（DR-037） |
| T-26 | 下载页 | done | 2026-11-04/39：`DownloadsPage` + `TaskList`/`TaskRow`/`ProgressBar` + 暂停/恢复/重试/取消 + 查看器进度条（DR-036，提前于 T-25） |
| T-27 | 批量入口 | done | 2026-11-04/41：多选 + 查询级 + >50 张确认 + ≤100 分片入队 + 汇总提示（DR-038） |

### M5 双站与发布

| ID | 任务 | 状态 | 备注 |
|---|---|---|---|
| T-28 | konachan 适配 + CF 通道 | done | 2026-11-05/61：新增 `getSiteAdapter(site)` 统一路由（复用 moebooru，yande 走 `ses.fetch`、konachan 走 CF 通道），搜索/榜单/联想 handler 按入参站点取适配器；搜索页与榜单页新增站点切换，榜单标签跳搜索携带来源站点；`IMAGE_HOSTS` 与 CSP 补 konachan 域（DR-057）；P-02/P-04/P-27 待真实网络人工复验 |
| T-29 | 榜单页 | done | 2026-11-04/44：热门固定 40 条，日/周/月按日期；补齐 `posts:rankings` 适配器与 IPC（DR-041）；P-18 待人工验证 |
| T-30 | 设置页 | done | 2026-11-04/43：网络（代理 + IP 映射）/ 下载（目录、模板、并发）/ 内容（R18）/ 隐私四组（DR-040） |
| T-31 | 错误态与空态 | done | 2026-11-05/56 会话：统一错误码引导 + 下载/设置页 ErrorState + 重试（DR-052）；P-24 待人工目视 |
| T-32 | 打包验收 | done | 2026-11-05/57：按当前源码重建 `Bluu Setup 0.1.0.exe` / `Bluu 0.1.0.exe`，依赖完整（DR-053）；用户回报人工验收清单全部通过（纯净 Win11 x64 免提权安装、启动、搜索→查看→收藏→下载→设置、退出与卸载均正常） |
| T-33 | 文档同步 | done | 2026-11-05/58：02/03/06 按当前代码核对并补变更记录，04 §5 逐项标注覆盖情况（DR-054）；未改业务代码 |

### P1

| ID | 任务 | 状态 |
|---|---|---|
| T-34 | 诊断页 | todo |
| T-35 | 自动更新 | done | 2026-11-05/69：新增 `electron-updater` 与 `main/update/service.ts` 状态机，设置页「关于与更新」手动检查/下载/重启安装；仅 NSIS 安装版（开发模式与便携版返回 `unsupported`），`autoDownload=false`、`autoInstallOnAppQuit=true`；`electron-builder.yml` 增加 `publish.provider=github`（DR-066）；TC-45 真机升级待验证 |
| T-36 | 搜索历史 | done · 2026-11-05/59 |
| T-37 | 标签黑名单 | done | 2026-11-05/60：`Settings.content` 持久化 + 搜索拼接 `-tag`（与显式 `-tag` 去重）+ 榜单本地过滤 + 设置页编辑与提示（DR-056）；konachan 真实生效随 T-28；P-26 待人工目视 |

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
| DR-030 | 产品名定为 **Bluu（蓝噗）**：`Bluu` 为 blue 的可爱拉长拼写，中文「蓝噗」取鲨鱼吐泡拟声；品牌角色为原创圆身蓝鲨「噗噗」。`appId` / `productName` / 窗口标题统一为 Bluu / 蓝噗，`author` 为 LeDon；数据库文件改为 `userData/bluu.db`；内部技术命名（`window.booru`、`BooruApi`、`booru://`、IPC 前缀）保持不变 | 用户确定以可爱蓝鲨角色为中心，且希望名字与个人 ID `LeDon` 有关；品牌与领域术语分离可避免全量 API/协议回归，用户可见处仍统一 | Electron `userData` 目录随应用名变为 `%APPDATA%\bluu`；未发布，不写自动迁移代码，旧 `%APPDATA%\booru-desktop` 的 `config.json` 与 `booru.db`（改名为 `bluu.db`）已手工复制；按用户选择不复制 `Partitions`，站点 cookie 与 CF clearance 由应用重新生成；发布前需做 Bluu / 蓝噗 商标与撞名检索 |
| DR-031 | T-20 隐藏已看完全在渲染层派生：`posts` 保留全部已加载数据，`filterUnviewed` 只生成可见列表；视口未填满由 `PostGrid` 检测 `scrollHeight - clientHeight < 300` 主动上报（过滤后不会产生滚动事件）；仅自动补页计入"连续 5 页无未看项"，"已跳过 N 张"的 N 为这 5 页中跳过的已看数量；新页在追加前先 `views:list` 恢复已看 | 02 §2.1 / §6.3 要求独立 toggle、自动补页与计数，但未说明 N 的口径与补页触发方式；若追加后再异步过滤，隐藏模式下已看项会闪现后被移除 | `shared/posts.ts` 新增 `MAX_AUTO_FILL_PAGES`、`advanceFillProgress`、`isAutoFillExhausted`、`filterUnviewed` 并有单测；新增通用 `Switch`（02 §14.1 已登记）；关闭开关即时恢复且不丢弃已加载数据；不改站点查询与 `post_views` |
| DR-032 | T-21 的 `favorites:toggle` 入参由 `{site, postId}` 扩展为 `{site, post}`：收藏时在同一事务内把 Post 快照 upsert 进既有 `posts` 表再写 `favorites`；`favorites:list` 改为 `{site, query?, sort?}`，从 `favorites` 联查 `posts` 快照，标签过滤与排序（`added` / `score`）全部本地完成。迁移 003 只新增 `favorites` 表与 `idx_favorites_added` | 03 §6.1 已有 `posts` 元数据表，但 T-12/T-13 未实现搜索写入缓存，若收藏只存 `(site, post_id)`，重启后收藏页无法渲染卡片；`favorites:list` 原签名缺排序参数，无法满足 02 §8 的"按收藏时间/评分排序"。收藏与已看独立，取消收藏不触碰 `post_views` | 03 §7 契约同步；`favorites:toggle` 失败返回 `Result` 信封；收藏页只读本地，不请求站点；T-22 清除记录需同时清理 `favorites`；`posts` 表暂不存 `source`，收藏页来源字段显示为 — |
| DR-033 | T-22 的 `views:clear` 同时清空对应站点的 `post_views` 与 `favorites`（`site` 缺省为全部站点），返回 `Result<{site, clearedViews, clearedFavorites}>`；成功后主进程广播 `views:updated` `{site}`。清除只删这两张记录表，不动 `posts` 快照、`tag_cache` 与 `schema_migrations` | 03 §7 原写返回 `{ok}` 且未说明收藏，与 05 §4 的 Result 信封及 DR-032 的"清除记录需同时清理 favorites"冲突；05 §6 / 03 §7 已约定 `views:updated` 用于跨页面同步，但直到本任务才落地 | `shared/ipc-contract.ts` 新增 `views:clear` / `views:updated`；设置页为最小入口（当前站点为 yande.re）；搜索页与收藏页订阅事件即时刷新；重复清除幂等返回 0 |
| DR-034 | T-23 的下载队列落地为：迁移 004 建 `download_tasks`；`main/download/queue.ts` 按站点独立并发，`concurrency` 读 `config.json#downloads.concurrency`（1–6，默认 3，非法值回落默认）；`downloads:control` 返回 `{taskId, status}`（`cancel` 后 `status=null`），进度事件载荷固定为 `{taskId, site, postId, status, bytesDone, bytesTotal, error}`；下载目录暂用 `userData/downloads/{site}`，文件名占位 `{postId}.{ext}`；暂停保留 `.part`，恢复/重试从 0 重下；进程重启把 `downloading`/`verifying` 重置为 `queued` 后继续 | 03 §7 原写 `downloads:control` 返回 `{ok}`，无法让界面获知操作后的状态；03 §8 的 `Range` 续传、md5、模板命名、磁盘预检分属 T-24/T-25，提前实现会跨任务返工；设置页未落地（T-30），但并发必须可配，故复用 DR-013 的 `config.json` 读写并新增 `downloads` 分组。占位命名与直接 `verifying→done` 均属临时行为，后续任务不得沿用 | `src/shared/downloads.ts`（状态机/配置/文案）、`src/main/download/queue.ts`、`src/main/storage/downloads.ts`、迁移 004、三个 `downloads:*` handler、preload 新增四个方法；查看器新增 `D` 键与信息栏"下载"按钮（DR-024 落地），状态/失败信息就地展示；`downloading/verifying` 中断任务会自动续跑，未完成校验前不得视为最终文件 |
| DR-035 | T-24 断点续传：`DownloadTransport` 由 `(url, signal)` 改为 `(url, { signal, headers })`；恢复/重试时读 `<dest_path>.part` 大小 `N` 并发 `Range: bytes=N-`；206 追加写并以 `N + content-length` 计算总进度；200（服务器忽略 Range）清空 `.part` 从头写并强制上报一次 0 进度；416 且已有 `.part` 时视为本地文件完整，直接进入 `verifying`；`bytes_done` 在调度（`start`）与恢复（`control.resume/retry`）时先回填为文件大小；暂停落状态前校验本协程仍是活动协程且库中状态为 `paused`，避免"暂停后立刻恢复"被旧协程回写成 `paused` 导致任务卡死 | 03 §8 与 04 T-24 的验收要求"中断 50% 后恢复、不重复下载"；`ses.fetch` 需要显式传 `Range` 头，原 transport 签名没有 header 通道；恢复时若界面闪回 0% 会误导用户；旧协程回写 paused 是实测单测暴露的真实竞态 | `src/main/download/queue.ts`、`src/main/ipc/registry.ts`（新增 `downloadTransport` 透传 headers，图片读取仍用 `imageTransport`）；`downloads-queue.test.ts` 新增 4 条（206 追加、200 回退、416、重启续传），全套 231 条通过；md5（T-25）仍未接入，`verifying` 直接转 `done` |
| DR-037 | T-25 命名与校验：模板在**入队时**渲染（`download_tasks` 只新增 `md5` 列存校验基准，迁移 005 用 `ALTER TABLE`），`{site}/{rating}/{artist}/{copyright}/{character}/{id}/{md5}/{ext}` 未知变量保留原文；`artist/copyright/character` 取该类型首个标签，缺失为 `unknown`；非法字符 `/ \ : * ? " < > |` 与控制字符替换为 `_`，`..`/`.` 段替换为 `_`；渲染结果超过 120 字符时回落到 `{site}/{rating}/{md5}.{ext}` 紧凑路径。md5 校验读 `.part` 后再改名落盘：不一致删除 `.part` 与最终文件并进入 `failed`（TC-27）；旧任务 `md5` 为空时跳过校验。已 `done` 的相同 `site+md5` 与目标路径同尺寸文件视为已下载，`downloads:enqueue` 返回新增的 `skipped` 计数以区分"已跳过"与失败 | 02 §7.3 未写明未知变量、长度超限的具体回落，也未说明 `copyright`/`character` 缺失值；`download_tasks`（迁移 004）没有 md5，无法在重启后续传/重试时校验；改名必须在校验之后，否则失败文件已落盘（TC-27）。入队渲染可让 `dest_path` 在暂停/重启后保持稳定 | 迁移 005 只加 `md5 TEXT` 与 `idx_tasks_md5`；`DownloadTask` 新增 `md5: string \| null`；`DownloadEnqueueResult` 新增 `skipped: number`（03 §7 同步）；`downloadFileName` 占位命名删除，改为 `renderDownloadPath`；查看器在 `skipped > 0` 时提示"该图片已下载，已跳过" |
| DR-047 | 多选开启后，点击卡片主区域（缩略图/信息条）直接切换选中并支持 `Shift` 连选，不再打开查看器；勾选框与收藏按钮仍独立可点；退出多选后恢复"点击打开查看器" | 多选是明确的批量选择态，点击打开详情会打断选择流程并让用户误触；卡片主区域本身已是打开按钮，只需在该模式下替换行为，无需新增热区 | `PostCard` 打开按钮的 `onClick` 按 `onToggleSelect` 是否存在分支，`aria-label` 同步改为"选择/取消选择"；`index.css` 无需改动；02 §7.1 同步 |
| DR-050 | 用户反馈：图片详情页对已下载图片不再显示“下载”，改为“打开所在文件夹”，并提供“重新下载”。查看器切图时调用 `downloads:list` 查找同站点同 `postId` 且 `done` 的任务，命中后保存 taskId；下载进度事件变为 `done` 时立即切换到已下载态。`downloads:enqueue` 新增可选 `force`：跳过 md5/同名已下载判定，复用原任务、丢弃旧 `.part`、把 `bytes_done` 归零后重跑，`finalize` 用新 `.part` 覆盖最终文件；D 键在已下载图片上等同“重新下载” | 用户明确要求已下载图片在详情页快速定位文件，同时保留重下入口；直接复用任务可避免生成 `(1)` 副本并保持记录唯一 | `shared/downloads.ts` 的 `DownloadEnqueueInput` 增加 `force`；`downloads-input.ts` 增加校验；`queue.ts` 的 `enqueue` 支持强制重跑；`ImageViewer` 查询/订阅已下载状态并接线 reveal/force；`InfoPanel` 与 `ImageViewer.module.css` 增加双按钮布局；队列新增 1 条 force 单测 |
| DR-051 | 用户反馈：其他平台下载时提供“原图 / 较小 JPG”两个选项；随后要求不要确认弹窗，改为下载按钮展开二级菜单。`Post` 与 moebooru 归一化新增可选 `jpegUrl` / `jpegFileSize`（`jpeg_url` 与 `file_url` 相同或 `jpeg_file_size` 为 0 表示没有独立压缩版）；`shared/downloads.ts` 新增 `DOWNLOAD_VARIANTS` / `DownloadVariant` / `hasJpegVariant` / `downloadSource`，`DownloadConfig` 新增 `format`（默认 `original`），`DownloadEnqueueInput` 新增 `variant`。查看器信息栏在存在独立 JPG 版本时，把“下载 / 重新下载”按钮变为带 `▾` 的菜单触发器，展开后选“原图 · 体积”或“较小 JPG · 体积”并入队；只有单一版本时按钮直接下载；批量下载沿用设置页新增的“批量默认格式”，D 键未指定格式时同样走该默认值。队列按实际下载地址建任务：URL、字节数、`{ext}` 均取所选变体；独立 JPG 与原图共享站点 md5，故 JPG 任务不写 md5，已完成判定、任务复用与启动折叠都加入 URL 维度，避免两种格式互相跳过或合并 | 用户明确希望像其他平台一样在下载时按画质/体积选择，且更偏好按钮内联展开而非弹窗确认；站点只为 PNG 原图提供独立 JPEG 压缩版，JPG 原图的 `jpeg_url` 与 `file_url` 相同 | `shared/models.ts`、`main/sites/moebooru.ts`、`shared/downloads.ts`、`shared/settings.ts`、`main/ipc/{downloads-input,settings-input,registry}.ts`、`main/download/queue.ts`、`SettingsPage`、`ImageViewer`、`InfoPanel`、`ImageViewer.module.css`；02 §7.1/§7.3/§7.4 与 03 §7 同步；新增单测覆盖归一化、格式选择、入参校验与变体任务分离 |
| DR-049 | 多选态不渲染收藏按钮（`onToggleFavorite !== undefined && !selectMode`），并修正多选样式权重：`.post-card:hover` / `:focus-within` 的揭示规则实为 3 个类的权重（伪类按类计），DR-048 的两类选择器无法覆盖，导致最后点击（保持焦点）的卡片仍露出 ☆；多选规则改为 `.post-card.post-card--select-mode …` 与 hover 规则同权重且靠后覆盖 | 多选只承担勾选，收藏不是该模式的可用操作，保留按钮即使隐藏也无意义；DR-048 的 CSS 覆盖在实测中未生效，根因是选择器权重而非属性值 | `PostCard` 增加 `selectMode` 并为收藏按钮渲染加条件；`index.css` 多选规则提升为双类选择器；02 §7.1 同步；无逻辑与单测改动 |
| DR-048 | 多选期间卡片视觉收敛：只常显已选中项右上角勾选框；收藏 ☆/★、状态角标、hover/focus 揭示与 hover 边框强调全部关闭（`post-card--select-mode`）；未选中项悬停无任何图标出现；退出多选恢复 DR-045 / DR-039 的 hover 规则。DR-047 的"收藏按钮仍可独立点按"随之收窄为仅非多选态 | 上一个被点击的卡片会保持 `focus-within`，导致它的 ☆/★ 与勾选框在鼠标移开后仍然常显，与"多选只突出已选"的预期冲突；多选态的点击目标就是整张卡片，不需要收藏与角标的悬停入口 | `PostCard` 按 `onToggleSelect` 是否存在追加 `post-card--select-mode`；`index.css` 在该类下统一归零收藏/角标/勾选框的 `opacity` 与 `pointer-events`，仅 `[data-selected='true']` 显示勾选框，并用 `:not(.post-card--selected)` 保住选中态边框；02 §7.1 同步；无逻辑与单测改动 |
| DR-046 | 去掉查询级"下载全部结果"按钮；多选改由卡片右键菜单进入，开启后批量操作以悬浮条呈现（固定在右下、状态栏之上），不占结果页布局 | 结果页空间应全部让给图片；查询级一次入队全部已加载项不是本轮必需能力（DR-038 已按可见结果定义），常驻批量条会挤压网格；右键菜单是低频入口的自然位置，关闭后零占位 | 新增 `ContextMenu` 组件；`PostCard`/`PostGrid` 透传 `onContextMenu`；`BatchDownloadBar` 改为 fixed 悬浮并移除 `visibleCount` / `onDownloadAll`；`SearchPage` 增加菜单状态，移除查询级入口；02 §7.1/§14.1 同步 |
| DR-045 | 卡片收藏与已看表达收敛：已收藏 ★ 常显，未收藏 ☆ 仅在 `hover` / `focus-within` 显示；移除右上角已看 ✓ 角标，已看只用缩略图透明度 + 降饱和表达；右上角角标与多选勾选框仍按 DR-039 仅悬停显示 | 收藏是高频正向状态，已收藏需要常显以便识别；未收藏的 ☆ 属于悬停操作，常显会占用图片区域；已看已有"变暗"强表达，再叠 ✓ 角标属于重复编码且干扰图墙 | `PostCard` 不再向 `BadgeStack` 传 `viewed`；`index.css` 收藏按钮增加 hover/focus 揭示，`[data-favorited='true']` 常显；02 §6.2 / §7.1 同步；`BadgeStack` 的 viewed 能力保留但不渲染 |
| DR-039 | T-27 视觉收敛：未 `hover` / `focus-within` 的卡片隐藏右上角状态角标与多选勾选框，左上角收藏 ☆/★ 常显；多选默认关闭，批量条新增"多选/退出多选"按钮，开启后才渲染勾选框，退出时清空选中 | 常驻角标与勾选框在瀑布流中干扰图片浏览，收藏是高频状态需要常显，多选是低频操作应显式开启；隐藏态需保留键盘可达性 | `BadgeStack` 增加外部 class 钩子；`PostCard`/`BatchDownloadBar`/`SearchPage` 增加多选模式状态；`index.css` 增加 hover 揭示与选中态样式；02 §6.2/§7.1 同步 |
| DR-038 | T-27 批量入口：多选以 `site:id` 为键存在渲染层（与 `PostGrid` 行回收解耦），`Shift` 连选从锚点连续并入、其余点击切换单项；查询级入口取当前**可见且已加载**的结果（尊重"隐藏已看"过滤），因 moebooru 不返回总数，首版不提供"前 N 张"输入；超过 50 张（02 §7.5）弹确认，显示数量与按 `Post.fileSize` 求和的预估体积（缺失/0 计入未知），确认后按 `downloads:enqueue` 单次上限 100 分片提交，汇总 `{taskIds, skipped}` 为"已加入/已跳过/失败"，失败按整片计入并继续后续分片；目标目录展示延后至 T-30（当前无读取下载目录的 IPC）；不改 T-25 模板/校验/去重语义，查看器单张路径不变 | 02 §7.1 写"前 N 张，默认 100 张，可改"，与 T-27 的"当前查询全部结果 + 分片 ≤100"冲突，且站点不返回结果总数，无法准确给出"全部"规模；02 §7.5 的"目标目录"依赖尚未落地的 T-30 设置页与目录读取通道；虚拟网格行回收会丢失组件内选中态，选中模型必须提升到 `SearchPage` | 新增 `shared/selection.ts`、`shared/download-batch.ts`（阈值/分片/预估/汇总）、`BatchDownloadBar`、`ConfirmDialog`；`PostCard`/`PostGrid` 增加选中插槽；02 §7.1/§7.5/§14.1 同步；新增单测覆盖分片、预估、汇总与连选 |
| DR-036 | T-26 下载页提前于 T-25 落地（用户明确反馈"点击下载看不见进度、没有暂停/恢复/取消入口"）：新增"下载"导航页，`DownloadsPage` 首次 `downloads:list` + 订阅 `downloads:progress` 增量合并（不轮询），`TaskList`/`TaskRow`/`ProgressBar` 展示进度并用 `downloads:control` 提供暂停/恢复/重试/取消；查看器信息栏下载状态下方同步显示同一进度条；`shared/downloads.ts` 新增 `applyDownloadProgress` / `downloadProgressRatio` / `downloadTaskTitle` / `formatByteSize` 纯函数 | 07 原定顺序为 T-25 → T-26，但 T-25（md5/模板命名）不影响任务列表与控制能力；下载页只依赖 `download_tasks` 与 T-23/T-24 的 IPC，先落地可立即解决用户可见性问题；T-25 完成后页面自动展示新文件名与新路径，无需改页面 | `src/renderer/pages/DownloadsPage.tsx`（新增）、`src/renderer/components/{TaskList,TaskRow,ProgressBar}.tsx`（新增）、`App.tsx`（新增"下载"页签）、`InfoPanel/ImageViewer`（进度条接线）、`tests/unit/downloads.test.ts`（+5 条：合并、未知任务、比例、标题、字节格式化）；T-25 仍为 NEXT_TASK，完成后需按 md5 失败态复验本页 |
| DR-040 | T-30 设置页：新增 `shared/settings.ts` 统一 `Settings` 形状（`hostmap` / `network` / `downloads` / `content`），`downloads` 扩展为 `{concurrency, destinationDir, template}`，空目录回落 `userData/downloads`；`settings:get` 返回 `{settings, defaultDownloadDir}`，`settings:set` 先 zod 结构校验、再语义校验（并发 1–6、目录须 Windows 绝对路径且无非法字符、模板非空且 ≤200 字符、非直连时代理地址/端口合法、IP 映射条目域名/IP 合法且不重复），非法时返回 `CONFIG` 且不落盘、不应用；保存后写 `config.json`、下载队列 `updateConfig` 热更新（仅影响后续入队）、代理立即 `applyProxyConfig` 并回填 `proxyStatus`；IP 映射变化只落盘并返回 `restartRequired`，界面提示重启；R18 沿用 `content.allowExplicit` 即时生效（开启需二次确认）；新增 `SettingsSection` / `IpMapEditor` 组件，设置页四组内各自保存并展示成功/失败反馈 | 03 §7 原仅写 `settings:get/set → Settings`，无法表达默认目录、代理复检结果与重启提示；下载目录/模板此前无配置字段，队列只在启动时读并发，无法支持设置页"保存即生效"；02 §9 的 R18 要求"开启需确认"，需在页面内提供确认层 | 新增 `src/shared/settings.ts`、`src/main/ipc/{settings-input,handlers/settings-get,handlers/settings-set}.ts`；`shared/downloads.ts` 扩展配置并解析；`main/download/queue.ts` 增加 `updateConfig` 与模板兜底；`main/ipc/registry.ts` 接线；`shared/ipc-contract.ts` / `preload` / `SettingsPage` / 新增 `SettingsSection`、`IpMapEditor`；`03 §7/§8`；新增 `tests/unit/settings.test.ts` 与队列热更新用例；`pnpm build` 通过 |
| DR-041 | T-29 榜单页：03 §5/§7 早已定义 `rankings` 与 `posts:rankings`，但代码中 `MoebooruAdapter` 与 IPC 均未实现（07 §6 原写"已注册"有误），本任务一并补齐。IPC 入参日期不能传 `Date`（05 §5），定义 `RankingDate = {year, month, day}`（都可为普通整数），`buildRankingPath` 放 `shared/rankings.ts` 纯函数；端点统一带 `.json`（以 06 §5 实测为准，02 §4/03 §5.1 原写法缺后缀）；热门固定 `period=1d`（02 §4 无周期选择，DR-008 固定 40 条），只取第 1 页不翻页；日/周/月带 `page`，界面以"合并后无新增"判定无更多，避免站点忽略 `page` 时无限翻页；R18 关闭时在 handler 内过滤 explicit 并回传 `r18Filtered`（榜单端点不支持 `tags` 排除）；榜单查看器点击标签通过 App 级回调切到搜索页并立即查询（复用 `SearchPage#runSearch`） | 07 §6 的 NEXT_DEPENDS 与代码不符，不补齐则榜单页无法请求；`Date` 不可跨 IPC 传递；`popular_recent` 的 `limit`/`page` 均被忽略，必须限制为单页；榜单无标签参数，R18 默认关闭只能本地过滤 | 新增 `shared/rankings.ts`、`main/ipc/rankings-input.ts`、`main/ipc/handlers/posts-rankings.ts`、`renderer/pages/RankingPage.tsx` 与 `.module.css`；修改 `shared/ipc-contract.ts`、`preload`、`main/ipc/registry.ts`、`main/sites/moebooru.ts`、`renderer/App.tsx`、`renderer/pages/SearchPage.tsx`（新增外部查询入口）；03 §5/§5.1/§7、02 §4 同步 |
| DR-044 | 用户反馈：下载页需要删除单条任务与清空任务列表。`downloads:delete` 的 `deleteFile` 缺省时只做存在性检查：最终文件不存在则直接删记录并清理 `.part`；存在则返回 `fileExisted:true, removed:false`，由界面弹窗提供“删除文件和记录 / 仅删除记录 / 取消”三个选项。删除运行中的任务先 `abort` 并标记 `cancelled`；与 DR-042 一致，其它任务仍引用同一 `dest_path` 时不删磁盘文件。`downloads:clear` 清空全部记录并清理 `.part`，已下载的最终文件一律保留，界面用二次确认说明该行为 | 用户明确要求删除前校验文件存在性并区分“删文件”与“删记录”；清空列表若静默删文件风险过高，故只清记录并在弹窗中写明 | `shared/downloads.ts` 新增 `DownloadRemoveInput/Result`、`DownloadClearResult`；`main/download/queue.ts` 新增 `remove` / `clear`；新增 `downloads-delete` / `downloads-clear` handler 与 IPC 接线；`DownloadsPage` 增加删除按钮、三选项弹窗、清空按钮与二次确认；`ConfirmDialog` 增加可选 `secondaryLabel`；新增队列 5 条与 handler 5 条单测 |
| DR-043 | 用户反馈：下载文件不要多层目录，且下载页每行提供“打开所在文件夹”。默认模板改为 `{site}/{md5}.{ext}`（所有文件平铺在站点目录下），紧凑回落路径同步去掉 rating；`config.json` 中旧默认模板 `{site}/{rating}/{artist}/{md5}.{ext}` 在 `parseDownloadConfig` 读取时自动迁移到新默认，用户自定义模板保持不变。新增 IPC `downloads:reveal`（`{taskId}` → `Result<null>`）：主进程 `shell.showItemInFolder` 选中最终文件；未完成时选中 `.part`；两者都不存在时用 `shell.openPath` 只打开目录；路径仅来自本地任务表，不接受渲染层传入路径 | 用户明确要求扁平目录与快速定位文件；原有 artist 目录因标签类型未补全恒为 `unknown`，层级没有实际信息量 | `shared/downloads.ts` 改默认模板 + 旧值迁移 + 新增 `DownloadRevealInput`；`shared/ipc-contract.ts` / `preload/index.ts` / `main/ipc/downloads-input.ts` / `main/ipc/handlers/downloads-reveal.ts` / `main/ipc/registry.ts` 接线；`TaskRow` / `TaskList` / `DownloadsPage` 增加按钮；模板与 reveal 单测更新/新增 |
| DR-042 | 下载去重与取消安全（用户实测反馈："打开应用后四个一模一样任务同时下载，删掉一个任务连已下载内容也被清除"）：`enqueue` 对同一 `site + postId` 或同一 `site + md5` 的未结束任务直接复用原任务 id（`failed` 复用并重置 `queued`、沿用 `.part`）；同批重复条目计入 `skipped`；`cancel` 先删任务行，仅当没有其它任务引用同一 `dest_path` 时才删 `.part` 与最终文件；`recover` 启动时按身份/路径折叠历史重复行（保留顺序：已落盘 done > downloading > verifying > paused > queued > 失败，同级取最早创建），只清理无人引用的 `.part`，不删除任何已完成的最终文件；`recover` 即使无中断任务也执行一次 `tick()`，让上次遗留的 queued 任务继续 | 用户实测暴露：重复点击/按键、批量重复项与历史重复行都会让同一图片生成多个任务并发写同名文件；`cancel` 原先无条件 `removeTaskFiles`，多行共享 `dest_path` 时会误删已完成文件；`recover` 只在有中断任务时才调度，纯 queued 遗留任务会卡住 | `main/download/queue.ts` 新增 `findReusableTask` / `collapseDuplicateTasks` / `retentionScore` / `taskIdentity`；`shared/downloads.ts` 注释同步；`tests/unit/downloads-queue.test.ts` 新增 6 条（重复入队复用、同批去重、失败重试复用、取消保留共享文件、折叠 4 条重复行、遗留 queued 自动调度） |
| DR-052 | T-31 错误态统一：新增 `shared/error-guidance.ts#describeErrorGuidance`，按 `ErrorCode` 生成面向用户的下一步引导（网络/超时/限流/CF/解析/本地读写/下载/配置），由 `ErrorState` 统一渲染；下载页与设置页的主数据读取失败改为 `Result` 信封 + `ErrorState` 重试，不再用裸文本。**不新增"打开诊断"按钮**（T-34 诊断页仍为 P1 未实现，避免死按钮）；**429 退避期间不新增主→渲染事件通道**，限流提示落在错误卡片（"请求过快，已自动降速，请稍后重试"），02 §2.5 / 05 §4 的"顶部气泡"改为该实现 | 02 §2.5 要求错误卡片含"打开诊断"、限流走"顶部气泡"，但诊断页与限流事件通道均不存在；为一次性提示扩 IPC 契约会超出本任务范围且增加跨进程耦合。错误码→引导集中在纯函数便于单测，页面只关心 `code`（05 §4） | `shared/error-guidance.ts`（新增）、`renderer/components/ErrorState.tsx`、`renderer/pages/{DownloadsPage,SettingsPage}.tsx`、`tests/unit/error-guidance.test.ts`；02 §2.5 与 05 §4 同步；不改搜索/下载业务语义，不新增依赖 |
| DR-053 | T-32 打包验收前核查发现：`release/` 中 11-03 的两份产物（`Booru Desktop Setup 0.1.0.exe` 与 portable）是在 T-13/T-14 引入 `better-sqlite3`/`zod` 之前打包的，其 `app.asar` 仅 99 项、只有 react/react-dom，没有 `better-sqlite3`、`zod`、`@tanstack/react-virtual`，而 `out/main` 用 `externalizeDepsPlugin` 把这些依赖保留为 `require(...)`，该包启动即会在加载依赖/开库阶段失败，不能用于验收。会话 57 用当前源码执行 `pnpm build` 后重新打包，产物更名为 `Bluu Setup 0.1.0.exe` / `Bluu 0.1.0.exe`（DR-030 的 productName），新 `app.asar` 971 项且 `better-sqlite3` 的 `.node` 已按 `asarUnpack` 解包到 `app.asar.unpacked`；旧名产物已删除以免误装。本机无 Visual Studio Build Tools、GitHub 预编译包直连超时，改用 npmmirror 的 `better-sqlite3-v11.10.0-electron-v130-win32-x64`（Electron 33 = ABI 130）恢复二进制，并以 `pnpm exec electron-builder --win --publish=never "--config.npmRebuild=false"` 打包；**后续换机打包必须确认原生模块为 Electron ABI**，否则会静默打出不可用的包。另记录：未配置应用图标（使用 Electron 默认图标）、未配置代码签名；`nsis.deleteAppDataOnUninstall=false` 且 per-user 安装，卸载后 `%LOCALAPPDATA%\\Programs\\bluu` 随安装目录删除，`%APPDATA%\\bluu` 的用户数据按设计保留，验收时不应把后者当作残留 | 打包验收必须基于当前源码；旧产物缺运行时依赖属事实性缺陷，与 electron-builder 配置无关（T-03 打包时这些依赖尚未加入 `package.json`）。无 VS 环境不能走 `@electron/rebuild`，改用官方 ABI 预编译是当前唯一可复现路径 | 07 §6 的 NEXT_ACCEPTANCE 文件名与残留口径同步修正；`release/` 只保留新产物；T-32 的人工验收清单以新包名为准；后续若需在其它机器打包，先恢复 Electron ABI 二进制或安装 VS Build Tools |
| DR-054 | T-33 文档同步以**当前代码为唯一事实源**，不删除尚未落地的设计意图，而是显式标注"设计目标 / 当前实现"。核对发现并修正：03 §1.2 仍写 Tailwind + Radix + Zustand + electron-log（实际为 CSS Modules、React 本地状态、无日志库）；03 §2 仍写 `booru://thumb` 自定义协议（实际为 `images:fetch` + `blob:`）；03 §3 目录树包含不存在的 `resume.ts` / `naming.ts` / `verify.ts` / `tasks.ts` / `thumbcache.ts` / `diag/` / `renderer/store/` / `konachan.ts` / `tests/e2e/`；03 §6.1 列了未创建的 `sites` / `search_history` 表；03 §7 列了未实现的 `views:stats` / `diag:run` / `cf:manualVerify` / `cf:status`；03 §9 日志落盘不存在；03 §11 声称已配置 CSP 图片白名单与 `will-navigate` 拦截（实际均无）；03 §12 写有 Playwright E2E（实际无）。02 侧修正：外壳为顶部五页导航（AppShell/TopBar/SiteSwitcher 未实现）、网格无 sample 悬停预取、查看器无"复制链接/在浏览器打开"且 `O` 未实现、设置页实为四组（无常规/诊断）、主题暗色默认、光斑未落地。06 补 `jpeg_url` 独立压缩版语义与 `jpeg_file_size`、`popular_by_day/week/month` 端点（未实测）并标注仅启用 yande。04 §5 按已有证据逐项勾选或注明未覆盖原因（konachan、批量 100 张、日志落盘、清除缓存不勾选）。**未改任何业务代码** | 文档与实现长期分叉会让后续会话按错误前提开发（例如按 Tailwind 写样式、调用不存在的 `views:stats`、按旧默认模板验收）；而设计意图（外壳、亮色主题、光斑、缩略图缓存、E2E）仍属于既定方向，不能在同步时直接抹掉。保留设计目标 + 当前实现双栏标注，既满足"与实现一致"，也不丢失规划 | `docs/02-UX-Design.md`、`docs/03-Architecture.md`、`docs/04-Task-Plan.md`、`docs/06-API-Contract.md`（均仅文档，各自补 2026-11-05 变更记录）；`docs/07-Progress.md`（T-33 状态、本 DR、会话 58、§6）；不改源码、不加依赖 |
| DR-055 | T-36 搜索历史：迁移 006 建 `search_history(query TEXT PRIMARY KEY, last_used_at INTEGER NOT NULL, use_count INTEGER NOT NULL DEFAULT 1) WITHOUT ROWID` 与 `idx_search_history_last(last_used_at)`；不按站点分列，当前仅启用 yande 且查询语法两站共享，50 条为全局上限。`shared/search-history.ts` 提供 `SEARCH_HISTORY_LIMIT=50` 与 `normalizeSearchQuery`（trim + 折叠连续空白，空串返回 null）；写入时 `last_used_at` 取 `max(Date.now(), 当前最大值 + 1)`，保证同一毫秒内连续记录也能严格按最近使用排序。新增四个 IPC：`search-history:list`（—→`Result<string[]>`）、`search-history:record`（`{query}`→`Result<string[]>`，UPSERT 后事务内截断到 50 条）、`search-history:delete`（`{query}`→`Result<string[]>`）、`search-history:clear`（—→`Result<{removed}>`）；record/delete 直接返回更新后的完整列表，避免渲染层二次 list 造成竞态。渲染层 `SearchBar` 聚焦且输入为空时展示历史下拉，点击项填入输入框并立即提交，单项 × 删除，顶部“清空”；只在 `runSearch` 首页成功（`ok`）后记录 | 04 T-36 要求“最近 50 条、可复用可清空”，03 §6.1 只有“未建 search_history”的设想，必须落地迁移 006；站点只启用 yande，按站点分列会引入当前无收益的维度；历史属于查询串本身，跨站点复用语法一致 | 03 §6.1 补表并更新“未建”说明，03 §7 补四行；`shared/ipc-contract.ts` / preload / registry / SearchBar / SearchPage / index.css；新增 `storage/search-history.ts` 与 4 个 handler/input；单测覆盖去重、截断、排序、删除、清空与入参校验；不改搜索请求与已看/收藏逻辑 |
| DR-056 | T-37 标签黑名单：`shared/content.ts` 的 `ContentConfig` 新增 `blacklist: string[]`，随 `Settings.content` 写入 `config.json`（旧配置缺失时回落 `[]`）。归一化规则：trim + 小写、按空白/逗号切分、去重、上限 100；空串、含空白、含 `:`（元数据条件）或以 `-` 开头（应为正向标签）视为非法，`settings:set` 语义校验拒绝并返回 `CONFIG`，落盘前再统一小写去重。搜索：在 R18 过滤之后逐项追加 `-tag`，与用户已写的同名 `-tag` 去重（大小写不敏感，用户写法保留），空查询不拼接也不请求，追加数量经 `PostPage#blacklistFiltered` 回传并在搜索页提示。榜单：端点不支持 tags，故先按 R18 丢弃 explicit，再按黑名单丢弃命中任一标签的条目（标签名大小写不敏感），`blacklistFiltered` 只统计后者；R18 关闭的 `r18Filtered` 标记语义不变。配置在每次请求时由 `registry` 读取，保存即生效 | 04 T-37 要求"全局过滤"；`Settings.content` 是现成的持久化入口，无需新 IPC；搜索能用站点查询排除时不应再拉回本地过滤（省流量且翻页一致），榜单端点无 tags 参数只能本地过滤；重复追加 `-tag` 会让查询串膨胀且可能与用户意图冲突；大小写不统一会导致同一标签重复排除或漏排除 | `shared/content.ts`（归一化/切分/拼接/命中判定纯函数，新增 `MAX_BLACKLIST_TAGS`）、`shared/models.ts`（`PostPage.blacklistFiltered`）、`shared/settings.ts`（校验）、`main/ipc/settings-input.ts`、`main/ipc/handlers/{posts-search,posts-rankings,settings-set}.ts`、`main/ipc/registry.ts`、`SettingsPage.tsx` / `.module.css`（黑名单编辑区）、`SearchPage.tsx` / `RankingPage.tsx`（过滤提示）；02 §2.4/§9 与 03 §5.3/§7 同步；新增内容/搜索/榜单/设置单测 |
| DR-057 | T-28 konachan 适配：03 §5 原计划每站一个适配器文件，实际两站共用 `moebooru.ts`，新增 `main/sites/adapters.ts#getSiteAdapter(site)` 按站点缓存单例并注入对应 HTTP 通道（yande `ses.fetch`、konachan 隐藏窗口 CF，DR-010），删除 `sites/yande.ts`。`posts:search` / `posts:rankings` / `tags:suggest` 三个 handler 由"注入单个适配器"改为"注入 `getAdapter(site)`"，`posts:rankings` 移除仅 yande 的限制；IPC 入参与返回结构不变（`site` 本就在契约中）。渲染层在搜索页与榜单页各加一组站点切换（复用收藏页 `site-tabs` 样式），搜索切站后按当前关键词在新站点重搜、榜单切站后按当前入口与日期重载；榜单查看器点标签跳搜索时 `App#searchRequest` 携带来源站点，避免在另一站搜同名标签。`IMAGE_HOSTS` 增加 `konachan.com` / `assets.konachan.com` / `files.konachan.com` 映射（覆盖预览与原图 host 差异，防止未知 host 回落 yande 会话），CSP `img-src` 同步放行；下载任务的站点取 `post.site`，无需改动 | 04 T-28 要求两站搜索、榜单、下载全可用；`moebooru` 是两站的共同 API 结构，复制适配器会带来两份易漂移的解析代码；`posts:rankings` 原先硬编码拒绝 konachan，站点路由必须在 handler 层解决；未知图片 host 默认回落 yande 会让 konachan 图片共用错误会话，故补齐 host 映射。P-02 字段结构与 P-04 图片 cookie 无法离线验证，留待真实网络人工复验 | `main/sites/adapters.ts`（新增）、`main/sites/yande.ts`（删除）、`main/ipc/handlers/{posts-search,posts-rankings,tags-suggest}.ts`、`main/ipc/registry.ts`、`shared/constants.ts`（`IMAGE_HOSTS`）、`shared/sites.ts`（`SITE_LABELS`）、`renderer/index.html`（CSP）、`renderer/App.tsx`、`renderer/pages/{SearchPage,RankingPage}.tsx`、`tests/unit/{posts-search,posts-rankings,tags-suggest}.test.ts`；02 §2.1/§4、03 §3/§5/§7、06 §1、09 §3.2（TC-35）/§4 M5 同步；新增按站点路由单测 |
| DR-058 | 下载目录不可用的错误闭环：`queue.enqueue` 对 `mkdirSync` 单独兜底，抛 `DOWNLOAD`「下载目录不可用，请在设置中选择其他目录」并把目录与系统错误写入 `detail`（此前原始异常被 `downloads:enqueue` 的通用 catch 吞成「加入下载队列失败」）。`settings:set` 在落盘前对非空下载目录执行 `mkdirSync` 可创建性校验，失败返回 `CONFIG`「设置未保存：下载目录不可用（路径）」，不写配置 | 用户配置的 `H:\1\` 外接盘未接入时，入队阶段 `mkdirSync` 抛 ENOENT，界面只看到通用失败，无法判断是盘符还是权限问题；保存时校验可在配置阶段拦截同类问题。目录可能在保存后离线，故入队阶段仍需兜底，不能只做保存校验 | `main/download/queue.ts`、`main/ipc/handlers/settings-set.ts`、`tests/unit/downloads-queue.test.ts`；02 §9 与变更记录同步 |
| DR-059 | 入队前目录校验与选择框：新增 `main/download/destination.ts#createDestinationGuard`，`downloads:enqueue` 在写任务前调用（handler 新增可选 `ensureDestination`，便于单测）。guard 读取配置目录：空串时用默认 `userData/downloads` 并自动创建；自定义目录不存在或指向文件时，通过注入的 `pickDirectory` 弹原生目录选择框，选中后 `mkdir` + 写回 `config.json` + `queue.updateConfig` 热更新再继续入队；取消返回 `DOWNLOAD`「未选择下载目录，下载未开始」，保存失败返回 `CONFIG`。目录校验放在入参校验之后，避免非法请求先弹框 | 用户要求"下载先检查路径是否有效，无效就弹出路径选择框"；仅报错仍需要用户手动进设置页，弹框可直接选到可用目录并写回，减少一步操作；`updateConfig` 保证本次及后续任务立即可用，无需重启 | `main/download/destination.ts`（新增）、`main/ipc/handlers/downloads-enqueue.ts`、`main/ipc/registry.ts`（dialog 接线）、`tests/unit/download-destination.test.ts`（新增）、`tests/unit/downloads-handlers.test.ts`；02 §7.5、03 §3/§7、09 TC-36 同步 |
| DR-061 | 用户报障「下载时选了目录，完成后文件仍在默认目录」并要求设置页也能弹目录框：① 根因不是入队校验失效——guard 已写回设置并热更新队列，新任务会用新目录；实际是已下载图片按 `task.url` 命中 done 任务被跳过、或重新下载沿用旧 `destPath`，所以文件留在旧目录（由 DR-062 修复）。② `settings:get` 读取后设置页草稿常驻不重读，guard 写回后界面仍显示旧值；新增 `settings:destination-changed` 广播同步草稿。③ 设置页下载目录新增「选择文件夹…」，走 `settings:pick-download-dir`，草稿目录可用时作为对话框 `defaultPath`，为空/不可用回退配置目录或默认目录；选择结果进草稿，沿用保存按钮落盘 | 用户预期"选了哪个目录，下载就落在哪个目录；下载时改的目录在设置里可见"；设置页是常驻页面，不会自动重读配置；目录输入框纯手填易打错盘符 | `shared/ipc-contract.ts`（通道与类型）、`preload/index.ts`、`main/ipc/handlers/settings-pick-download-dir.ts`（新增，可注入依赖便于单测）、`main/ipc/registry.ts`（注册 + 写回后广播）、`renderer/pages/SettingsPage.tsx` + `.module.css`（按钮、订阅、反馈）、`tests/unit/settings-pick-download-dir.test.ts`；09 TC-38/39；02 §7.5、03 §7；不加依赖 |
| DR-062 | DR-061 的文件落点修复：`downloads:enqueue` 中，已完成任务（`status='done'`）若 `destPath` 不在当前下载目录下，不再计入"已下载"跳过；改为按当前目录重算目标路径，写回任务（`relocate`：`dest_path/url/md5/bytes_total/updated_at` 更新、状态回 `queued`、`bytes_done` 归零），随后正常下载。旧目录成品文件保留，不删除；旧 `.part` 清理失败不影响迁移。运行中/排队中/暂停任务仍保持原目录（DR-040 不变） | "切换目录后再次下载应落到新目录"，否则用户看到的是旧目录文件；DR-042 的复用只应复用同一目录内的任务 | `main/download/queue.ts`（路径归属判断 + 迁移分支）、`main/storage/downloads.ts`（`relocate`）、`tests/unit/downloads-queue.test.ts`（`updateConfig` 后重新下载迁到新目录）、`tests/unit/downloads-store.test.ts`（`relocate` 落库）；09 TC-37；02 §7.4 |
| DR-065 | 用户报障「点击关闭 18R 后整页向上平移约半屏，顶部导航不可见、下半部分空白」：设置页 `.page` 是内部滚动容器，但 `Switch` 把原生 checkbox 做成 `position:absolute; width:1px; height:1px; opacity:0`，其 label `.root` 未定位，checkbox 的包含块因此是初始包含块（视口）。该绝对定位框的静态位置落在设置页内容深处，逃出 `.page` 的裁剪并计入文档滚动溢出（`body{overflow:hidden}` 只挡用户滚动，挡不住聚焦引起的程序化滚动）；点击 label 使 checkbox 获得焦点时，Chrome 滚动的是整个文档，于是导航被滚出视口、下方露出空白。修复：`Switch.module.css#.root` 增加 `position: relative`，让隐藏 checkbox 以 label 为包含块，不再参与文档滚动区域；长内容仍由设置页自身滚动。本机 Electron 33 无窗口探针（`show:false` + `executeJavaScript`）实测：修复前文档 `scrollHeight 865` / `clientHeight 638`，聚焦隐藏 checkbox 后 `scrollTop 227.2`；修复后 `scrollHeight == clientHeight == 638`、`scrollTop` 保持 0，滚动只发生在设置页容器内 | 用户只看到"页面渲染坏了"，实际是隐藏表单控件定位缺陷，与保存设置、窗口尺寸、渲染进程崩溃无关；`body{overflow:hidden}` 不能让文档免于程序化滚动，必须消除文档级溢出 | `renderer/components/Switch.module.css`（`.root` 加定位）；02 §9 与变更记录、09 TC-43；不改业务逻辑、不加依赖 |
| DR-064 | 用户要求「选择了路径就不需要再生成 `yande` 文件夹，直接把图片保存在设置的路径下」：默认命名模板由 DR-043 的 `{site}/{md5}.{ext}` 改为 `{md5}.{ext}`，下载文件直接平铺在设置的下载目录；`parseDownloadConfig` 把旧默认值（含 DR-043 默认与更早的多层默认）统一迁移到新默认，用户自定义模板原样保留；超长路径的紧凑回落同为 `{md5}.{ext}` | 站点子目录对用户没有价值，用户按设置目录管理文件；`config.json` 里已写入的旧默认值若不迁移，界面/实际路径仍会继续建 `yande` 子目录 | `shared/downloads.ts`（默认模板与旧默认集合、紧凑路径）、`tests/unit/downloads-template.test.ts`（默认与迁移用例）、`tests/unit/downloads-queue.test.ts`（迁移/修复用例路径断言）；02 §7.3/§7.5、03 §8、09 TC-42；不加依赖 |
| DR-063 | 用户报障「把设置里的下载文件夹删掉后，重新下载/普通下载都失败且不弹选择路径」：实测失败任务 `bytes_done=0`、目标在 `...\Camera Roll\yande\`，而两个原图 URL 经 hostmap 直连均 200；Electron 内实测 `ses.fetch` 206 正常、`fs` 打开 `.part` 会抛 `EPERM`/`ENOENT`——失败发生在写盘，且删掉文件夹后 Windows 会立即重建同名"已知文件夹"，`isUsableDirectory` 只看"存在"于是不弹框，错误被吞成通用「下载失败，请重试」。修复：① `isUsableDirectory` 增加可写探测（创建并删除临时探针文件），探测失败即视为不可用→弹选择框；② 队列 `run()` 写盘前 `mkdirSync(dirname(partPath))` 重建父目录；③ 捕获 `ENOENT`/`EPERM`/`EACCES`/`EROFS`/`ENOTDIR`/`ENOSPC` 时调用新增的 `DownloadQueueOptions#requestDestination`（主进程弹目录框并写回配置，并发失败复用同一次弹框），选中后 `store.relocate` 把任务迁到新目录（保留原有相对路径，默认模板下只有文件名）并重新排队，取消才落 `failed`；④ 失败文案区分"下载目录不可用，请重新选择目录"/"磁盘空间不足，请清理或更换下载目录"，网络与 HTTP 错误不弹目录框 | 用户预期"删掉目录后点下载应弹目录框并落到新目录"，而不是无解释失败；删除后 Windows 已知文件夹自愈让"存在性检查"失效；`bytes_done=0` 说明失败在首次写盘而非流传输，通用错误文案掩盖了真实原因 | `main/download/destination.ts`（可写探测）、`main/download/queue.ts`（`requestDestination`、写前建目录、文件系统错误分类、`repairDestination` 迁移重排）、`main/ipc/registry.ts`（`applyDownloadDestination` 抽取、弹框去重接线）、`tests/unit/downloads-queue.test.ts`（迁移重排 + 取消失败 2 条）；02 §7.5、03 §8、09 TC-40/41；不加依赖 |
| DR-060 | 用户报障「`pnpm dev` 关闭窗口后进程不退出，需 Ctrl+C」：T-28 接入 konachan 后，首次 konachan 请求会创建隐藏的 CF 挑战窗口（03 §4.3 / DR-010），该窗口只在 `will-quit` 时销毁；因此关闭主窗口后 `window-all-closed` 永不触发，`app.quit()` 不被调用，主进程与 `electron-vite dev` 持续存活。修复：主窗口 `closed` 时若当前平台非 darwin 直接 `app.quit()`（隐藏 CF 窗口随 quit 一并关闭，`will-quit` 仍负责 `destroy` 与关库）；macOS 保留关窗常驻语义；`window-all-closed` 兜底保留 | 单窗口应用不存在"关掉主窗口但保留其它窗口"的产品语义；仅当用户访问过 konachan 才复现，属于 T-28 引入的回归。此前只在 `window-all-closed` 退出是按"无隐藏窗口"的前提写的，隐藏窗口加入后该前提失效 | `main/index.ts`（主窗口 `closed` 主动 `app.quit()`）；07 本行与会话 64；不改 CF 通道与下载逻辑，不加依赖 |
| DR-039 | T-09 代理落地为 `config.json#network.proxy = {mode: 'direct' \| 'http' \| 'socks5', host, port}`（默认 `direct` + `127.0.0.1:7890`）。app ready 后对两站 session 调用 `setProxy({mode:'fixed_servers', proxyRules})`，再用 `resolveProxy(yande)` 复检；规则非法、复检无法识别或返回 `DIRECT` 时立即回退 `mode:'direct'`。非直连时另用既有 HTTP 客户端探测一次 `/post.json?limit=1`（8s 超时、0 重试），只有 `NETWORK` / `TIMEOUT` 才判定代理不可达并回退，429 / 5xx / CF 视为代理可用。回退原因经新增 `network:status` IPC 读取、`network:status-changed` 事件广播，渲染层在导航下方以 `role=alert` 横幅提示，可手动关闭 | 03 §4.5 只写 `resolveProxy`，只能验证"规则是否被系统采纳"，无法识别"能解析但连不通"的代理；而 §6 `NEXT_MANUAL` 要求不可达代理也回退，故补一次可被既有错误分类约束的轻量探测。03 §7 原本没有代理状态通道，界面无法获知回退原因 | 新增 `shared/proxy.ts`（纯函数：规则组装、配置解析、复检解析、回退判定）与 `main/network/proxy.ts`（应用/复检/探测/回退/状态广播）；`AppConfig` 增加 `network` 分组；preload 新增 `getNetworkStatus` / `onNetworkStatus`；默认直连会显式关闭 Chromium 的系统代理继承。代理编辑入口仍归 T-30（当前手工编辑 `config.json` 后重启生效）；探测请求计入站点令牌桶，但不参与搜索、下载与 CF 通道 |
| DR-066 | T-35 自动更新落地：只支持 **NSIS 安装版**，便携版（`PORTABLE_EXECUTABLE_DIR` 存在）与未打包的 `pnpm dev` 返回 `unsupported`，明确提示而非报错。用 `electron-updater` 的 `autoUpdater`，`autoDownload=false`、`autoInstallOnAppQuit=true`、`allowPrerelease=false`；electron-builder 增加 `publish.provider=github`（`owner: LeDonX`、`repo: bluu-wallpaper`），打包时生成 `app-update.yml`，检查更新走 GitHub Release 的 `latest.yml`。检查/下载/安装全部由用户在设置页「关于与更新」手动触发（PRD FR-18 为手动检查），状态经新增 `updates:get-state` 读取与 `updates:status` 广播（`idle/checking/not-available/available/downloading/downloaded/error/unsupported`）；下载进度按事件实时刷新。安装调用 `quitAndInstall(false, true)`，重启后生效。更新失败只展示中文提示，不影响现有功能 | 未签名、未配置图标的安装包无法离线验证真实升级链路，但客户端流程、状态机与 IPC 可先落地并有单测；T-35 验收要求 `检查更新、下载、重启生效`，必须有可见的手动入口；便携版没有安装器上下文，electron-updater 的 NSIS 流程不适用，需显式区分；仓库地址已由 `git remote` 确认，无需把更新源做成用户可编辑配置 | `package.json`（新增依赖 `electron-updater`）、`electron-builder.yml`（`publish`）、新增 `shared/updates.ts` / `main/update/service.ts`、`shared/ipc-contract.ts`、`preload/index.ts`、`main/ipc/registry.ts`（服务实例化与 4 个 handler）、`SettingsPage.tsx` + `.module.css`；02 §9、03 §3/§7/§10、04 §5、09 TC-44/45；新增 `tests/unit/updates.test.ts` |

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
| P-11 | 隐藏已看的自动补页、5 页上限与计数文案未在真实数据下验证 | 补页次数、视口填满与"已跳过 N 张"可能不符预期 | 本地桌面 `pnpm dev` 用已看较多的查询开启隐藏已看，观察自动补页不超过 5 页、顶部"已过滤 X 张已看"与"已跳过 N 张已看过的图片"，关闭后列表即时恢复 | T-20 |
| P-12 | 设置页清除记录的实际交互未在窗口内验证 | 二次确认文案、清除后搜索页亮度恢复与收藏页即时清空可能不符预期 | 本地桌面 `pnpm dev`：搜索并点开几张图 → 设置页清除当前站点 → 返回搜索观察全部恢复亮度、收藏页清空；再执行清除全部站点，确认另一站记录也清空 | T-22 |
| P-13 | T-23 下载队列的真实图床落盘与界面反馈未在窗口内验证 | 进度文案、下载目录 `userData/downloads/yande`、并发上限与暂停/恢复/取消的实机手感可能不符预期；真实网络失败分类（403/CF）尚未接入 | 本地桌面 `pnpm dev`：查看器按 `D` 或点"下载" → 观察 `正在下载 x%` → 打开下载目录确认文件与 `.part` 清理；暂停后确认 `.part` 保留、恢复后完成；取消后确认任务与文件删除；改 `config.json#downloads.concurrency` 为 4 重启，批量入队观察并发不超过 4 | T-23 |
| P-14 | T-24 真实图床的 `Range` 支持与续传进度未实测 | 若 `files.yande.re` 返回 200，每次恢复都会清空重下；206 的 `content-length` 与 `content-range` 是否一致未验证 | 本地桌面 `pnpm dev`：下载约 50% 暂停 → 关闭应用 → 重启后观察进度从已有比例继续、`.part` 不被清零且最终文件大小正确；若站点返回 200，确认 `.part` 被清空并从 0 重新开始 | T-24 |
| P-15 | T-26 下载页与查看器进度条的窗口内表现未实测 | 进度事件刷新频率、长列表滚动、按钮禁用与失败提示的实际观感可能不符预期；取消/重试的实机反馈需逐项确认 | 本地桌面 `pnpm dev`：查看器点"下载"后信息栏立即出现进度条与百分比；切到"下载"页确认同一任务同步刷新；分别点暂停/恢复/取消/重试，确认状态与文件变化；断开网络触发失败后确认红色原因与"重试"可用 | T-26 |
| P-16 | T-27 批量入口的多选/连选、确认弹窗与入队汇总未在窗口内验证（DR-039 / DR-045 / DR-046 / DR-047 / DR-048 后改为右键开启、悬浮操作、无查询级入口、多选时点击卡片即选中、多选态只显示已选勾选） | 未收藏卡片静止时不应出现 ☆、右上角角标与勾选框；已收藏 ★ 须常显；已看仅变暗且无 ✓；右键菜单位置与关闭、悬浮条不遮挡图片、Shift 连选、>50 张弹窗、滚动回收选中态与"已加入/已跳过/失败"文案需人工确认；多选开启后点击卡片不得再打开查看器；多选期间卡片不渲染收藏按钮，未选中项悬停不得出现 ☆/角标/勾选框，仅已选中项常显勾选框 | 本地桌面 `pnpm dev`：滚动画廊确认未收藏卡片静止无 ☆、悬停才出现；已收藏卡片 ★ 常显且悬停可取消；已看卡片仅变暗、右上角无 ✓；确认结果页没有常驻批量条与"下载全部结果"按钮；右键卡片确认弹出"多选"菜单，点击空白/Esc 可关；进入多选后确认任意卡片（含已收藏）左上角都没有收藏按钮，右上角无状态角标，鼠标悬停也不出现；点击卡片缩略图与信息条确认变为选中、出现勾选框且**不打开查看器**，再点一次取消选中且勾选框消失；移开鼠标确认该卡片不再残留任何图标；按住 Shift 点击另一张确认连选且不打开查看器；退出多选后确认 ☆/★ 与 hover 揭示恢复、点击卡片恢复打开查看器；勾选 3 张点"下载选中"直接入队；按住 Shift 连选一段并在滚动回收后核对仍选中；点"退出多选"确认勾选框与悬浮条一并消失；勾选 >50 张确认弹窗数量/预估体积；到下载页核对任务数；重复勾选已下载图片确认计入"已跳过" | T-27 |
| P-17 | T-30 设置页四组保存、代理切换、映射重启生效与下载目录落盘未在窗口内验证 | 布局与反馈文案可能不符预期；代理/映射组合与真实目录写入需本机确认；目录可写性未在保存时预检 | 本地桌面 `pnpm dev`：逐组修改并保存，核对 `config.json`；切换直连/HTTP/SOCKS5/不可达代理观察状态与回退横幅；修改映射后重启验证解析；把下载目录改为 `D:\Bluu` 后入队确认新任务落盘；并发填 7 与目录填相对路径确认被拒绝并显示原因；开启 R18 确认出现二次确认 | T-30 |
| P-24 | T-31 的错误/空态文案与重试按钮观感需人工确认 | 错误卡片新增按错误码的引导行，下载页与设置页首次读取失败改为卡片 + 重试；真实断网/429/CF 失败下的文案、按钮禁用态与布局未在窗口内目视 | 本地桌面 `pnpm dev`：断开网络后分别搜索、打开榜单、进入收藏/下载/设置，确认错误卡片显示原因 + 引导 + 错误码 + 重试，`detail` 折叠可展开；恢复网络后点重试确认恢复；确认下载页无任务时只在无错误时显示"暂无下载任务"，设置页失败时不显示空表单；用 mock 429/CF 场景确认引导语分别提示"稍后重试"与"重启应用或检查网络" | T-31 / DR-052 |
| P-25 | T-36 搜索历史下拉的窗口内观感与交互需人工确认 | 历史下拉与标签联想共用输入框下方浮层；聚焦空输入时展开、点击历史项复用、单项 × 删除、顶部"清空"、Esc/失焦收起与长查询串省略号表现需目视；记录顺序是否与最近使用一致需实机确认 | 本地桌面 `pnpm dev`：连续搜索 3 个不同查询后清空输入并聚焦，确认下拉按最近使用排序且最多 50 条；点击一项确认立即重新搜索且输入框显示该查询；点单项 × 确认只删一条；点"清空"确认全部消失；按 Esc 或点空白确认下拉收起；搜索一个带连续空格的查询，确认历史里只显示折叠后的形式 | T-36 / DR-055 |
| P-28 | DR-059 入队前目录选择框需窗口内目视 | 自定义目录不存在/指向文件时点下载应弹系统目录框；选中后面板刷新设置并正常入队，取消显示"未选择下载目录，下载未开始"且不产生任务；默认目录缺失时自动创建且不弹框 | 本地桌面 `pnpm dev`：在设置页把下载目录改为不存在的盘符，搜索后单张下载与批量下载各触发一次；选中 `D:\` 后确认任务出现在下载页；再改回无效路径并点取消确认未入队；清空下载目录（用默认）确认自动创建 | DR-059 |
| P-30 | DR-061/062 目录选择与迁移需窗口内确认 | ① 设置页点「选择文件夹…」：输入框有可用目录时对话框从该目录打开；取消后草稿不变；选中后保存，配置与下载队列生效；② 把目录改成不存在的盘符后点下载：弹框选中新目录，完成后打开设置页确认输入框已显示新目录；③ 切换目录后重新下载一张已下载过的图片：文件出现在新目录，旧目录文件仍在，下载页任务目标为新目录 | 本地桌面 `pnpm dev`：按上述三步操作，各做一次单张与一次批量；批量中已下载项不再被"已跳过"挡住；切换目录后 `downloads:list` 的任务 `destPath` 全部位于新目录 | DR-061 / DR-062 |
| P-32 | DR-065 隐藏开关控件的文档滚动溢出需窗口内确认 | 关闭 R18 后整页不位移、顶部五页导航与页面下半部分正常；设置页长内容只在页面内部滚动；用 Tab 聚焦 R18 开关同样不触发整页滚动；其它页面（搜索/榜单/收藏/下载）无回归 | 本地桌面 `pnpm dev`：进入设置页滚到内容分组，关闭 R18 观察整页不动；缩小窗口使设置页内容超过一屏后再用 Tab 聚焦开关；切回搜索页确认布局正常 | DR-065 |
| P-31 | DR-063 目录失效自愈需窗口内确认 | ① 在资源管理器删掉下载目录后点下载：Windows 重建同名目录也不可写时应弹目录框；取消则不产生任务，选中后文件落在新目录；② 下载中删掉目录：弹框选中后任务迁到新目录并完成，旧 `.part` 被清理；③ 取消选择后任务失败原因为"下载目录不可用，请重新选择目录"，不再是"下载失败，请重试"；④ 网络断开的失败仍显示原网络文案且不弹目录框 | 本地桌面 `pnpm dev`：按上述四步操作，单张与批量各一次；比对 `%APPDATA%\bluu\bluu.db` 中任务 `dest_path` 与磁盘文件 | DR-063 |
| P-29 | DR-060 关窗即退出需窗口内确认 | 访问过 konachan（触发隐藏 CF 窗口）后关闭主窗口，应用应完全退出、`pnpm dev` 返回命令行；未访问 konachan 时同样退出；下载进行中关窗直接结束进程；macOS 关窗后常驻、点 Dock 重新开窗 | 本地桌面 `pnpm dev`：① 切到 konachan 搜索一次 → 关闭窗口 → 确认终端回到提示符、任务管理器无残留 electron 进程；② 重启后只在 yande 搜索 → 关闭窗口 → 同样退出；③ 开始一个下载后立即关窗，确认进程退出且 `downloads` 中保留 `.part`；④ macOS 上关窗确认进程常驻 | DR-060 |
| P-27 | T-28 konachan 接入与两站站点切换需真实网络人工确认 | `post.json` 字段结构与预期是否一致（P-02）、`files.konachan.com` 原图/预览是否需 cookie 或 CF（P-04）、`konachan.com`/`assets.konachan.com` 图片 host 映射是否命中、榜单三个端点与搜索分页是否可用；切站后的重搜/重载、榜单标签跳搜索是否落在来源站点需窗口内目视 | 本地桌面 `pnpm dev`：搜索页切到 konachan.com 搜索任意标签，确认首屏、翻页、查看器、收藏、单张与批量下载可用；榜单页切到 konachan 依次打开热门/日/周/月，确认首屏与日期切换；在 konachan 查看器点标签确认跳到搜索页且站点仍为 konachan；回到 yande 确认原链路无回归 | T-28 / DR-057 |
| P-26 | T-37 标签黑名单的窗口内编辑与过滤提示需人工确认 | 设置页新增多行输入与保存按钮；搜索/榜单提示文案、计数准确性、与用户显式 `-tag` 去重后的查询串需目视；konachan 真实生效需 T-28 后复验 | 本地桌面 `pnpm dev`：设置页录入 `lowres`、`bad_id` 并保存，打开 `config.json` 确认小写数组；搜索 `hatsune` 确认结果已排除命中项且提示"已排除 N 个标签"；再搜 `hatsune -LowRes` 确认不重复追加；榜单任选周期确认命中项不出现且提示计数；输入空行/重复项确认保存后归一化；输入含空格或冒号的非法项确认被拒绝并提示 | T-37 / DR-056 |
| P-23 | DR-051 的原图 / JPG 二级菜单需实机确认 | 独立 JPEG 版本只存在于 PNG 原图帖子，真实站点的 `jpeg_file_size`、地址白名单与下载扩展名需确认；菜单展开位置、体积展示、点击空白 / Esc 收起与两种格式共存需窗口内验证 | 本地桌面 `pnpm dev`：打开一张 PNG 原图帖子，确认“下载”按钮带 `▾`，点击展开“原图 / 较小 JPG”并显示两种体积；分别下载两种格式，确认目录内同时存在 `.png` 与 `.jpg` 且大小不同；点空白处或 Esc 确认只收起菜单、不关闭查看器；对 JPG 原图帖子确认按钮直接下载；批量下载确认沿用设置页“批量默认格式” | T-23 / T-26 / DR-051 |
| P-22 | DR-050 的已下载态与重新下载需实机确认 | 查看器打开已下载图片时的任务查询、按钮切换、重新下载覆盖原文件与 D 键行为需在真实窗口下验证 | 本地桌面 `pnpm dev`：下载一张图片后在查看器重新打开，确认显示“打开所在文件夹 + 重新下载”；点前者确认资源管理器选中文件；点后者确认进度重新走完且最终文件被替换；按 D 在已下载图片上确认触发重下而非提示已跳过 | T-23 / T-26 / DR-050 |
| P-21 | DR-044 的删除与清空需实机确认 | 三选项弹窗（删文件/仅删记录/取消）、删除运行中任务的稳定性、清空后文件保留与 `.part` 清理需在真实窗口与文件系统下验证 | 本地桌面 `pnpm dev`：对一个已完成任务点“删除”，确认弹窗出现且两种选择分别删文件 / 保留文件；对下载中任务点“删除”，确认任务停止且记录移除；点“清空任务列表”，确认列表清空、已下载文件仍在、`.part` 消失 | T-26 / DR-044 |
| P-20 | DR-043 的扁平目录与“打开所在文件夹”需实机确认 | 旧 `config.json` 的模板迁移在读取时完成，设置页保存前展示值需人工确认；Windows 资源管理器选中行为与未完成任务选中 `.part` 的观感需窗口内验证 | 本地桌面 `pnpm dev`：下载一张图片，确认落在 `downloads/yande/<md5>.<ext>`；下载页点击“打开所在文件夹”，确认资源管理器打开并选中该文件；对下载中的任务点击，确认选中 `.part`；把模板手动改回旧默认值再启动，确认设置页显示新默认值 | T-25 / T-26 / DR-043 |
| P-19 | DR-042 的重复任务清理与取消安全需在真实数据下确认 | 历史重复行会在下次启动时折叠，但磁盘上可能仍残留 `(1)(2)` 等重复最终文件（按设计不自动删除）；同一图片下载中重复点按的幂等性需实机确认 | 本地桌面 `pnpm dev`：对同一图片连按 `D` 4 次，确认下载页只出现 1 条任务；入队后取消，确认其它已完成的同名副本文件仍在；用含重复行的旧库启动，确认任务列表折叠为 1 条且只跑一个任务 | T-23 / T-26 / DR-042 |
| P-18 | T-29 榜单页的真实接口行为与窗口内表现未验证 | 期榜端点（`popular_by_day/week/month`）是否同样需要 CF cookie、是否支持 `limit/page` 与返回量未知；热门 `period=1d` 的实际周期仍未核对（P-03）；四入口切换、日期选择器的窗口观感需人工确认 | 本地桌面 `pnpm dev`：逐个打开热门/日/周/月，确认首屏有图且切换日期结果随之变化；滚动期榜确认翻页无重复且到底停止；断网/限流确认错误文案与重试；确认查看器、收藏、下载与"标签点击跳搜索页"可用 | T-29 |
| P-33 | DR-066 自动更新的设置页入口与真实升级需人工确认 | 设置页「关于与更新」版本号、检查中/已是最新/发现新版本/下载百分比/已下载/失败各状态的文案与按钮禁用需目视；`pnpm dev` 与便携版应显示"不支持"原因；安装版需真实 Release 才能验证下载与重启生效，未签名安装包可能触发 SmartScreen。**进度（会话 69）**：`v0.1.1` 已发布、`latest.yml` 可公开下载；含更新代码的 `0.1.0` 测试版已安装并启动，剩检查→下载→重启安装的点击验证 | ① 安装版点「检查更新」应显示"发现新版本 v0.1.1"；② 点「下载更新」，进度实时更新，完成后出现「重启并安装」，点击后应用退出并升级到 0.1.1；③ 升级完成后再点检查应显示"已是最新版本"；④ 断网点检查只显示"检查更新失败，请稍后重试"；⑤ `pnpm dev` 与 portable 版确认显示不支持的说明且按钮禁用 | T-35 / DR-066 |

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
- 迁移: 用户确认只迁移配置与数据库；已将 `%APPDATA%\booru-desktop\config.json` 与 `booru.db` 复制到 `%APPDATA%\bluu\`（数据库重命名为 `bluu.db`），未复制 `Partitions`，旧目录保留
- 遗留: 站点 cookie / CF clearance 需在新目录重新获取；品牌角色/图标未绘制（T-43）；发布前需 Bluu / 蓝噗 商标与撞名检索；真实窗口标题与安装包名需本地人工确认
- 下一步: T-19（三态角标）

### 2026-11-04 会话 30
- 任务: T-19 三态角标
- 改动文件: `src/shared/badges.ts`（新增）、`src/renderer/components/BadgeStack.tsx`（新增）、`src/renderer/components/BadgeStack.module.css`（新增）、`src/renderer/components/PostCard.tsx`、`src/renderer/styles/index.css`、`tests/unit/badges.test.ts`（新增）、`docs/07-Progress.md`
- 决策: 角标顺序/文案/字形集中在 `shared/badges.ts#resolveBadges`，组件只负责渲染，状态组合不会重排；颜色复用 `--muted`(#6B7C93)、`--success`(#3FA96B)、`--warning`(#D9A441)，暗色 token 值即 02 §6.2 指定值，未新增 token；角标挂在卡片根层而非 `.post-card__image` 内，使已看的 `opacity 0.55 / saturate 0.8` 只作用于缩略图，✓ 始终清晰（hover/focus 恢复亮度时 ✓ 保留）；按 02 §2.2 把 rating 色点从右上角移入信息条右下角（与评分同组），右上角让位状态角标
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 154/154 通过（22 个文件，新增 5 条角标用例）
- 遗留: ↓（下载，T-23）/ ★（收藏，T-21）无真实数据源，组件已留插槽且不渲染空角标；角标是否遮挡缩略图主体、亮/暗主题对比度需本地桌面人工确认
- 下一步: T-20（隐藏已看 + 补页）

### 2026-11-04 会话 31
- 任务: T-17 查看器缩放下限调整（用户反馈）
- 改动文件: `src/shared/viewer.ts`、`tests/unit/viewer.test.ts`、`docs/{02-UX-Design,07-Progress}.md`
- 决策: `VIEWER_MIN_ZOOM` 由 0.5 改为 1（默认适应尺寸），可放大至 400%，但不能缩小到比默认更小；`zoomAtPoint` 缩到下限时返回 `{zoom:1, offsetX:0, offsetY:0}`，避免带偏移的图片停在非居中位置
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 155/155 通过（22 个文件，viewer 9 条，新增缩小重置用例）；`pnpm build` 三端成功（main 37.18 kB、preload 1.11 kB、renderer 287.40 kB / CSS 16.73 kB）
- 遗留: 滚轮与 `-` 键缩到 100% 的停止手感、拖动后缩小是否回到居中需本地桌面人工确认
- 下一步: T-20（隐藏已看 + 补页）

### 2026-11-04 会话 32
- 任务: T-17 查看器拖拽修复与边界限制（用户反馈）
- 改动文件: `src/shared/viewer.ts`、`src/renderer/components/ZoomLayer.tsx`、`src/renderer/components/ImageViewer.module.css`、`tests/unit/viewer.test.ts`、`docs/{02-UX-Design,07-Progress}.md`
- 决策: 原图加载后拖不动的根因是 `.stage` 尺寸不确定，图片 `max-width/max-height: 100%` 无法解析，原图按自然尺寸溢出预览区；改为 stage 铺满预览区、图片按 contain 适配。新增 `fitContentSize` / `clampViewerOffset`：放大后最多拖到图片四边与预览区四边对齐，100% 时偏移为 0；滚轮、拖动、键盘缩放与图片替换后统一夹取
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 160/160 通过（22 个文件，viewer 14 条含 contain 适配与边界用例）；`pnpm build` 三端成功（main 37.18 kB、preload 1.11 kB、renderer 289.54 kB / CSS 16.75 kB）
- 遗留: 需本地桌面确认原图替换后 100% 能完整显示、放大拖动在四边停住且不抖动
- 下一步: T-20（隐藏已看 + 补页）

### 2026-11-04 会话 33
- 任务: T-20 隐藏已看 + 补页
- 改动文件: `src/shared/posts.ts`、`tests/unit/posts.test.ts`、`src/renderer/components/Switch.tsx`（新增）、`src/renderer/components/Switch.module.css`（新增）、`src/renderer/components/PostGrid.tsx`、`src/renderer/pages/SearchPage.tsx`、`src/renderer/styles/index.css`、`docs/07-Progress.md`
- 决策: DR-031——隐藏已看只做渲染层派生（`posts` 保留全部已加载数据，`filterUnviewed` 生成可见列表）；`PostGrid` 在 `scrollHeight - clientHeight < 300` 时上报 `onUnderfilled`，补页上限只统计自动补页；"已跳过 N 张"的 N 为连续 5 个空页中跳过的已看数；新页在追加前先 `views:list` 恢复已看，避免隐藏模式下已看项闪现后被移除
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 166/166 通过（22 个文件，`posts.test.ts` 新增 6 条：过滤 2 条、补页进度 4 条）
- 遗留: 自动补页触发时机、视口是否填满、5 页上限与"已跳过 N 张"文案需真实站点 + 本地桌面人工确认（P-11）；查看器仍按完整 `posts` 切图，隐藏已看只作用于网格，属本任务既定范围
- 下一步: T-21（收藏）

### 2026-11-04 会话 34
- 任务: T-21 收藏
- 改动文件: `src/main/storage/migrations/003_favorites.sql`（新增）、`src/main/storage/migrations/index.ts`、`src/main/storage/favorites.ts`（新增）、`src/main/ipc/favorites-input.ts`（新增）、`src/main/ipc/handlers/favorites-toggle.ts`（新增）、`src/main/ipc/handlers/favorites-list.ts`（新增）、`src/main/ipc/registry.ts`、`src/shared/favorites.ts`（新增）、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/renderer/components/PostCard.tsx`、`src/renderer/components/PostGrid.tsx`、`src/renderer/components/ImageViewer.tsx`、`src/renderer/components/ImageViewer.module.css`、`src/renderer/components/InfoPanel.tsx`、`src/renderer/pages/SearchPage.tsx`、`src/renderer/pages/FavoritesPage.tsx`（新增）、`src/renderer/App.tsx`、`src/renderer/styles/index.css`、`tests/unit/db.test.ts`、`tests/unit/favorites.test.ts`（新增）、`tests/unit/favorites-handlers.test.ts`（新增）、`docs/{03-Architecture,07-Progress}.md`
- 决策: DR-032——`favorites:toggle` 入参改为 `{site, post}`，收藏时在同一事务内把 Post 快照 upsert 进既有 `posts` 表再写 `favorites`；`favorites:list` 支持 `query`（空格分词、全部命中）与 `sort`（`added` / `score`），全部本地完成，不请求站点。迁移 003 只新增 `favorites(site, post_id, added_at)` 与 `idx_favorites_added`；取消收藏不触碰 `post_views`，与已看完全独立
- 行为: `PostCard` 根层改为容器，打开按钮与左上角 ☆/★ 切换按钮平级（避免按钮嵌套），右上角 `BadgeStack` 显示 ★ 状态；查看器信息栏新增收藏按钮并接入 `F` 键；搜索页进入搜索时并行读取 `favorites:list` 恢复收藏集合，切换乐观更新失败回滚；收藏页按站点 tab 分组，支持标签筛选与排序，打开查看器后取消收藏会即时从列表移除；`App` 增加搜索/收藏最小导航（外壳任务落地前临时）
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 188/188 通过（24 个文件，新增 favorites 11 条、favorites-handlers 11 条，`db.test` 表清单补 `favorites`）
- 遗留: 收藏页筛选输入 120ms 防抖；`posts` 表不存 `source`，收藏页来源字段显示为 —；切换导航会卸载搜索页、丢失当前结果（等 T-38~ 外壳任务统一处理）；★ 即时反馈、重启保留、标签筛选/排序、查看器内取消收藏需本地桌面人工确认
- 下一步: T-22（清除浏览记录）

### 2026-11-04 会话 35
- 任务: T-21 收藏角标重复修复（用户反馈）
- 改动文件: `src/renderer/components/PostCard.tsx`、`docs/07-Progress.md`
- 决策: 卡片收藏状态只由左上角可点击的 ☆/★ 承担；`BadgeStack` 在提供 `onToggleFavorite` 时不再渲染 ★，避免右上角与左上角同时出现收藏图标。未提供切换按钮的调用方仍由 `BadgeStack` 显示 ★
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 188/188 通过（24 个文件）
- 遗留: 需本地桌面确认已看+已收藏卡片只显示一个 ★
- 下一步: T-22（清除浏览记录）

### 2026-11-04 会话 36
- 任务: T-22 清除浏览记录
- 改动文件: `src/main/storage/history.ts`（新增）、`src/main/ipc/views-clear-input.ts`（新增）、`src/main/ipc/handlers/views-clear.ts`（新增）、`src/main/ipc/registry.ts`、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/renderer/pages/SettingsPage.tsx`（新增）、`src/renderer/pages/SettingsPage.module.css`（新增）、`src/renderer/App.tsx`、`src/renderer/styles/index.css`、`src/renderer/pages/SearchPage.tsx`、`src/renderer/pages/FavoritesPage.tsx`、`src/renderer/components/SearchBar.tsx`、`tests/unit/history.test.ts`（新增）、`tests/unit/history-handlers.test.ts`（新增）、`docs/{02-UX-Design,03-Architecture,07-Progress}.md`
- 决策: DR-033——`views:clear` 同时清理 `post_views` 与 `favorites`（`site` 缺省为全部站点，返回 `Result<{site, clearedViews, clearedFavorites}>`），成功后广播 `views:updated` `{site}`；清除在单个事务内先计数后删除，只动两张记录表，保留 `posts` 快照、`tag_cache` 与迁移记录。为支持"即时刷新"，`App` 的搜索/收藏/设置页改为常驻挂载（`hidden` 切换），搜索页与收藏页订阅事件后重置已看/收藏集合或重读本地收藏
- 行为: 设置页为 T-30 前的最小入口，只落地"隐私 - 清除浏览记录"；范围可选当前站点（yande.re）或全部站点，点击后出现二次确认卡片，确认前不可执行；成功后显示清除条数，0 条时提示"没有可清除的记录"；失败展示中文错误
- 追加（用户反馈）: 搜索框回车或点击"搜索"提交时同步关闭标签联想下拉（`SearchBar#handleSubmit` 调用 `cancelSuggest`），02 §3 已同步
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 197/197 通过（26 个文件；新增 `history.test.ts` 4 条：按站点隔离、全部清除、保留元数据、幂等；`history-handlers.test.ts` 5 条：缺省/指定站点、非法 site、非对象入参、存储异常）
- 遗留: 设置入口、二次确认与清除后即时刷新需本地桌面确认（P-12）；设置页其余分组与主题/网络/下载配置归 T-30；"当前站点"目前固定为 yande（T-28 前无站点切换）
- 下一步: T-23（下载队列）

### 2026-11-04 会话 37

- 任务: T-23 下载队列
- 改动文件: `src/shared/downloads.ts`（新增）、`src/shared/ipc-contract.ts`、`src/main/download/queue.ts`（新增）、`src/main/storage/downloads.ts`（新增）、`src/main/storage/migrations/004_downloads.sql`（新增）、`src/main/storage/migrations/index.ts`、`src/main/ipc/downloads-input.ts`（新增）、`src/main/ipc/handlers/downloads-{enqueue,control,list}.ts`（新增）、`src/main/ipc/registry.ts`、`src/main/network/hostmap.ts`、`src/preload/index.ts`、`src/renderer/components/ImageViewer.tsx`、`src/renderer/components/InfoPanel.tsx`、`src/renderer/components/ImageViewer.module.css`、`tests/unit/downloads.test.ts`（新增）、`tests/unit/downloads-store.test.ts`（新增）、`tests/unit/downloads-queue.test.ts`（新增）、`tests/unit/downloads-handlers.test.ts`（新增）、`tests/unit/db.test.ts`、`tests/unit/history.test.ts`、`docs/{03-Architecture,07-Progress}.md`
- 决策: DR-034——迁移 004 建 `download_tasks`（沿用 03 §6.1 字段）；`shared/downloads.ts` 定义 6 个状态与迁移表、4 个 control 动作、`config.json#downloads.concurrency` 解析（1–6，默认 3）；`downloads:control` 原 `{ok}` 改为 `{taskId, status}`（取消后 `status=null`）；下载目录 `userData/downloads/{site}`、文件名占位 `{postId}.{ext}`；暂停保留 `.part`，恢复/重试从 0 重下，取消删除任务行与文件；启动时把中断的 `downloading/verifying` 重置为 `queued` 继续。`Range` 续传、md5、模板命名、磁盘预检、403/CF 分类与下载页仍归 T-24~T-27
- 行为: 队列按站点独立并发，调度以 `download_tasks` 为准（FIFO），流式写盘并每 200ms 节流上报 `downloads:progress`，状态变化强制上报；入队校验 `posts` 1–100、站点一致、`fileUrl` 仅 https 且图片域名白名单；查看器新增 `D` 键与信息栏"下载"按钮，就地显示排队/进度/校验/完成/暂停/失败文案与失败原因；`F-`/`D` 均不影响其他快捷键
- 验证: `pnpm lint` 通过（先 `eslint --fix` 修 import 排序）；`pnpm typecheck` 通过（node + web）；`pnpm test` 227/227 通过（30 个文件；新增 30 条：`downloads.test.ts` 10 条状态机/配置/命名、`downloads-store.test.ts` 4 条迁移与读写、`downloads-queue.test.ts` 7 条并发/暂停/取消/失败/节流/恢复、`downloads-handlers.test.ts` 9 条入参与异常映射；`db.test.ts` 表清单与 `history.test.ts` 迁移数同步为 4）
- 遗留: 真实图床下载与窗口内交互需本地桌面确认（P-13）；恢复/重试暂从 0 重下（T-24）；`verifying → done` 未做 md5（T-25）；`template` 入参只校验不渲染（T-25）；无下载页与暂停/取消 UI（T-26）；并发只能改 `config.json` 后重启（T-30）
- 下一步: T-24（断点续传）

### 2026-11-04 会话 38

- 任务: T-24 断点续传
- 改动文件: `src/main/download/queue.ts`、`src/main/ipc/registry.ts`、`tests/unit/downloads-queue.test.ts`、`docs/{03-Architecture,07-Progress}.md`
- 决策: DR-035——`DownloadTransport` 改为 `(url, { signal, headers })` 以便透传 `Range`；恢复/重试读 `<dest_path>.part` 大小 `N` 发 `Range: bytes=N-`，206 追加写并按 `N + content-length` 计总进度，200 忽略 Range 时清空 `.part` 并强制上报 0 进度，416 且已有 `.part` 视为完整直接 `verifying`；`bytes_done` 在 `start` 与 `control.resume/retry` 先回填为文件大小；暂停落状态前校验"本协程仍是活动协程 + 库中状态仍为 paused"，修复"暂停后立刻恢复"被旧协程回写 `paused` 导致任务卡死的竞态（单测实测暴露）。下载 transport 与图片读取分离：`downloadTransport` 透传 headers，`imageTransport` 保持不变
- 行为: 暂停/恢复/重试/进程重启均从 `.part` 已有字节继续，最终文件大小与内容正确且不重复写入；服务器不支持 Range 时自动清空重下；`.part` 缺失按 0 处理；取消仍删除任务行与 `.part`
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 231/231 通过（30 个文件；`downloads-queue.test.ts` 由 7 条增至 11 条：206 追加续传且断言 `Range` 与最终字节、200 回退重下、416 视为完成、重启从已有 `.part` 续传）
- 遗留: 真实图床是否返回 206 需本地桌面确认（P-14）；md5 校验与模板命名归 T-25；磁盘预检、403/CF 刷新与失败重试次数仍待后续任务
- 下一步: T-25（md5 校验与命名）

### 2026-11-04 会话 39

- 任务: T-26 下载页（用户明确要求提前于 T-25）
- 改动文件: `src/renderer/pages/DownloadsPage.tsx`（新增）、`src/renderer/pages/DownloadsPage.module.css`（新增）、`src/renderer/components/TaskList.tsx` + `TaskList.module.css`（新增）、`src/renderer/components/TaskRow.tsx` + `TaskRow.module.css`（新增）、`src/renderer/components/ProgressBar.tsx` + `ProgressBar.module.css`（新增）、`src/renderer/App.tsx`、`src/renderer/components/ImageViewer.tsx`、`src/renderer/components/InfoPanel.tsx`、`src/renderer/components/ImageViewer.module.css`、`src/shared/downloads.ts`、`tests/unit/downloads.test.ts`、`docs/07-Progress.md`
- 决策: DR-036——按用户反馈将 T-26 提前于 T-25；下载页只依赖 `downloads:list` / `downloads:control` / `downloads:progress`，不轮询，进度事件直接并入本地列表（`applyDownloadProgress`），未知任务以 150ms 去抖补拉；行内按状态显示可用动作（`pause`/`resume`/`retry`/`cancel`）；查看器信息栏在状态文案下增加同一 `ProgressBar`，解决"点击下载看不见进度"；T-25 完成后页面自动显示新文件名与路径，无需再改页面
- 行为: `App` 新增"下载"页签；首次进入读取任务列表，之后由事件增量更新；每条任务显示文件名、站点/ID、字节进度、百分比与失败原因；操作在途时禁用本行按钮；取消成功后立即移除该行；空态提示从查看器 `D`/下载按钮入队
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 236/236 通过（30 个文件；`downloads.test.ts` 由 10 条增至 15 条，覆盖进度合并、未知任务、比例、标题与字节格式化）
- 遗留: 窗口内观感与交互需本地桌面确认（P-15）；T-25 未做，页面文件名仍是占位 `{postId}.{ext}` 且完成态未校验 md5；批量入口 T-27、顶部 ↓ 角标数据源仍未接
- 下一步: T-25（md5 校验与命名）

### 2026-11-04 会话 40

- 任务: T-25 md5 校验与命名
- 改动文件: `src/shared/downloads.ts`、`src/shared/ipc-contract.ts`、`src/main/download/queue.ts`、`src/main/storage/downloads.ts`、`src/main/storage/migrations/005_downloads_md5.sql`（新增）、`src/main/storage/migrations/index.ts`、`src/main/ipc/handlers/downloads-enqueue.ts`、`src/renderer/components/ImageViewer.tsx`、`tests/unit/downloads-template.test.ts`（新增）、`tests/unit/downloads-queue.test.ts`、`tests/unit/downloads-store.test.ts`、`tests/unit/downloads.test.ts`、`tests/unit/downloads-handlers.test.ts`、`tests/unit/history.test.ts`、`docs/{02-UX-Design,03-Architecture,07-Progress}.md`
- 决策: DR-037——模板在入队时渲染（`dest_path` 在暂停/重启后保持稳定）；迁移 005 只给 `download_tasks` 追加 `md5 TEXT` 与 `idx_tasks_md5`；`artist/copyright/character` 取首个同类型标签、缺失为 `unknown`；未知变量原样保留；非法字符与控制字符替换为 `_`，`.`/`..` 段替换为 `_`；渲染结果超过 120 字符回落到 `{site}/{rating}/{md5}.{ext}`。`finalize` 先对 `.part` 流式算 md5，一致才 `verifying → done`，不一致删除 `.part` 与最终文件并 `failed`（TC-27）；历史任务 `md5` 为 NULL 时跳过校验。入队先去重已 `done` 的 `site+md5`，再按 02 §7.4 跳过同尺寸文件、否则追加 ` (n)`，并避让同批/存量任务的 `dest_path`，避免模板缺 `id/md5` 时并发写同一文件；`downloads:enqueue` 返回 `{taskIds, skipped}`
- 行为: 默认模板落盘为 `downloads/<site>/<rating>/<artist>/<md5>.<ext>`；md5 校验失败显示"文件校验失败（md5 不一致）"且不产生最终文件；重复下载同一图片在查看器提示"该图片已下载，已跳过"；下载页标题自动显示新文件名
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 246/246 通过（31 个文件；新增 `downloads-template.test.ts` 7 条，`downloads-queue.test.ts` 增至 15 条：md5 一致落盘、md5 不一致失败且不落盘、md5 去重跳过、同尺寸跳过与 `(1)` 追加；`downloads-store.test.ts` 新增 `findCompletedMd5` 1 条；`history.test.ts` 迁移数同步为 5）
- 遗留: 真实图床 md5 与落盘路径、Windows 非法字符实际表现、跳过提示需本地桌面确认（P-13/P-14）；模板编辑与自定义目录归 T-30；批量入口 T-27 未做；旧占位命名任务（md5 为 NULL）不校验，需人工确认可正常结束
- 下一步: T-27（批量入口）

### 2026-11-04 会话 41

- 任务: T-27 批量入口
- 改动文件: `src/shared/selection.ts`（新增）、`src/shared/download-batch.ts`（新增）、`src/renderer/components/BatchDownloadBar.tsx` + `BatchDownloadBar.module.css`（新增）、`src/renderer/components/ConfirmDialog.tsx` + `ConfirmDialog.module.css`（新增）、`src/renderer/components/PostCard.tsx`、`src/renderer/components/PostGrid.tsx`、`src/renderer/pages/SearchPage.tsx`、`src/renderer/styles/index.css`、`tests/unit/download-batch.test.ts`（新增）、`tests/unit/selection.test.ts`（新增）、`docs/{02-UX-Design,07-Progress}.md`
- 决策: DR-038——选中态以 `site:id` 存在页面层，与虚拟网格行回收解耦；`Shift` 从锚点连续并入可见区间、其余点击切换单项；查询级入口取当前可见且已加载的结果（尊重"隐藏已看"），因站点不返回总数，首版不做"前 N 张"输入；>50 张弹 `ConfirmDialog` 显示数量与按 `Post.fileSize` 求和的预估体积（缺失/0 标注未知）；确认后按 ≤100 分片调用 `downloads:enqueue`，汇总 `{taskIds, skipped}` 为"已加入/已跳过/失败"，单片失败计入该片并继续后续分片，有失败时保留选中便于重试；目标目录展示延后 T-30；不改 T-25 模板/校验/去重语义
- 行为: 搜索页卡片新增勾选框（收藏钮右侧，不遮挡右侧角标），选中卡片加强调色边框；结果区上方常驻批量条，显示"已选 N 张 · 预估体积"与"下载全部结果（N 张）"；≤50 张直接入队，>50 张先确认；入队完成后显示"已加入 X 项，已跳过 Y 项，失败 Z 项"，失败时另有红色 `role=alert` 提示
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 259/259 通过（33 个文件；新增 `download-batch.test.ts` 8 条覆盖阈值、分片、预估与失败汇总，`selection.test.ts` 5 条覆盖选中键、切换与正反方向连选）
- 遗留: 窗口内多选/连选、确认弹窗与滚动回收选中态需本地桌面确认（P-16）；查询级"前 N 张"与目标目录展示分别待 T-30、按需补；未接入真实图床大规模入队耗时测试
- 下一步: T-09（代理支持，T-30 网络组的前置）

### 2026-11-04 会话 42

- 任务: T-09 代理支持
- 改动文件: `src/shared/proxy.ts`（新增）、`src/main/network/proxy.ts`（新增）、`src/main/network/hostmap.ts`（`AppConfig` 增加 `network`）、`src/main/index.ts`、`src/main/ipc/registry.ts`、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/renderer/App.tsx`、`src/renderer/styles/index.css`、`tests/unit/proxy.test.ts`（新增）、`docs/{03-Architecture,07-Progress}.md`
- 决策: DR-039——`config.json#network.proxy` 三模式；app ready 后两站 `setProxy` + `resolveProxy` 复检；规则非法/未生效/被系统忽略立即回退；非直连时用既有 HTTP 客户端探测一次，仅 `NETWORK`/`TIMEOUT` 判定不可达；新增 `network:status` 与 `network:status-changed`，渲染层横幅提示。代理编辑入口仍归 T-30，当前手工编辑后重启生效
- 行为: 默认直连（`127.0.0.1:7890` 仅作占位）；启动时若配置代理且复检不通过，则显式 `mode:'direct'` 回退；探测在后台执行，不阻塞窗口创建；回退后导航下方出现可关闭的 `role=alert` 横幅，文案来自 `ProxyStatus.reason`
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 271/271 通过（34 个文件；新增 `proxy.test.ts` 12 条覆盖规则组装、配置解析、`resolveProxy` 解析与回退判定矩阵）
- 遗留: 真实 HTTP/SOCKS5 代理连通、不可达代理回退、重启持久化与两站实际请求需本地桌面验证；代理与 hostmap 同时开启的组合需人工确认；T-30 前无图形化编辑入口
- 下一步: T-30（设置页）

### 2026-11-04 会话 43

- 任务: T-30 设置页
- 改动文件: `src/shared/settings.ts`（新增）、`src/shared/downloads.ts`、`src/shared/ipc-contract.ts`、`src/main/network/hostmap.ts`、`src/main/download/queue.ts`、`src/main/ipc/registry.ts`、`src/main/ipc/settings-input.ts`（新增）、`src/main/ipc/handlers/settings-get.ts`（新增）、`src/main/ipc/handlers/settings-set.ts`（新增）、`src/preload/index.ts`、`src/renderer/pages/SettingsPage.tsx`、`src/renderer/pages/SettingsPage.module.css`、`src/renderer/components/SettingsSection.tsx` + `.module.css`（新增）、`src/renderer/components/IpMapEditor.tsx` + `.module.css`（新增）、`tests/unit/settings.test.ts`（新增）、`tests/unit/downloads.test.ts`、`tests/unit/downloads-queue.test.ts`、`docs/{03-Architecture,07-Progress}.md`
- 决策: DR-040——`Settings` 四组全量读写；`settings:set` zod + 语义校验（并发 1–6、Windows 绝对目录、模板非空 ≤200、非直连代理地址/端口、映射条目合法且不重复），非法返回 `CONFIG` 且不落盘；保存后队列 `updateConfig` 热更新目录/模板/并发（仅后续入队）、代理立即 `applyProxyConfig`，IP 映射变化返回 `restartRequired` 提示重启；R18 开启需二次确认；空下载目录回落 `userData/downloads`
- 行为: 设置页分四组各自保存并展示成功/失败文案；网络组展示"已配置/实际生效/回退原因"；下载组展示并发、目录（占位默认路径）、模板与可用变量；内容组默认关闭，开启前弹出确认；隐私组沿用 T-22 的清除范围与二次确认；代理回退时网络组直接显示 `ProxyStatus.reason`
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 286/286 通过（35 个文件；新增 `settings.test.ts` 12 条覆盖解析、校验矩阵、重启判定与 get/set handler，队列新增 1 条热更新用例）；`pnpm build` 通过（main 86.31 kB / preload 3.23 kB / renderer 360.30 kB）
- 遗留: 设置页布局、四项保存反馈、R18 确认层、代理切换与回退文案、映射表编辑与重启生效、下载目录实际落盘位置需本地桌面验证（P-17）；目录可写性与磁盘预检未在保存时校验；未提供"测试 IP 映射"按钮（02 §9 为可选能力）；T-27 批量条"目标目录展示"仍未接入（可后续复用 `settings:get`）
- 下一步: T-29（榜单页，先落地 yande）

### 2026-11-04 会话 44

- 任务: T-29 榜单页
- 改动文件: `src/shared/rankings.ts`（新增）、`src/main/ipc/rankings-input.ts`（新增）、`src/main/ipc/handlers/posts-rankings.ts`（新增）、`src/renderer/pages/RankingPage.tsx` + `RankingPage.module.css`（新增）、`tests/unit/rankings.test.ts`（新增）、`tests/unit/posts-rankings.test.ts`（新增）、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/main/sites/moebooru.ts`、`src/main/ipc/registry.ts`、`src/renderer/App.tsx`、`src/renderer/pages/SearchPage.tsx`、`tests/unit/moebooru.test.ts`、`docs/{02-UX-Design,03-Architecture,07-Progress}.md`
- 决策: DR-041——03 §5/§7 已定义 `rankings` 与 `posts:rankings` 但代码一直未实现（07 §6 原写"已具备"有误），本任务补齐；日期改为可序列化 `RankingDate = {year, month, day}`（05 §5 禁止 `Date` 跨 IPC），`buildRankingPath` 收敛到 `shared/rankings.ts`；端点统一带 `.json`（06 §5 实测），热门固定 `period=1d` 且只取第 1 页（DR-008），期榜带 `page` 并以"合并后无新增"停止；R18 关闭时 handler 本地过滤 explicit 并回传 `r18Filtered`（榜单端点不支持 `tags` 排除）；榜单查看器点击标签经 App 级 `searchRequest` 切到搜索页并立即执行该标签查询
- 行为: 导航新增"榜单"页签；页内四个入口"热门/日/周/月"，期榜显示日期选择器且 `max` 为今天；加载中、空结果、网络/限流错误均有文案与重试；热门 40 张不翻页，期榜触底加载下一 `page` 并按 `site+id` 去重；卡片复用 `PostGrid`，可打开查看器、收藏、下载；R18 关闭时显示"已过滤 R18"
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 309/309 通过（37 个文件；新增 `rankings.test.ts` 9 条覆盖标签/日期规则、四种路径与日期解析；新增 `posts-rankings.test.ts` 10 条覆盖入参校验、游标透传、站点限制、错误信封与 R18 过滤；`moebooru.test.ts` 新增 4 条榜单路径与 popular 单页断言）
- 遗留: 三个期榜端点的真实返回、`limit/page` 支持与 CF 行为、热门 `period=1d` 的实际周期（P-03/P-18）需本地桌面验证；榜单页四入口与日期选择的窗口观感需人工确认；konachan 榜单入口随 T-28
- 下一步: T-31（错误态与空态）

### 2026-11-04 会话 45

- 任务: 用户反馈缺陷修复（下载重复任务与取消误删），不占用 T-31
- 改动文件: `src/main/download/queue.ts`、`src/shared/downloads.ts`、`tests/unit/downloads-queue.test.ts`、`docs/07-Progress.md`
- 决策: DR-042——`enqueue` 按 `site + postId` / `site + md5` 复用未结束任务（`failed` 复用并回 `queued`、沿用 `.part`），同批重复条目计入 `skipped`；`cancel` 改为一律先删任务行，仅当无其它任务共享 `dest_path` 时才删文件；`recover` 启动时折叠历史重复行（已落盘 done > downloading > verifying > paused > queued > 失败，同级取最早创建），不删除已完成文件、只清理无人引用的 `.part`；`recover` 无条件 `tick()` 让遗留 `queued` 任务继续
- 行为: 同一图片连按 `D` 或同批重复提交只产生 1 条任务并复用同一 id；失败任务再次入队等价重试；取消任一重复任务不再删除共享的已完成文件；重启后历史 4 条重复任务折叠为 1 条并从 `.part` 继续；无中断任务时遗留队列也会自动开跑
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 315/315 通过（37 个文件；`downloads-queue.test.ts` 由 16 条增至 22 条）
- 遗留: 历史库中已存在但无任务行引用的 `(1)(2)` 重复文件按设计不自动删除，需人工清理；实机幂等与取消保留文件需本地桌面确认（P-19）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 46

- 任务: 用户反馈（下载目录扁平化 + 下载页每行“打开所在文件夹”），不占用 T-31
- 改动文件: `src/shared/downloads.ts`、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/main/ipc/downloads-input.ts`、`src/main/ipc/handlers/downloads-reveal.ts`（新增）、`src/main/ipc/registry.ts`、`src/renderer/pages/DownloadsPage.tsx`、`src/renderer/components/TaskList.tsx`、`src/renderer/components/TaskRow.tsx`、`tests/unit/downloads-template.test.ts`、`tests/unit/downloads-reveal.test.ts`（新增）、`docs/02-UX-Design.md`、`docs/03-Architecture.md`、`docs/07-Progress.md`
- 决策: DR-043——默认模板改为 `{site}/{md5}.{ext}`，紧凑回落路径同步去掉 rating；`config.json` 旧默认模板在 `parseDownloadConfig` 读取时迁移，自定义模板不变；新增 `downloads:reveal`，主进程按最终文件 → `.part` → 目录顺序打开并选中，路径只来自本地任务表
- 行为: 新下载文件直接落在 `downloads/yande/<md5>.<ext>`；下载页每行新增“打开所在文件夹”按钮，点击后资源管理器打开并选中对应文件；未完成时选中 `.part`，尚未产生文件时只打开目录
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 321/321 通过（38 个文件；新增 `downloads-reveal.test.ts` 5 条，`downloads-template.test.ts` 增加旧模板迁移用例）
- 遗留: 旧库中已有任务保持原 `dest_path`，不会自动搬迁；扁平目录与资源管理器选中行为需本地桌面确认（P-20）；历史遗留 `(1)(2)` 重复文件仍按设计不自动删除
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 47

- 任务: 用户反馈（卡片控件显隐与多选开关），T-27 视觉收敛，不占用 T-31
- 改动文件: `src/renderer/components/BadgeStack.tsx`、`src/renderer/components/PostCard.tsx`、`src/renderer/components/PostGrid.tsx`、`src/renderer/components/BatchDownloadBar.tsx`、`src/renderer/pages/SearchPage.tsx`、`src/renderer/styles/index.css`、`docs/02-UX-Design.md`、`docs/07-Progress.md`
- 决策: DR-039——卡片未 `hover` / `focus-within` 时隐藏右上角状态角标与多选勾选框，左上角收藏 ☆/★ 常显；多选默认关闭，批量条新增"多选/退出多选"按钮，开启后才渲染勾选框，退出、新搜索、切换"隐藏已看"均清空选中
- 行为: 静止的图墙只保留缩略图、信息条与收藏星标；悬停或键盘聚焦时显示状态角标（✓ 等）；点"多选"前卡片无勾选框，开启后悬停显示，退出即消失
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 321/321 通过（38 个文件，未改动纯函数与现有用例）
- 遗留: hover 揭示、键盘聚焦可达性与多选开关的实际观感需本地桌面确认（P-16 已补充）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 48

- 任务: 用户反馈（下载页删除单条任务 + 清空任务列表，删除前校验文件是否存在）
- 改动文件: `src/shared/downloads.ts`、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/main/download/queue.ts`、`src/main/ipc/downloads-input.ts`、`src/main/ipc/handlers/downloads-delete.ts`（新增）、`src/main/ipc/handlers/downloads-clear.ts`（新增）、`src/main/ipc/registry.ts`、`src/renderer/pages/DownloadsPage.tsx`、`src/renderer/pages/DownloadsPage.module.css`、`src/renderer/components/{TaskList,TaskRow,ConfirmDialog}.tsx`、`src/renderer/components/TaskRow.module.css`、`tests/unit/downloads-queue.test.ts`、`tests/unit/downloads-delete.test.ts`（新增）、`docs/03-Architecture.md`、`docs/07-Progress.md`
- 决策: DR-044——`deleteFile` 缺省时只检查文件存在性，不存在直接删记录，存在则由界面弹窗三选一；删除运行中任务先中止；共享 `dest_path` 不删文件；清空只删记录与 `.part`，保留最终文件
- 行为: 每行新增“删除”按钮；已下载文件存在时弹窗提供“删除文件和记录 / 仅删除记录 / 取消”；顶部“清空任务列表”二次确认后清空记录并保留已下载文件
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 331/331 通过（39 个文件；队列新增 5 条、handler 新增 5 条）
- 遗留: 三选项弹窗、运行中删除与清空后的磁盘行为需本地桌面确认（P-21）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 49

- 任务: 用户反馈（已收藏常显、未收藏 hover、已看 ✓ 角标移除），T-27 视觉收敛，不占用 T-31
- 改动文件: `src/renderer/components/PostCard.tsx`、`src/renderer/styles/index.css`、`docs/02-UX-Design.md`、`docs/07-Progress.md`
- 决策: DR-045——已收藏 ★ 常显；未收藏 ☆ 只在 `hover` / `focus-within` 出现（`pointer-events` 同步禁用，键盘 Tab 聚焦仍可揭示）；`PostCard` 不再向 `BadgeStack` 传 `viewed`，已看不再渲染 ✓，仅保留缩略图变暗/降饱和
- 行为: 静止卡片只保留缩略图、信息条与已收藏的 ★；未收藏卡片悬停才出现 ☆；已看仅变暗，右上角无 ✓
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 331/331 通过（39 个文件，未改动用例）
- 遗留: hover 揭示、已收藏常显与 Tab 可达性需本地桌面确认（P-16 已更新）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 50

- 任务: 用户反馈（移除"下载全部结果"、多选入口改右键菜单且不占结果页空间），T-27 视觉与交互收敛，不占用 T-31
- 改动文件: `src/renderer/components/ContextMenu.tsx` + `ContextMenu.module.css`（新增）、`src/renderer/components/BatchDownloadBar.tsx` + `BatchDownloadBar.module.css`、`src/renderer/components/PostCard.tsx`、`src/renderer/components/PostGrid.tsx`、`src/renderer/pages/SearchPage.tsx`、`docs/02-UX-Design.md`、`docs/07-Progress.md`
- 决策: DR-046——移除查询级"下载全部结果"按钮与对应处理；多选默认关闭，卡片右键菜单选"多选"开启；开启后批量操作以 `position: fixed` 悬浮条出现在右下（状态栏之上），不再占据结果页纵向空间；退出多选 / 新搜索 / 切换"隐藏已看"关闭菜单并清空选中
- 行为: 结果页无任何常驻批量条；右键卡片弹出"多选"菜单；开启后悬停卡片出现勾选框，右下滑出悬浮条显示已选数量/预估体积与"下载选中 / 清除选择 / 退出多选"
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 331/331 通过（39 个文件，未改动用例）
- 遗留: 右键菜单位置/关闭、悬浮条遮挡与"下载全部结果"移除后的入口发现性需本地桌面确认（P-16 已更新）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 51

- 任务: 用户反馈（开启多选后点击卡片应为选中而非打开详情），T-27 交互收敛，不占用 T-31
- 改动文件: `src/renderer/components/PostCard.tsx`、`docs/02-UX-Design.md`、`docs/07-Progress.md`
- 决策: DR-047——多选开启时卡片主按钮（缩略图 + 信息条）点击改为切换选中，`Shift` 走连选；退出多选后恢复打开查看器；收藏按钮保持独立，不触发选中；`aria-label` 随模式切换为"选择/取消选择 #id"
- 行为: 多选期间点击卡片任意位置只取消/选择该张，不再弹出查看器；连选与滚动回收后的选中态不受影响；卡片左上角 ☆/★ 仍只切换收藏
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 331/331 通过（39 个文件，未改动用例）
- 遗留: 多选开启后点击不打开查看器、Shift 连选与收藏按钮独立可点需本地桌面确认（P-16 已更新）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 52

- 任务: 用户反馈（多选中最后点击的卡片常显收藏图标与勾选，多选态只应常显已选勾选、hover 无其它效果），T-27 视觉收敛，不占用 T-31
- 改动文件: `src/renderer/components/PostCard.tsx`、`src/renderer/styles/index.css`、`docs/02-UX-Design.md`、`docs/07-Progress.md`
- 决策: DR-048——多选期间卡片追加 `post-card--select-mode`：收藏 ☆/★、状态角标、勾选框的 hover/focus 揭示全部归零，仅 `[data-selected='true']` 常显勾选框；未选中项 hover 不再有边框强调（`:not(.post-card--selected)` 保住选中态边框）；DR-047 的"收藏仍可独立点按"收窄为仅非多选态
- 行为: 进入多选后卡片不再显示任何收藏图标与角标，悬停也不出现；点击过的卡片移开鼠标后不再残留 ☆/★（原先由 `focus-within` 常显）；只有已选中的卡片保留勾选框与强调边框；退出多选恢复原有 hover 规则
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 331/331 通过（39 个文件，未改动用例）
- 遗留: 多选态下图标残留消失、hover 无揭示与选中边框保持需本地桌面确认（P-16 已更新）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 53

- 任务: 用户反馈（多选中最后选中的卡片仍常显收藏按钮；多选只勾选不收藏，无需收藏按钮），T-27 视觉收敛，不占用 T-31
- 改动文件: `src/renderer/components/PostCard.tsx`、`src/renderer/styles/index.css`、`docs/02-UX-Design.md`、`docs/07-Progress.md`
- 决策: DR-049——多选态直接不渲染收藏按钮（`onToggleFavorite !== undefined && !selectMode`），而不是仅靠透明度隐藏；同时修正 DR-048 未生效的根因：`.post-card:hover` / `:focus-within` 的揭示规则实为 3 个类的权重（伪类按类计），原两类选择器覆盖不了，改为 `.post-card.post-card--select-mode …` 同权重靠后覆盖
- 行为: 进入多选后卡片左上角不再出现收藏按钮（含已收藏卡片），右上角也无角标，未选中项悬停不出现勾选框；只有已选中卡片常显勾选框与强调边框；退出多选恢复收藏与 hover 规则
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 331/331 通过（39 个文件，未改动用例）
- 遗留: 多选态无收藏按钮、hover 无揭示与已选勾选常显需本地桌面确认（P-16 已更新）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 54

- 任务: 用户反馈（图片详情页对已下载图片改为“打开所在文件夹 + 重新下载”），不占用 T-31
- 改动文件: `src/shared/downloads.ts`、`src/main/ipc/downloads-input.ts`、`src/main/download/queue.ts`、`src/renderer/components/ImageViewer.tsx`、`src/renderer/components/InfoPanel.tsx`、`src/renderer/components/ImageViewer.module.css`、`tests/unit/downloads-queue.test.ts`、`docs/03-Architecture.md`、`docs/07-Progress.md`
- 决策: DR-050——查看器用 `downloads:list` 按 `site + postId + done` 判定已下载；`downloads:enqueue` 增加 `force`，跳过已下载判定、复用原任务并覆盖最终文件；D 键在已下载图片上等同重新下载
- 行为: 已下载图片的详情页不再出现“下载”，改为“打开所在文件夹”与“重新下载”；下载完成事件到达时立即切换；重新下载复用同一任务与目标路径，不产生 `(1)` 副本
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 332/332 通过（39 个文件；队列新增 force 1 条）
- 遗留: 已下载态查询、按钮切换、重下覆盖与 D 键行为需本地桌面确认（P-22）
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-04 会话 55

- 任务: 用户反馈（下载时可选择原图 / 较小 JPG），不占用 T-31
- 改动文件: `src/shared/models.ts`、`src/main/sites/moebooru.ts`、`src/shared/downloads.ts`、`src/shared/settings.ts`、`src/main/download/queue.ts`、`src/main/ipc/downloads-input.ts`、`src/main/ipc/settings-input.ts`、`src/main/ipc/registry.ts`、`src/renderer/pages/SettingsPage.tsx`、`src/renderer/components/{ImageViewer,InfoPanel}.tsx`、`src/renderer/components/ImageViewer.module.css`、`tests/unit/{downloads-queue,downloads-template,downloads-handlers,moebooru,settings}.test.ts`、`docs/{02-UX-Design,03-Architecture,07-Progress}.md`
- 决策: DR-051——站点只对 PNG 原图提供独立 JPEG 压缩版（`jpeg_url` 与 `file_url` 相同或 `jpeg_file_size` 为 0 视为无）；存在多个版本时下载按钮展开二级菜单（不做确认弹窗），单版本按钮直接下载；批量下载沿用设置页“批量默认格式”；队列按实际下载地址生成 URL/字节数/扩展名，JPG 任务不写 md5，已完成判定、复用与启动折叠加入 URL 维度
- 行为: PNG 原图帖子的“下载 / 重新下载”按钮带 `▾`，点击展开“原图 · 体积 / 较小 JPG · 体积”，选择后立即入队；点空白处或 Esc 收起菜单且不关闭查看器；选 JPG 后下载压缩版并落盘为 `.jpg`，原图仍可另行下载为 `.png`；JPG 原图帖子按钮直接下载；设置页新增“批量默认格式”
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 338/338 通过（39 个文件；新增队列 1 条、模板/纯函数 3 条、moebooru 归一化 1 条、handler 2 条，设置用例同步 `format`）
- 遗留: 二级菜单观感、体积展示、两种格式共存与批量默认格式需本地桌面确认（P-23）；JPG 任务因无独立 md5 不做完整性校验，依赖 `Content-Length` 与最终文件大小
- 下一步: T-31（错误态与空态），§6 NEXT 字段不变

### 2026-11-05 会话 56

- 任务: T-31（错误态与空态）
- 改动文件: `src/shared/error-guidance.ts`（新增）、`src/renderer/components/ErrorState.tsx`、`src/renderer/styles/index.css`、`src/renderer/pages/DownloadsPage.tsx`、`src/renderer/pages/SettingsPage.tsx`、`tests/unit/error-guidance.test.ts`（新增）、`docs/{02-UX-Design,05-Conventions,07-Progress}.md`
- 决策: DR-052——错误码→用户引导集中到 `describeErrorGuidance`（10 个 `ErrorCode` 全覆盖），`ErrorState` 统一渲染"原因 + 引导 + 错误码 + 折叠详情 + 重试"；下载页与设置页的首次读取失败改用 `Result` 信封 + `ErrorState` 重试，且下载页失败时不再同时渲染"暂无任务"空态；按 02 §2.5 约定暂不提供"打开诊断"（T-34 未实现），限流提示不新增事件通道而落在错误卡片
- 行为: 搜索/榜单/收藏沿用既有 `ErrorState` 复用了新引导行；下载页任务表读取失败显示卡片与重试，已有任务时仅显示行内错误；设置页读取失败显示卡片与重试，不渲染空白表单；五页空态文案分别区分"无搜索结果 / 该榜单暂时没有结果 / 还没有收藏 / 暂无下载任务"
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 344/344 通过（40 个文件；新增 error-guidance 6 条，覆盖全错误码、限流/CF/网络/解析/下载文案与"引导只取决于 code"）
- 遗留: 错误/空态观感、断网与 mock 429/CF 场景需本地桌面目视（P-24）；"打开诊断"与 429 退避期顶部气泡按 DR-052 暂不实现
- 下一步: T-32（打包验收），需纯净 Win11 人工环境；§6 NEXT 字段已同步

### 2026-11-05 会话 57

- 任务: T-32（打包验收）——已完成
- 改动文件: `docs/07-Progress.md`（DR-053、会话记录、§6）；重建 `release/` 产物（`pnpm build` + electron-builder，非源码改动）；恢复 `node_modules` 内 `better-sqlite3` 的 Electron ABI 二进制（非仓库文件）
- 决策: DR-053——11-03 旧产物 `app.asar` 仅 99 项、缺 `better-sqlite3`/`zod`/`@tanstack/react-virtual`，而 `out/main` 以 `externalizeDepsPlugin` 保留 `require(...)`，旧包不可用于验收；改用当前源码重建，产物为 `release/Bluu Setup 0.1.0.exe`（NSIS per-user）与 `release/Bluu 0.1.0.exe`（portable），旧名产物已删除；本机无 VS Build Tools 且 GitHub 预编译直连超时，改用 npmmirror 的 Electron ABI 130 预编译并以 `--config.npmRebuild=false` 打包
- 核查: 新 `app.asar` 971 项，含 `better-sqlite3`（37 条）、`zod`、`@tanstack/react-virtual`；`better_sqlite3.node`（1720320 字节）已解包到 `app.asar.unpacked\node_modules\better-sqlite3\build\Release\`；`productName` 为 Bluu，`nsis` per-user、`allowElevation=false`、可改目录、`deleteAppDataOnUninstall=false`
- 验证: `pnpm build` 通过（main/preload/renderer 均产出）；`pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 344/344 通过（40 个文件）
- 人工验收: 用户回报清单全部通过——纯净 Win11 x64 上 `Bluu Setup 0.1.0.exe` 免提权安装、启动、搜索→查看器→收藏→单张/批量下载→设置保存全流程、退出无残留进程、卸载无安装目录残留与自启动项
- 遗留: 应用图标未配置（使用 Electron 默认图标）、未配置代码签名（SmartScreen 有拦截提示，用户已接受并记录）；后续换机打包须先确认原生模块为 Electron ABI，否则 `@electron/rebuild` 会失败并删除二进制
- 下一步: T-33（文档同步），把 T-32 确认的产物名、依赖完整性、卸载数据口径与打包前置条件写回 02/03/06

### 2026-11-05 会话 58

- 任务: T-33（文档同步）——已完成
- 改动文件: `docs/02-UX-Design.md`、`docs/03-Architecture.md`、`docs/04-Task-Plan.md`、`docs/06-API-Contract.md`、`docs/07-Progress.md`（T-33 状态、DR-054、本记录、§6）；未改任何源码，未新增依赖
- 决策: DR-054——以当前代码为唯一事实源；已落地的设计保留并标注"当前实现"，未落地的保留为"设计目标"而非删除。02 修正外壳/预取/查看器动作/设置分组/主题默认/光斑与组件清单；03 修正技术选型、图片通道、目录树、适配器接口、迁移与表、缓存、IPC 通道、日志、构建配置、测试口径；06 补 `jpeg_url`/`jpeg_file_size` 与期榜端点并标注仅启用 yande；04 §5 逐项标注覆盖与未覆盖原因
- 核查（打包口径）: 产物 `release/Bluu Setup 0.1.0.exe` / `release/Bluu 0.1.0.exe`；`files: out/** + package.json`、`asarUnpack: '**/*.node'`、`nsis.perMachine:false`、`allowElevation:false`、`deleteAppDataOnUninstall:false`；运行时依赖 `better-sqlite3` / `zod` / `@tanstack/react-virtual` 必须进包；原生模块须 Electron ABI 130，否则需 VS Build Tools 或 npmmirror 预编译 + `--config.npmRebuild=false`
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 通过（40 个文件 / 344 条，含集成 6 条）
- 遗留: P-18 / P-23 / P-24 等人工目视项保持"待人工"；文档与实现不一致但无需改代码的项已按 DR-054 处理，未发现必须改代码才能消除的分叉
- 下一步: T-36（搜索历史，见 §6）

### 2026-11-05 会话 59

- 任务: T-36（搜索历史）——已完成
- 改动文件: 新增 `src/main/storage/migrations/006_search_history.sql`、`src/shared/search-history.ts`、`src/main/storage/search-history.ts`、`src/main/ipc/search-history-input.ts`、`src/main/ipc/handlers/search-history-{list,record,delete,clear}.ts`、`tests/unit/search-history.test.ts`、`tests/unit/search-history-handlers.test.ts`；修改 `src/main/storage/migrations/index.ts`、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/main/ipc/registry.ts`、`src/renderer/components/SearchBar.tsx`、`src/renderer/pages/SearchPage.tsx`、`src/renderer/styles/index.css`、`tests/unit/{db,history}.test.ts`、`docs/03-Architecture.md`、`docs/07-Progress.md`
- 决策: DR-055——迁移 006 建 `search_history`；`last_used_at` 取 `max(Date.now(), 当前最大值 + 1)`，同毫秒连续记录也能严格排序；`record`/`delete` 直接返回更新后的完整列表，避免渲染层二次 `list` 产生竞态；历史全局共享、不按站点分列
- 行为: 仅在 `runSearch` 首页成功后记录查询；输入框聚焦且为空时展示最近 50 条历史，点击整项填入并立即复用查询，单项 × 删除，顶部“清空”；空白查询不写入；记录按最近使用去重并自动截断到 50 条
- 验证: `pnpm lint` 通过；`pnpm typecheck` 通过（node + web）；`pnpm test` 364/364 通过（42 个文件；新增搜索历史 9 条、handler 11 条，`db`/`history` 迁移数断言同步为 6）
- 遗留: 历史下拉/清空观感、点击复用与 Esc 收起需本地桌面确认（P-25）；历史为全局共享，未来多站点启用后如需按站点隔离再评估
- 下一步: T-37（标签黑名单，见 §6）

### 2026-11-05 会话 60

- 任务: T-37（标签黑名单）——已完成可自动化部分；konachan 真实生效随 T-28
- 改动文件: `src/shared/content.ts`、`src/shared/models.ts`、`src/shared/settings.ts`、`src/main/ipc/settings-input.ts`、`src/main/ipc/handlers/{posts-search,posts-rankings,settings-set}.ts`、`src/main/ipc/registry.ts`、`src/renderer/pages/{SettingsPage.tsx,SettingsPage.module.css,SearchPage.tsx,RankingPage.tsx}`、`tests/unit/{content,settings,posts-search,posts-rankings}.test.ts`、`docs/02-UX-Design.md`、`docs/03-Architecture.md`、`docs/07-Progress.md`；未新增依赖
- 决策: DR-056——`ContentConfig` 扩展 `blacklist: string[]`，落盘前 trim + 小写、去重、上限 100，拒绝空串/含空白/含 `:`/以 `-` 开头的项；搜索在 R18 过滤后追加 `-tag` 并与用户显式 `-tag` 去重（大小写不敏感），追加数经 `PostPage#blacklistFiltered` 回传；榜单端点无 tags，按"先 R18 后黑名单"顺序本地过滤，计数只统计后者；`registry` 每次请求读配置，保存即生效
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 381/381 通过（42 个文件），新增内容归一化/拼接/命中、搜索黑名单、榜单本地过滤与计数归属、设置校验与落盘归一化等单测
- 遗留: konachan 两站真实生效需 T-28 后复验；黑名单编辑/保存观感、搜索与榜单提示计数需本地桌面目视（P-26）；黑名单不含收藏页过滤（04 仅要求搜索与榜单）
- 下一步: 无自动可领任务（见 §6），剩余 T-28 / T-34 / T-35 均需真实网络或发布凭据，须用户指定后再领

### 2026-11-05 会话 61

- 任务: T-28（konachan 适配 + 榜单入口）——用户指定；已完成可自动化部分，真实网络待人工复验
- 改动文件: 新增 `src/main/sites/adapters.ts`；删除 `src/main/sites/yande.ts`；修改 `src/main/ipc/handlers/{posts-search,posts-rankings,tags-suggest}.ts`、`src/main/ipc/registry.ts`、`src/shared/constants.ts`、`src/shared/sites.ts`、`src/renderer/index.html`（CSP）、`src/renderer/App.tsx`、`src/renderer/pages/{SearchPage,RankingPage}.tsx`、`tests/unit/{posts-search,posts-rankings,tags-suggest}.test.ts`、`docs/{02-UX-Design,03-Architecture,04-Task-Plan,06-API-Contract,07-Progress,09-Test-Cases}.md`；未新增依赖
- 决策: DR-057——两站共用 `moebooru.ts`，新增 `getSiteAdapter(site)` 按站点缓存单例并注入 HTTP 通道；三个 handler 改为注入 `getAdapter(site)`，`posts:rankings` 移除仅 yande 限制；搜索页/榜单页各加站点切换，切站按当前关键词/榜单参数重载；榜单标签跳搜索经 `App#searchRequest` 携带来源站点；`IMAGE_HOSTS` 与 CSP 补 `konachan.com` / `assets.konachan.com` / `files.konachan.com`；下载沿用 `post.site` 无需改动
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 383/383 通过（42 个文件；`posts-search` 新增按站点路由 1 条、`posts-rankings` 站点限制用例改为路由用例、`tags-suggest` 新增路由 1 条）
- 遗留: P-02（字段结构）与 P-04（图片 cookie）只能在真实网络下复验；P-27 覆盖切站重搜/重载、两站榜单与下载、标签跳搜索站点归属；若 konachan 预览或原图使用未列入 `IMAGE_HOSTS` 的 host，需按实测补充映射
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 需真实网络或发布凭据，须用户指定后再领

### 2026-11-05 会话 62

- 任务: 用户报障——搜索加载慢、下载提示「加入下载队列失败」；非 07 看板任务，按现场证据定位并修复
- 排查结论: ① 下载失败根因是 `config.json#downloads.destinationDir = H:\1\`，本机无 H 盘，`mkdirSync` 抛 ENOENT 被 `downloads:enqueue` 通用 catch 吞掉；② 搜索慢为网络层：curl 实测 yande `/post.json` 单次约 2.3s、`assets.yande.re` 预览单张约 2.6s，Chromium 单域并发约 6，首屏 30 张预览需十余秒；konachan 直连 403，首次搜索需 CF 挑战（06 §1 约 11s）。T-28 未引入额外请求，适配器路由为单次调用
- 改动文件: `src/main/download/queue.ts`（`mkdirSync` 兜底为 `DOWNLOAD` 可读错误）、`src/main/ipc/handlers/settings-set.ts`（保存前校验下载目录可创建）、`tests/unit/downloads-queue.test.ts`（新增目录不可用用例）、`docs/{02-UX-Design,07-Progress}.md`；未新增依赖
- 决策: DR-058——保存与入队两处都校验/兜底：保存时拦截错误目录，运行期盘符离线时入队给出可读原因，不再显示通用失败
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过；`pnpm test` 384/384 通过（42 个文件，新增 1 条目录不可用例）
- 遗留: 用户需在设置页把下载目录改到本机存在的盘（如 `D:\` 或 `E:\`）后重试；若搜索慢发生在 konachan，属首次 CF 挑战与真实网络延迟，待 T-34 诊断页可视化；P-27 两站全流程仍需人工复验
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 63

- 任务: 用户现场反馈延续——按用户明确要求「下载先检查下载路径是否有效，无效就弹出路径选择框」实现入队前目录校验；并确认搜索慢仅发生在 konachan（首次 CF 挑战约 11s，后续正常，未改代码）
- 改动文件: 新增 `src/main/download/destination.ts`；修改 `src/main/ipc/handlers/downloads-enqueue.ts`、`src/main/ipc/registry.ts`（原生目录框接线、写回配置并热更新队列）；新增 `tests/unit/download-destination.test.ts`；修改 `tests/unit/downloads-handlers.test.ts`、`docs/{02-UX-Design,03-Architecture,07-Progress,09-Test-Cases}.md`；未新增依赖
- 决策: DR-059——guard 在入参校验之后执行：默认目录（配置为空）缺失时自动 `mkdir` 后放行；自定义目录不存在或指向文件时弹 `dialog.showOpenDialog`（`openDirectory` + `createDirectory`，当前目录可用时作为 `defaultPath`）；选中后创建目录、写回 `config.json` 并由 `queue.updateConfig` 热更新再继续入队；取消返回 `DOWNLOAD`「未选择下载目录，下载未开始」且不入队；选中后保存失败返回 `CONFIG`
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 391/391 通过（43 个文件，新增 `download-destination` 6 条与入队前 guard 拦截 1 条）
- 遗留: P-28 需窗口内目视目录框与取消/选中行为；P-27 两站全流程仍需真实网络人工复验；konachan 首次搜索慢属 CF 挑战，如需可观测性由 T-34 诊断页覆盖
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 64

- 任务: 用户报障——`pnpm dev` 关闭窗口后进程不退出，需 Ctrl+C；非看板任务，按代码定位
- 排查结论: konachan 首次请求会创建隐藏 CF 挑战窗口（`network/cloudflare.ts#ensureWindow`），该窗口只在 `will-quit` 销毁；主窗口关闭后仍有窗口存活，`window-all-closed` 不触发，`app.quit()` 不执行，主进程与 `electron-vite dev` 持续等待。仅访问过 konachan 才复现，属 T-28 引入的回归；yande 单站时关窗可正常退出
- 改动文件: `src/main/index.ts`（主窗口 `closed` 时非 darwin 平台主动 `app.quit()`，并带注释说明原因）、`docs/07-Progress.md`；未新增依赖，未改 CF 通道
- 决策: DR-060——单窗口应用在 Windows/Linux 上以"关闭主窗口 = 退出应用"为准，不依赖 `window-all-closed`；`app.quit()` 会关闭隐藏 CF 窗口并走 `will-quit`（销毁通道 + 关库）；macOS 保持关窗常驻；原 `window-all-closed` 兜底保留
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 391/391 通过（43 个文件）
- 遗留: P-29 需窗口内确认关窗退出与下载中关窗行为（本执行环境 GUI 崩溃，见 P-08）；konachan 首搜慢与两站全流程仍待 P-27
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 65

- 任务: 用户现场反馈——下载前选了目录，完成后文件仍在默认目录；要求下载时目录无效弹框并同步设置，设置页改目录也要弹框且从当前可用目录打开
- 排查结论: guard 本身有效（写回配置 + `updateConfig` 在入队前完成）；文件仍在旧目录的根因是 DR-042 复用——已完成任务按 `task.url` 命中后直接跳过，或重新下载沿用旧 `destPath`。另：设置页常驻挂载，`settings:get` 只在加载时读取，guard 写回后界面不刷新
- 改动文件: `shared/ipc-contract.ts`（`settings:pick-download-dir`、`settings:destination-changed` 与相关类型）、`preload/index.ts`、`main/ipc/handlers/settings-pick-download-dir.ts`（新增）、`main/ipc/registry.ts`（注册选择框、写回后广播）、`main/download/queue.ts`（目录归属判断与已完成任务迁移）、`main/storage/downloads.ts`（`relocate`）、`renderer/pages/SettingsPage.tsx` + `.module.css`（「选择文件夹…」、订阅广播、提示）；新增 `tests/unit/settings-pick-download-dir.test.ts`，扩充队列与存储单测；02 §7.4/§7.5、03 §7、09 TC-37/38/39；未新增依赖
- 决策: DR-061（设置页选择框 + 广播同步草稿：草稿目录可用时作 `defaultPath`，空/不可用回退配置目录或默认目录；选择结果进草稿，沿用保存按钮）；DR-062（已完成任务不在当前下载目录时迁到新目录重新下载，旧文件保留；运行中/排队/暂停任务仍保持原目录，DR-040 不变）
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 398/398 通过（44 个文件，新增 `settings-pick-download-dir` 5 条、队列迁移 1 条、`relocate` 存储 1 条）
- 遗留: P-30 需窗口内确认（选择框起始目录、取消、保存生效、广播同步、迁移落点）；P-28/P-29 仍待窗口内验证
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 66

- 任务: 用户报障——删掉设置里的下载文件夹后，重新下载/普通下载均失败且不弹选择路径；非看板任务，按现场取证修复
- 排查结论: DB 中两次失败任务 `bytes_done=0`、`dest_path` 在 `C:\Users\10217\Pictures\Camera Roll\yande\`，`error` 为通用「下载失败，请重试」；两个原图 URL 经 hostmap 直连 curl 均 200 且完整下载；Electron 内用同一 `persist:yande` 会话复测 `ses.fetch` 206 + Content-Length 正常 → 失败不在网络。删掉 `Camera Roll` 后 Windows 立即重建同名"已知文件夹"（含 `desktop.ini`），`isUsableDirectory` 只判断"存在且是目录"→ guard 放行、不弹框；写盘阶段打开 `.part` 抛 `EPERM`/`ENOENT`（Electron 实测复现），被 run 的通用 catch 吞成"下载失败，请重试"（DR-063）
- 改动文件: `src/main/download/destination.ts`（`isUsableDirectory` 加可写探测）、`src/main/download/queue.ts`（`requestDestination` 选项、写盘前 `mkdirSync`、文件系统错误分类、`repairDestination` 迁移重排）、`src/main/ipc/registry.ts`（抽取 `applyDownloadDestination`、接线弹框且并发失败复用同一次选择）、`tests/unit/downloads-queue.test.ts`（新增 2 条）；02 §7.5、03 §8、09 TC-40/41、07 本行；未新增依赖
- 决策: DR-063——目录"可用"= 存在 + 是目录 + 可写；写盘时目录失效不直接落通用失败，而是弹目录选择框，选中后 `relocate` 到新目录（保留原子路径）并重排，取消才失败且文案为"下载目录不可用，请重新选择目录"；网络/HTTP 错误不弹目录框
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 400/400 通过（44 个文件，新增队列迁移重排与取消失败 2 条）
- 遗留: P-31 需窗口内确认（删目录后弹框、下载中删目录迁移、取消失败文案、网络失败不弹框）；P-28/P-29/P-30 仍待窗口内验证
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 67

- 任务: 用户要求「选择了路径就不需要再生成 `yande` 文件夹，直接把图片保存在设置的路径下」；非看板任务，按现场反馈调整默认命名模板
- 改动文件: `src/shared/downloads.ts`（`DEFAULT_DOWNLOAD_TEMPLATE` 改为 `{md5}.{ext}`、新增旧默认集合迁移、`compactDownloadPath` 去掉站点层）、`tests/unit/downloads-template.test.ts`（默认值与迁移/回落用例）、`tests/unit/downloads-queue.test.ts`（DR-062 迁移断言与 DR-063 两条用例改为平铺路径）；02 §7.3/§7.5、03 §8、09 TC-42、07 本行；未新增依赖
- 决策: DR-064——默认模板 `{md5}.{ext}`，下载文件直接平铺在设置的下载目录；`config.json` 中 DR-043 旧默认与更早多层默认在 `parseDownloadConfig` 读取时统一迁移，用户自定义模板保持原样；既有 `done` 任务仍按 DR-062 只在更换目录时迁移，旧目录已下载文件不移动、不删除
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 400/400 通过（44 个文件）
- 遗留: P-31/P-30 仍待窗口内验证（改为平铺后需确认新下载不再出现 `yande` 子目录）
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 68

- 任务: 用户报障——点击关闭 18R 后整页向上平移约半屏、顶部导航不可见、下半部分空白；非看板任务，按现场取证修复
- 改动文件: `src/renderer/components/Switch.module.css`（`.root` 增加 `position: relative`）；02 §9 与变更记录、09 TC-43 / M4 人工项、07 本行；未改业务逻辑、未新增依赖
- 决策: DR-065——隐藏 checkbox 的包含块必须是 label；设置页长内容由 `.page` 自身滚动；`body{overflow:hidden}` 不阻止聚焦引起的文档滚动，修复靠消除文档级溢出而不是重设滚动位置
- 验证: Electron 33 无窗口布局探针（`show:false` + `executeJavaScript`）对比：修复前文档 `scrollHeight 865` / `clientHeight 638`，聚焦隐藏 checkbox 后 `scrollTop 227.2`（整页被滚走）；修复后 `scrollHeight == clientHeight == 638`、`scrollTop` 保持 0，仅设置页容器滚动；`pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 400/400 通过（44 个文件）
- 遗留: P-32 需窗口内确认（关闭 R18 / Tab 聚焦开关后整页不位移、设置页内部滚动正常、其它页面无回归）；P-28/P-29/P-30/P-31 仍待窗口内验证
- 下一步: 无自动可领任务（见 §6），剩余 T-34 / T-35 须用户指定后再领

### 2026-11-05 会话 69

- 任务: T-35 自动更新（用户指定领取）。目标：检查更新、下载、重启生效；本次完成客户端可自动化部分，真实升级链路留人工验证
- 改动文件: `package.json`（新增依赖 `electron-updater@6.8.11`）、`electron-builder.yml`（`publish.provider=github`，owner `LeDonX` / repo `bluu-wallpaper`）、`src/shared/updates.ts`（新增：`UpdateState` / 进度与 notes 归一化纯函数）、`src/main/update/service.ts`（新增：状态机与 electron-updater 事件接线）、`src/shared/ipc-contract.ts`、`src/preload/index.ts`、`src/main/ipc/registry.ts`（服务实例化、`updates:status` 广播与 4 个 handler）、`src/renderer/pages/SettingsPage.tsx` + `.module.css`（「关于与更新」分组、进度条与按钮）、`tests/unit/updates.test.ts`（新增 14 条）；02 §9、03 §3/§7/§10、04 §4/§5、09 TC-44/45、07 本行；未改与任务无关的代码
- 决策: DR-066——仅 NSIS 安装版支持自动更新：`app.isPackaged=false`（pnpm dev）或存在 `PORTABLE_EXECUTABLE_DIR`（portable）时返回 `unsupported` 并给出中文原因，不抛错；`autoDownload=false`、`autoInstallOnAppQuit=true`、`allowPrerelease=false`，检查/下载/安装全部由设置页手动触发，状态经 `updates:status` 全量广播；安装调用 `quitAndInstall(false, true)`；检查或下载进行中重复点击不并发；异常只落 `error` 状态与中文提示，不阻塞其它功能
- 验证: `pnpm lint` 通过（`eslint .`，无输出）；`pnpm typecheck` 通过（node + web）；`pnpm test` 414/414 通过（45 个文件，新增 `updates.test.ts` 14 条）；`pnpm build` 通过（main 133.08 kB / preload 5.65 kB / renderer 411.59 kB）
- 发布测试（会话 69 后续）: 用户级 `GH_TOKEN` 已验证（`LeDonX`，仓库 push/admin=true）；`package.json` 升到 `0.1.1`，用 `pnpm exec electron-builder --win --publish always --config.npmRebuild=false` 打包并上传，GitHub Release `v0.1.1` 已从 Draft 发布为正式版，资产含 `Bluu-Setup-0.1.1.exe`、blockmap、`latest.yml`（`version: 0.1.1`），`resources/app-update.yml` 指向 `LeDonX/bluu-wallpaper`；另用当前代码打了一个 `0.1.0` 测试安装包（`release-0.1.0-test/`，已加入 .gitignore）并以 `/S` 安装到 `%LOCALAPPDATA%\Programs\Bluu`，已确认安装包内含 `updates:*` 通道与 `electron-updater`，应用已启动等待人工点击验证
- 环境限制: 本机无 Visual Studio，`pnpm add electron-updater` 重装依赖后 `better-sqlite3` 的 Electron ABI 二进制被清除，`electron-builder` 默认 `npmRebuild` 会在 node-gyp 阶段失败；已从旧 `release/win-unpacked/resources/app.asar.unpacked` 恢复二进制并使用 `--config.npmRebuild=false`，已写入 03 §10
- 遗留: TC-45 只剩窗口内点击验证——安装版 `0.1.0`（含本次更新代码）已启动，需依次点「检查更新」（应发现 v0.1.1）→「下载更新」→「重启并安装」，升级后再检查应为"已是最新版本"；断网、`pnpm dev`、portable 三种"不支持/失败"表现也需目视；未签名安装包可能触发 SmartScreen；P-28~P-32 等既有待人工项保持原状
- 下一步: 看板仅剩 T-34（诊断页），其验收依赖真实网络探测与窗口内目视，按规则停止并等用户指定（见 §6）

---

## 6. 下一步（自动接续）

> 新会话按以下字段自动领取任务；字段缺失、与 §2 看板冲突、依赖未满足时，**停止并询问，不要猜**。

- **NEXT_TASK**: 无 —— T-35 已于会话 69 完成客户端部分，看板仅剩 T-34（诊断页），其验收依赖真实网络探测与窗口内目视，等待用户指定
- **NEXT_REASON**: T-35 的可自动化部分已完成并置 `done`（DR-066），剩余 TC-45 真机升级属于人工验证。看板中没有依赖满足且可离线验收的 `todo`：T-34 需要真实 DNS/TCP/TLS 探测结果与窗口内目视。按 §1 规则，验收只能人工完成时必须停止并说明，不猜、不顺手改做别的任务
- **NEXT_ACCEPTANCE**: 若用户选 T-34：六项诊断（DNS/TCP/TLS/代理/CF/磁盘）可运行并复制报告，需真实网络与窗口内目视
- **NEXT_DEPENDS**: T-34 → 真实网络探测 + 日志/诊断基础（03 §9 尚未落地）
- **NEXT_MANUAL**: P-33（DR-066 设置页「关于与更新」：安装版点检查更新显示版本/进度并重启安装、无新版显示"已是最新版本"、断网只提示失败、`pnpm dev` 与便携版显示"不支持"且按钮禁用）需窗口内确认；TC-45 还需先发布更高版本 GitHub Release（`latest.yml` + `Bluu Setup x.y.z.exe` + blockmap）后用安装版完成一次真实升级；P-32（DR-065 关闭 R18 或 Tab 聚焦开关后整页不位移、顶部导航可见、设置页内容只在自身容器内滚动、其它页面无回归）需窗口内确认；P-31（DR-063 删掉下载目录后点下载应弹目录框、下载中删目录弹框后迁移并完成、取消失败文案为"下载目录不可用，请重新选择目录"、网络失败不弹目录框）需窗口内确认；P-30（DR-061/062 设置页目录选择框、下载写回后的设置同步、切换目录后重新下载迁到新目录）需窗口内确认；P-29（DR-060 关窗即退出：访问过 konachan 后关窗进程应结束、`pnpm dev` 回到命令行；未访问 konachan 同样退出）需窗口内确认；P-28（DR-059 入队前目录选择框：无效目录弹框、取消不入队、选中写回并继续入队、默认目录自动创建）需窗口内目视；P-27（konachan 两站搜索/榜单/下载、切站重搜与标签跳搜索站点归属）与 P-02/P-04（字段结构、图片 cookie）需本地桌面复验；P-26（T-37 黑名单设置页编辑、保存归一化、搜索/榜单过滤与计数提示，含 konachan 生效）需窗口内目视；P-18 / P-23 / P-24 / P-25 等既有待人工项保持原状
- **NEXT_BLOCKED_NOTE**: 当前无可自动领取任务。下一会话必须先向用户确认是否选 T-34，不得自行挑选；若用户未指定，只做文档/人工清单整理，不改业务代码

后续顺序（按用户指定的优先级推进，并同步更新本字段）：

1. ~~**T-37 标签黑名单**~~：已于会话 60 完成（DR-056），konachan 真实生效已具备代码路径，待 P-26/P-27 复验
2. ~~**T-28 konachan 适配**~~：已于会话 61 完成可自动化部分（DR-057），整体验收需 P-02/P-04/P-27 真实网络人工复验
3. ~~**T-35 自动更新**~~：已于会话 69 完成客户端流程（DR-066）；TC-45 真机升级与 P-33 观感待人工验证
4. **T-34 诊断页**：P1 最后一项，需真实网络探测结果与窗口内目视，等用户指定后领取

> T-03 结论：`pnpm dist` 产出 NSIS per-user（免管理员）与 portable 两种产物；`release/win-unpacked` 产物已烟测启动窗口与单实例；图标/签名与纯净 Win11 安装验收待人工。**会话 57 起产物改名为 `release/Bluu Setup 0.1.0.exe` / `release/Bluu 0.1.0.exe`（DR-030 的 productName），11-03 旧名产物已按 DR-053 删除。**

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
> T-19 结论：`shared/badges.ts#resolveBadges` 输出固定顺序 ✓→↓→★ 的角标描述（含 `aria-label` 文案与字形），无状态时返回空数组；`renderer/components/BadgeStack.tsx` 只在有数据源时渲染，当前仅 `SearchPage → PostGrid → PostCard` 传 `viewed`，↓/★ 留待 T-23/T-21 接线。角标 18×18、圆角 4、半透明底，颜色取 `--muted/--success/--warning`；挂在卡片根层，已看的透明度与饱和度只作用于缩略图。`PostCard` 的 rating 色点按 02 §2.2 移入信息条右下角与评分同组，右上角让位状态角标。
> T-20 结论：`shared/posts.ts#filterUnviewed` 生成可见列表，`posts` 始终保留全部已加载数据；`advanceFillProgress` / `isAutoFillExhausted` 负责"连续 5 页无未看项"的计数，空页不改变进度（DR-031）。`PostGrid` 在 `scrollHeight - clientHeight < 300` 时经 `onUnderfilled` 主动上报（过滤后无滚动事件）；`SearchPage` 的 `handleUnderfilled` 只在开关开启且未达上限时调 `loadMore(true)`，仅自动补页参与计数。顶部显示"已过滤 X 张已看"，达到上限后显示"已跳过 N 张已看过的图片"；关闭开关不清空 `posts`，列表即时恢复完整。新页追加前先 `views:list` 恢复已看，避免隐藏模式下闪现。新增通用 `Switch`（02 §14.1 已登记）。
> T-21 结论：迁移 003 建 `favorites(site, post_id, added_at)` 与 `idx_favorites_added`；`main/storage/favorites.ts#createFavoritesStore` 的 `toggle` 在同一事务内 upsert `posts` 快照并写收藏，`list` 联查快照并跳过损坏 `tags_json`；`favorites:toggle` 入参 `{site, post}`、`favorites:list` 支持标签筛选与 `added`/`score` 排序，全部本地完成（DR-032）。渲染层 `PostCard` 左上角 ☆/★ 切换、`ImageViewer` 信息栏按钮与 `F` 键、`SearchPage` 收藏集合乐观更新失败回滚、`FavoritesPage` 站点 tab + 筛选 + 排序 + 查看器；`App` 增加搜索/收藏最小导航（T-38~ 外壳落地前临时）。
> T-22 结论：`main/storage/history.ts#createHistoryStore` 在单个 `BEGIN IMMEDIATE` 事务内先计数再删除 `post_views` 与 `favorites`（`site` 缺省为全部），返回 `{views, favorites}`，保留 `posts` 快照、`tag_cache` 与迁移记录；`views:clear` 经 zod 校验（`site` 可选）并返回 `Result<{site, clearedViews, clearedFavorites}>`，成功后主进程向所有窗口广播 `views:updated`（DR-033）。渲染层新增 `SettingsPage` 最小入口（当前站点 yande.re / 全部站点 + 二次确认卡片 + 清除条数提示），`App` 改为搜索/收藏/设置三页常驻挂载（`hidden` 切换）；搜索页订阅事件后清空已看与收藏集合并重置补页计数，收藏页订阅后重读本地列表，实现清除后即时刷新（P-12 待本地桌面确认）。
> T-23 结论：迁移 004 建 `download_tasks`；`shared/downloads.ts` 固化 6 个状态、迁移表与 4 个 control 动作，`main/download/queue.ts` 按站点独立并发（`config.json#downloads.concurrency`，1–6，默认 3），以任务表 FIFO 调度，流式写 `<dest_path>.part` 并经 `verifying → done` 落盘（DR-034）。`downloads:enqueue/control/list` 经 zod 校验并返回 `Result`，`downloads:progress` 按任务 200ms 节流、状态变化强制上报；暂停保留 `.part`、取消删除任务行与文件，进程重启把 `downloading/verifying` 重置为 `queued` 自动续跑。查看器 `D` 键与信息栏"下载"按钮就地展示状态与失败原因；T-24 前恢复/重试从 0 重下且未做 md5（P-13 待本地桌面确认）。
> T-24 结论：`DownloadTransport` 改为透传 `headers`（`downloadTransport` 与图片读取分离），恢复/重试读 `.part` 大小发 `Range`，206 追加、200 回退重下、416 视为完成；`bytes_done` 在调度与恢复时先回填；修复"暂停后立刻恢复"被旧协程回写 `paused` 的竞态（DR-035）。真实图床 206 支持待按 P-14 复验。
> T-26 结论：新增"下载"页签，`DownloadsPage` 首次 `downloads:list` + 订阅 `downloads:progress` 增量合并（不轮询），`TaskList`/`TaskRow`/`ProgressBar` 展示进度与失败原因，并按状态提供暂停/恢复/重试/取消（`downloads:control`）；查看器信息栏状态文案下同步显示进度条（DR-036）。该页提前于 T-25 落地，文件名仍为占位 `{postId}.{ext}`，md5 完成态待 T-25；窗口内观感待 P-15。
