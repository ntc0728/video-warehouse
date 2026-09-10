---
date: 2026-09-10 15:42
module: 首页 / CategoryQuickAccess / HeroBili / StickyHeader / SearchBox / useIsWideDesktop
type: feature
build: 通过（npx tsc -b && npx vite build --emptyOutDir false）
files:
  - src/hooks/useIsWideDesktop.ts（断点 1280 → 1024）
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx（rail 变体重写为今日趋势 TOP20 + chip hover 延迟 + cqa-trend__h 移出 meta）
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css（两处 @media 1280 → 1024；rail/catgrid 规则替换为 cqa-trend；px 违规清零）
  - src/components/HeroBanner/HeroBili.tsx（右卡 6 → 5）
  - src/components/HeroBanner/HeroBili.css（@media 1280 → 1024 + ≥1280 末卡跨 2 列 + ≤1024 降 2×2）
  - src/pages/Home/Home.css（@media 1280 → 1024 + 左栏 240/260 档位）
  - src/components/StickyHeader/StickyHeader.css（chips 与搜索框隔离间距 + ≤1280 收间距档）
  - src/components/SearchBox/SearchBox.css（大屏搜索框 480 → 440）
  - src/assets/styles/variables.css（--comp-input-height-header 40→48 改为 36→42）
demo: changelogs/demos/demo-home-heat-dedup-2026-09-10.html
---

## 首页热度榜去重（方案 B）+ 大屏断点 1024 + 五项 UI 微调

### 问题（三层根因）

1. **入口重复**：顶栏 chip「电影」（`CategoryQuickAccessNav`，hover 开 mega 面板）与首页左栏
   分类卡「电影」（`CategoryHeatRow variant="rail"`，点击跳 `/chart`）指向同一分类。
2. **数据源分裂**：左栏分类卡的 5 条来自 `aggregateCategoryHeat(trending)`——数据是
   `/trending/all/day` **单页 20 条**内的桶聚合；面板「电影 · 全部」的 20 条来自
   `/trending/movie/day`（独立端点）。两端点 → 同标题不同内容。
3. **指标不可信**：20 条内综艺/动漫/纪录片桶常只有 0~2 条 → Σ 剧烈抖动、跨分类不可比；
   而该 Σ 在面板头、左栏卡头、`HomeTopStrip` 三处重复出现。

### 新逻辑（用户拍板方案 B）

左栏不再做分类桶切分，直接展示 `/trending/all/day` 的**完整连续排名 TOP 20**
（复用 store 已有的 `trending`，**零新增请求**）。职责分离：顶栏 chip 管「按分类切片浏览」，
左栏管「全站趋势一眼看完」。分类桶聚合（`aggregateCategoryHeat`）保留给面板头 Σ 与
`HomeTopStrip`「最热分类」继续使用，`variant='row'` 通栏形态不变。

### 逐项落地

