# LePic API 契约

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 采集日期 | 2026-11-03 |
| 数据来源 | yande.re 实测；konachan.com 受 Cloudflare 拦截，仅记录挑战响应；第三方站点按公开接口文档记录 |
| Fixtures | `booru-desktop/fixtures/` |

> 本合同是适配器实现的唯一依据。字段变更必须先改本文，再改代码。

> **启用状态（2026-11-05/T-28）**：yande / konachan 均已启用，`src/main/sites/adapters.ts#getSiteAdapter(site)` 按站点复用 `moebooru.ts`，konachan 走 CF 通道（DR-010 / DR-057）。konachan 的 Post/Tag 字段结构仍未实测（P-02），本合同第 2/3 节中 konachan 字段仍按"与 yande 相同"的预期记录，实测后须替换 `fixtures/konachan/` 并更新本合同。
>
> **多源扩展（2026-11-06/T-48~T-53）**：wallhaven / bing 已接入，走独立适配器并统一为 `AnySiteId`（DR-070 / DR-073 / DR-076）；两站契约见第 7 节。pexels 已于 DR-084 移除。

---

## 1. 基础信息

| 项 | yande.re | konachan.com |
|---|---|---|
| Base URL | `https://yande.re` | `https://konachan.com` |
| 架构 | moebooru | moebooru（同源分支） |
| 鉴权 | 无 | 无 |
| Cloudflare | 无 | 有（`Just a moment` 挑战） |
| API 格式 | JSON 数组 | 预期相同（未实测） |

**必须覆盖的域名与 IP（实测）**

| 域名 | IP | 用途 | 备注 |
|---|---|---|---|
| `yande.re` | `198.251.89.183` | 主站 / API | 证书 `*.yande.re` |
| `files.yande.re` | `198.251.88.76` | 原图、sample | HTTP 200 正常，沙箱环境下载较慢 |
| `assets.yande.re` | `198.251.89.183` | **预览图** | 与主站同 IP；旧的 `198.98.54.92` 已不可用 |
| `konachan.com` | `104.21.4.105` / `172.67.131.252` | 主站 / API | Cloudflare，IP 会变 |
| `files.konachan.com` | `104.21.4.105` | 图片 | Cloudflare |

> **图片热链校验（2026-11-03 实测）**：`files.yande.re` 收到非本站 `Referer`（如开发环境的 `http://localhost:5173/`）时返回 `307` 并跳转到 `https://yande.re/post/show?md5=…`（`text/html`），`<img>` 解码失败；不带 Referer 返回 `200 image/jpeg`。因此渲染层所有远程图片必须声明 `referrerPolicy="no-referrer"`（见 07 DR-025）。`assets.yande.re` 预览图当前不校验 Referer，但仍统一抑制。

---

## 2. 通用请求参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `tags` | string | 空格分隔，支持 `-tag`、`rating:s/q/e`、`score:>=N`、`order:`、`id:` |
| `limit` | int | 每页数量，**最大 100** |
| `page` | int | 页码，从 1 开始 |

---

## 3. Post 字段（实测样本）

样本：`fixtures/yande/posts-safe.json`（2 条，`rating:safe`）

