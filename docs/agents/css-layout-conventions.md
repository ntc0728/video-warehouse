# CSS / 布局 / 断点 约定（细则层）

> 本文件是 CSS / 布局 / 断点类任务的**权威细则层**。做样式、布局、骨架、动画尺寸相关改动前必读。
> 与 `patterns.md` 的分工：`patterns.md` 讲「组件/模式怎么做」，本文件讲「断点、尺寸 token、布局几何怎么做」。
> 索引：`index.md` / `AGENTS.md`。

---

## 1. 页面高度体系（2026-09-09 定稿）

- **统一最小高度 = `100%`，不是 px**。`.page-transition`（`Layout.css`）已 `flex: 1 1 0`；
  页面根 `flex: 1` 或 `min-height: 100%` 即撑满滚动区，自动跟随 header / tabbar / TV 安全区。
- Token（`variables.css`）：
  - `--layout-page-min-height: 100%` —— 语义 A「页面填满一屏」。**禁 px、禁 `100dvh`**，Player 除外。
  - `--layout-loading-min-height` —— 语义 B「空态/加载块不塌陷」，300→480px 流体。
- **10 个业务页里 9 个根容器早已 `flex: 1 1 0`**（Home / Browse / Chart / Detail / Person / History /
  Settings / SourceChecker），只有 IPTV 靠 min-height（已换 token）。**别再给已撑满的页加冗余 min-height**。
- **两个例外**：
  - **Player** 高度由视频 16:9 派生（加 `min-height` 只会放大留白）。
  - **IPTVPlayer** 用 `100dvh`。
- **Player 留白根因与修法**：`Player.css` 容器 `height: calc(100dvh - var(--header-height))` +
  仅顶部 `padding`（`var(--space-sm) 0 0`）→ 差值全堆下方。
  修法 = `.player-main` 改 `margin: auto` + padding 上下对称。
  **⚠️ 必须用 auto margin，不可用 `justify-content: center`** —— `.player-page` 是 `overflow-y: auto`
  滚动容器，居中后内容超高会**裁掉顶部且滚不到**；auto margin 在超高时自动归 0。

---

## 2. 流体 token 三段式（2026-09-04 落地）

- **结构**：`:root` 段1（375→768 MIN→A）+ 段2 `@media (width >= 768px)`（768→1920 A→MAX），
  外包 `calc(… * var(--ui-scale))`；A = MIN + (MAX − MIN) × 2/3。
- **R3 五个**（`--sidebar-width` / `logo-size` ×3 / `header-height`）是真实契约，不动、不乘 scale。
- **TV**：由 `[data-device="tv"]` 独立 `clamp(A, (A/19.2)vw, 2A)` 重写（1080p = A、4K = 2A），
  不共用 `:root`、不乘 scale → 桌面方案对 TV 天然零影响。
- **红线**：新增 `@media` 尺寸/网格规则若不想影响 TV，必须加 `html:not([data-device="tv"])` 前缀。
- **UI 缩放**：手动档 `AppSettings.uiScale` → `AppLayout` 内联 `<html>`（最高优先）；
  自动档为**单条** `@media (≥1920 and resolution < 1.5dppx)` →
  `--ui-scale: clamp(1, calc(0.76 + 0.000125 * tan(atan2(100vw, 1px))), 1.08)`
  （1920→2560 线性 1.00→1.08，≥2560 冻结）。上一行 `--ui-scale: 1` 是**解析期回退**
  （老浏览器丢弃整条 → 沿用 1），**勿删**。
- **单位剥离技巧**：`tan(atan2(100vw, 1px))` 把 `vw` 转无单位数（Chrome 111+），
  老浏览器解析期丢弃 = 天然 fallback，不需要 `@supports`。
- ⚠️ `scripts/gen-fluid-tokens.py` 与 `variables.css` 手修已漂移，**禁止盲目 `--write`**。

---

## 3. 断点宪法