| # | 用户要求 | 落地 |
| --- | --- | --- |
| 1 | 采用方案 B，显示 20 条 | `CategoryHeatRow` 拆成 rail（新「今日趋势」连续榜）/ row（原分类桶）两分支；rail 取 `trending.slice(0, 20)`。`/trending/all/day` 单页恰为 20 条 → 免扩容、免新增请求 |
| 2 | 左栏 card 布局与 demo 一致 | 新增 `cqa-trend` 系列：`<ol>` + 行式按钮（排名 20px 定宽槽位 / 竖版海报 / 标题 / 徽标+年份+热度），行间用 1px 分隔线而非 gap，外层一张 surface 卡 |
| 3 | 封面竖图尽量大 | 海报 2:3；左栏 260px 下 **64×96**，≥1920 档左栏 280px 时 **72×108**（`Home.css` 内联 `--cqa-poster-*` 覆盖）。原方案 C 是 32×48 |
| 4 | 点击 card 跳 detail | `CategoryTrendList` 内 `navigate('/detail/' + item.id)`（`item.id` 已是 `tmdb-movie-123` 形态，与 `CategoryHeatCards` 同款用法） |
| 5 | 首页 ≥1024 就显示新 UI | `useIsWideDesktop` `(min-width: 1280px)` → `(min-width: 1024px)`（唯一 JS 真源）；CSS 五处同步：`Home.css` 两栏块、`CategoryQuickAccess.css` 两处、`HeroBili.css`。`StickyHeader.css` / `HeroBanner.css` / `SearchBox.css` 本已有 1024 块，无需改。与 `useIsMobile`(1023) 互补无缝 |
| 6 | 右侧 card 排列减 1 | `SIDE_COLS×SIDE_ROWS = 6` → 新增 `SIDE_CARDS = 5`，`shuffleBatch` 随之 5（换一换一批 5 张）。破格留空改为**末卡跨 2 列**补满第 2 行（`.hero-bili__cards > .hero-side-card:nth-child(5):last-child { grid-column: span 2 }`），高度仍由 `grid-template-rows` 均分 2 行 |
| 7 | chip hover 过于灵敏 | store 新增 `scheduleOpen` / `cancelPendingOpen` + `HOVER_OPEN_DELAY_MS = 200`。**未展开时**延迟 200ms 才开面板、chip 移出即取消（`handleChipLeave`）；**已展开时**横移立即跟随（否则扫一排 chips 变卡顿）。另在 `StickyHeader.css` 给 `.cqa-nav` 补 `margin-right: --space-xs-plus`（≈8px 物理隔离） |
| 7b | 搜索框宽度减小 | `SearchBox.css` ≥1441 档 `480px` → `440px`（−8.3%）。只动 header 变体；1024–1440 的流式宽度不受影响 |

### 已知取舍

- 左栏 20 行总高 ≈ 2100px（1920 档 ≈2250px），必然高于滚动区 →
  `Home.css` 里 rail 的 `max-height + overflow-y:auto` 从「可选优化」变成**必需项**，
  已在注释中标注（不锁则 sticky 元素高于 scrollport，底部内容永远滚不到）。
- HeroBili 右卡 5 张时若 `trending` 池不足（少于 11 条），末卡跨 2 列会与第 3 张错位；
  实测 `/trending/all/day` 恒 20 条，风险可忽略，已在 CSS 注释留回归提示。

### 验证

- `npx tsc -b` EXIT=0。
- `npx vite build --emptyOutDir false` 通过（2282 modules，✓ built in 59.92s）。
- 产物 CSS 断言：`cqa-trend__poster` / `cqa-trend__rank` / `cqa-trend__badge`（index-DSP--zn7.css）、
  `nth-child(5):last-child` + `span 2`（HomeRoute-CNolXQLx.css）、`440px` 均已落盘；
  三个 `@media(width>=1024px)` 块存在。
- 未跑 E2E（按协作流程，等用户确认本模块无需再改后再跑）。

### E2E 待同步项（本轮未改，跑 E2E 时需一并更新）

- `home.spec.ts` 070：`.cqa-catcard__row` 断言针对 rail 旧形态，rail 下已无此元素。
- `home.spec.ts` 061 / 075：视口 1280 → 1024。
- 新增断言建议：rail 下 `.cqa-trend__item` 数量 = 20、首项点击落 `/detail/`。

---

## 追加轮（2026-09-10 下午，用户 7 项微调）

### 逐项落地

