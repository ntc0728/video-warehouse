---
date: 2026-09-12 03:15
module: Detail 页加载态（detail-page--loading）
type: fix
build: tsc -b 通过；vite build 通过；stylelint 相对 HEAD 零新增（基线 5 条未动）
files:
  - src/pages/Detail/Detail.css
demo: 无
---

## 旧 → 新

```css
/* 旧 */ .detail-page--loading { justify-content: center; }
/* 新 */ .detail-page--loading { justify-content: flex-start; }
```

## 根因与实测

骨架整改后 loading 分支渲染整页 `DetailSkeleton`（内容高 ~500px+），但宿主保留了旧
AppLoading 菊花时代的 `justify-content: center`——骨架被垂直居中到 `min-height:100%`
的容器中部，与顶栏之间空出大段（实测 1440×900：顶栏底 60px / 骨架顶 226px，空隙 ~166px）。
改顶对齐后骨架顶 68px（= 顶栏 60 + 页面上内距 8），空隙消除。

该类仅 Detail/index.tsx 的 tmdbLoading 分支使用（已 grep 确认），改动无外溢。

## 附带排查记录（未复现，不改代码）

用户反馈「大视口下顶部导航栏左侧出现导航菜单侧边栏 + 多个图标不显示」。在当前工作区
（HEAD + 并行会话 WIP）实测 1920/2560/3440/3840 web 及 `data-device="app"`@2560 模拟：
顶栏结构均为 `left(logo+导航) / center / right` 三段，零 broken svg、零零尺寸图标、无
drawer/sidebar/rail 类弹层节点；图片全部 abort 的极端口径下图标也完好。WIP diff 里亦无
侧栏/导航菜单相关改动（AppLayout=FAB 软刷新、StickyHeader=去 2200 封顶、CQA=趋势榜骨架）。
疑为长驻 dev server 静默 serve 旧 CSS / 浏览器缓存，或把首页左栏「今日趋势」榜
（≥1024 设计内的左栏）在其图片未加载时误认为异常。如仍复现，请提供截图与视口宽度。
