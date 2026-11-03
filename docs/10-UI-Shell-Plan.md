# Bluu（蓝噗）界面外壳重构技术方案

| 项 | 内容 |
|---|---|
| 版本 | v0.1 |
| 日期 | 2026-11-03 |
| 关联 | 02-UX-Design.md、03-Architecture.md、05-Conventions.md、07-Progress.md |
| 前提 | 设计图尚未提供；本方案以"QQ 音乐式三栏布局"为基准结构，设计图到位后按 §7 校准 token 与尺寸 |

> 范围：窗口层（Electron）、导航壳层、主题体系、现有页面迁移。
> 不在范围：查看器、下载、榜单等业务功能本身。

---

## 0. 与现有任务的关系

- 当前看板：T-14（搜索页）、T-15（标签联想）已完成，`NEXT_TASK` 为 T-16（R18 默认关闭）。
- 外壳改造不依赖 T-14/T-15，但 P3 会重写 `SearchPage`、`SearchBar`、`index.css`，与 T-16 / T-17 的改动范围重叠；需串行，或按 05 §10 登记文件归属后再并行。
- 本方案建议的新任务编号 T-38 ~ T-45，见 §10；并入 `04-Task-Plan.md` 前不改动现有看板。

---

## 1. 目标形态

```
┌───────────────────────────────────────────────────┐
│ TitleBar   logo · 全局搜索 · 窗口按钮（可拖拽）      │  36px
├──────────────┬────────────────────────────────────┤
│ SideNav      │  主内容区（路由页面）                │
│ 220 / 56px   │                                    │
│ 站点切换      │                                    │
│ 导航项        │                                    │
├──────────────┴────────────────────────────────────┤
│ StatusBar  当前站点 · 网络状态 · 过滤计数           │  28px
└───────────────────────────────────────────────────┘
```

关键差异：当前应用是"系统标题栏 + 单页 SearchPage"，需要改成"自绘标题栏 + 壳层 + 多页路由"。这是**外壳重构**，不是换肤。

---

## 2. 现状与差距（文件级）

| 位置 | 现状 | 差距 |
|---|---|---|
| `src/main/index.ts` | 默认系统边框窗口；无菜单配置（Windows 下带默认菜单栏） | 需无边框/隐藏标题栏、窗口控制 IPC、移除默认菜单、最大化状态回传 |
| `src/shared/ipc-contract.ts` | 只有 `posts:search` | 需新增 `window:*` 调用与 `window:state` 事件 |
| `src/preload/index.ts` | 只暴露 `searchPosts` | 需暴露窗口控制与状态订阅（带取消订阅） |
| `src/renderer/App.tsx` | 一行直接渲染 `SearchPage` | 需改为 `AppShell` + 路由 |
| `src/renderer/pages/SearchPage.tsx` | 自带整页布局（header/content） | 需降级为内容区组件，布局上移到壳层 |
| `src/renderer/styles/index.css` | 单一全局样式表 + 自造 BEM 类（T-14/T-15 后约 6.8 kB） | 05 §1 要求 Tailwind，DR-015 定为原生 CSS，规范与代码已冲突；多页面下全局类必冲突，需作用域化并修订 05 |
| `src/renderer/styles/tokens.css` | 单层暗色 token，颜色写死在 CSS | 颜色改由 `shared/theme.ts` 预设生成 CSS 变量，CSS 只保留非颜色 token |
| `src/renderer/components/PostGrid.tsx` | 列宽/行高/间距写死在 TS，且 CSS 重复写 `280px` | 需尺寸单一来源（DR-022） |
| `src/main/index.ts` 主题 | 写死 `nativeTheme.themeSource = 'dark'` | 需随主题切换 |
| 图标/图片 | 无资源；图标是 `★` 文字 | 需开源图标库 + 自绘占位/品牌资源 |

---

## 3. 方案决策（待并入 07 DR 表）