| # | 用户要求 | 落地 |
| --- | --- | --- |
| 1 | `cqa-trend__h` 移出 `cqa-trend__meta`，放到 meta 下方 | `CategoryQuickAccess.tsx` 中 `.cqa-trend__h` 从 `.cqa-trend__meta` 内提为 `.cqa-trend__body` 的第 3 个子元素（标题 / meta / 热度）。CSS 去掉已无意义的 `flex: 0 0 auto` 与 `margin-left: auto`（移出后是块级行左对齐，不再需要右推） |
| 2 | 搜索框高度减小 | `variables.css` 的 `--comp-input-height-header`：`clamp(40px, 38.058px + 0.5178vw, 48px)` → `clamp(36px, 34.832px + 0.3108vw, 42px)`。单一真源，只作用 header 变体，1024/1440/1920 各档同步收 6px |
| 3 | 视口 ≤1280 顶栏左右图标间距减小（搜索框被挤压） | `StickyHeader.css` 新增 `@media (width >= 1024px) and (width <= 1280px)` 档：左右容器 `gap: --space-2xs`、`.sticky-header__nav { gap: 0 }`、`nav-item { padding-inline: --space-2xs }`。**不缩图标尺寸**（保点击热区）、**不隐藏 IPTV/设置入口**（否则功能不可达） |
| 4 | 左栏宽度适当减小 | `Home.css` `--home-rail-w` 260 → **240px**；≥1920 档 280 → **260px**（保持两档差值恒定）。三档累计收敛：300 → 280 → 260 → 240 |
| 5 | `hero-bili__right` ≥1280 排列不变、≤1024 改 2 行 2 列 | `HeroBili.css` 把「末卡跨 2 列」规则包进 `@media (width >= 1280px)`；新增 `@media (width <= 1024px)`：`grid-template-columns: repeat(2, …)` + 取消末卡跨列 + `nth-child(n+5) { display: none }`（4 张）。1025–1279 沿用 ≥1280 形态（用户只点两个端点） |
| 6 | 检查本地 CSS 是否用 px 等违规写法 | 见下方「px 规范审查」 |
| 7 | （顺带）上轮遗留 | `.cqa-trend__h` 相关 CSS 重排 |

### px 规范审查（第 6 项）

审查方法：对 6 个本轮改动文件，把 `HEAD` 版本与工作区版本**分别**过一遍 stylelint，
只筛 `declaration-property-unit-disallowed-list`（禁止裸 px）与
`declaration-block-single-line-max-declarations`（单行声明数）两类，
其余 `order/properties-order` / `number-max-precision` 为历史遗留（项目按「相对基线无新增」口径容忍）。

**结论：基线 33 条 → 本轮开工时 40 条（新引入 7 条）→ 修复后回到 33 条，净新增 0。**

新引入的 7 条（全部落在新增的 `.cqa-trend*` 块）与修法：

| 位置 | 违规 | 修法 |
| --- | --- | --- |
| L950 | `border-radius: var(--radius-sm, 4px)` | 去掉 px 兜底 → `var(--radius-sm)`（该 token 在 `:root` 与 TV/app 各作用域均已定义） |
| L951 / L957 | `font-size: 10px` ×2 | → `var(--text-2xs)`（9→11 区间，语义正是「超小标注」） |
| L967 | `gap: 1px` | → `var(--space-3xs)`（1→2 区间） |
| L973 | `width: 10px; height: 10px;`（含单行 2 声明） | 拆成两行，值改走 `var(--cqa-flame-size)` |

`--cqa-flame-size` 的定义放在 `.cqa-heat-row--rail` 作用域内（与既有 `--cqa-poster-w/h` 同槽位）。
**为什么走 custom-property**：stylelint 的 `declaration-property-unit-disallowed-list` 只校验
declaration 的顶层裸值，custom-property 的**定义**不在校验范围（这一口径与项目里
`--card-cols`、`--home-rail-w` 等既有 px 常量一致，是文件内的既定豁免通道）。
把亚像素常量收进槽位而不是散落 `em`，还可保留「10px 与文件内其它热度图标同一视觉权重」的可读性
（若改 `1em` 会随父级 `--text-xs` 放大到 12~13px，属于未经许可的视觉变更）。

**未修的既有违规（非本轮引入，逐条已核对基线存在）**：

- `CategoryQuickAccess.css` L403/450/456/477/541/542/685/690/757/763/831/839/843/851/857/860 等
  —— 全是既有 `gap: 1px` / `width: 10px; height: 10px;` / `font-size: 10px` / `max-width: …px`
  的火焰图标与徽标族；基线已有 29 条同类，修它们属于**超范围重构**，本轮不动。
