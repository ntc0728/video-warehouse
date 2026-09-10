---
date: 2026-09-10 23:05
module: CategoryQuickAccess / Chart / StickyHeader / HeroBili / SearchBox / 首页
type: feature + fix
build: 通过（tsc -b + vite build，EXIT=0）
files:
  - src/hooks/useHeroSideCols.ts（新增）
  - src/hooks/index.ts
  - src/components/HeroBanner/HeroBili.tsx
  - src/components/HeroBanner/HeroBili.css
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
  - src/pages/Chart/index.tsx
  - src/pages/Chart/Chart.css
  - src/components/StickyHeader/StickyHeader.css
  - src/components/SearchBox/SearchBox.css
demo: null
---

## 第五轮顶栏 / Hero / 跑马灯 / 封面尺寸整改（7 项）

### 问题

用户一次性提出 7 项反馈（含 2 项追加），横跨顶栏纯文本态、Hero 右栏列数、
标题跑马灯实现范式、榜单封面尺寸、搜索框宽度。

### 旧逻辑（实测）

| # | 议题 | 现状 |
| --- | --- | --- |
| 1 | `cqa-subgenres` chip 宽度 | `padding: var(--space-xs) var(--space-sm)`，偏宽 |
| 2 | 标题跑马灯 | 自研范式：量「内层 vs 外层」`clientWidth` + JS 写 `--marquee-x: -Npx` 单段位移；三处（`cqa-hotcard` / `cqa-trend` / `chart-row`）各自实现 |
| 3 | ≤1280 顶栏纯文本态 | 文本间距太小（横向 padding 仅 `--space-2xs`≈2px）；选中胶囊 `height: --comp-tab-height - --space-sm`≈30px 偏高、`--radius-full`(9999px) 过于圆润。真实选中元素是 `.cqa-nav__item--on`（**不是** `.sticky-header__nav-item--active`，Home 页 `activeCount: 0`） |
| 4 | `hero-bili__right` | 恒 3 列（`SIDE_COLS = 3`，硬编码），1024–1280 窄桌面下右栏每列被压到 ~110px，卡片文字换行溢出 |
| 5 | `sticky-header__inner` | `padding-inline: var(--page-pad-x)`（≥1440 为 60/100/140px） |
| 6 | ≤1280 `sticky-header__logo` | 顶栏切纯文本后 logo 组空间被挤，观感上「消失」 |
| 7 | 搜索框宽度 | 1024–1280 档用通用 `--layout-searchbox-max-w`（1280 实测 471px），占宽过大 |

### 新逻辑

1. **`cqa-subgenres` chip 收窄**：`padding: var(--space-xs) var(--space-sm)` →
   `var(--space-2xs) var(--space-xs)`，`font-size` 补 `var(--text-2xs)`。

2. **跑马灯统一迁移到 History `RecordCard` 范式**（用户指定参考基准），三处重写：
   - **测量**：同一元素上 `el.scrollWidth > el.clientWidth + 1`（该元素自身
     `overflow:hidden` + `white-space:nowrap`），`ResizeObserver` 复测。
     —— 取代原「量内层 vs 外层」的双元素比较。
   - **渲染**：溢出时输出**双段轨道**
     `<span class="…-track"><span class="…-text">title</span><span class="…-text" aria-hidden>title</span></span>`，
     两段各带 `margin-right: var(--space-lg)`。
   - **动画**：`@keyframes` `from { translateX(0) } to { translateX(-50%) }`，7s linear infinite。
     轨道总宽 = 2× 文本宽，位移一半即无缝回起点 —— **无需 JS 计算像素**，
     `--marquee-x` 与 `-Npx` 单段位移方案全部删除。
   - **触发**：`.cqa-hotcard:hover` / `.cqa-trend__row:hover` / `.chart-row:hover`
     命中 `…-track`；`prefers-reduced-motion` 块同步改引用 `…-track`。
   - 三处类名：`cqa-hotcard__t-track`|`cqa-hotcard__t-text`、
     `cqa-trend__t-track`|`cqa-trend__t-text`、`chart-row__t-track`|`chart-row__t-text`；
     keyframes 分别 `cqaHotMarquee` / `cqaTrendMarquee` / `chartTitleMarquee`。

3. **≤1280 顶栏纯文本态一次性处理 3 诉求**（同一个 `@media (width >= 1024px) and (width <= 1280px)`
   块内，`.cqa-nav__item` 与 `.sticky-header__nav-item` 共用一条规则）：
   - 文本间距：横向 `padding` 由 `--space-2xs`(≈2px) 放开到 `--space-xs-plus`(≈5px)；
   - 胶囊高度：`height: auto` 覆盖基础的 `--comp-tab-height - --space-sm`(≈30px)，竖向 `--space-2xs`；
   - 圆角：`border-radius: var(--radius-sm)` 覆盖基础的 `--radius-full`(9999px)。
   - 实测 w1100/1200/1280：圆角 9999 → **4.5px**、高度 30 → **23px**、`padding-inline` ≈5px；
     w1281 恢复 9999px/29px（图标 8 个回归），改档边界正确。