| ID | 决策 | 理由 |
|---|---|---|
| DR-015 | **已存在，本方案继承**：原生 CSS + 等高行虚拟化，暂不引 Tailwind / 瀑布流库 | 行虚拟化前提是等高；本期不改 `PostGrid` 的虚拟化实现 |
| DR-016 | **已存在，本方案遵守**：预览图直连站点域名并在 CSP 放行 | 新增任何外链图片都必须同步 CSP 与 03 §11 |
| DR-017 | 窗口**完全自绘**：`frame: false` + 自绘最小化/最大化/关闭按钮，接受失去 Windows 贴边布局悬停菜单 | 用户明确要求完全自绘；Snap 悬停菜单的损失已确认可接受 |
| DR-018 | 样式作用域化：原生 CSS 改为 **CSS Modules**，token 保持全局；修订 05 §1 中"必须用 Tailwind"的表述 | 与 DR-015 的原生 CSS 路线一致，Vite 原生支持、零新增依赖，同时消除全局类冲突 |
| DR-019 | 主题为**亮色默认 + 暗色可选 + 可扩展预设 + 自定义配色**，颜色由 `shared/theme.ts` 的预设生成 CSS 变量，不在 CSS 中写死 | 未来会有更多预设与自定义强调色；注册表式预设新增一项即可生效 |
| DR-020 | 资源策略：图标 `lucide-react`；图片一律来自站点 API，不用外链装饰图；空态用内联 SVG；字体先用系统字体 | 无资源交付前提下，离线可用、体积可控、许可干净 |
| DR-021 | 路由用 `react-router-dom` 的 **HashRouter**；渲染层状态用 `zustand` | 生产环境 `loadFile` 下 `file://` 只有 hash 路由可靠；zustand 为 05 §6 既定 |
| DR-022 | 布局尺寸**单一来源**：`src/shared/layout-metrics.ts` 定义数值，渲染层启动时写入 CSS 变量 | 虚拟滚动需要 TS 数值，CSS 需要变量，双写必然漂移 |

---

## 4. 窗口层设计（主进程）

### 4.1 窗口创建

```ts
// src/main/index.ts（示意）
const window = new BrowserWindow({
  width: DEFAULT_WINDOW_SIZE.width,
  height: DEFAULT_WINDOW_SIZE.height,
  minWidth: MIN_WINDOW_SIZE.width,
  minHeight: MIN_WINDOW_SIZE.height,
  show: false,
  frame: false,                 // 完全自绘标题栏（DR-017）
  backgroundColor: '#00000000',
  backgroundMaterial: 'mica'    // Win11 22H2+；Win10 自动无效，回退纯色
});
```

- 默认菜单必须移除：`Menu.setApplicationMenu(null)`（否则窗口顶部会出现 File/Edit 菜单）。
- 标题栏按钮全部自绘：最小化、最大化/还原、关闭；建议 46×32，关闭按钮 hover 用系统红 `#C42B1C`。
- 最大化状态由 `window:state` 事件回传，按钮图标在最大化/还原之间切换。
- `show: false` + `ready-to-show` 保留，避免首帧白闪；非 Mica 场景由主题色填充窗口底色。
- Mica 需要窗口与页面背景透明（`html/body` 透明，内容面板用不透明或半透明面）；**不先开 `transparent: true`**，避免 Win10 丢失阴影与圆角，spike 确认必须时再加。
- 完全自绘后 Windows 的"悬停最大化按钮出贴边布局"不可用（用户已确认接受）；拖边分屏与 `Win+Z` 需在 spike 验证。

### 4.2 标题栏拖拽区（渲染层）

```css
.titlebar {
  -webkit-app-region: drag;
  height: var(--titlebar-height);
}
.titlebar button,
.titlebar input,
.titlebar a {
  -webkit-app-region: no-drag;
}
```

要点：

- 拖拽区内默认不响应鼠标事件，所有可点元素必须显式 `no-drag`。
- 自绘按钮必须是原生 `<button>`，带 `aria-label`、`title` 与可见焦点环；关闭按钮的 hover 色单独定义。
- 双击最大化在 Windows 上不可靠，需在标题栏空白处补 `onDoubleClick` → 调 `window:toggleMaximize`。
- 最大化时窗口不可拖动、不可缩放；按钮组右侧不预留系统按钮宽度（完全自绘）。

### 4.3 窗口控制 IPC（新增契约，同步 03 §7）

| channel | 参数 | 返回 |
|---|---|---|
| `window:minimize` | — | `{ ok: boolean }` |
| `window:toggleMaximize` | — | `{ maximized: boolean }` |
| `window:close` | — | `{ ok: boolean }` |
| `window:state` | 事件：`{ maximized, focused, fullscreen }` | — |