- **结构断点：768 / 1024 / 1280 / 1440 / 1920 / 2200 / 2560**。
  1920 = 2K 起点；**2200 = 内容区封顶 = 卡片增列点**（从 2560 下移）；2560 = 超宽收敛；
  **无硬件语义数字（如 1980）一律不加**。
- **页面整体布局大屏起点 = 1440**（现仅 `page-pad` ≥1440 / SearchBox ≥1441 / Home 骨架 ≥1440 / 卡片间距 >1440）。
  HeroBili + 分类导航上移/mega/热度榜已**回退 1280**。`Player.css` 仍 `<1280 / ≥1280` 待整改。
- `--card-cols` **不受 1440 限制，仍含 1280→6 档**（1440 起点只针对页面布局，非 card 排列）。
- **左栏 / rail 例外：起点 = 1024**。已落地：Browse BR-C 侧栏筛选 + RecordShell rail。
  Browse 768–1023 走移动端命令栏（`isPhone = useIsMobileLayout() || useIsMobile()`）。
- **改/删断点档位必须 grep 全仓注释**（旧契约同时写在 `variables.css` 体系说明块 + 组件 CSS 规则头，
  只改一处会留误导注释）。

---

## 4. 列数梯度与增列铁律

**列数梯度（终版）**：

| token | 梯度 |
| --- | --- |
| `--card-cols` | 3(<768) → 4(768) → 5(1024) → 6(1280) → 7(1440) → 8(1920) → 8(2200) |
| `--page-pad-x` | 16(<1440) → 60(1440) → 100(1920) → 140(2560) |
| `--iptv-cols` | 2(≤767) → 3(768) → 4(1024) → 5(≥1440) |
| `--continue-cols` | 2(<768) → 3(768) → 5(1280) |

- **历史页独立**：`.history-grid` 不走 `--card-cols`（≥1440→5、≥1920→6、1280–1439 回落 4、TV 恒 5）——
  横版记录卡更宽。
- **增列铁律**：增列必须发生在**内容区停止变宽的那一刻**（2200 封顶），
  否则「视口变宽卡片反而缩小」。根治范式 = `repeat(auto-fill, var(--card-size))` + `justify-content: center`
  （History / Collections 在用）。N→N+1 卡宽降幅 ≈ **1/(N+1)**，加档只能摊薄不能归零。

---

## 5. max-width token 契约

- `MIN` < 移动视口会钳窄移动端 → **移动端用 `100%`、曲线放段2**；内容区终版 = 段2 `min(100%, 2200px)`。
- 嵌导航栏控件高度用**专用矮曲线**且**不乘 `--ui-scale`**。
- 徽标 / 图标用 `--icon-*`（随字号），**勿用 `--space-*`**。

---

## 6. CSS 布局陷阱（实测）

- **`position: fixed` 元素的 `max-width: min(100%, Npx)`**：其中 `100%` 按**视口**解析 →
  想与内容同宽须 `left/right: var(--page-pad-x)` 内缩。对齐用 `getBoundingClientRect` 实测。
- **flex column 子项「`width:100%` + `max-width` 居中」必须显式写 `width: 100%`**
  （只写 `margin-inline: auto + max-width` 会被 auto margin 顶成 `fit-content`）。
- **grid item `position: sticky` 只能在自身 row track 内移动**：做「视口中部悬浮胶囊」时，
  sticky 应放 flex/block 容器首位做**零高度载体**（`height: 0` + 子 `translateY(-50%)`）。
- **选中态 `--on` 规则必须连 `--on:hover` 一起声明**（同特异性 `:hover` 靠后即覆盖选中底色）：
  `.x--on, .x--on:hover { … }`。
- ⚠️ **改 `flex-direction` 会静默反转主轴语义**（收藏/历史空状态贴顶的根因）：
  在 column 容器里可靠的 `flex: 1`（纵向拉伸），换到 row 容器后**只作用于宽度**，对高度完全无效；
  此时纵向拉伸改由**交叉轴**的 `align-items` 决定。
  **范式**：跨断点切换主轴方向时，必须重新检查「谁在拉伸谁」；
  让子项**自锁尺寸**（`align-self` + 显式 `width`）比依赖父级 `align-items` 稳。
