# Bluu（蓝噗）开发环境与命令

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 日期 | 2026-11-03 |
| 适用 | Windows 10 / 11 x64 |

---

## 1. 环境要求

| 组件 | 版本 | 说明 |
|---|---|---|
| Windows | 10 1809+ / 11 x64 | 目标与开发环境 |
| Node.js | 20.x LTS | Electron 33 内置 Node 20，保持一致 |
| pnpm | 9.x | 用 `corepack enable` 启用 |
| Git | 任意近期版本 | |
| VS Build Tools 2022 | 含"使用 C++ 的桌面开发" | 原生模块编译兜底；有预编译包时可不装 |

检查：

```powershell
node -v      # v20.x
pnpm -v      # 9.x
git --version
```

---

## 2. 初始化

```powershell
cd D:\new_space\booru-desktop
pnpm install
pnpm exec electron-builder install-app-deps   # 重建 better-sqlite3 等原生模块
```

> 首次安装若卡在原生模块，先确认 Build Tools 已装，再删除 `node_modules` 重试。

---

## 3. 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动开发环境（主进程 + 渲染层 HMR） |
| `pnpm typecheck` | TypeScript 全量检查 |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier 写入 |
| `pnpm format:check` | Prettier 只检查不写入 |
| `pnpm test` | Vitest 单元/集成测试 |
| `pnpm test:e2e` | Playwright（本地，不进 CI） |
| `pnpm build` | 编译到 `out/` |
| `pnpm dist` | 打包 NSIS + portable 到 `release/` |

提交前必须：`pnpm lint && pnpm typecheck && pnpm test`。

---

## 4. 目录速查

```
src/main/        主进程（网络、站点、下载、DB）
src/preload/     contextBridge
src/renderer/    React 界面
src/shared/      IPC 契约、常量、纯函数
fixtures/        API 样本（06 文档）
tests/           单测与 E2E
docs/            本项目文档
```

路径别名（`tsconfig.node.json` / `tsconfig.web.json` / `electron.vite.config.ts` / `vitest.config.ts` 同步配置）：

| 别名 | 指向 | 可用范围 |
|---|---|---|
| `@shared/*` | `src/shared/*` | 全部三端 + 测试 |
| `@main/*` | `src/main/*` | 主进程、预加载、测试 |
| `@renderer/*` | `src/renderer/*` | 渲染层 |

---

## 5. 本地网络调试

开发期最常见的三类问题，按顺序排查：

1. **域名解析**：应用启动时注入 `host-resolver-rules`，与系统 hosts 无关。调试时可直接：

```powershell
curl.exe -v --resolve yande.re:443:198.251.89.183 https://yande.re/post.json?tags=rating:safe&limit=3
curl.exe -v --resolve konachan.com:443:104.21.4.105 https://konachan.com/
```

2. **代理**：开发机若开着 Clash 等，系统代理会影响 Electron。设置 `NO_PROXY` 或在应用设置里显式选择直连。
3. **CF 挑战**：konachan 返回 403 `Just a moment` 属正常，交给应用内状态机；调试时不要误判为代码错误。

---

## 6. 原生模块（better-sqlite3）

| 问题 | 处理 |
|---|---|
| `NODE_MODULE_VERSION` 不匹配 | `pnpm exec electron-builder install-app-deps` |
| 预编译包下载超时（GitHub 不可直连） | 从镜像 `https://registry.npmmirror.com/-/binary/better-sqlite3/v<版本>/` 取 `better-sqlite3-v<版本>-electron-v130-win32-x64.tar.gz`（Electron 33 对应 ABI 130），解压到包目录，得到 `build/Release/better_sqlite3.node` |
| 编译报 MSB 错误 | 安装 VS Build Tools 的 C++ 工作负载，重启终端 |
| 打包后启动崩溃 | 确认 `asarUnpack` 包含 `*.node` |
| 仍失败 | 备选方案 `node:sqlite`（需评估 Electron 版本支持） |

`electron-builder.yml` 需包含：

```yaml
asarUnpack:
  - "**/*.node"
```

---

## 7. 打包

```powershell
pnpm build
pnpm dist
```

产物：

- `release/Bluu Setup x.y.z.exe`（NSIS，per-user，免管理员）
- `release/Bluu x.y.z.exe`（portable）

注意：

- 未签名会被 SmartScreen 拦截，属预期；内测阶段可"仍要运行"
- 安装目录不要放在中文路径下做首次验证，避免干扰排查
- 每次发版前跑一遍 `09-Test-Cases.md` 的冒烟集

---

## 8. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 启动白屏 | 渲染层异常或 preload 未加载 | 看 `%APPDATA%\bluu\logs` |
| 请求全部 403 | 未走 CF 通道 / cookie 失效 | 清 cookie 后重新验证 |
| 图片不显示 | 未映射 `assets.yande.re` | 检查 IP 映射表 |
| 下载 0 字节 | Range 不被支持 | 走整文件重下分支 |
| 端口/代理冲突 | 系统代理覆盖 | 应用内显式指定代理或直连 |
| 杀软拦截安装 | 未签名 | 加白名单，后续做代码签名 |

---

## 9. CI 约定

- CI 只跑 `lint`、`typecheck`、`test`
- **禁止**在 CI 访问 yande.re / konachan.com：会被限流且结果不稳定
- 网络相关测试全部使用本地 mock server 与 `fixtures/`
- 发布包由本地或受控 Runner 构建
