---
date: 2026-10-10 20:30
module: 零散修复（Home/Browse/Detail/Player/SearchBox）
type: fix
build: pass
files:
  - src/assets/styles/variables.css
  - src/components/HeroBanner/HeroBili.css
  - src/components/SearchBox/SearchBox.tsx
  - src/components/StickyHeader/StickyHeader.tsx
  - src/pages/Browse/BrowseMobileBar.css
  - src/pages/Detail/Detail.css
  - src/pages/Detail/index.tsx
  - src/pages/Home/Home.css
  - src/pages/Home/HomeTopStrip.tsx
  - src/pages/Player/Player.css
  - src/stores/useTMDBStore.ts
demo: 无（浏览器实测见下）
---

# 零散问题批量修复（8 项）

## 1. 首页 hero-bili banner 胶囊背景 + 卡片行底部对齐
- `HeroBili.css` `.hero-bili__meta > span`：评分/年份/类型胶囊底色 `rgba(0,0,0,0.45)` → `rgba(0,0,0,0.72)` + `backdrop-filter: blur(6px)`（与 `.hero-side-card__corner` 同档）。原 0.45 与底部渐变字幕同色，亮 backdrop 上几乎无对比 → 用户反馈「看不见」。实测计算值 bg=rgba(0,0,0,0.72)、blur=blur(6px)。
- 卡片行与 banner 底部对齐（用户澄清「图片与图片对齐，而不是标题与图片对齐」）：原不变量是 banner 下沿 = 第二行【卡（含标题条）】下沿。改为 banner 下沿对齐第二行【封面】下沿，第二行标题条悬于 banner 下方。
  - `variables.css` 新增 `--hero-title-bar-h: calc(2*space-xs + 1.4*hero-title-size)`（单行标题条高）。
  - `HeroBili.css` `.hero-bili__banner`：`height: 100%` → `calc(100% - var(--hero-title-bar-h))`，`min-height` 同步减一个标题条。网格行高仍 = 右栏两行卡总高（由右栏内容驱动），banner 取行高减一个标题条 → 下沿落在第二行封面底。
  - Playwright 实测 1100/1280/1440/1920：`banner.bottom - 第二行封面.bottom = 0`（严格对齐），比卡底高约一个标题条（-25~-28px）。boot-splash 宽屏档仍走 flex stretch（全高），冷启动 boot→骨架 交接有约一个标题条的瞬时差，未强改注入侧占位（bundle token 不在注入层）。

## 2. 顶部搜索框在纯本地页不联网
- `SearchBox.tsx` 新增 `allowLiveSearch` prop（默认 true）：为 false 时跳过 `/search/multi` 实时建议请求，下拉在输入时仍显历史/热门（不切空的建议分支）。
- `StickyHeader.tsx` 新增 `LIVE_SEARCH_DISABLED_PAGES = ['/collections','/history','/settings','/source-checker','/proxy-setup']`，按路由派生 `allowLiveSearch` 传入。

## 3. Browse 搜到 1 条却显示很多页
- 根因：`useTMDBStore.search` 把 `/search/multi` 的 `total_results`（含人物/其它类型、未经客户端筛选）原样写入 `discoverPagination.totalResults`；逻辑分页按此算 `totalPages` → 「1 部电影 + 一堆人物」虚报成很多页、翻页全空。
- 修法：按本页「视频条数 / 原始条数」比例折算出视频口径总数估计（`Math.min(total_results, round(total_results * video/raw))`）。

## 4. 移动端 Browse 模式段钮过高
- `BrowseMobileBar.css` `.bmb-seg`：`min-height: var(--comp-tab-height)`（移动端≈36–38px）→ `30px`，padding `--space-xs`→`--space-2xs`，与同文件紧凑档（filter-trigger 28px / chip 26px）对齐。本组件仅 <768px 生效。

## 5. detail / play 推荐 video card 封面缺圆角
- 桌面去卡片化后 `.video-card` 容器 radius 被削（`VideoCard.css:98`），推荐卡封面变直角。
- `Detail.css` 加 `.detail-recommend .video-card-cover { border-radius: var(--radius-md) }`、`Player.css` 加 `.player-recommend .video-card-cover`，均 `@media (width>=768px) :not(app):not(tv)`，与首页 `Home.css` 同口径。