- ⚠️ **`min-height: 0` 会反向覆盖祖先的 `min-height` 变量**：
  页面级空状态规则写 `min-height: 0` 会抹掉全局 `.empty-state-wrapper` 的
  `min-height: var(--layout-loading-min-height)`；若页面级规则要保留安全垫，
  应**显式写回同一变量**而非 `0`。
- **排查拉伸链断裂的手法**：逐层 `getComputedStyle(el).flexDirection` +
  `getBoundingClientRect().height` 对照，一眼看出高度从哪一层开始塌陷。**只截图会误判成「居中写错」**。

---

## 7. 文本跑马灯范式（标题溢出滚动）

> **现役范式 = History `RecordCard`。** 三处（`HotCardTitle` CQA 面板卡 / `TrendTitle` 首页左栏趋势榜 /
> `ChartRowTitle` chart 页）已全部迁到该范式。

**四步**：

1. **测量（JS）**：在**同一个元素**上判 `el.scrollWidth > el.clientWidth + 1` →
   `ResizeObserver` 复测，写入 `overflow` state。该元素自身 `overflow: hidden` + `white-space: nowrap`
   （`display: block`），`.is-overflow` 时把 `text-overflow: ellipsis` 改 `clip`。
2. **渲染（JSX）**：溢出时输出**双段轨道**：
   ```jsx
   <span className="…-track">
     <span className="…-text">{title}</span>
     <span className="…-text" aria-hidden="true">{title}</span>
   </span>
   ```
   两段各带 `margin-right: var(--space-lg)`；**未溢出时只渲染单个 `…-text`**。
3. **动画（CSS）**：`@keyframes { from { transform: translateX(0) } to { transform: translateX(-50%) } }`，
   **7s linear infinite**。轨道总宽 = 2× 文本宽，位移一半即无缝回起点
   —— **无需 JS 计算/注入像素**。
4. **触发**：触发点挂**整行**（`.cqa-hotcard:hover` / `.cqa-trend__row:hover` / `.chart-row:hover`），
   鼠标落卡任意处即滚。

| 组件 | 轨道 / 文本类名 | keyframes |
| --- | --- | --- |
| `HotCardTitle`（CQA 面板卡） | `cqa-hotcard__t-track` / `cqa-hotcard__t-text` | `cqaHotMarquee` |
| `TrendTitle`（首页左栏趋势榜） | `cqa-trend__t-track` / `cqa-trend__t-text` | `cqaTrendMarquee` |
| `ChartRowTitle`（chart 页） | `chart-row__t-track` / `chart-row__t-text` | `chartTitleMarquee` |

- ⛔ **旧自研范式已全废，勿回退**（原「量内层文本 span vs 外层包裹 div」+ JS 注入 `--marquee-x: -Npx`
  单段位移 —— 两个坑：量错对象、keyframes 依赖 JS 像素）。
- **坑 1**：**绝不要把 `prefers-reduced-motion` 的 `animation: none` 规则写在别的 `@media` 块内部**。
  曾把整段「reduced-motion 停用」误写进 `@media (width >= 1024px)` 主块内、漏掉
  `(prefers-reduced-motion: reduce)` 条件 → 对全体桌面用户**无条件** `animation: none`，静默盖掉跑马灯。
  抓法：遍历 `document.styleSheets` 打印命中同一元素的全部 `animation` 规则，看是否有后者覆盖前者。
- **坑 2（验证方法论）**：验证跑马灯**必须用「真实溢出」**，禁止用 `el.textContent = '超长文本'` 改 DOM
  （绕过 React state → `overflow` 仍为 `false` → 不渲染 track → **假 FAIL**）。
  正确做法：把视口压到让真实标题自然超宽（如 w1024/w1100），再断言
  `hasTrack: true`、track 子节点 n: 2、`animationName`、`transform` 是否推进。