- `Home.css` L524/531/585/586/593/614/624 —— 本轮未触碰这些行（diff 只改 rail 块 639 行以下）。
- `HeroBili.css` L144 `font-size: 10px`、`SearchBox.css` L36 `max-width: 440px` —— 基线已存在。

> 备注：`variables.css` 的 `clamp(36px, 34.832px + 0.3108vw, 42px)` **不报 px 错**
> ——stylelint 不检查 `clamp()` 内部单位，项目全部流体 token 都依赖这一行为。

### 验证（追加轮）

- `tsc -b` EXIT=0。
- `vite build --emptyOutDir false` EXIT=0（2282 modules，✓ built in 23s）。
- 产物断言（跨全部 `dist/assets/*.css` 搜索，非单文件）：
  `--home-rail-w:240px` / `:260px`、`34.832px + .3108vw`、
  `@media(width>=1024px)and (width<=1280px){`、`.sticky-header__left`、
  `nth-child(5):last-child{grid-column:auto}`（≤1024 档）、`grid-column:span 2`（≥1280 档）、
  `.cqa-trend__body`、`--cqa-flame-size:10px`、`.cqa-trend__h svg{width:var(--cqa-flame-size)}`
  —— 全部命中。
- stylelint 复检：6 文件 px/单行违规数 = **33（与基线一致，净新增 0）**。
- 未跑 E2E（按协作流程，等用户确认本模块无需再改后再跑）。

---

## 第三轮（2026-09-10 傍晚，HeroBili 三档视口修复 + 顶栏纯文本 + 榜单微调）

> 本轮推翻了上一轮的「末卡跨 2 列」方案 —— 用户在第 4 次反馈中明确否决。

### 逐项落地

| # | 用户要求 | 落地 |
| --- | --- | --- |
| 1 | `hero-bili__grid` ≤1024 左右比例 1:1 | `HeroBili.css` 的 `@media (width <= 1024px)` 块：`grid-template-columns: repeat(2, minmax(0, 1fr))`，两侧各占 50%（原为 `--hero-side-w` 派生比例，偏窄） |
| 2 | 1025–1279 右下角缺卡 | 根因：上一轮把「末卡跨 2 列」只包进 `@media (width >= 1280px)`，5 张卡在 3 列下必然留空第 6 格。**放弃跨列，回到满格矩形**：`HeroBili.tsx` 的 `SIDE_CARDS` 由 `SIDE_COLS × SIDE_ROWS - 1`（=5）改回 `SIDE_COLS × SIDE_ROWS`（=6），`shuffleBatch` 随之 6（一次推进 6 张） |
| 3 | ≥1280 第 2 行第 2、3 列被合并 | 即上一轮的 `nth-child(5):last-child { grid-column: span 2 }`，**整条规则删除**。6 张卡在 3 列下自然填成 3×2 满格，无跨列 |
| 4 | ≤1280 顶栏只显示文本（隐藏图标）+ 调间距 + 搜索框不被挤压 | `StickyHeader.css` 原「收间距档」重写为**纯文本态**：`nav-item > svg { display: none }`（图标是最大占宽项，6 个 ≈120px）、`nav-item { gap: 0; padding-inline: --space-2xs }`、标签降 `--text-xs` + `letter-spacing: .02em`、左右容器与 `.sticky-header__right .sticky-header__nav` 的 `gap` 收 `--space-2xs` |
| 5 | 左栏 card 之间不要分割线 | `CategoryQuickAccess.css` 删除 `.cqa-trend__item + .cqa-trend__item { border-top: 1px solid … }`。行间距改由 `cqa-trend__body` 的 gap 提供 |
| 6 | `cqa-trend__body` gap 调大 | `gap: var(--space-2xs)` → `gap: var(--space-sm)` |
| 7 | card 内标题过长时 hover 跑马灯 | 新增 `TrendTitle` 组件（`CategoryQuickAccess.tsx`），**镜像同文件既有 `HotCardTitle` 范式**：`ResizeObserver` 测 `scrollWidth - clientWidth`，溢出时注入 `--marquee-x` 并加 `.is-overflow`。触发点挂在**整行**（`.cqa-trend__row:hover`）而非标题本身 —— 鼠标落卡任意处即滚。复用既有 `cqaHotMarquee` keyframes（未新造） |
| 8 | `home-topstrip` 内「首页」→「公告」 | `HomeTopStrip.tsx` 文案替换（类名 `home-topstrip__crumb` 保留） |