```ts
// src/shared/ipc-contract.ts（示意）
windowMinimize: 'window:minimize',
windowToggleMaximize: 'window:toggleMaximize',
windowClose: 'window:close',
windowState: 'window:state'
```

```ts
// 主进程：状态变化推给渲染层，初始化时推一次
const pushState = (win: BrowserWindow): void => {
  if (win.isDestroyed()) return;
  win.webContents.send(IPC_CHANNELS.windowState, {
    maximized: win.isMaximized(),
    focused: win.isFocused(),
    fullscreen: win.isFullScreen()
  });
};
['maximize', 'unmaximize', 'focus', 'blur', 'enter-full-screen', 'leave-full-screen'].forEach((e) =>
  win.on(e, () => pushState(win))
);
```

规范要求（05 §5）：

- 调用型用 `invoke/handle`，状态用 `send/on`；
- 入参即使为空也过 zod（`z.undefined()` 或空对象 schema），失败返回 `CONFIG`；
- 主进程不抛异常，统一 `Result` 信封；
- 事件订阅在 preload 里封装成 `onWindowState(cb): () => void`，返回值用于取消订阅，禁止把 `ipcRenderer` 本体暴露给渲染层。

---

## 5. 渲染层架构

### 5.1 目录结构（新增部分）

```
src/renderer/
├── app/
│   ├── AppShell.tsx       壳层组合：TitleBar + SideNav + Outlet + StatusBar
│   └── routes.tsx         HashRouter 路由表
├── layout/
│   ├── TitleBar.tsx       logo、拖拽区、窗口按钮、全局搜索入口
│   ├── SideNav.tsx        导航项、站点切换、折叠按钮
│   └── StatusBar.tsx      站点、网络状态、计数
├── pages/
│   └── SearchPage.tsx     只负责内容区（搜索框 + 网格）
├── store/
│   └── ui-store.ts        zustand：主题、侧栏折叠、当前站点
├── assets/
│   └── logo.svg           自绘品牌标
├── styles/
│   ├── base.css            reset、字体、滚动条等全局基础
│   └── tokens.css          两层 token（原始色板 + 语义变量）
└── （组件样式）            与组件同目录的 *.module.css
```

### 5.2 组件职责（同步 02 §14.1）

| 组件 | 职责 | 禁止 |
|---|---|---|
| `AppShell` | 布局组合 | 不含业务请求 |
| `TitleBar` | 窗口按钮、拖拽区、logo | 不直接调 IPC 以外的主进程能力 |
| `SideNav` | 导航、站点切换、折叠 | 不触发搜索 |
| `StatusBar` | 状态展示 | 不做数据请求 |
| `SearchPage` | 搜索内容区 | 不再拥有整页 frame |

### 5.3 路由

```tsx
// HashRouter：生产环境 loadFile 下可用
<HashRouter>
  <Routes>
    <Route element={<AppShell />}>
      <Route path="/search" element={<SearchPage />} />
      <Route path="*" element={<Navigate to="/search" replace />} />
    </Route>
  </Routes>
</HashRouter>
```

后续 `/rankings`、`/favorites`、`/downloads`、`/settings` 直接挂到同一壳层。

### 5.4 状态

```ts
// ui-store：只放会话级 UI 状态（05 §6）
interface UiState {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  activeSite: SiteId;
}
```

- 主题持久化不在本阶段落地，等 T-30 设置页接 `settings:get/set`；当前默认 `light`。
- 搜索的数据状态仍留在 `SearchPage`（后续随 T-18/T-20 迁移），不提前抽全局 store。

### 5.5 折叠与响应式

| 窗口宽度 | 行为 |
|---|---|
| ≥ 1200 | 侧栏 220px 展开 |
| 1024–1199 | 侧栏 56px 图标态（hover 出 tooltip，可手动展开） |

尺寸分两类，不做"全流式"：

- **固定 px**：标题栏 42px、状态条 28px、侧栏 220/56px、窗口按钮 46×32px。窗口外壳尺寸不随窗口缩放。
- **流式**：内容区左右内边距 `clamp(16px, 2vw, 24px)`；网格列宽 200–260px，列数由可用宽度决定，超宽屏增加列数而不是把卡片拉宽；搜索框 `flex: 1 1 320px`，右侧控件在窄窗换行。
- 卡片高度不固定：按原图比例计算并夹紧（DR-026）。
- 字号保持 px（桌面应用无浏览器缩放，系统 DPI 由 Windows 处理），仅窄窗把辅助文字 14 → 13。