## 6. detail 演员 / 季海报失败占位 + 季海报小视口尺寸
- 演员头像、季海报由裸 `<img>`（仅「无 path」兜底，加载失败露裂图）→ `LazyImage`：统一「加载中骨架 / 失败兜底 / 无图」三态，失败与无图都落同一占位（演员 UsersIcon 圆框、季海报 Layers 矩形），与 video card 封面效果一致。
- 季海报基础宽 `--layout-time-display-min-w`（90→123px，768–1023 档命中上限偏大）→ `clamp(64px, 5vw, 88px)` + `aspect-ratio: 2/3`。实测 1440 下 72px 宽。
- 「数据不完整」需具体条目复现（TMDB season 字段 vs 取值），暂待用户提供案例。

## 7. play 剧集/线路面板未占满剩余高度（已定位并修复）
- 用户提供完整截图（~2560 宽）后复现：宽视口下 16:9 播放器很高，侧栏两面板（CMS源 + 选集）却很短、下方大片空白。
- **根因**：桌面 `.player-sidebar` 用 grid + `grid-template-rows: var(--panel-rows)`，`--panel-rows` 由 `PlayerSidebar` 按 `variant` 硬编码行数（tv=3 行 auto auto 1fr / movie=2 行）。但 `hasSeasonPanel`（据 cmsSeasons + `tmdb-tv-` 前缀）判 tv 时，`PlayerSeasonPanel` 在单季/无季时 `return null` → 实际只渲染 2 个子项。3 行模板 vs 2 子项错位：1fr 落到第 3 行（幽灵空行），选集被压成第 2 行 auto（内容高）→ 面板矮 + 下方空白。Playwright 实测 2560×1250：epsH=140、gridRows 第 3 行 702px 空。
- **修法**：`Player.css` 桌面侧栏由 grid 行模板改为 flex 列（`display:flex; flex-direction:column`），面板按【实际渲染子项】分配高度：收起 `flex:0 0 auto`（只 header）、展开 `flex:1 1 auto`（撑满）。天然免疫子项数≠行数。容器高度恒定（min-height:100%==播放器高），flex:1 与旧 1fr 等价、无过冲。实测修复后 2560×1250 epsH=852（==侧栏/播放器高）。
- 附带：`--panel-rows` 内联变量桌面已无消费方（保留无害）；all-collapsed 规则注释同步更新（align-content 为 grid 残留、flex 下无害）。

## 8. detail 基本信息「主创」单独整行
- `Detail/index.tsx`：`createdBy`（主创）从普通 `factCells` 网格格移出，改渲染为 `detail-fact--full` 整行，与「国家 / 发行」一致。

# 第二批（同日晚，用户追加）

## A. hero 胶囊分色（评分金 / 年份浅白 / 类型浅绿）
- 采纳用户建议：`HeroBili.css` 三枚胶囊改为「浅色实底 + 深色字」同族胶囊——评分 `rgba(250,204,21,.92)`、年份 `rgba(255,255,255,.82)`、类型 `rgba(134,239,172,.9)`，文字均深色。caption 恒深色渐变底，浅底胶囊高对比、语义分明。
- ⚠️ 选择器需 `.hero-bili__meta > .hero-bili__rating`（0,2,0）才能压过基座 `.hero-bili__meta > span`（0,1,1）——首版用裸 `.hero-bili__rating`（0,1,0）被基座盖掉、实测仍全黑，已修正。rgba 不走 hex，避开硬编码色 lint。

## B. 首页今日趋势轮播 + 继续观看/收藏 可点击
- `HomeTopStrip.tsx`：轮播条 `home-topstrip__rotator-item` 由 `<span>` → `<Link to="/detail/${item.id}">`（TMDBVideoItem.id 已是 `tmdb-movie-N`/`tmdb-tv-N`）；继续观看 pill → `/history`、收藏 pill → `/collections`。
- `Home.css`：两元素补 `text-decoration:none; cursor:pointer` + hover 反馈（轮播条标题变主色、pill 变 surface-hover）。

## C. 首页 tmdb-movierow 上下间距收紧
- `Home.css` 桌面（≥768 非 app/tv）：行内 `padding` 纵向 `--space-sm → --space-2xs`、`margin-bottom --space-sm → --space-xs`（横向 padding 维持 --space-sm 保对齐）。行间隔由 ≈3×space-sm 降到 ≈space-xs+2×space-2xs。