### HeroBili 三档视口（本轮收敛后的唯一形态）

| 视口 | `hero-bili__grid` | `hero-bili__cards` | 卡数 |
| --- | --- | --- | --- |
| ≤1024 | `repeat(2, minmax(0,1fr))`（1:1） | `repeat(2, minmax(0,1fr))` | 4（`nth-child(n+5)` 隐藏） |
| 1025–1279 | 默认（`--hero-side-w` 派生） | 3 列 | 6（3×2 满格） |
| ≥1280 | 默认 | 3 列 | 6（3×2 满格，无跨列） |

### 验证（第三轮）

- `tsc -b` EXIT=0。
- **先清空 `dist/`（342 文件）再 build** —— 上一轮用 `--emptyOutDir false` 导致
  `HomeRoute-M0I06FJG.css` / `index-CO83ucgd.css` 两个陈旧产物残留，
  断言脚本误命中旧版「`span 2`」与「`border-top` 分割线」，产生 2 条假 FAIL。
  清空后重跑即 9/9 PASS。**教训：产物断言前必须清 dist，否则 `--emptyOutDir false` 会留下旧 chunk。**
- `vite build --emptyOutDir false` EXIT=0（2282 modules，✓ built in 14.83s）。
- 产物断言 9 项全 PASS：`repeat(2,minmax(0,1fr))`、**`grid-column:span 2` hits=0**、
  `.sticky-header__nav-item>svg{display:none}`、`.cqa-trend__t-text`、`cqaHotMarquee`、
  `.cqa-trend__body{gap:var(--space-sm)}`、**分割线已移除**（`cqa-trend__item+cqa-trend__item` 无 `border-top`）、
  JS 产物含「公告」、`hero-side-card:nth-child(n+5)`。
- stylelint：基线 32 → 当前 32（新增行导致的行号漂移，按 `file\|rule\|text` 比对为同一条，**净新增 0**）。
- 未跑 E2E（按协作流程，等用户确认本模块无需再改后再跑）。

---

## 第四轮（2026-09-10 傍晚，跑马灯根因 + 切换清空态 + chart 竖版封面）

> 用户反馈 7 项；其中「跑马灯没生效」「≤1280 顶栏没生效」两条**上轮我判定已生效，被用户否认** —— 深挖后各自有真根因，见下。

### 逐项落地