4. **`hero-bili__right` 分档，JS + CSS 成对**：
   - 新增 `src/hooks/useHeroSideCols.ts`（列数唯一 JS 真源，因为卡数 = 列 × 行必须在 JS 侧算）：
     `isTV → 3`；`1024–1152 → 1`；`1153–1280 → 2`；`≤1023 → 2`；其余 → `3`。
   - `HeroBili.tsx`：删硬编码 `SIDE_COLS`/`SIDE_CARDS`，保留 `SIDE_ROWS = 2`，
     改 `const sideCards = useHeroSideCols() * SIDE_ROWS`。
   - `HeroBili.css` 新增 `@media (width >= 1153px) and (width <= 1280px)` → `repeat(2, …)`；
     `@media (width >= 1024px) and (width <= 1152px)` → `minmax(0, 1fr)`；
     **移动档边界由 `(width <= 1024px)` 收为 `(width <= 1023px)`** ——
     否则 1024 会同时命中移动档（2 列）与 1 列档，实测冲突。
   - 实测：w1024/1152=`1列/2张`、w1153/1200/1280=`2列/4张`、w1281/1440=`3列/6张`。

5. **`sticky-header__inner` 移除 `padding-inline: var(--page-pad-x)`**，回归基础
   `padding: 0 var(--space-md)`，仅保留 `max-width: var(--layout-content-max-width)` + 居中。
   实测 `padInline` 为 `--space-md`（9.8–12px），w2560 `marginInline: 180px` 保留。

6. **≤1280 logo 保持可见**：在 ≤1280 块内显式恢复
   `.sticky-header__logo-group` / `.sticky-header__logo-wrap` /
   `.sticky-header__logo-group .sticky-header__brand { display: flex }`，
   并把 logo-group `gap` 收 `--space-2xs`。
   ⚠️ **实测口径修正**：HEAD 基线本就**没有**任何隐藏 logo 的规则（grep 基线 CSS 确认），
   logo 在基线 1024–1280 也是可见的；本项是对**本会话前几轮**顶栏收窄改动的防回归加固，
   不是恢复 HEAD 行为。实测 900/1024/1152/1200/1280/1281/1440/1920 全部
   `groupVisible=true`、`imgVisible=true`、48×48。

7. **搜索框 ≤1280 收窄**：`SearchBox.css` 新增
   `@media (width >= 1024px) and (width <= 1280px)` →
   `max-width: min(var(--layout-searchbox-max-w), calc(420px * var(--ui-scale, 1)))`。
   实测（`box` = 输入框本体宽）：

   | w | HEAD 基线 maxW / box | 本轮 maxW / box |
   | --- | --- | --- |
   | 1024 | 657 / 212 | **420** / **242** |
   | 1152 | 673 / 341 | **420** / **372** |
   | 1280 | 688 / **471** | **420** / **372** |

   **隔离验证**：把新增的 ≤1280 块 strip 掉重跑，w1281/1440/1920 三项数值与未 strip
   **完全一致** → 本规则只作用于 ≤1280，未波及以上档位。
   ≥1441 档的 440px 封顶（既有）保持不变。

### 已确认的**非**本次改动（避免误判为回归）

- **w1281 搜索框仅 140px**：`maxW` 为 688px 未触顶，是 flex 被 6 个回归的导航图标挤压到
  `--comp-input-min-w` 下限（**基线 129px → 本轮 140px，实际还宽了 11px**）。
  这是 1281 这个 1px 带宽档位的既有结构问题，**非本轮引入**。
- **w1440 204 → 302、w1920 430 → 394**：strip 测试证明与本轮 ≤1280 块无关，
  系本会话前几轮顶栏几何改动所致。
- `Chart` 竖版封面 96×144 → **112×168**（`@media (width <= 1023px)` 与
  `html[data-device="app"]` 两处，含 skeleton），一并落地。

### 验证

- `npx tsc -b` → EXIT=0；`npx vite build` → EXIT=0（先递归清空 `dist/`，避免
  上一轮 `--emptyOutDir false` 残留旧 chunk 的坑）。
- 产物 CSS 断言：`420px` 封顶存在、`440px`（≥1441 既有）仍在、
  logo `display:flex` 规则存在且位于 `@media(width>=1024px)and (width<=1280px)` 内、
  logo-group `gap: var(--space-2xs)` 存在、**无** `logo-wrap { display:none }`。
- Playwright 实测（preview 3101 + `test-storage-state.json` 真实数据）：见上各项数值。
- 临时资源清零：`scripts/tmp-v5/v6/v6b/v6c.mjs` 与全部 `.pw-*.txt`、`.baseline/` 已删；
  `netstat` 确认 3000/3001/3101/5173 **无 LISTENING 残留**。

### 未做（按协作红线，等用户确认）

