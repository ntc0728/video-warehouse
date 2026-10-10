---
date: 2026-10-09 14:55
module: Home / Browse / RecordShell / HeroBili
type: refactor
build: pass
files:
  - src/components/HeroBanner/HeroBili.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/CategoryQuickAccess/index.ts
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
  - src/assets/styles/index.css
  - src/pages/Browse/BrowseChromeSkeleton.css
  - src/components/RecordShell/RecordShell.css
  - index.html
demo: 无
---

# 四项细节调整：首页左栏残留清理 / 换一换去自动轮换 / Browse 骨架撑满 / rail 排序不换行

## 1. 首页左栏残留代码清理（2026-09-29 左栏删除的收尾）

删除无人引用的死代码（全仓 grep 证实零消费方）：

- **组件**（CategoryQuickAccess.tsx，−253 行）：`CategoryHeatRow`（row+rail 两变体）、
  `CategoryTrendSkeleton`、`CategoryTrendList`、`TrendTitle`、`CategoryHeatCards`、
  `TREND_MAX_ITEMS`/`TREND_SKELETON_ROWS`；`useFillRows` import 一并移除。
- **导出**（index.ts）：`CategoryHeatRow` 移出。
- **CSS**（CategoryQuickAccess.css）：`.cqa-trend*` 全系、`.cqa-catgrid/.cqa-catcard*` 全系、
  `.cqa-heat-row(--rail/__head/__title/__sub/__more)` 全系；`--cqa-poster-*` 宿主收敛为
  `.cqa-overlay` 单一规则（并入 mega 面板规则，消 no-duplicate-selectors）；
  reduced-motion 块剔除 catcard/trend 选择器。
- **全局按压豁免**（index.css）：6 处 `:not(.cqa-catcard)` 死豁免移除（元素已不存在，
  行为恒等）。
- **boot-splash 骨架**（index.html）：home 形态删 `.bs-rail`+`heatRail()/heatItem()`
  左栏分支（two-col 回单列），删 `.bs-home__railcard`/`.bs-heat*` CSS 与
  `--home-rail-w` 引用（token 已于 09-29 删除，此前 fallback 240/260 生效=死值）、
  对应 dark 主题条目与 `.bs-home__cols` 容器。

## 2. HeroBili「换一换」取消自动轮换（用户 2026-10-09 要求）

- 删除 P3-A 自动轮播整块（8s interval + hover/focus/visibility 暂停 + app 端
  `isNativePlatform` 排除），`SHUFFLE_AUTO_MS` 常量与 `isNativePlatform` import 随删。
- 保留：手动点击推进 + 0.6s is-spinning 动画锁防抖 + banner 自身 5s 轮播（不受影响）。

## 3. Browse 左栏筛选骨架占满剩余高度（用户要求）

- BrowseChromeSkeleton.css ≥1024 新增：根盒 `align-self: stretch` 吃满 row2（1fr），
  三组 `.filter-bar__row` `flex: 1 1 auto` 均分剩余高度（组内容顶对齐、组距铺开）。
- 动机：真实 rail 的右 1px 分割线在骨架期中途截断（agent-rule-violations #25 同型）。
- 特异性 (0,4,1) 压过 Browse.css `.filter-bar` (0,3,1)，与 import 顺序无关。

## 4. 收藏/历史左栏排序长文本不换行（用户要求）

- RecordShell.css ≥1024：`.record-aside` rail 的 `min-width: 0` → `min-width: max-content`
  —— 选中「评分从高到低」（Collections）/「评分高到低」（History）时 rail 自动加宽到
  单行宽度；短文案时仍走 `--rail-w`，不破坏四处左栏统一宽度曲线。
- `.record-inline-filter .record-sort-btn` 加 `white-space: nowrap`。

## 5. E2E spec 整改（用户拍板本轮一并处理）

- **scripts/home.spec.ts**（13 用例数不变，段内改写）：
  - `waitPageReady` 就绪信号剔除 `.cqa-heat-row`；072/076/080/081/082/084 的
    「等左栏可见」就绪等待迁移到首行 `.home-page:not(.home-skeleton) .tmdb-movierow`；
  - 071：删左栏排名连续性断言，保留 `.home-topstrip__stat` 含「今日趋势」；
  - 083：点击目标 `.cqa-trend__row` → `.hero-side-card`（同为首页常驻 /detail 入口）；
  - 077：左栏趋势行点击 → 面板卡 `.cqa-overlay .cqa-hotcard` 点击；
  - 079：前置等待 `.cqa-trend__item` → `.home-topstrip__stat`。
- **scripts/boot-splash.spec.ts**（21→19 用例）：删「home ≥1024 带左栏 240」
  「home 1920 档栏宽 260」两条用例（断言对象已不存在）。
- **计数同步**：`test-count-report.mjs --write` ✓（全仓 246→244、skeleton 档 39→37）；
  `--check`（lint:test-map）✓ 五项校验全过；`playwright test --list` 两 spec 解析 ✓（32 条）。
- 本轮**未实跑 E2E**（未经用户要求）。

## 验证

- `tsc -b` + `vite build --emptyOutDir false`：pass。
- stylelint 四个改动 CSS：0 问题（含消掉 1 条历史 duplicate selector）。
- ESLint 三个 TS/TSX：0 error（1 条既有 react-refresh warning）。
