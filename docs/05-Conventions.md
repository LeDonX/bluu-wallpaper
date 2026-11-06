# LePic 编码与协作规范

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 日期 | 2026-11-03 |
| 效力 | 所有任务必须遵守；与本文冲突的代码视为未完成 |

---

## 1. 工具链与代码风格

| 项 | 约定 |
|---|---|
| Node | 20.x LTS |
| 包管理 | pnpm 9.x |
| TypeScript | `strict: true`，`noUncheckedIndexedAccess: true` |
| 格式化 | Prettier：2 空格、单引号、分号、行宽 100 |
| 检查 | ESLint（typescript-eslint + react-hooks + import 排序） |
| UI | CSS Modules（原生 CSS，DR-018），禁止内联 style（动态尺寸除外） |

### 命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 组件 / 类型 | PascalCase | `PostCard`、`DownloadTask` |
| 函数 / 变量 | camelCase | `acquireClearance` |
| Hook | `use` 前缀 | `useSearchQuery` |
| 文件（组件） | PascalCase | `PostCard.tsx` |
| 文件（模块） | kebab-case | `hostmap.ts`、`cloudflare.ts` |
| IPC channel | `domain:action` | `posts:search`、`views:mark` |
| 常量 | UPPER_SNAKE | `MAX_CONCURRENCY` |
| DB 字段 | snake_case | `post_id`、`created_at` |
| JSON / IPC 字段 | camelCase | `postId`、`previewUrl` |
| CSS 类 | CSS Modules，作用域内使用可读语义命名；不新增全局类 | — |

---

## 2. 分层与依赖规则

```
renderer → (IPC only) → main
renderer → shared (仅类型/常量)
preload  → shared
main     → shared / node / electron
```

硬性规则：

1. **renderer 不得 import `main/` 任何模块**，不得直接访问 `fs`、`net`、`child_process`
2. **main 不得 import `renderer/`**，不得依赖 DOM
3. `shared/` 只放纯类型、常量、纯函数（无 Node / DOM API）
4. preload 只通过 `contextBridge` 暴露白名单方法，不暴露 `ipcRenderer` 本体
5. 网络请求只能出现在 `main/network` 与 `main/sites`，其他模块调用封装好的函数

---

## 3. TypeScript 规则

- 禁止 `any`；外部数据用 `unknown` + zod 解析
- 导入类型用 `import type`
- 联合类型 `switch` 必须穷尽（`never` 兜底）
- 公共函数必须显式返回类型；内部函数可推断
- 不使用 `enum`，用 `as const` 对象 + 联合类型

```ts
export const ERROR_CODES = ['NETWORK','TIMEOUT','RATE_LIMITED','CF_CHALLENGE',
  'NOT_FOUND','SERVER','PARSE','DB','DOWNLOAD','CONFIG'] as const;
export type ErrorCode = typeof ERROR_CODES[number];
```

---

## 4. 错误模型

统一 `AppError`：

```ts
interface AppError {
  code: ErrorCode;
  message: string;      // 面向用户的中文
  detail?: string;      // 技术细节，仅日志与"详情"折叠区
  retryable: boolean;
  cause?: unknown;
}
```

