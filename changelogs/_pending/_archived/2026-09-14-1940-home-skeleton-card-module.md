---
date: 2026-09-14 19:40
module: Home 骨架行卡片模块化（修复「card 骨架只有 2 行左右」）
type: fix
build: npx tsc -b 通过 + npx vite build --emptyOutDir false 通过（沙箱清 dist 撞批量删除保护）；vitest 113 passed / 14 files
files:
  - src/pages/Home/Home.css（.home-skeleton-rows / .home-skeleton-row / .home-skeleton-row-title / .home-skeleton-row-cards 四处盒模型对齐真实行）
demo: .pw-shots-final/bp-*.png（9 档断点骨架截图，本地诊断产物，已 gitignore）
---

## 用户反馈 → 根因 → 修复

用户报「涉及 card 的页面，card 的骨架占位只有 2 行左右」。
实测定位到**首页骨架行**（`.home-skeleton-row`）与真实行（`.home-page .tmdb-movierow`）
盒模型漂移，四层各差一截，逐层修复。

### 逐层根因（1440 档实测，修复前）

| 层 | 骨架 | 真实 | 差 |
| --- | --- | --- | --- |
| 骨架行 `.home-skeleton-row` | 274.5 | 301.5 | **−27.0** |
| ↳ 行容器 gap | `--space-xl` | `margin-bottom: --space-sm` | 行距偏大 |
| ↳ 行外壳 | 无 padding/border/radius/surface/shadow | 四向 `--space-sm` + 1px border + radius-lg + surface + shadow-sm | −24.6 |
| ↳ 标题条高 | 固定 `clamp(24px,…,36px)` | `--text-lg × 1.3`（≥768 升 `--text-xl`） | +5.8 |
| ↳ 标题区下间距 | 0 | `.tmdb-movierow-header` 的 `margin-bottom: --space-sm` | −7.9 |
| ↳ 卡片区 padding | 0 | `.tmdb-movierow-scroll` 的 `padding: --space-md --space-xs` | **−21.8** |

### 修复（4 处，逐条镜像真实行）

1. **`.home-skeleton-rows`**：`gap: --space-xl` → `0`；去掉 `padding: --space-md --space-xs`。
   旧注释声称对齐的是 `.tmdb-movierow` 的 `padding: 0 var(--space-xs)` —— 该取值早已改为
   四向 `--space-sm`，注释与代码双过时。横向 padding 改由每行自带外壳承担，避免双份边距。
2. **`.home-skeleton-row`**：补上与真实行同一套盒模型外壳 ——
   `margin-bottom/padding: --space-sm` + `border: 1px solid --color-border-light` +
   `border-radius: --radius-lg` + `background: --color-surface` + `box-shadow: --shadow-sm`；
   同时 `gap` 必须为 `0`。
3. **`.home-skeleton-row-title`**：`height` 由固定 clamp 改为 `calc(var(--text-lg) * 1.3)`，
   并补 `margin-bottom: --space-sm`；新增 `@media (width >= 768px)` 升档到 `--text-xl * 1.3`
   （门控 `html:not([data-device="app"])`，与真实标题的 App 端豁免一致）。
4. **`.home-skeleton-row-cards`**：补 `padding: var(--space-md) var(--space-xs)`，
   镜像 `.tmdb-movierow-scroll` 为 TV 聚焦放大/焦点方框预留的上下留白。

> ⚠️ 2 与 3 存在**联动陷阱**：标题条的 `margin-bottom(--space-sm)` 已承担「标题→卡片区」
> 间距，而行 `gap` 若同时给 `--space-md`，就会叠加成双份间距 —— 实测骨架行反比真实行
> **高 11px**（312.45 vs 301.47）。故第 2 步的 `gap: 0` 不是可选优化，是必须项。

### 修复结果（骨架行 vs 真实行，同页同会话采样）

| 视口 | 修复前 | 修复后 | 残留 |
| --- | --- | --- | --- |
| 480 | — | −2.77 | 移动端 |
| 768 | — | −3.49 | 窄分支 |
| 1024 | −10.0 | −2.19 | |
| 1280 | — | −0.77 | |
| 1440 | −9.13（原 −27.0） | **+0.08** | |
| 1920 | — | +1.32 | |
| 2560 | — | +1.47 | |

卡片本身同步收敛：1440 档骨架卡 233.66 vs 真实卡 233.58 = **+0.08px**。

### 附带澄清（用户问题 ②：首页骨架缺左栏）

跨 9 档断点实测：左栏 `.home-two-col__rail`、顶部过渡带 `.home-skeleton-topstrip`、
趋势榜 `.cqa-trend`（6 行）**只在 ≥1024 非 TV 出现**，与 `useIsWideDesktop`
（`min-width:1024px && !isTV`）这一唯一 JS 真源一致；<1024 走窄分支（`.hero-banner__card`
单图 banner + 7 行）。用户反馈「一直都是错的」高度指向其观测视口 <1024（如 DevTools 开启
压缩了视口）—— **代码侧无缺陷**，①「所有页面刷新都显示首页骨架」同样未复现（7 条路由原地
刷新逐帧采样，非首页路由命中首页骨架帧数 = 0）。
