---
date: 2026-09-22
module: boot-splash / layout-tokens
type: fix
build: npm run build 通过；npm run lint:all 通过；test:e2e:shots 29/29（截图 docs/screenshots/boot-splash/ 全量更新）
files:
  - index.html（启动骨架 CSS + 内联构建脚本）
  - src/assets/styles/layout-tokens.css（--chart-cols 迁入单真源）
  - src/assets/styles/index.css（--chart-cols 旧定义移除）
---

# 启动骨架 5 处与真实页错构修正 + 深色换一换白底修复

用户对照骨架截图逐项核查提出 5 问题，修复后重跑 `test:e2e:shots` 取证；二次核查又纠出 detail banner 与深色 shuffle 两处。

## 逐项（旧 → 新）

| 项 | 旧 | 新 |
| --- | --- | --- |
| browse 左栏 | 通用频道列表条 rail（标题 + 9 横条），与真实页 FilterBar 筛选组错构 | `filterRail()`：4 组「label + 2 列 chips + 组间 1px 分割线」，镜像 FilterBar rail 化（2026-09-14 拍板恒两列） |
| chart 内容区 | `listRows(8)` 单列 flex | `.bs-row--chart` 读 `var(--chart-cols)`（桌面 2 / ≤1023 与 App 1），与真实 `.chart-list` 同源；`--chart-cols` 基值+覆盖自 index.css 迁入 layout-tokens.css（单真源第 7 个 token） |
| detail banner | 纯灰块无卡壳、右栏内容自然高 → 上半截读作「一大块灰 banner」 | 实测真实页 hero 724×407 vs 骨架 719×404 **本就同尺寸**，无需缩；真因是右栏缺 surface 卡壳 → `.bs-detail__side` 补 bg+border+radius+padding 且 `align-self:stretch` 下沿与 banner 齐平（镜像 `.detail-hero-side` JS 锁高）；hero 另补真实页同款 `max-height: min(65vh, clamp(...))` 曲线（矮视口才生效） |
| detail 信息卡 | 曾尝试 flex 拉伸铺满整栏 | **用户否决拉伸**：恢复固定 3.25rem（镜像 `.detail-skeleton__info-card` 3.25em），栏底留白与真实页同构 |
| home 左栏（1920） | 趋势榜固定 8 行，1920×1080 下填不满视口 | 行数镜像真实 TOP 20（真实榜总高本就超首屏，溢出由 overflow 裁剪） |
| player 右面板 | 固定 7rem+13rem，总高与播放器脱钩 | side `align-self:stretch` 吃满 stage 高，面板按真实 `.player-panel` movie 变体 3:7 比例分配 |
| home 深色换一换 | 白底（≥1024 media 浅色规则带 `#boot-splash` ID 前缀特异性 1,2,1 压过 dark 规则 0,2,1） | dark 规则补同款 ID 前缀提权 |

## 教训（沉淀）

1. **骨架尺寸类反馈先量真实页再动手**：detail banner 两轮才修对——第一轮加的 max-height 在取证视口（1280×720）下不生效等于没改；用临时诊断 spec 实测真实页 `.detail-hero`/`.detail-hero-side` boundingBox 后才定位真因（右栏缺卡壳）。真实页 mock 数据路由要用 `tmdb-movie-550` 前缀 id（裸 TMDB id 会判成 CMS 落 not-found）。
2. **骨架内联 CSS 的深色规则注意 media 块里的 ID 前缀浅色规则**：`#boot-splash:not(...)` 前缀特异性高，普通 `html[data-theme="dark"]` 规则会静默失效；深色覆盖需带同级前缀。
3. layout-tokens.css 为今日新建文件，存量 `@media` 阶梯缺空行未过 stylelint，本次 `--fix` 补齐。