## D. detail-hero-logo 加载失败不显示
- `Detail/index.tsx`：新增 `logoFailed` 态 + `onError` 置位 + `id` 变时重置；渲染改 `logoPath && !logoFailed ? <img> : <h1 标题>`。logo 拉取失败时不再露裂图，回退到文字标题。

## E. 顶栏主题切换图标尺寸与设置图标一致
- `StickyHeader.tsx` 桌面 hdr-icons：主题按钮 `<Icon size="lg">` → `size={isTV ? 'md' : 'sm'}`，与左侧设置图标同档。

## 附带（第二批）
- `Player.css` 桌面侧栏 grid→flex 改动触发 `order/properties-order`（flex 应在 flex-direction 前），已调序。

---

# 第三批（同日晚，用户追加）

## F. hero 胶囊配色重定（用户交由定夺）+ 尺寸/文本再收小
- 采纳「单一强调 + 中性玻璃」同族（比三枚亮粉彩更收敛）：基础胶囊 `rgba(255,255,255,0.18)` 白玻璃+白字（年份）、评分 `rgba(250,204,21,0.92)` 金底黑字（唯一强调）、类型 `rgba(52,211,153,0.30)` 淡翡翠玻璃+白字。删去年份/类型旧亮底 override。
- 尺寸：`.hero-bili__meta` 字号 `--text-base → --text-sm → --text-xs`（文本再收一档，实测 12px）、gap `--space-xs → --space-2xs`；基础胶囊 padding 横向 `--space-sm → --space-xs`。实测 1440 下三枚胶囊清晰、收敛。

## G. 今日趋势（home-topstrip）下方间距与上方一致
- `Home.css` `.home-topstrip` `margin-bottom: --space-sm → 0`。上方 gap = `.home-page` padding-top（space-sm），下方原本 = margin-bottom(space-sm) + HeroBili 网格 padding-top(space-sm) = 2×space-sm。去 margin 后下方 = 网格 padding-top = space-sm，与上方齐平。Playwright 实测 1440：header→strip = 7.9px、strip→banner = 7.9px（相等）。

## H. 今日趋势轮播条 hover 样式
- `Home.css` `.home-topstrip__rotator-item`：加 `padding-inline: --space-2xs` + 等量负 `margin-inline`（hover 背景留呼吸区、文字位置不变）+ `border-radius` + `transition`；新增 `:hover { background: --color-surface-hover }`（原已有标题变主色）。

## I. detail 发行公司 logo 加载失败不显示
- `Detail/index.tsx`：新增 `failedCompanyLogos:Set<number>` 态 + 公司 logo `<img onError>` 置位 + `id` 变时清空；渲染 `c.logo_path && !failed.has(c.id) && <img>`。某公司 logo 拉取失败时只隐图、保留公司名。

## 验证（第三批）
- `npm run build` 通过（✓ built）；`npm run lint:all` 全 7 门通过；Playwright 实测 hero 胶囊配色/尺寸、topstrip 上下间距相等均符合预期。

---

# 第四批（同日晚，detail 页）

## J. detail hero 文本不清晰 → 改主题正文色
- `Detail.css`：`.detail-hero-desc`（简介）、`.detail-hero .detail-hero-meta` / `.detail-hero-meta-item`、`.detail-hero-tagline` 均由 `--color-text-secondary` → `--color-text`。用户反馈 secondary 在底纹上对比不足。

## K. detail hero banner 图透度过高 → 提高可见度
- `.detail-hero-bg` `--hero-bg-o`：亮 `0.12 → 0.3`、暗 `0.16 → 0.34`。左侧文字带仍由 `.detail-hero-veil` 实色渐变保护，对比不随图漂移。实测 bg opacity=0.3。

## L. 季信息左侧竖版封面只拉伸高度 → 回到 2:3 等比
- 根因：`.detail-season-card` 默认 `align-items:stretch` → 海报高度被拉到卡片高（随简介长短），宽度固定 → 竖长失比例。
- 修法：`.detail-season-poster` 加 `align-self:flex-start`，海报回到自身 `aspect-ratio:2/3`（高随宽）。实测 1440 下三枚海报均 72×108（ratio 1.5），不再撞满 147px 卡高。

## 验证（第四批）
- `npm run build` 通过；`npm run lint:all` 全 7 门通过；Playwright 实测 desc 色 rgb(0,0,0)、bg opacity 0.3、季海报 ratio 1.5 均符合预期。