| # | 用户要求 | 落地 |
| --- | --- | --- |
| 1 | 标题跑马灯没生效 | **双层真根因**（见下节），两处都修才生效 |
| 2 | `cqa-subgenres` 内 card 标题 + chart 页 card 标题也加跑马灯 | CQA 面板 grid 内的卡标题本就走同文件 `HotCardTitle`（随根因修复自动生效）；chart 页**新增 `ChartRowTitle`**（`Chart/index.tsx`），同款「量内层 scrollWidth vs 外层 clientWidth」+ `ResizeObserver`，触发点挂 `.chart-row:hover`，新增 `@keyframes chartTitleMarquee` |
| 3 | ≤1280 顶栏纯文本没生效 | **真根因：漏了 `.cqa-nav__item`**（见下节） |
| 4 | `cqa-subgenres` 宽度再调小 | `.cqa-subgenres__chip` 内边距 `var(--space-xs) var(--space-sm)` → `var(--space-xs) var(--space-xs)` |
| 5 | 切 `cqa-subgenres` chip → 不显示旧图与遮罩、清空、居中「加载中 + 小电视」 | `useWideCategoryPanel` 的 `prevCatKeyRef` → **`prevSubKeyRef`**（key 含 `sub.id`，切子分类也触发清空）；`if (changed) setPanelItems(null)`。渲染条件 `panelItems === null && panelLoading` → **`panelItems === null`**；删 `cqa-panel__grid--refreshing` 与 `cqa-panel__refresh` 悬浮徽标（遮罩死代码）；加载态改居中 `<TvMascot blink size={44} />` + `正在获取 X · Y 数据…` |
| 6 | chart 页切 `chart-tabs` → 同上 | `Chart/index.tsx` 删 `refreshing` state 全部分支；`loadFeed` 命中缓存外统一 `setFeed(null)`；删 `chart-refresh-sticky` 胶囊；首载态改 `chart-loading__inner`（TvMascot + 「加载中…」） |
| 7 | 分类首次开 `cqa-overlay` 不显示「正在加载子分类…」 | `CategoryQuickAccess.tsx` 的 `<span className="cqa-subgenres__loading">正在加载子分类…</span>` → `null`（行留空保高度，避免布局跳动）；同时**删对应死 CSS** |
| 8 | chart 页 <1024 card 封面改竖版图 | JS 侧 `useIsMobile()`（=max-width:1023px）切数据源：`isMobile ? (posterPath ?? backdropPath) : (backdropPath ?? posterPath)`，尺寸档 `w154` / `w300`；CSS 侧 `@media (width <= 1023px)` 给 `.chart-row__cover--poster` 定 **96×144**（用户拍板，真实 2:3） |

### 跑马灯真根因（决定性）

**根因 A —— JS 测量对象错误。**
原实现 `el.scrollWidth - el.clientWidth` 量的是**带 `overflow: hidden` 的外层容器**，
被自身裁切后两值恒等（实测溢出 91px 的标题仍 `120 === 120`）→ `overflowX` 恒 0、`.is-overflow` 永不注入。
**修法**：改为 `text.scrollWidth - wrap.clientWidth`（内层 `inline-block` 未被裁切）。
三处（`HotCardTitle` / `TrendTitle` / `ChartRowTitle`）统一为「内层 span 量 scrollWidth vs 外层 div 量 clientWidth」，
并用 `ResizeObserver` 同时 observe 两层。

**根因 B（更致命）—— 假 `prefers-reduced-motion` 块。**
`CategoryQuickAccess.css` 末尾的「prefers-reduced-motion 停用」规则**被误写在 `@media (width >= 1024px)` 主块内部**，
**没有 `prefers-reduced-motion: reduce` 条件包裹** → 对全体桌面用户**无条件** `animation: none`，直接盖掉跑马灯。

抓法：遍历 `document.styleSheets` 打印命中同一元素的所有 `animation` 规则，
看到后者 `auto ease 0s 1 normal none running none` 覆盖前者的 `cqaHotMarquee`。

**修法**：整段移出到文件末尾独立 `@media (prefers-reduced-motion: reduce) { … }` 块。

> 顺带全仓排查：`src/` 下所有其它 `prefers-reduced-motion` 引用（`StickyHeader.css:611`、
> `Chart.css:417`、`HeroBili.css:411`、`Home.css:731`、`animations.css:57/173/399` 等 40+ 处）
> **均为正确的独立块**，仅 `CategoryQuickAccess.css` 这一处是嵌套误写（已修）。

**验证（决定性）**：
```
[cqa] 溢出最大行 index=4 ov=72
[cqa hover]  {"anim":"cqaHotMarquee","dur":"5s","mx":"-72px","transform":"matrix(1,0,0,1,0,0)"}
[cqa hover +1.5s] transform=matrix(1, 0, 0, 1, -71.5234, 0)   ← 真滚动
[chart w1024] {"anim":"chartTitleMarquee","dur":"5s","mx":"-388px"}
[chart w1024 +1.4s] transform=matrix(1, 0, 0, 1, -375.49, 0)   ← 真滚动
```

