---
date: 2026-09-15
module: src/hooks/useGridCols.ts（新增）、各页 *Skeleton.tsx、src/components/common/Skeleton.css、src/components/TMDBMovieRow/index.tsx、src/pages/Home/index.tsx
type: feat
build: npm run build 通过（tsc -b 0 错 + vite build 29.18s）；stylelint 0 输出；design-audit --strict 无新增违规
files: ['src/hooks/useGridCols.ts', 'src/hooks/index.ts', 'src/components/common/Skeleton.css', 'src/pages/Collections/CollectionsSkeleton.tsx', 'src/pages/Browse/BrowseSkeleton.tsx', 'src/pages/IPTV/IPTVSkeleton.tsx', 'src/pages/IPTV/IPTVSkeleton.css', 'src/pages/Person/PersonSkeleton.tsx', 'src/pages/Detail/DetailSkeleton.tsx', 'src/pages/Home/index.tsx', 'src/components/TMDBMovieRow/index.tsx']
demo:
---

## 骨架占位张数改为「列数 × 行数」派生 + 页级骨架延迟淡入

承接同日 `2026-09-15-2025-boot-splash-history-cols-and-fill`（该片段末尾已把「张数硬编码」列为未决项）。

### 方案取舍：选 B（视口填满），并按「读 token」而非「测视口」落地

用户提出两条路线 + 征求其他方案，最终拍板 **B+**：

| 方案 | 做法 | 判决 |
| --- | --- | --- |
| A | 请求期一直显示全屏 AppLoading，数据到达后再显示骨架 | ✗ 见下三条 |
| **B** | 请求期就显示骨架，张数按视口填满 | ✓ 采纳 |
| B+ | B + 骨架延迟 150ms 淡入（吸收 A 唯一合理内核：抑制快请求下的骨架闪烁） | ✓ 采纳 |

**否决 A 的三条理由**：

1. **前提不成立** —— 骨架是**结构级**的（分区头 / 筛选条 / 左栏 / 网格），这些结构不依赖接口，请求期就能画。用全屏 AppLoading 盖住 = 把已知的视觉信息扔掉，感知等待反而变长。
2. **多一跳** —— 现状 2 态（骨架 → 内容），A 变 3 态（全屏菊花 → 骨架 → 内容），且「数据到了又变回骨架」观感像倒退。
3. **后半段是重复建设** —— A 的「数据到·图未到再显示正确骨架」，与 `LazyImage` 的 shimmer 占位（`--color-placeholder-shimmer-a/b`；VideoCard / RecordCard / IPTVChannelCard 全经它渲染封面）完全重叠，且它的张数是**真实条数**，天然精确。

**概念澄清**：「骨架 + loading」不是二选一，项目是分层在做 —— `AppLoading` 管「连页面结构都不知道」的阶段（路由 chunk 未到位），`XxxSkeleton` 管「结构已知、数据未知」的阶段。A 等于把第二层的活抢给第一层。

### 旧 → 新（张数）

| 骨架 | 旧（写死） | 新 |
| --- | --- | --- |
| CollectionsSkeleton | 影视 8 / IPTV 6 | `--card-cols × 3` / `--iptv-cols × 3` |
| BrowseSkeleton | 16 | `--card-cols × 3` |
| IPTVSkeleton | 频道 12 | `--iptv-page-cols × 3` |
| PersonSkeleton | 14 | `--card-cols × 3` |
| Home 骨架行 | 每行 7 张 | `ceil(--row-cols × 1.5)`（横滚行要「一屏整卡 + 半屏溢出」） |
| Home HeroBili 右栏 | 6 张 | `useHeroSideCols() × 2`（1024–1280 自动降 4 张） |
| TMDBMovieRow `SkeletonCards` | `count = 12` | `ceil(--row-cols/--continue-cols × 1.5)` |
| DetailSkeleton | 4 chips / 4 info | **不动**（结构项数，非网格张数） |
| IPTVSkeleton 左栏 | 9 行 | **不动**（填的是左栏高度，与列数无关） |

**新 hook `useGridCols(token, fallback)`**（`src/hooks/useGridCols.ts`）：读 `documentElement` 上 CSS 数字 token 的计算值并取整；视口跨断点由 `ResizeObserver` 捕获、设备档切换由 `MutationObserver(data-device)` 捕获；`useLayoutEffect` 保证首帧按 fallback 渲染后 paint 前修正。

**为什么不在 JS 里再刻断点表**（`useMediaQuery` 逐档判断）：那会让列数出现第二个真源，与 `variables.css` / `index.css` 必然漂移（本项目已多次发生「骨架列数与真实网格差一档」）。现在**列数真源仍是 CSS**，改断点只改 CSS 一处。

**行数 3 的取值依据**：只要求「视口内填满 + 末行完整」；视口外多出的行不可见，故取 3 行而非精确测量 —— 精确测视口需监听 resize + 首帧测量不准 + 与真实卡高耦合，收益不抵复杂度。

### 顺带修正