---

# 第五批（同日晚，detail 播放列表 / 源检测胶囊）

## M. CMS 匹配改增量上屏
- `Detail/index.tsx` `fetchCMSSources`：由 `Promise.allSettled` 全量后一次 `setCmsResults` 改为逐源 `setCmsResults(prev => [...prev, r])` 追加（电视/电影均逐源并发）。首条可用结果到达即停网格大转圈、显示数据，其余源陆续补上。
- 渲染门禁：`cmsLoading` → `cmsLoading && availableResults.length === 0`（有首条结果即落入结果分支）。实测：groups 0→2、bigSpinner 首条后消失。

## N. 轮播文本移入胶囊 + 去重复「资源」
- 新增 `runningText`（`正在查询${源名}…`，末尾不再追「资源」——旧为「豆瓣资源资源」）传入 `SourceDetectPill`。
- `SourceDetectPill`：running 态 = 小转圈 + 轮播文本 + 计数（去掉进度条 sdp-mini）；done/idle 保持原 UI（进度条+计数）。网格大转圈仅留 spinner（文案已入胶囊）。
- CSS：胶囊 `max-width:280px` 适当加宽 + `.sdp-label--run` 溢出省略号（min-width:0 + text-overflow）。

## O. 去掉点击钉住 + 去黑框
- `SourceDetectPill`：删 `pinned` 态与 `handleClick`，结果浮层仅 hover 展开（`open = done && hovered`）。
- CSS：`.sdp-pill:hover` 不再变深色边框（border-light）+ `:focus/:focus-visible/:active { outline:none }`；`.detail-source-all-btn` 同样去 focus/active 默认黑框。

## 验证（第五批）
- `npm run build` 通过；Playwright 实测 running 胶囊「正在查询爱奇艺资源…/豆瓣资源…」（无重复资源）、hasMini=false、count 0/6→2/6→5/6、首条后 bigSpinner 消失、done 态恢复进度条+6/6、无 console 错误。
- ⚠️ `lint:css` 当前因 **ProxySetup.css**（本任务未碰、另一会话并发编辑）两处 `order/properties-order` 报错而整体红；本批自有文件 stylelint 全绿。未代他方修改。

---

# 第六批（同日晚，detail hero 透明度 / 加载扫光）

## P. banner 图透明度再提（仍太淡）
- `Detail.css` `.detail-hero-bg` `--hero-bg-o`：亮 `0.3 → 0.5`、暗 `0.34 → 0.55`（heroBgReveal 终点 fallback 同步 0.5）。左侧文字带仍由 veil 保护。实测 bg opacity=0.5。
- 追加（用户反馈 0.5 仍「整体发白」）：真因是图叠在不透白 surface 底 + 白 veil 上，0.5 仍被白底洗白。`--hero-bg-o` 再提到亮 `0.92` / 暗 `0.88`。曾一度加宽 veil（26%→82%）反而更白，已回退到原始 12%→68%（veil 只负责文字带托底，发白靠提透明度解决）。用合成彩色 backdrop 实测：图清晰显色、不再发白，文字带仍可读。

## Q. 加载扫光不再压暗内部文本/按钮
- 删除 `.detail-hero--skeleton .detail-hero-body { opacity:0.4 }`。背景图未加载完（bgLoaded=false）时旧规则会把真实标题/立即播放/收藏压到 40% 不透明度，与扫光叠加显得闪烁。
- `.detail-hero-info` 本身是不透 surface 底，扫光在其背后不显形，无需再压文字。实测加载期 body opacity=1（标题/按钮正常显示）。

## 验证（第六批）
- 自有文件 `Detail.css` stylelint 全绿；Playwright 实测加载期 bodyOpacity=1、backdrop opacity=0.5。
- ⚠️ `npm run build` 当前因 **SourceChecker/index.tsx**（本任务未碰、另一会话 RowVM 重构中途）多处 TS2345/TS2741 报错而整体失败；本批仅改 CSS，不涉 TS。未代他方修改。

---

# 第七批（同日晚，首页 hero 胶囊微调）

## R. hero 胶囊再收小 + 间距拉大
- `HeroBili.css` `.hero-bili__meta`：字号 `--text-xs → --text-2xs`（实测 12→11px）、gap `--space-2xs → --space-xs`（胶囊间距拉大，实测 ≈4px）；`.hero-bili__meta > span` 横向 padding `--space-xs → --space-2xs`（胶囊再收小）。实测 padding 1.8×2px、fontSize 11px。

