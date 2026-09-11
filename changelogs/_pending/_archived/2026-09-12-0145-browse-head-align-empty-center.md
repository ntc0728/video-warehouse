---
date: 2026-09-12
module: pages/Browse
type: ui
build: pass
files:
  - src/pages/Browse/Browse.css
demo: playwright 实测（dev 3001，1440/1920/600 三视口）
---

# Browse：首行等高对齐 + 左栏/结果区顶对齐 + 空态与 loading 视口居中

## 用户指令（2026-09-12 01:26）

1. 分类是否「写死一部分 + 接口取值」？（询问，未改代码）
2. 左栏有高度 → 右侧空态提示不在可视范围居中，要单独处理
3. loading 位置同样问题
4. browse-search-tabs 与 browse-sort-bar 等高对齐（宽度可适当调整）
5. filter-bar 与 browse-results-body 上方对齐

## 旧 ↔ 新对照（均在 ≥1024 非 TV/App 作用域）

| 项 | 旧 | 新 |
| --- | --- | --- |
| 分类数据 | 类型行 7 档 = `Browse/constants.ts` `CATEGORY_CONFIG` 写死（综艺=genre 10764 / 动漫=16 / 纪录片=99）；可选流派 = TMDB `/genre/movie|tv/list` + `/genre/tv/list` + `/genre//countries`（`useTMDBStore.fetchGenresAndCountries`，zustand 缓存按语种）；地区/年份 = `FilterBar/constants.ts` 写死；CMS 面板分类 = 写死 5 档 | 未改（回答确认） |
| 首行高度 | tabs 28.3px vs sort-bar 45.9px（不等高） | 两列 `align-self: stretch` → 同为 45.9px（1920=46.7），y 相同 |
| 行间距 | tabs margin-bottom(--space-sm) | 上提为 grid `row-gap: var(--space-sm)`（margin 会让 stretch 后盒高不等） |
| 顶对齐 | results-body padding-top 7.9px → 右栏内容低于左栏 7.9px | results-body `padding: 0 sm sm`，filter-bar 与 results-body 顶边齐平（121.8/121.8 @1440） |
| 空态位置 | results-body 内 flex 居中 → 中心 = 506.9（1440），偏下 ≈57px | `position: fixed; right/bottom/left; height: 100dvh` → 中心 = 450 = 视口中心（600 视口 = 300 ✓，1920 = 540 ✓），页面零滚动 |

## 关键实现说明

- **空态/loading 视口居中**（同一条规则覆盖 `.empty-state-wrapper` 与 `.app-loading`，二者均为 results-body 直接子元素、条件渲染，有数据时零作用）：
  - ⚠️ 不能用 `top: 0`：祖先 `.custom-scrollbar-container` 带 `contain: layout`，fixed 退化为相对内容区（实测 probe top:0 → [60,900]）；
  - `bottom: 0 + height: 100dvh` 实测精确落 [0,900]，无需知道 header 高度，不产生滚动条；
  - 水平 `left: calc(--page-pad-x + --rail-w + --space-2xl); right: --page-pad-x` = 精确右栏范围（实测 x=240.4/327.6 与右栏逐像素吻合）。
- stylelint order：`right` 需排在 `bottom`/`left` 之前。

## 二次修正（2026-09-12 01:50 用户反馈）

1. **等高对象改为 sort-bar 主体**：sort-bar 有 `padding: 0 0 var(--space-sm)`（底 7.9），
   主体高 38 ≠ 盒高 45.9。tabs 同样 stretch 到行高后加 `padding-bottom: var(--space-sm)`
   → pill = 38 与主体等高、顶边齐平；row-gap 回退 0，下间距由两者各自 padding-bottom
   提供（同值 7.9，content bottom 均为 105.9）。head 统一补 padding-bottom
   （source-status-row 原本没有）+ align-items: start（顶边对齐）。
2. **loading 位置三次定稿**：① 右栏内居中（初版）→ 用户「很靠右」；② 内容区居中（cx=720）
   → 用户明确「loading 应在 browse-results-body 内水平居中」→ ③ 最终：loading 单独规则
   `left = pad-x + rail-w + space-2xl`（cx = 810.2 = resultsBody 中心），垂直仍视口居中；
   空态保持内容区居中（cx=720）。**关键 bug**：组件层 `.app-loading--inline` 的
   `width: 100%`（相对 containing block）会把 fixed 的 left/right 撑掉 → 探针实测
   w=1440、中心 780 偏右 60 —— 这才是「很靠右」的真凶，`width: auto` 修复。
3. 复测（1440）：pill 38 = sortBody 38 同 y 同 bottom；filterBar.y = resultsBody.y = 113.9；
   loading cx=810.2 cy=450；empty cx=720 cy=450；scrollH=900 无滚动。1920 同构成立。
4. build EPERM 坑：dev server 运行中跑 build，gzip 插件写 dist/*.gz 报
   `EPERM: sourceService-*.js.gz`（文件被 dev 占用）→ 停 dev 后重跑干净通过。

## 三次修正（2026-09-12 02:05 用户拍板）

loading 垂直参照从「视口」改为「results-body 可视范围」：
- results-body 高 = 视口剩余（1fr 行）且加载态页面无滚动 → 其内部居中 = 可视范围居中，
  无需 fixed。改用 `:has(> .app-loading)` 仅在含 loading 时把 body 变 flex column
  （⚠️ 常驻 flex 会让网格掉进 flex 语境，触发 Chromium auto-fill grid 1 列内在高度
  假设坑——与 .filter-bar__row 同根因），loading 自身 flex:1 拉伸 + 组件层 flex center。
- 补刀：loading 态下 body 的 padding-bottom 归零（无 padding-top 不对称会让中心
  偏高半个 padding，实测 503 vs 506.9）→ 精确居中。
- 最终实测（1440）：loading cx=810.2=resultsBody 中心、cy=506.9=可视中心；1920 同构
  （1073.8/599.4）。空态不变（cx=720=视口中心、cy=450）。pill 38=sortBody 38。
- build 瞬态错误坑：dev 刚停立即 build 报空的 "error during build"（.gz/.br 文件句柄
  延迟释放），稍候或用 spawnSync 重跑即 EXIT=0。

## 验证

- playwright 实测（1440×900 / 1920×1080）：pill=sortBody=38 同 y 同 bottom；filter-bar.y = resultsBody.y；empty 中心 = 视口中心；loading 中心 = results-body 可视范围中心；scrollH = 视口高（无滚动）
- `vite build` EXIT=0（18.35s 前台 spawnSync）；stylelint 15 条 = 基线，零新增
- loading 真实触发未捕获（mock 接口秒回），几何用注入 `.app-loading--inline` 探针验证

未 commit、未 E2E（待用户确认）。