---

## 8. 骨架占位

骨架占位的完整约定（各页专属骨架、与真实元素同尺寸、镜像盒模型树、loading 宿主居中继承、
flex 拉伸 + aspect-ratio 反算等）见 **`patterns.md` → 「页面骨架占位」**。核心红线复述：

- **每个页面骨架各不相同，禁止跨页复用整套骨架**；列数消费真实网格同源 token，结构复用真实布局类名。
- 骨架必须**逐层镜像真实行的盒模型树**，不只是卡宽公式。
- 行的 `gap` 与标题条的 `margin-bottom` **只能二选一**（两者都给会反比真实高 11px）。

---

## 9. 基线隔离验证法 & 断点溢出判断

**问题**：新增一条 `@media` 规则后，如何证明它没波及其它断点？如何区分「我引入的回归」与「既有问题」？

- **隔离法（证明新规则的作用域）**：把工作区源码 CSS 里**新增的那段**用正则 strip 掉，
  注入页面（`<style>`）重测同一批视口，对比数值。
  ```js
  const stripped = css.replace(/\/\* 注释锚点[\s\S]*?@media \(width >= A\) and \(width <= B\) \{[\s\S]*?\n\}\n/, '');
  console.log(css.length - stripped.length);  // 0 = 正则没命中，断言无效
  ```
  数值不变 → 证明该规划只作用于目标区间。
- **回归判定法（对 HEAD 基线实测，禁止 cascade 推理）**：
  ```js
  const out = execFileSync('git', ['show', 'HEAD:' + f], { maxBuffer: 1e8 });
  fs.writeFileSync('.baseline/' + basename, out);   // 用完删 .baseline/
  ```
  把基线 CSS 注入页面测一遍，与当前值逐档对比。**只有基线也正常、当前才异常，才算回归。**
- **所有「疑似回归」必须对 HEAD 基线实测对比，禁止靠 cascade 推理下结论。**

---

## 10. Hero / 首页大屏

- **`useIsWideDesktop` = `(min-width: 1024px) && !isTV`**，是「首页大屏 UI」的**唯一 JS 真源**。
  CSS 侧四个消费方必须同步：`Home.css`（两栏）、`CategoryQuickAccess.css`（两处）、`HeroBili.css`。
  `StickyHeader.css` / `HeroBanner.css` / `SearchBox.css` 本就有 1024 块，不用改。
  与 `useIsMobile`（1023）互补无缝。
- **`.cqa-trend*` = 首页左栏「今日趋势 TOP 20」连续榜**：数据直接取 store 的 `trending`
  （`/trending/all/day` 单页 20 条，零新增请求）。
- **chart 页封面按视口切换数据源**：`useIsMobile()`（=1023）→ <1024 竖版 `112×168` 取 `posterPath`(`w154`)；
  ≥1024 横版 16:9 取 `backdropPath`(`w300`)。**纯 CSS 换不了图源，必须在 JS 侧切**。
- **`.hero-bili__right` 列数 = `useHeroSideCols()`**（`src/hooks/useHeroSideCols.ts`）：
  `isTV → 3` / `1024–1280 → 2` / `≤1023 → 2` / 其余 `→ 3`。
  **卡数 = 列 × `SIDE_ROWS`(2) 必须在 JS 侧算**（CSS 只是同步表现），
  故 CSS 的 `grid-template-columns` 两档必须与 hook 同批断点（1280/1281）。
  ⚠️ `HeroBili.css` 移动档边界是 **`<= 1023px`**（不是 1024）。