- 主进程**不向 IPC 抛异常**，统一返回信封：

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
```

- 渲染层只处理 `error.code` 决定 UI（重试按钮、诊断入口、CF 提示），不解析 message 文本

| code | UI 行为 |
|---|---|
| `NETWORK` / `TIMEOUT` | 重试 + 下一步引导（诊断入口随 T-34） |
| `RATE_LIMITED` | 自动退避；达到重试上限后错误卡片提示"稍后重试"（不新增限流事件通道，07 DR-052） |
| `CF_CHALLENGE` | 显示"正在验证"，失败转手动 |
| `NOT_FOUND` | 标记失效，不重试 |
| `DOWNLOAD` | 任务级失败，可单条重试 |
| `CONFIG` | 引导去设置页 |

---

## 5. IPC 规范

- 所有 channel 定义在 `src/shared/ipc-contract.ts`，主/渲染共用
- 入参一律 zod schema 校验，校验失败返回 `CONFIG` 错误
- 只传可序列化的 plain object；禁止传 `Date`、`Map`、类实例（时间统一用 epoch ms 数字）
- 调用型 channel 用 `invoke/handle`；进度类用 `send/on` 事件
- 事件命名：`downloads:progress`、`cf:status`、`views:updated`
- 每个 channel 必须出现在 `03-Architecture.md` 的契约表中，新增需同步文档

```ts
// 主进程注册示例
ipcMain.handle('posts:search', async (_e, raw) => {
  const input = SearchInput.parse(raw);       // zod
  try { return { ok: true, data: await adapter.search(input) }; }
  catch (e) { return { ok: false, error: toAppError(e) }; }
});
```

---

## 6. 状态管理边界

| 数据 | 归属 | 说明 |
|---|---|---|
| 网络请求、cookie、代理 | 主进程 | 唯一真相源 |
| SQLite（已看/收藏/任务） | 主进程 | 渲染层只读缓存 |
| 当前查询、滚动位置、选中项 | 渲染层 zustand | 会话级，不持久化（滚动位置可选） |
| 已看状态的即时反馈 | 渲染层乐观更新 | 失败回滚，见下 |

乐观更新规则：

1. 用户操作 → 立即更新渲染层状态
2. 发起 IPC
3. 返回 `ok: false` → 回滚并 toast
4. 事件 `views:updated` 用于其他窗口/页面同步

---

## 7. 时间、单位、编码

| 项 | 约定 |
|---|---|
| 应用内时间 | epoch **毫秒**（`number`） |
| API 时间 | moebooru 返回 epoch **秒**，适配器负责 ×1000 |
| 文件大小 | **字节**（`number`） |
| 尺寸 | API 的 `width`/`height` 为像素整数 |
| 文本 | 源码 UTF-8；DB 文本 UTF-8；URL 使用 `encodeURIComponent` 拼 query |
| 布尔 | `is_*` 字段原样保留，不映射为字符串 |

---

## 8. 日志规范

- `electron-log`，级别 `error / warn / info / debug`
- 必记字段：`module`、`site`、`channel`、`durationMs`、`status`
- **禁止记录**：cookie 值、`cf_clearance`、完整 UA（只记前 32 字符）、用户本地完整路径（脱敏为 `...\filename`）
- 单文件 5MB 轮转，保留 3 份
- 渲染层禁止 `console.log`，统一经 IPC 写入主进程日志

---

## 9. Git 规范

| 项 | 约定 |
|---|---|
| 分支 | `feat/T-xx-简短描述`、`fix/T-xx-...` |
| 提交 | Conventional Commits：`feat(network): ...`、`fix(download): ...` |
| 粒度 | 一个提交对应一个可运行状态；不提交半成品 |
| 禁止 | 提交 `node_modules`、`release/`、日志、真实 cookie |
| 任务关联 | 提交正文写 `Task: T-xx` |

---

## 10. 文件归属与并行开发

- 每个任务在 `04-Task-Plan.md` 中应标注**涉及文件**；未标注的由执行会话在 `07-Progress.md` 中补充
- 同一文件同一时间只允许一个会话修改；跨会话改动共享文件（`shared/ipc-contract.ts`、`styles/tokens.css`）必须在 Progress 中登记
- 新增依赖需在 Progress 记录理由；禁止引入第二套 UI 库 / 状态库 / HTTP 库

---

## 11. 注释与文案

- 标识符、类型、日志字段一律英文
- 注释用中文，只解释"为什么"，不复述代码
- UI 文案中文，错误文案遵循 `02-UX-Design.md` 第 11 节
- 不写 `TODO` 除非同时在 Progress 登记

---

## 12. 提交前检查

```bash
pnpm lint
pnpm typecheck
pnpm test
```

三项全绿才允许提交；涉及界面改动的任务需附一张截图或说明手工验证步骤。