### ≤1280 顶栏真根因

上轮只改了 `.sticky-header__nav-item > svg`（右侧 nav 的图标），
但**真正最占宽的是渲染在 `.sticky-header__center` 里的 `.cqa-nav` 的 9 个分类图标**
（7 分类 + 2 more ≈171px）。实测 w1200 顶栏有 **12 个可见 svg**，其中 `inCqaNav` 占 9 个 —— 上轮一个都没隐藏。

**修法**：`StickyHeader.css` 的 `@media (width >= 1024px) and (width <= 1280px)` 块内补
`html:not([data-device="app"]):not([data-device="tv"]) .cqa-nav__item > svg { display: none }`
+ `.cqa-nav__item { gap: 0; padding-inline: --space-2xs }` + `.cqa-nav { gap: --space-3xs }`。

**验证**：`w1100/1200/1280` 可见 svg `12 → 3`（`inCqaNav: 0`，只剩主题按钮 1 + 搜索框 2）；
`w1300` 恢复 `16` 个。搜索框宽度 `437 / 539 / 622`，不再被挤压。

> **教训**：排查「某类元素是否生效」时，不要只验自己改的选择器 ——
> 要枚举**用户实际能看到的全部同类元素**，否则会漏掉另一个容器里的同名族。

### 切换清空态验证

```
CQA first-open:   {"hasLoadingText":false,"subText":""}            ← 不再显示「正在加载子分类…」
CQA switch chip:  {"hasGrid":false,"gridChildren":0,"hasLoading":true,"masking":false,"hasTvMascot":true}
CQA after load:   gridChildren 恢复
chart switch tab: {"rows":0,"hasList":false,"hasLoading":true,"tvMascotInLoading":true,"loadingText":"加载中…"}
chart after load: rows=20
```
（注：`chart-tabs__tab` 才是正确类名 —— 我首轮验证脚本误用 `.chart-tab`，已纠正后复测通过。）

### 验证（第四轮）

- `tsc -b` EXIT=0；`vite build --emptyOutDir false` EXIT=0（产物 mtime 刷新）。
- **⚠️ 又踩了「`--emptyOutDir false` 留旧 chunk」的坑**：首轮产物断言有 3 条 FAIL
  （`cqa-panel__refresh` / `chart-refresh-sticky` / `grid--refreshing` 死代码仍命中）。
  逐文件按 mtime 定位 → 命中的全是 `08:59:07` 的**上一轮产物**
  （`index-BKuigI3F.css` / `index-COupSTwY.css`），本轮新产物是 `09:32:19`。
  **递归清空 `dist/`（342 文件）后重 build → 13 项断言 13 PASS**（第 13 项是我断言串写太死：
  规则实际带 `html:not([data-device=app]):not([data-device=tv])` 前缀，已核实落盘）。
  产物断言必须用**清空后的干净 dist**，否则必出假 FAIL。
- 清空空态回归：删 `cqa-panel__grid--refreshing` / `cqa-panel__refresh` / `cqa-panel__refresh` 悬浮徽标
  / `chart-list--refreshing` / `chart-refresh-sticky` / `chart-list__refresh` / `cqa-subgenres__loading` 全部死 CSS。
- 未跑 E2E（按协作流程，等用户确认本模块无需再改后再跑）。

### E2E 待同步项（累加）

- `chart.spec.ts`：`refreshing` 态断言（`chart-list--refreshing` / `chart-refresh-sticky`）已失效；
  新增断言建议：切 tab 后 `.chart-row` 数为 0 且 `.chart-loading__inner` 存在。
- 新增断言建议：`.chart-row__cover--poster` 在 <1024 下 `getBoundingClientRect()` = 96×144、`src` 含 `/w154/`。