| 字段 | 类型 | 实测值 | 说明 |
|---|---|---|---|
| `id` | number | `1271989` | 站内唯一 ID |
| `md5` | string | `4d3b8a5d...` | 文件 md5，用于去重与校验 |
| `rating` | string | `s` | **单字符**：`s` / `q` / `e`，需映射为 safe/questionable/explicit |
| `score` | number | `1` | 评分，可为负 |
| `tags` | string | `koh_(minagi_kou) police_uniform selfie` | 空格分隔，含括号与下划线 |
| `file_url` | string | `https://files.yande.re/image/...` | 原图 |
| `sample_url` | string | `https://files.yande.re/sample/...` | 大图预览 |
| `preview_url` | string | `https://assets.yande.re/data/preview/...` | 缩略图 |
| `jpeg_url` | string | 可能与 `file_url` 不同（站点的较小 JPG 压缩版）；JPG 原图帖与 `file_url` 相同 | 仅当与 `file_url` 不同且 `jpeg_file_size > 0` 时视为独立格式（07 DR-051；P-23 待实测数值） |
| `jpeg_file_size` | number | `jpeg_url` 对应字节数；无独立版本时为 0 | JPEG 变体任务的预估体积来源 |
| `width` / `height` | number | `3000` / `3950` | 原图尺寸 |
| `sample_width` / `sample_height` | number | `1139` / `1500` | sample 尺寸 |
| `preview_width` / `preview_height` | number | `114` / `150` | 缩略图尺寸 |
| `file_size` | number | `917952` | **字节** |
| `sample_file_size` | number | `306855` | 字节 |
| `file_ext` | string | `jpg` | 扩展名，不含点 |
| `created_at` | number | `1793668940` | **epoch 秒** |
| `updated_at` | number | `1793669007` | epoch 秒 |
| `status` | string | `active` | 可能为 `pending` / `flagged` / `deleted` |
| `source` | string | 推文链接 | 可为空字符串 |
| `author` | string | `blooregardo` | 上传者 |
| `has_children` | boolean | `false` | 是否有子图 |
| `parent_id` | number\|null | `null` | 父图 |
| `frames` | array | `[]` | 动图帧，通常空 |
| `is_pending` / `is_held` | boolean | `false` | 审核状态，非 `active` 的应过滤 |

**适配器归一化必须做的四件事**

1. `rating`：`s→safe`、`q→questionable`、`e→explicit`
2. 时间：`created_at` × 1000 得到 epoch ms
3. 过滤：`status !== 'active'` 的条目丢弃
4. JPEG 变体：`jpeg_url` / `jpeg_file_size` 缺失时按 `''` / `0` 处理；`jpeg_url === file_url` 或大小为 0 表示没有独立压缩版（07 DR-051）

---

## 4. Tag 字段（实测）

样本：`fixtures/yande/tags.json`（`name=hatsune*`）

| 字段 | 类型 | 实测值 | 说明 |
|---|---|---|---|
| `id` | number | `49386` | 标签 ID |
| `name` | string | `hatsune` | 标签名 |
| `count` | number | `3` | 作品数（可能为 0） |
| `type` | **number** | `4` | 0=general、1=artist、3=copyright、4=character（moebooru 约定） |
| `ambiguous` | boolean | `false` | 是否歧义 |

> `type` 是整数不是字符串，UI 需映射为显示名；未识别的 type 按 general 处理。

---

## 5. 端点与实测结果

| 端点 | 实测 | 结果 |
|---|---|---|
| `GET /post.json?tags=rating:safe&limit=3` | 200 | 返回数组，**实际按 limit 返回 2 条**（样本中存在 2 条 safe 图） |
| `GET /post.json?tags=rating:safe&limit=100&page=1001` | 200 | **仍返回数据**，未观察到 page 上限；但深度翻页仍建议用 `id:` 游标以减少偏移成本 |
| `GET /post.json?tags=id:1271989&limit=1` | 200 | 精确命中 1 条，`id:` 语法有效 |
| `GET /tag.json?name=hatsune*&limit=5` | 200 | 返回 5 条，前缀通配有效 |
| `GET /post/popular_recent.json?period=1d&limit=3` | 200 | **返回 40 条，`limit` 被忽略**；`period` 是否生效未验证，实现时按 40 条处理并本地分页 |
| `GET /post.json?tags=date:2026-10-20 order:score&limit=100&page=1` | 200 | 日榜：该日共 83 条，`page=2` 为空；`date:` 单日 + `order:score` 排序正确，替代 `popular_by_day`（DR-092） |
| `GET /post.json?tags=date:2026-10-19..2026-10-25 order:score&limit=100&page=1` | 200 | 周榜：`page` 1/2/3 各返回 100 条，区间可继续翻页（DR-092） |
| `GET /post.json?tags=date:2026-10-01..2026-10-31 order:score&limit=100&page=1` | 200 | 月榜：`page` 1/2/3 各返回 100 条，区间可继续翻页（DR-092） |
| `GET /comment.json?post_id=` | 未测 | 首版不使用 |
| `GET /post.json` 无匹配 | 未测 | 预期 200 + `[]`，适配器需按空数组处理 |