- **`--hero-banner-h` 的生效点是 `Home.css` 不是 `variables.css`**：
  `.home-two-col__main` 的覆盖（特异性 0,2,1）**永远压过** `variables.css` 的 `html:not(tv)`（0,1,1）。
  现系数一律写在 `Home.css`：基础（≥1281）`bannerH = R × 0.24` / `sideW = R × 0.56`；
  `@media (width <= 1280px)` 覆盖 `bannerH = R × 0.31` / `sideW = R × 0.48`（R = 右列宽）。
  **2 列档必须同时调 sideW（56%→48%）**，只调 bannerH 会让 banner 变 0.70:1 竖条。
  **通用教训：改 CSS 变量前先 grep 全仓同名 token，确认有无更高特异性覆盖。**
- **`.hero-bili__cards` 不可锁 `height: var(--hero-banner-h)`**：锁高 + `rows: repeat(2, minmax(0,1fr))`
  会让行高恒 = bannerH/2、与列数解耦，降列即比例失控。现为 `height: auto` + `rows: repeat(2, auto)`，
  卡高由 `.hero-side-card__cover` 的 `aspect-ratio: 16/9` 派生。
  ⚠️ **算卡片宽必须扣 shuffle 换一换列宽**：
  `(sideW − shuffleW≈33.7 − columnGap − (cols−1) × sideGap) / cols`，用整列宽算会高估。
- **Hero 类改动无法用 production preview 验证**：无 TMDB Token → 首页数据为空 → `HeroBili` 根本不渲染。
  只能靠「产物系数 grep + 几何算术」验证。
- **≤1280 顶栏纯文本态的选中胶囊**：真实选中元素是 **`.cqa-nav__item--on`**
  （不是 `.sticky-header__nav-item--active`）；改胶囊尺寸/圆角必须**同时覆盖**
  `.cqa-nav__item` + `.sticky-header__nav-item`。
- **搜索框 header 变体宽度**：`1024–1280` 已封顶 `min(--layout-searchbox-max-w, calc(420px * --ui-scale))`；
  `≥1441` 封顶 `440px`。**`--layout-searchbox-header-max-w` 是死 token，无消费方**。
- **`sticky-header__inner` 不再用 `--page-pad-x`**，回归基础 `padding: 0 var(--space-md)`，
  仅保留 `max-width: --layout-content-max-width` + 居中封顶。
- **切换态统一范式**：CQA 切 chip / chart 切 tab → **清空旧数据 → 居中 `<TvMascot blink size={44} />` + 文案**，
  不用「保留旧网格 + 遮罩降沉」。

---

## 11. CSS 规范审查（stylelint）

- **验收口径 = 「相对 HEAD 基线无净新增」**，不是「零违规」。
  项目现存大量历史遗留 `order/properties-order` / `number-max-precision` / 裸 px 火焰图标族，
  修它们属超范围重构。
- **审查方法**：对 HEAD 版本与工作区版本**各跑一遍** stylelint，只筛
  `declaration-property-unit-disallowed-list` + `declaration-block-single-line-max-declarations`，对比总数。
  踩坑：`execFileSync` 抓 stylelint `--formatter json` 输出**可能被 stdio 截断**
  → 解析前 `raw.slice(raw.indexOf('[{'), raw.lastIndexOf('}]') + 2)` 再 `JSON.parse`。
- **两条豁免通道**（写亚像素常量时用）：
  1. stylelint **不检查 `clamp()` 内部单位**（`clamp(36px, 34.832px + 0.3108vw, 42px)` 合法）。
  2. **不检查 custom-property 的「定义」**（`--cqa-flame-size: 10px` 合法）。
  但 custom-property 在 declaration 里被**引用**的顶层裸 px 仍会报错。
- **常用替换**：`font-size: 10px` → `var(--text-2xs)`；`gap: 1px` → `var(--space-3xs)`；
  `padding: 1px …` → `var(--space-3xs)`；`var(--radius-sm, 4px)` → 去掉 px 兜底。
  小图标**不改成 `1em`**（会随父级字号放大，属未经许可的视觉变更）。
- `npm run lint:all` = ESLint + Stylelint；单文件审查用
  `node_modules/stylelint/bin/stylelint.mjs <files> --formatter json`（`npx` 沙箱不可用）。