侧栏折叠变化通过 CSS 变量驱动，`PostGrid` 的 `ResizeObserver` 已能自适应列数。

瀑布流实现（DR-026）：

- 列数 `floor((容器宽 + 12) / (200 + 12))`，实际列宽 `(容器宽 - 12 × (列数 - 1)) / 列数`，上限 260px。
- 卡片高度 `clamp(列宽 × 原图高 / 原图宽, 140, 420)`；被夹紧的极端图用 `object-fit: cover` 裁切。
- 新卡片放入当前累计高度最小的列；维护每列累计偏移与总高度容器。
- 虚拟化：布局表按原顺序保存 `{x, y, w, h}`，另建按 y 排序的索引；滚动时二分定位可视区，按原索引渲染并绝对定位。
- 追加分页时增量分配，保持已有卡片位置；列数变化时整体重算。`@tanstack/react-virtual` 只保留给列表页，不再用于网格。

---

## 6. 主题与 Design Token

### 6.1 主题模型：预设 + 自定义（DR-019）

```ts
// src/shared/theme.ts（示意）
export interface ThemePreset {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  colors: ThemeColors; // bgBase / bgSurface / bgInset / border / textPrimary / textSecondary / primary / ...
}

export const THEME_PRESETS: readonly ThemePreset[] = [LIGHT, DARK];
```

```ts
// 渲染层：预设或"预设 + 自定义覆盖"都归一到同一组 CSS 变量
export function applyTheme(preset: ThemePreset, overrides?: Partial<ThemeColors>): void {
  const root = document.documentElement;
  root.dataset['themeMode'] = preset.mode;
  for (const [token, value] of Object.entries({ ...preset.colors, ...overrides })) {
    root.style.setProperty(cssVarName(token), value);
  }
}
```

- 组件与 CSS 只引用语义变量（`var(--bg-surface)`），具体色值不进组件样式。
- 新增预设 = `THEME_PRESETS` 增加一项；自定义 = 在所选预设上覆盖 `primary` / `primaryHover` 等字段，同一入口。
- 默认 `light`；应用启动在 React 渲染前调用 `applyTheme`，窗口底色用亮色值，避免首帧白闪。
- 主题持久化与设置页选择器归 T-30；本阶段只落地机制与默认亮色。
- 每个预设需通过对比度校验（正文/背景 ≥ 4.5:1），并用单测锁定预设字段完整。

> 默认强调色 `#B9DDFF`（浅蓝）。它是浅色，**不得承载白色文字**：填充按钮文字用 `--on-primary: #14202B`；浅底上的链接/图标另用 `--primary-text: #2A6F9F` 保证对比（约 5.5:1）；hover/active 取 `#A6D2FB` / `#8FC4F5`；focus ring 用 `#3D8FD1`。暗色主题下文字同样用深色。

> 颜色值在设计图校准后直接写入 `shared/theme.ts`，同步更新 `02 §14.2`。

### 6.2 尺寸单一来源（DR-022）

```ts
// src/shared/layout-metrics.ts
export const LAYOUT_METRICS = {
  'titlebar-height': 42,
  'statusbar-height': 28,
  'sidebar-width': 220,
  'sidebar-collapsed-width': 56,
  'post-card-min-width': 200,
  'post-card-max-width': 260,
  'post-card-min-height': 140,
  'post-card-max-height': 420,
  'post-card-gap': 12
} as const;
```

```ts
// 渲染层启动时注入（动态尺寸属于 05 §1 允许的内联 style 例外）
export function applyLayoutMetrics(): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(LAYOUT_METRICS)) {
    root.style.setProperty(`--${name}`, `${value}px`);
  }
}
```

`PostGrid` 直接读 `LAYOUT_METRICS`（列宽上下限、间距、卡片高度上下限），CSS 只写对应的 `var(--*)`，彻底消除双写。

### 6.3 样式作用域化（CSS Modules，DR-018）

```css
/* src/renderer/components/PostCard.module.css */
.card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
```

卡片高度由布局计算后通过内联 style 写入（瀑布流尺寸属于 05 §1 允许的例外）。