**重要行为**

- 空结果返回 `200` + `[]`，不是 404
- `popular_recent` 返回固定 40 条，不能依赖 `limit`
- **`popular_by_day/week/month` 实测固定返回 40 条且忽略 `limit`/`page`**（2026-11-06 会话 94 实测，两个 `page` 的字节与首尾 id 完全相同），因此期榜改用 `/post.json` 的 `date:` 单日/区间 + `order:score`（DR-092）；周榜的区间起点为所选 ISO 周的周一
- 搜索页首页默认使用 `popular_recent?period=1d`（单页 40 条，翻页禁用）；首页切到日榜时改用 `date:` 单日查询——konachan 在当天未结束时可能只返回 1 条 pending 作品，R18 过滤后为空，因此默认热门而非日榜（DR-087 / DR-088 / DR-092）
- `page` 参数在 1001 仍有效；不保证更大页码，长列表统一走 `id:<lastId>` 游标

---

## 6. konachan.com 的 Cloudflare 行为

实测（`fixtures/konachan/challenge-403.html`、`challenge-headers.txt`）：

```
HTTP/2 403
content-type: text/html; charset=UTF-8
server: cloudflare
<title>Just a moment...</title>
```

判定规则（适配器与网络层共用）：

```ts
const isChallenge = (status: number, body: string) =>
  status === 403 && /Just a moment|cf-chl-|__cf_chl/i.test(body);
```

处理：

1. 命中 → 进入 CF 状态机，隐藏窗口获取 `cf_clearance`
2. 重试一次；仍 403 → 返回 `CF_CHALLENGE`
3. 失败后 UI 提示"手动验证"

**本地验证结论（2026-11-03，详见 07-Progress DR-010 / DR-011）**

- 隐藏窗口加载 `https://konachan.com/` 可自动通过托管挑战；全新分区首次访问约 **11s** 取到 `cf_clearance`
- **`ses.fetch` 不可用于 konachan**：同一 persist session 已持有 `cf_clearance` 时，连续请求仍返回 403 挑战页
- 可用通道：隐藏窗口页内 `fetch`（或 `loadURL`）返回 200 + JSON
- 不要覆盖 UA：覆盖为 Chrome UA 会与 Client Hints 版本不一致，挑战无法通过

> konachan 的 Post/Tag 字段结构**未经实测**，按与 yande 相同处理；首次在本地网络跑通后，必须用真实响应替换 `fixtures/konachan/` 并更新本合同。

---

## 7. 第三方站点契约（wallhaven / bing，2026-11-06）

两站均通过 `SiteAdapter` 接入（03 §5，DR-070），统一遵循第 3 节的 Post 归一化口径；差异如下。

### 7.1 wallhaven（T-50 / DR-073）

| 项 | 内容 |
|---|---|
| Base URL | `https://wallhaven.cc` |
| 鉴权 | `X-API-Key: <key>`（`config.json#providers.wallhavenApiKey`，设置页掩码编辑，DR-071） |
| 端点 | `GET /api/v1/search` |
| 分页 | 仅 `page`（从 1 开始）；`lastId` 游标不适用，收到 `lastId` 时按第 1 页 |
| 能力 | 搜索 + 空查询首页（24 小时 toplist，DR-085）；无榜单 / 标签联想 |

请求参数映射（`src/main/sites/wallhaven.ts`）：