---

# 第八批（同日晚，sdp/全部按钮黑框未除净 — 追根因）

## S. 黑框真因：全局 :focus-visible 环 + primary=#000
- 上一批的 `outline: none`（无 !important、特异性 (0,2,0)）被 `index.css:619` 全局规则
  `:root:not(tv):not(projector) :focus-visible:not(.no-interaction-visual) { outline: var(--layout-outline-width) solid var(--color-primary) !important }`（(0,5,0)+!important）压过 → 黑环仍在。
- 且本主题 `--color-primary: #000`（亮）/`#fff`（暗），所以“primary 颜”的边框/环就是黑色。
- 实测（修复前）：sdp.done 聚焦 computed outline = `rgb(0,0,0) solid 2px`。

## T. 修法
- `SourceDetectPill.css` / `Detail.css`：用 (0,6,0)+!important 高特异性规则覆盖全局焦点环，仅桌面（TV/projector 遥控导航焦点环保留）：
  `:root:not([data-device="tv"]):not([data-device="projector"]) .sdp .sdp-pill:focus-visible { outline: none !important }`；
  `... .detail-source-group .detail-source-all-btn:focus-visible { outline: none !important }`。
- `.detail-source-all-btn:hover` 边框 `var(--color-primary)`（黑）→ `var(--color-border-strong)`（浅灰 #bfbfbf）。
- `.sdp-pill.done` 静息边框 `color-mix(primary 40%, border-light)`（≈#8b8b8b 近黑灰）→ `var(--color-border-strong)`（#bfbfbf 浅灰）。
- `.detail-source-all-btn` 静息（默认）边框 `--color-border-light`（#e8e8e8 太浅看不清）→ `--color-border-strong`（#bfbfbf）（2026-10-10 用户追加）。hover 仍靠 bg+文字色反馈。
- 验证：CSSOM 确认两条 (0,6,0)!important 覆盖规则已加载；自有文件 stylelint 全绿。（a11y 权衡：按用户明确要求去掉这两个按钮的键盘焦点环；TV/遥控器导航焦点环未动。）

---

# 第九批（同日晚，修正第八批的 a11y 误判）

## U. 恢复键盘焦点环（上次删错了）
- 用户指出：要取消的是「黑色边框」，不该连键盘焦点环一起去掉。上次用 `:focus-visible { outline: none !important }` 把两个按钮的键盘焦点环也抹了，属过度修复（伤 a11y）。
- 修正：删除 `.sdp-pill` / `.detail-source-all-btn` 的 `:focus-visible { outline: none !important }` 高特异性覆盖 → 键盘 Tab 时 index.css 全局焦点环恢复点亮。
- 保留：`.sdp-pill:focus/:active`、`.detail-source-all-btn:focus/:active` 的 `outline: none`（无 !important、特异性低于全局）→ 仅抑制鼠标点击环；鼠标点击不触发 :focus-visible，故无黑环；键盘 Tab 时全局 !important 胜出，焦点环正常显示。
- 保留：边框去黑（all-btn 默认/hover → border-strong 浅灰；sdp.done 静息 → border-strong）——这才是用户真正要取消的「黑色边框」。
- 验证：CSSOM 确认覆盖规则 overrides=[]、globalRing=true（键盘环恢复）；自有文件 stylelint 全绿。

---

## 附带
- `Detail.css:414` 修正既有 stylelint `order/properties-order`（transition 应在 animation 前）——该错误在改动前的干净树已存在、阻断 `lint:all`，顺手修复。

## 验证
- `npm run build` 通过；`npm run lint:all` 全 7 门通过（含 lint:css / lint:design）。
- Playwright 实测：hero 胶囊色/模糊、cast 圆框 73px、季海报 72px 占位、play 桌面侧栏同高——均符合预期。

## V. detail banner 右侧文字发暗（渐变托底不够）
- 用户反馈：渐变需要调整，靠 banner 右侧文本有点暗看不清。
- 根因：旧 veil `transparent 68%` 使简介行尾/展开按钮落在无托底的图上，暗图上黑字不可读（用暗色合成 backdrop 复现确认）。
- 修正：`Detail.css` `.detail-hero-veil` 渐变透出点 68% → 88%——文字带（至 ~85%）始终有白托底，仅最右边缘露图；暗图实测简介尾+展开按钮清晰可读，图仍从右侧可见。
- 验证：`Detail.css` stylelint 绿（EXIT=0）。