- Vite 原生支持 `*.module.css`，无需新增依赖与额外配置。
- 组件内类名走 `styles.xxx`，全局样式只保留 `base.css`（reset/字体/滚动条）与 `tokens.css`（变量）。
- 现有 `index.css` 的 BEM 类按组件拆分到同名 `*.module.css`，迁完即删旧段落，禁止两套样式长期共存。
- 动态样式（瀑布流每项的 `left/top/width/height`、网格列数）保留内联 style，属 05 §1 允许的例外。
- 05 §1 当前要求 Tailwind、DR-015 定为原生 CSS，二者已冲突；本方案取"原生 CSS + CSS Modules"，并按 DR-018 修订 05 §1 的表述。

### 6.4 动态背景（DR-027）

默认背景为 CSS 浮动光斑：4 个 40–65vw 的径向渐变圆，静态 `blur(90px)`，仅动画 `transform` 与 `opacity`，周期 28–42s，`ease-in-out` 无限循环。

```css
.bg-orbs { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; contain: strict; }
.bg-orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .1; will-change: transform, opacity; }
@keyframes orb-drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .8; }
  50% { transform: translate3d(4%, -3%, 0) scale(1.08); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .bg-orb { animation: none; } }
html[data-window-active="false"] .bg-orb { animation-play-state: paused; }
```

- 亮色透明度 0.08–0.14，暗色 0.10–0.18；颜色取 `bg-orb-1..3`，随主题切换。
- 光斑层在内容之下，不覆盖卡片与文字；不做 `filter` 动画，避免每帧重算模糊。
- 窗口失焦或最小化时由 `AppShell` 写 `data-window-active="false"` 暂停；`prefers-reduced-motion` 下静止。
- 每个光斑的 `animation-duration` / `delay` 不同，避免同步呼吸显得机械。

---

## 7. 设计图落地流程（你提供图片后）

### 7.1 你需要提供

| 项 | 要求 |
|---|---|
| 原图 | 尽量 1x 或 2x 原尺寸 PNG/JPG，不要社交媒体压缩图；放到 `design/` 下（仅作参考，不进安装包） |
| 覆盖状态 | 有多少给多少；未覆盖的状态我按 §7.2 的默认矩阵实现，先给可用版本再按反馈调整 |
| 关键窗口尺寸 | 设计稿按多少宽度绘制（如 1440×900） |
| 可交互说明 | 哪些区域可拖拽、按钮行为、折叠触发方式（文字即可） |

### 7.2 我产出的中间物

1. **token diff**：从设计图提取色值/字号/圆角/间距/阴影，形成"旧 token → 新 token"对照，回写 `02 §14.2`。
2. **尺寸清单**：标题栏、侧栏、卡片、间距等，落到 `layout-metrics.ts`。
3. **组件清单增量**：新组件登记到 `02 §14.1`。
4. **缺口清单与默认规则**：设计图未表达的状态按统一矩阵实现——hover 提亮 6%、active 10%、disabled 0.45 透明度、focus 2px 主色环、加载用骨架微光、图片失败用 `ImageOff` 占位、空/错态沿用现有结构重绘；清单一次性列出确认。
5. **截图基线**：壳层完成后用真实窗口截图与设计图逐屏比对。

### 7.3 校准顺序

`设计图 → 尺寸/颜色提取 → token 更新 → 壳层实现 → 截图比对 → 差异修正`。
每轮差异只改 token 与布局变量，不改组件结构，避免返工。

---

## 8. 开源资源方案（无图/无图标资源）

### 8.1 选型与许可

| 类别 | 选型 | 许可证 | 说明 |
|---|---|---|---|
| 图标 | `lucide-react` | ISC | 线性风格、可换尺寸与颜色、按需导入可 tree-shake；覆盖导航/窗口/状态所需 |
| 图标备选 | `@tabler/icons-react` | MIT | 若设计图图标风格更接近 Tabler，可整体替换，接口几乎一致 |
| 字体 | 系统字体（Segoe UI Variable / 微软雅黑） | 系统 | 首版不打包字体，体积最小 |
| 字体备选 | MiSans（小米）/ Noto Sans SC | 免费商用 / OFL | 若设计图字体特殊再引入，需子集化，避免整包 10MB+ |
| 空态插画 | 内联 SVG 自绘（lucide 形状组合） | 自有 | 不依赖外链；若后续要成品插画，可用 unDraw（免费商用、无需署名） |
| 品牌 logo / 应用图标 | 自绘 SVG + 脚本转 PNG | 自有 | 见 8.3 |
| 内容图片 | 站点 API 的 `previewUrl` / `sampleUrl` | 站点内容 | 不引入外部图床或装饰图 |