- 未 commit、未跑 E2E、未写 changelog 合并、未起长期 dev server。

---

## 第七轮追加：HeroBili 右栏卡片「变扁」根因修正

### 问题（用户反馈）

> 「1024/1152，1153/1200/1280，hero-bili__banner 宽度要适当调整啊，右侧 card 都变扁了」

第六轮按列数降列后，卡片被横向拉扁。复查发现**第六轮的修法有两处错**，全部订正。

### 旧逻辑 → 根因

**根因 1：第六轮的系数改动一行都没生效（特异性被压过）**

`Home.css:683` 的 `html:not([data-device="tv"]) .home-two-col__main`（特异性 **0,2,1**）
硬编码 `--hero-banner-h: … * 0.2727`，**高于** `variables.css` 里 `html:not([data-device="tv"])`
（特异性 **0,1,1**）的 `:root` 与分段媒体查询。第六轮把 0.477/0.261/0.18 三档系数写进
variables.css 的分段查询 → **被完全压过，产物实测仍是 0.2727**。

**根因 2：目标本身自相矛盾**

`aspect-ratio: 16/9` 令卡高由**列宽**派生。降列 → 卡变宽 → 高度暴涨：

| 档位 | 列 | 卡宽 | 2 行总高 | 齐平需 bannerH | 该 banner 比例 |
| --- | --- | --- | --- | --- | --- |
| 1024–1152 | 1 | 685–813 | **837–981** | 981 | **0.88:1（竖条）** |
| 1153–1280 | 2 | 465 | 589 | 589 | 1.68:1 |
| ≥1281 | 3 | 330 | 437 | 437 | 2.43:1 |

即「降列数」与「封面保持 16:9」在 1 列档下**数学上不可共存**。

### 新逻辑（用户拍板：取消 1 列档 + 封面保持 16:9）

1. **列数三档 → 两档**（`useHeroSideCols.ts` 删 `isCol1` 分支）：
   `isTV→3`；`1024–1280→2`；`≤1023→2`；其余 `→3`。
   `HeroBili.css` 同步：删原 `1153–1280` 与 `1024–1152` 两个块，
   合并为单个 `@media (width >= 1024px) and (width <= 1280px)` → `repeat(2, …)`。

2. **系数移到真正的生效点 `Home.css`**（不再写 variables.css）：
   - 基础（≥1281）：`bannerH = R × 0.24`、`sideW = R × 0.56`
   - `@media (width <= 1280px)` 覆盖：`bannerH = R × 0.31`、`sideW = R × 0.48`
   - R = 右列宽 = `min(100vw, 2200px) − 2×pad − rail − railGap`
   - 系数由「2 行卡总高 + 行gap = banner 高」联立反推

3. **2 列档必须同时收 sideW（56% → 48%）**：只调 bannerH 时 banner 宽仅 420px 而
   需高 595px → `0.70:1` 竖条；收 sideW 后 banner 回到 **1.61–1.62:1** 正常横幅。

4. `HeroBili.css` 注释全面订正（原三档说明 → 两档），`variables.css` 删除三档死代码、
   保留 `0.24` 兜底并注明「真正生效点在 Home.css」。

### 验证

- `tsc -b` EXIT=0；`vite build` EXIT=0（先清 `dist/`）。
- **产物 CSS 断言**（`HomeRoute-*.css`）：基础档 `*.24`+`*.56` 存在、
  `@media(width<=1280px)` 内 `*.48`+`*.31` 存在、旧值 `*.2727` / `*.4)` / `*.59` / `*.18`
  **全部无残留**。
- **几何终验**（11 个视口，按产物系数）：

  | 档位 | banner | banner 比例 | 卡宽 | 封面比例 | 齐平差 |
  | --- | --- | --- | --- | --- | --- |
  | 1024–1280（2 列） | 366×228 ~ 499×307 | 1.61–1.62 | 145–207 | 1.78 | ≤9px |
  | 1281–2560（3 列） | 420×238 ~ 707×394 | 1.76–1.79 | 161–282 | 1.78 | ≤14px |

  齐平差 ≤14px = 标题条高取整误差，视觉不可辨；封面比例 1.78 = 真 16:9 全档成立。

- **stylelint 基线对比**（口径：相对 HEAD 无净新增）：
  `HeroBili.css` 12→12、`Home.css` 29→29、`variables.css` 0→0 → **净增 0**。

### 环境限制备忘

- `npx` 在沙箱不可用（EXIT=127）→ 直调 `node_modules/{typescript/bin/tsc,
  vite/bin/vite.js, stylelint/bin/stylelint.mjs}`。
- **production preview 无法验证 Hero**：无 TMDB Token → 首页无数据 → `HeroBili`
  根本不渲染（6 个视口实测全 `hasHero: false`）。Hero 类改动只能靠
  「产物系数 grep + 几何算术」验证。

### 未做（按协作红线，等用户确认）

- 未 commit、未跑 E2E。