| 参数 | 来源 | 说明 |
|---|---|---|
| `q` | 正向标签 + `-排除标签` | 只下发普通标签；`rating` / `score` / `width` / `order` 不拼入 `q` |
| `purity` | R18 与 `rating:` | 三位依次为 SFW / sketchy / NSFW 的 `1/0`：R18 关闭且未写 `rating:` 为 `100`，R18 开启未写 `rating:` 为 `111`，显式 `rating:` 按位合并（如 `rating:safe questionable` → `110`） |
| `categories` | 固定 `111` | 三分类全开 |
| `sorting` | `order:` | `score`→`relevance`、`fav`→`favorites`、`random`→`random`；未指定按 `relevance` |
| `topRange` | 仅空查询首页 | 空查询时固定 `sorting=toplist` 且追加 `topRange=1d`，不拼 `q`，其余参数（`purity` / `categories` / `page` / `atleast`）不变（DR-085） |
| `atleast` | `width:>=N` | 取最严格下界：≥3840→`3840x2160`、≥2560→`2560x1440`、≥1920→`1920x1080`，其余按 16:9 推导偶数高度 |
| `page` | 分页 | — |

响应 `data[]` 字段（只用以下字段，其余由 zod 忽略）：

| 字段 | 类型 | 归一化 |
|---|---|---|
| `id` | string（6 位 base36） | 解码为安全整数作为 `Post.id`（纯数字直接取值；非法格式走稳定哈希兜底） |
| `purity` | string | `100→safe`、`010→questionable`、`001→explicit`，未知按 `safe` |
| `dimension_x` / `dimension_y` | number | `width` / `height` |
| `file_size` | number | `fileSize`（字节） |
| `created_at` | string `YYYY-MM-DD HH:mm:ss`（UTC） | 解析为 epoch 毫秒；空串或非法记 `0` |
| `path` | string | `fileUrl`（原图） |
| `thumbs.large` / `thumbs.original` | string | `previewUrl` / `sampleUrl` |
| `favorites` | number | `score`（缺失记 0） |
| `source` | string \| null | 非空时写入 `source` |

固定归一化：`md5: ''`、`tags: []`、`lastId: null`；下载命名回退 `wallhaven_{id}.{ext}`（DR-070）。

错误映射：未配置密钥 → `CONFIG`「请先在设置中配置 Wallhaven API Key」且不发请求；401 → `CONFIG`「Wallhaven API 密钥无效，请在设置中重新填写」；429 → `RATE_LIMITED`「Wallhaven 请求过于频繁（429），请稍后重试」；JSON/字段异常 → `PARSE`。

### 7.2 bing 每日壁纸（T-52 / DR-076）

| 项 | 内容 |
|---|---|
| Base URL | `https://www.bing.com` |
| 鉴权 | 无 |
| 端点 | `GET /HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN` |
| 能力 | 仅每日壁纸（`daily`）；无关键词搜索 / 榜单 / 联想 |

响应 `images[]` 字段：

| 字段 | 类型 | 归一化 |
|---|---|---|
| `enddate`（缺失时 `startdate`） | string `YYYYMMDD` | 同时作为 `Post.id`（如 `20261106`）与 `createdAt`（本地零点）；非法格式或不存在的日历日 → `PARSE` |
| `urlbase` | string | 拼接预览 `{base}{urlbase}_400x240.jpg`、sample 与原图 `{base}{urlbase}_1920x1080.jpg` |
| `copyright` | string | 非空时写入 `source`（信息栏显示为「来源」） |
| `url` / `startdate` | — | 不消费 |

固定归一化：`md5: ''`、`rating: 'safe'`、`score: 0`、`fileSize: 0`、`tags: []`、`width: 1920`、`height: 1080`、`lastId: null`；结果按 `createdAt` 倒序（固定 8 条，空 `images` 返回空页）；下载命名回退 `bing_{日期}.jpg`。

错误映射：关键词搜索直接 `CONFIG`「Bing 仅提供每日壁纸，不支持关键词搜索」且不发请求；429 → `RATE_LIMITED`「Bing 请求过于频繁，请稍后重试」；缺 `urlbase` / 日期异常 / 非法 JSON → `PARSE`；网络错误原样透传。