1. **IPTVSkeleton 列数 token 用错**：骨架写 `--iptv-cols`，而真实网格自 2026-09-08 起是 `.iptv-page .iptv-channel-grid` → `--iptv-page-cols`（左栏吃宽降一档）。后果：1024–1439 骨架 4 列 vs 真实 3 列、1440–2559 骨架 5 列 vs 真实 4 列。已改为 `--iptv-page-cols`。
2. **骨架闪烁**：`.skeleton-scope` 给页级骨架根容器加 `animation-delay: var(--dur-2xs)`（150ms）+ `fill-mode: both` —— 前 150ms 停在 `opacity: 0`（**DOM 与布局占位始终存在，不影响 CLS / 不触发重排**），之后淡入。请求 <150ms 时骨架从未可见；`prefers-reduced-motion: reduce` 下 `animation: none` 立即可见。
   零 JS、零分支改动，故未复用现成的 `useDelayedFlag`（那需要每页额外处理「延迟期间显示什么」，且 Collections 那种三元表达式延迟期间会闪空态）。
   覆盖：Collections / Browse / IPTV(×2 分支) / Person / Detail / Home 两个骨架根。`PlayerSidebarSkeleton` 因根是 `display: contents`（不生成盒子、动画无效）且为面板行数，未加。

### 已知遗留（未动，需单独决策）

- **Person 骨架在 768–1023 与真实网格仍差一档**：`Person.css` 把真实 `.person-work-grid` 在该档锁 5 列（跳过 `--card-cols` 的 4），骨架按 `--card-cols` 取 4。修它要么改真实页面列数（观感变动），要么给骨架另立 token（第三真源），故不在本次范围。已在 `PersonSkeleton.tsx` 顶部注明。
- **非网格类固定档数保留**：Browse 的 5 品类 tabs / 3 排序 tabs、Detail 的 4 chips / 4 info、PlayerSidebar 的 2/6/6 面板行 —— 这些是**结构项数**（对应真实 UI 的固定档数），不属「卡片张数」。

### 验证

- **`useGridCols` 读取链**（Playwright + preview 产物，5 视口）：`--card-cols` = 3 / 4 / 5 / 6 / 7，`--row-cols`（= `var(--card-cols)` 别名）**逐档完全一致** —— 证明自定义属性的 var() 别名可被 `getPropertyValue` 解析（这是本 hook 成立的前提）；`--iptv-cols` = 2/3/4/4/5，`--iptv-page-cols` = 2/3/3/3/4（证实 1024 起两者分叉，即上条修正的依据）。
- **`.skeleton-scope` 计算样式实测 PASS**：`animation-name = skeleton-scope-in`、`animation-delay = 0.15s`、`animation-fill-mode = both`、`duration = 0.2s`。
- **骨架 border 实测**（顺带回答「骨架卡片边框多粗」）：所有骨架灰块（`.skeleton-block` / `__cover` / `__avatar` …）计算 `border-width` 均为 **0**，只有 `border-radius`；带边框的是 5 处**白底容器卡**，统一 `1px solid var(--color-border-light)`（= `#e8e8e8` 浅色 / `#2b2b2b` 深色）：`.iptv-skeleton__content`、`.iptv-skeleton__rail`（仅 border-right）、`.person-skeleton__card`、`.detail-skeleton__side`、`.home-skeleton-row`（另带 `--shadow-sm`）。
- `npm run build`：`tsc -b` 0 错 + `vite build` 21.24s。产物 `Skeleton-*.css` 为 `.skeleton-scope{animation:skeleton-scope-in var(--dur-sm) var(--ease-standard) both;animation-delay:var(--dur-2xs)}` + reduced-motion 的 `{animation:none}`。
- `stylelint src/**/*.{css,scss}` 0 输出；`design-audit --strict` 无新增违规。
  - 首版把 `150ms` 写进 `animation` 简写，被 `timing-literal` 判为**新增违规**（该检查不区分 delay 与 duration）→ 改为独立 `animation-delay` + `var(--dur-2xs)`（值同为 150ms）后通过。

**两个测试坑（写入本片段，避免下次重复踩）**：

1. **逐路由运行时错误检查未完成**：沙箱 chromium 在遍历到第 2 个路由时 `Target crashed`（该环境已知限制：视口 ≥1600、或连续多 page/长时运行必崩）。替代证据：`tsc -b` 覆盖 hook 类型正确性；`ResizeObserver` / `MutationObserver` 均为标准 API，回调里只有 `getComputedStyle` + `setState`。
2. **注入 CSS 做计算样式测量时，必须一并注入 token 层**：只注入骨架 CSS 时，`var(--color-border-light)` / `var(--dur-sm)` 等解析不到 → **整条声明静默失效**，会读出 `border: 0px`、`animation-name: none` 这类**假数据**（首次测量即因此得出全 0 的错误结论）。注入 `variables.css` 后同批探测全部得到真实值。

### 待提炼（push 前）

- `docs/agents/patterns.md` §页面骨架占位（2026-09-12 定稿）需补两条红线：①张数 = 列数 × 行数、列数运行时读真实网格同源 token，禁止写死张数；②页级骨架根加 `.skeleton-scope` 延迟 150ms 淡入。
- `docs/agents/css-layout-conventions.md` §8 骨架占位的核心红线复述区同步。
