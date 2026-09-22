---
date: 2026-09-22
module: layout-tokens / variables / Home / HeroBili
type: 行为修复（骨架共存文本 / 行卡弹入抖动 / banner 超大竞态）
build: ✅ npm run build + lint:all 全绿
tests: boot-splash 21/21 · skeleton 18/18 · boot-splash-iso 42/42 · home 1.1 ✓ + 临时观察 spec（已删）
---

# 首页骨架三连修：共存文本解释 + 行卡弹入抖动 + banner 超大竞态

## ① 「真实文本与骨架共存」——机制说明（非缺陷，未改代码）

实测确认：`isInitialLoading = (trending||nowPlaying loading) && !hasAnyData`，
hero 数据先到 → 整页从全骨架切到真实树，其余 6 块仍在 loading →
行渲染真实 `<TMDBMovieRow title isLoading>`（09-18「骨架直接渲染真实组件」拍板）→
**行标题（正在热映/热门电影…）是真实静态文本 + 行内 SkeletonCards 灰卡**。
这是同构设计（标题非接口数据），共存窗口 = 各块请求的时差。若要纯灰条标题另行拍板。

## ② TMDBMovieRow 行骨架「严重抖动」——修复

实测：骨架行 307px vs 真实行 306px、卡 236/235、宽 139 全一致（几何无跳变）；
真凶是**数据到达时整行卡片重挂并逐个重放 `animate-card-enter`**（8 块各自到达 ×
每行几十卡弹入，与逐块替换叠加）。首页本有整层 `page-transition-enter` 淡入，
行级入场动画冗余。
修复：`renderHomeRows` 的真实 `<TMDBMovieRow>` 恒传 `skipAnimations`
（复测 `hasEnterAnim:false`）。分类切回等场景同由层动画承担。

## ③ banner 骨架「异常超大尺寸」——CSS 竞态，根因修复

根因：`--hero-banner-h/--hero-side-w` 双定义——variables.css `:root` 兜底按
「全视口宽」算（@1440 = 339px），真值在 Home.css `.home-two-col__main` 生效点
（右列宽分母，@1440 = 255px）。**Home.css 随 HomeRoute 懒 chunk 加载**，
骨架首帧命中不到生效点就吃兜底 → banner 瞬时超大、Home.css 落地后回缩（闪跳）。

修复（单真源收敛）：
- `--hero-banner-h / --hero-side-w`（1024–1280 / ≥1281 / ≥2560 三档）+
  `--page-pad-x`（60/100/140 分档）整体迁入 **layout-tokens.css**——
  主 CSS（variables @import）与骨架注入（vite 插件）**双路首帧可得**，无懒 chunk 窗口；
- Home.css 生效点三块删除（留注释指向）；variables.css :root 兜底与 pad 分档删除；
- 启动骨架 `.bs-herobili` 宽屏档改 `var(--hero-side-w)/var(--hero-banner-h)` 直接消费，
  **删掉 --bs-main-w/--bs-pad 手抄公式**（此前 splash 是第三套拷贝，现三方同一真源）。
- 产物实锤：`--hero-banner-h:calc` 定义 = index-*.css 3 处 + dist/index.html 3 处、
  HomeRoute-*.css **0 处**（竞态源头移除）。

## 验证

- build ✓ lint:all ✓（中途 layout-tokens 双 :root 触发 no-duplicate-selectors，已合并基值块）
- 观察 spec：banner 高度轨迹 20 帧恒 255 ✓、真实行 hasEnterAnim=false ✓（spec 已删）
- 回归：boot-splash 21/21、skeleton 18/18、**iso 42/42**（骨架↔真实列数/几何三方同源）、home 1.1 ✓
- 全量 E2E 未跑（未放行）。

## 遗留

- splash 侧 `--page-pad-x` 的 <1440 档 fallback 14.333px 与 bundle 侧 fluid space-lg
  （×ui-scale）仍有自动档乘数残差（layout-tokens 注释已声明）。
- `--home-rail-gap`（Home.css）与 token 公式的 space-lg 引用为**约定同步**而非同一变量，
  注释已互指。