## W. hero 胶囊调扁对齐历史页 card 标签 + 继续观看间距
- 用户反馈：胶囊调整后有点圆（上下宽左右扁）；继续观看标题与上方模块间距有点大。
- 参照物：历史页 card 标签 = `RecordCard.css .record-card__badge-type`（radius-sm 小圆角 + line-height 1.5 + text-2xs）。
- 修正：`HeroBili.css` ① 胶囊 `border-radius: var(--radius-full) → var(--radius-sm)`、`line-height: 1.25 → 1.5`（对齐历史页 badge；字号两处本就同为 --text-2xs），横向 padding 维持 --space-xs（图上空间敏感，历史页用 --space-sm）；② `.hero-bili` 底距 `--space-sm → --space-xs`，与行间节奏（movierow margin-bottom --space-xs + padding-top --space-2xs）对齐。
- 实测：chip 38×20.1（宽>高扁标签）、radius 4.6px、fontSize 11px、lineHeight 16.5px；heroMarginBottom 7.9→4.0px、hero→首模块间距 15.9→11.9px（cqa-board 自带顶距，继续观看行存在时 ≈6px 与行间一致）。
- 验证：HeroBili.css stylelint 绿（--fix 一次属性顺序）；`npm run build` 通过。
- 追加（同日用户反馈「chip 高度再调小」）：line-height 1.5 → 1.2，实测高度 20.1 → 16.8px；stylelint 绿 + `npm.cmd run build` 通过（npm.ps1 在 sandbox 包装下偶发自身 $LASTEXITCODE 异常，用 npm.cmd 绕过）。

## X. 顶栏搜索框选中历史项后 dropdown 抙动
- 用户反馈：点击搜索框下拉历史数据选中后，下拉框收起之后会快速展开收起，明显抙动。
- 根因：`handleHistoryClick`（建议项/回车同路径）先 `setIsDropdownOpen(false)`（dropdown 立即卸载）再手动 blur；200ms 后 `handleBlur` 定时器照旧 `setDropdownIsExiting(true)`，而渲染条件 `(showDropdown || dropdownIsExiting)` 让已收起的 dropdown 以退出动画状态重新挂载 → 150ms 后再卸载 = 「收起后又展开收起」。Playwright 采样实测修复前 reopen=1（收起后 ≈400ms 闪现 exiting 帧 6 帧再消失）。
- 修正：`SearchBox.tsx` 新增 `isDropdownOpenRef`（effect 同步），`handleBlur` 定时器回调开头判断 dropdown 已关闭则直接 return（不补退出动画）。正常 blur 关闭路径（dropdown 还开着）退出动画保留（实测 exiting 6 帧正常播放后收起）。
- 验证：修复后 reopen=0、exitingSeenAt=[]；`npm.cmd run build` 通过；`node scripts/e2e-skeleton.mjs -g "SearchBox" scripts/regression.spec.ts` 1 passed（8s，跑批器自动收尾零遗留）。

## Y. hero 标签去背景改纯文字 + 上下间距
- 用户反馈：①首页 banner 左侧标签删除背景色以及边框；②标签上下间距稍微调大。
- 修正（HeroBili.css）：①基座删 background/backdrop-filter/padding/border-radius（无底色后均失义），年份/类型白字；rating 变体金底黑字 → 金色文字（rgba(250,204,21,0.95)）；type 变体整条删（仅剩 background）；间距仅由 meta gap 承担。②meta margin-top 2xs(≈2px) → sm(≈8px) 拉开与标题距离；按钮行 margin-top sm → md（合并进 caption 作用域既有 `.hero-bili__caption .hero-banner__actions` 规则，不动 HeroBanner.css 共享值）。
- 实测：三标签 bg=rgba(0,0,0,0)、border=0；标签行上距 2→7.9px、下距 7.9→10.9px。
- 验证：stylelint 绿（一次 no-duplicate-selectors，margin-top 并入既有 actions 规则）；`npm.cmd run build` 通过。
- 追加（同日用户反馈「标签左右间距适当调大」）：meta gap --space-xs(≈3.9px) → --space-sm(≈7.9px)；stylelint 绿 + build 通过。