**硬性约束**：不使用 CDN 外链图片与在线图标字体；应用需离线可用，且外链会破坏"网络只走主进程"的架构约束。站点图片域名已在 CSP 放行（DR-016），新增域名必须同步 CSP 与 03 §11。

### 8.2 图片加载与兜底（渲染层）

| 状态 | 表现 |
|---|---|
| 加载中 | 骨架块（CSS 渐变/微光），固定卡片高度，避免布局跳动 |
| 成功 | 懒加载 `loading="lazy"` + `decoding="async"` |
| 失败 | `onError` 切占位态：底色 + lucide `ImageOff` 图标，不重试 |
| 空态/错误态 | 大号 lucide 图标 + 文案 + 操作按钮（复用现有 `EmptyState` / `ErrorState` 结构） |

### 8.3 品牌与应用图标生成

1. 手写 `src/renderer/assets/logo.svg`（几何字标，单色，可随主题换色）。
2. 应用图标用 devDependency `sharp` 一次性脚本 `scripts/build-icon.mjs`：SVG → 512/256 PNG，输出到 `build/`，供 electron-builder 使用。
3. 生成物（PNG/ICO）进版本库，脚本保留以便改标；`sharp` 只在开发期使用，不进运行时依赖。

---

## 9. 分阶段实施与验收

### P0 窗口层 spike（先验证，后写正式代码）

产出：`scripts/spike-titlebar.cjs`（临时验证脚本，验证通过后可保留作复验工具）。

验收：

- [ ] `frame: false` 下自绘按钮（最小化/最大化/还原/关闭）全部生效，双击标题栏可最大化
- [ ] 拖拽区内按钮可点击（`no-drag` 生效）
- [ ] 最大化/还原事件能回传渲染层，按钮图标随状态变化
- [ ] `backgroundMaterial: 'mica'` 在 `frame: false` 下生效；不生效时纯色回退无异常
- [ ] 拖边分屏与 `Win+Z` 的实际表现已记录（悬停贴边菜单丢失为已接受项）
- [ ] 移除默认菜单后无残留菜单栏
- [ ] 多屏 + 125% 缩放下标题栏高度与按钮位置正确

### P1 壳层骨架

验收：