---

## 8. Fixtures 清单

```
fixtures/
├── yande/
│   ├── posts-safe.json        /post.json?tags=rating:safe&limit=3
│   ├── tags.json              /tag.json?name=hatsune*&limit=5
│   ├── popular-recent.json    /post/popular_recent.json?period=1d&limit=3
│   └── by-id.json             /post.json?tags=id:1271989&limit=1
├── konachan/
│   ├── challenge-403.html     挑战页 HTML
│   └── challenge-headers.txt  响应头
├── wallhaven/
│   └── search.json             /api/v1/search 响应（data[] + meta）
└── bing/
    └── daily.json              /HPImageArchive.aspx 响应（images[]）
```

> wallhaven / bing 的 fixtures 为按公开接口结构构造的**离线样本（未实测）**，供两站适配器单测使用；取得真实 key 后应替换为实测响应并更新本节。

刷新命令（需要能直连 yande 的网络）：

```bash
curl -sS --resolve yande.re:443:198.251.89.183 \
  "https://yande.re/post.json?tags=rating:safe&limit=3" -o fixtures/yande/posts-safe.json
```

约束：

- Fixtures 只保留公开、安全的样本，不提交 R18 content
- 单元测试读取本地 fixtures，CI **不访问真实站点**

---

## 9. 变更流程

1. 站点行为变化 → 先更新本合同与 fixtures
2. 更新 `07-Progress.md` 的"已知问题"
3. 再改适配器与测试
4. 若影响 UI（如新增字段），同步 `02-UX-Design.md`

---

## 10. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-03 | 初版：yande 实测字段/端点、konachan CF 行为与 fixtures |
| 2026-11-05 | T-33 文档同步：补 `jpeg_url` 独立压缩版语义与 `jpeg_file_size` 字段、归一化第 4 条；补 `popular_by_day/week/month` 端点（未实测，P-18）；标注当前仅启用 yande.re |
| 2026-11-05 | T-28 / DR-057：启用状态改为两站已接入（`adapters.ts`），补充 konachan 字段仍属预期（P-02）；图片 host 映射新增 `konachan.com` / `assets.konachan.com`（P-04 待实测） |
| 2026-11-06 | T-54：新增第 7 节 wallhaven / pexels / bing 契约（鉴权、参数映射、字段归一化、命名回退与错误映射）；第 8 节 fixtures 清单增三站离线样本；原第 7~9 节顺延为第 8~10 节 |
| 2026-11-06 | DR-084：pexels 不再开放 API 申请——删除 7.2 pexels 契约与 `fixtures/pexels`，bing 顺延为 7.2；搜索与收藏契约移除 curated/pexels 分支 |
| 2026-11-06 | T-58 / DR-085：wallhaven 空查询即首页，固定 `sorting=toplist&topRange=1d` 且不拼 `q`；`posts:search` 对具备 `toplist` 能力的站点放行空查询（此前一律返回空页） |
| 2026-11-06 | T-58 / DR-087：moebooru 站点首页改用 `popular_recent?period=1d`（单页 40 条，首页禁用翻页）；实测 konachan `popular_by_day` 当天仅 1 条 pending，故首页不用日榜 |
| 2026-11-06 | T-62 / DR-091：日/周/月榜切类默认上一个完整周期（昨天/上周/上月）；周榜由「ISO 周历年份 + 周数」换算为该周周一的 `year/month/day` 参数，月榜只带 `year/month`；请求结构不变 |
| 2026-11-06 | T-63 / DR-092：实测 `popular_by_day/week/month` 固定 40 条且忽略 `limit`/`page`，期榜端点改为 `/post.json?tags=date:<单日或区间> order:score&limit=100&page=`（日=单日、周=周一..周日、月=1日..月末）；日榜该日 83 条、周/月区间 `page` 1~3 各 100 条 |