- [ ] `AppShell` 渲染四区域，路由可切换 `/search` 与占位页
- [ ] 侧栏折叠有过渡动效，折叠后内容区 `PostGrid` 列数自适应
- [ ] 窗口控制全部可用（最小化/最大化/关闭）
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` 全绿

### P2 主题与 token

验收：

- [ ] 组件样式全部改为 `*.module.css`，`index.css` 只留全局基础与 token
- [ ] 亮/暗切换即时生效，自绘窗口按钮随主题变色；自定义强调色生效
- [ ] 新增预设仅改 `shared/theme.ts` 即可生效，无需改组件
- [ ] 预设对比度校验与 `LAYOUT_METRICS` 单测通过；CSS 中不再出现卡片高度硬编码
- [ ] `02 §14.2` 已回写为新 token（含设计图校准值），05 §1 已按 DR-018 修订

### P3 页面迁移

验收：

- [ ] `SearchPage` 只保留内容区，整页布局由壳层提供
- [ ] 原有功能不回退：搜索、翻页、去重、空/错态、重试
- [ ] `index.css` 中已迁移段落删除，无重复样式
- [ ] T-15 的标签联想交互（chip、Tab/↑↓、300ms 防抖）在迁移后保持可用
- [ ] `PostGrid` 改为虚拟化瀑布流：1000 项无白屏，追加分页不重排已有卡片，列数变化后位置正确重算

### P4 视觉打磨与验收

验收：

- [ ] 与设计图逐屏比对，差异项清单归零或已确认
- [ ] 键盘可达：Tab 顺序、按钮 `aria-label`、焦点可见
- [ ] 滚动 1000 项无白屏、无卡顿（DR-012：不得关硬件加速）
- [ ] 背景光斑在亮/暗下不干扰图片与文字，窗口失焦暂停，`prefers-reduced-motion` 下静止，滚动时无掉帧
- [ ] 应用图标、logo、空态资源齐备；`pnpm dist` 产物启动正常

---

## 10. 建议任务拆分（待并入 04）

| ID | 任务 | 依赖 | 验收要点 |
|---|---|---|---|
| T-38 | 窗口层 spike（无边框/材质/拖拽） | — | §9 P0 清单全过 |
| T-39 | 窗口控制 IPC 与状态事件 | T-38 | 契约入 03 §7；zod 校验；preload 取消订阅可用 |
| T-40 | 壳层布局（AppShell/TitleBar/SideNav/StatusBar/BackgroundOrbs） | T-39 | 四区域渲染、折叠、路由挂载、背景光斑（DR-027） |
| T-41 | 路由与 UI 状态（HashRouter + zustand） | T-40 | `/search` 可切换；状态不与业务耦合 |
| T-42 | 样式作用域化（CSS Modules）+ 两层 token + 主题切换 | T-40 | 亮/暗生效；`02 §14.2` 与 05 §1 更新 |
| T-43 | 图标/品牌/占位资源 | T-40 | lucide 接入；logo 与 app icon 生成；图片兜底 |
| T-44 | 搜索页迁移与网格适配 | T-40~T-42 | 功能不回退；尺寸单一来源 |
| T-45 | 视觉打磨与文档同步 | T-43、T-44 | P4 清单；02/03/05/07 同步 |

> T-38 与现有 T-09（代理）无依赖关系，可并行。

---

## 11. 测试与验收

### 11.1 自动化

| 用例 | 层级 | 断言 |
|---|---|---|
| `layout-metrics` 映射 | 单元 | 键值唯一、均为正整数、CSS 变量名合法 |
| 窗口入参 zod | 单元 | 非法 payload 返回 `CONFIG`，不抛异常 |
| `toAppError` 在窗口 handler 生效 | 单元 | 主进程不向 IPC 抛异常 |
| 主题解析 | 单元 | `system` 按系统偏好归一为 light/dark |

### 11.2 手工

- 拖拽移动窗口、双击最大化、还原位置保持
- 拖边分屏与 `Win+Z` 可用；悬停贴边菜单已确认放弃
- 125% / 150% DPI 与双屏跨屏拖动
- 侧栏折叠动画、内容区列数变化无跳动
- 键盘 Tab 顺序、窗口按钮可聚焦且 `aria-label` 正确
- 断网时状态栏与错误态文案正确

### 11.3 性能

- 冷启动首帧无白闪（浅色 `backgroundColor` + `show:false`）
- 1000 项滚动保持 60fps 观感，虚拟行数不随总数增长
- Mica/亚克力开启前后滚动帧率对比，若明显劣化则回退纯色

---

## 12. 风险与回退

| 风险 | 影响 | 回退 |
|---|---|---|
| 完全自绘失去贴边布局悬停菜单 | Win11 少一个分屏入口 | 已确认接受；保留拖边分屏与 `Win+Z`，spike 记录实际表现 |
| `frame: false` 下 Mica 不显示 | 质感缺失 | spike 验证；必要时加 `transparent: true` 并复核阴影/圆角，否则纯色回退 |
| Mica 在 Win10 或旧显卡不生效 | 视觉不一致 | 纯色背景，不以模糊层级做视觉分隔 |
| 样式迁移期新旧类并存 | 样式优先级冲突 | 按组件整块迁移，迁完即删 `index.css` 旧段落；禁止长期共存 |
| 设计图尺寸/色值不精确 | token 反复调整 | 只改 token 与 metrics，不动组件结构 |
| 侧栏折叠导致网格重排抖动 | 观感问题 | 折叠用固定宽度过渡，网格依赖 `ResizeObserver` 防抖 |
| 自绘标题栏按钮的键盘/无障碍缺失 | 可用性 | 全部按钮用原生 `<button>` + `aria-label` + 可见焦点环 |
| 图标风格与设计图不符 | 视觉偏差 | 换 Tabler 或自绘 SVG，组件接口不变 |

---

## 13. 已确认与待验证

**已确认（2026-11-03）**：完全自绘窗口；亮色默认 + 暗色可选 + 更多预设与自定义配色；需要 Mica；设计图未覆盖状态由 §7.2 默认矩阵补齐；样式采用 **CSS Modules**（DR-018）。

**待 T-38 验证**：完全自绘下拖边分屏与 `Win+Z` 是否可用、`frame: false` 下 Mica 是否显示；若拖边分屏也失效，需重新确认取舍。
