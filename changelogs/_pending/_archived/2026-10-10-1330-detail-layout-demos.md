---
date: 2026-10-10
module: Detail
type: demo-only（未改 src 代码）
build: 未涉及（无 src 改动，无需 build）
files:
  - changelogs/demos/detail-layout-2026-10-10/index.html（新增）
  - changelogs/demos/detail-layout-2026-10-10/_shared.css（新增）
  - changelogs/demos/detail-layout-2026-10-10/scheme-a-poster-spread.html（新增）
  - changelogs/demos/detail-layout-2026-10-10/scheme-b-fullbleed-band.html（新增）
  - changelogs/demos/detail-layout-2026-10-10/scheme-c-natural-side.html（新增）
  - changelogs/demos/detail-layout-2026-10-10/scheme-d-poster-side.html（新增）
  - changelogs/README.md（Demo 索引登记一行）
demo: changelogs/demos/detail-layout-2026-10-10/index.html
---

# Detail 页 banner×基本信息组布局整改 — 四候选 Demo（待拍板）

【问题】现网 Detail 页 ≥1024 的 C1 两栏（左 16/9 banner 内含海报 | 右基础信息栏）需要整改：
右栏被 `--detail-hero-h`（JS ResizeObserver 测高）锁死等于 hero 高度 + `overflow-y:auto`
栏内滚动，字段多时内容被裁；banner 宽度被压缩（1440 下 ~771px，海报再 ×0.78）；
双列 KV 卡长字段挤压依赖半宽 `--span` 测量脚本兜底。

【旧逻辑】`src/pages/Detail/index.tsx`（isWideDetail 分支 + heroRef 测高）+
`Detail.css` ≥1024 `.detail-top` grid `1.4fr:1fr` 块（C1，2026-09-10 拍板）。

【新逻辑】本轮不动代码，仅产出 4 款候选布局 Demo 供拍板（参考结构 `demos/e-detail.html` 的
`.hero-in` 海报对开 + 通栏 facts 资料表）：
- **A 海报对开 + 通栏资料表（★推荐）**：左竖海报 | 右片名/meta/简介/CTA，backdrop 淡化底纹；
  基础信息撤出右栏改通栏资料表，撤掉定高滚动与两段测量脚本。
- **B 全宽 banner + 信息带**：hero 视觉零改动回归全宽，基础信息降为 hero 下方横置信息带（最小整改档）。
- **C 双栏保留 + 右栏自然高**：撤 `--detail-hero-h` 锁死，右栏单列 label·value 数据行（保守止痛档）。
- **D banner 纯净 + 右栏「海报+资料」组合**：海报从 hero 图内移到右栏顶，图/文分家（折中重构档）。

四案均只动桌面 ≥1024 上半部；移动端堆叠、tab 结构、演员/剧照通栏、TV 端不受影响。
Demo 为离线静态页（渐变占位图、昼夜可切），预览：仓库根起静态服务器或
`npx vite changelogs/demos/detail-layout-2026-10-10`。

**下一步**：等用户从 A/B/C/D 拍板（或组合/否决）后，才改 `Detail/index.tsx` + `Detail.css` 落地。

## 追加（同日 v2）：方案 D 按用户反馈优化（同文件覆盖）

用户选定方向倾向 D，要求四项优化（已落 `scheme-d-poster-side.html` v2，浏览器 1440 实测验证）：
1. **右栏海报缩小**：栏宽 340→300px，海报收敛 150px（2:3），与评分/上映日/播放进度摘要并排成 rail-head。
2. **基础信息占满右栏整列到容器底**：`.rows` flex:1 撑开、注脚 `margin-top:auto` 钉底；实测两列下沿差 0px。
3. **banner 下方剩余元素补齐**：左列改纵向流 hero → 演员 → 剧照 → 相关推荐（消除 v1 实测 ~282px 空白）。
4. **长字段超 4 行展开/收起**：`.txt` 默认 `-webkit-line-clamp:4`，JS 测 scrollHeight>clientHeight 才显按钮；
   实测行为自洽：短字段（导演/语言/国家在当前栏宽下≤4 行）不出按钮，长字段（主创/发行 5 行）出按钮，
   展开/收起切换与恢复均正常。落地时拟做成通用组件，与演员「展开全部」同一交互语言。

未动 src 代码；总览页 D 卡片与对比表、changelogs/README.md 索引行已同步 v2 口径。

## 追加（同日拍板）：选定方案 A，D 撤出删除；A 迭代 v2/v2.1

- **拍板**：用户宣布只整改 A，D 不再需要 → 删除 `scheme-d-poster-side.html`，index/A/B/C 导航与对比表、README 索引行同步去 D（grep 零残留，浏览器实测站内链接全 200）。
- **A v2（自查七调，浏览器实测）**：资料表回归 e-detail「label 上/值下+底线」；电影/剧集示例切换（验证剧集 4 专属字段+季信息 tab 联动）；长字段超 4 行折叠；补回返回/官方/tagline/logo 标题位；backdrop 17%→32%+左侧渐变压色；hero 块去卡片化改底部分区线；无海报兜底开关。
- **A v2.1（用户反馈重排，实测通过）**：返回钮叠海报左上角（半透暗玻璃底，灰占位态仍可读）；官方页面钮居 hero-txt 右上（与 kicker 同行）；播放/从头/收藏+观看进度 `.cta-zone` `margin-top:auto` 钉文本区底——实测 poster/hero-txt/cta-zone 三底边 0px 齐平，与简介视觉间隙 ≥22px（padding-top clamp 22–36px 兜底）。
- **⚠️ 通用坑（Chromium，值得后续提炼入 ref/docs）**：`-webkit-line-clamp` 容器上用 `scrollHeight<=clientHeight` 判溢出不稳（实测 5 行内容仍报相等，同页另一字段却正常），改用**同宽克隆节点去 clamp 量自然高**；demo 内 A/B/C 三页均已换 isOverflow 实现。
- 下一步：按 A v2.1 落地 `Detail/index.tsx` + `Detail.css`（撤 isWideDetail 右栏、heroRef/--detail-hero-h、半宽 span 测量；DetailSkeleton 重构；长字段折叠抽通用组件），待用户放行。

## 追加（同日落地）：方案 A v2.3 正式实施完成（用户放行「整改完之后开始正式实施」）

落地前 demo 定稿为 v2.3（tab 移入资料区头部居中；概览 = 基础信息+演员+剧照；国家/发行整行换行；4 列封顶；hero-txt 横板底纹）。

【旧逻辑】C1：左 16/9 沉浸 banner（图内叠海报）| 右 `.detail-hero-side` 定高滚动栏（JS --detail-hero-h）+ 双列 info-card + 半宽 span 测量脚本 + tab 悬在 hero 与内容之间。
【新逻辑】已验证改动（build ✓ / lint:all 7 门 ✓ / 增量 test:changed 38 例 ✓ / detail.spec 8 例 ✓ / SKEL-013 ✓）：
- `Detail/index.tsx`：hero 改海报对开（左列 `.detail-hero-poster` 含返回钮叠左上+进度条 | 右列 `.detail-hero-info` 横板 backdrop 底纹 + veil + topline(kicker/官方页面) + 标题/标语/meta/简介 CollapsibleValue(3行) + `.detail-hero-cta-zone` margin-top:auto 钉底）；新增 `.detail-facts` 资料区 section（tabs 居中置顶 + 概览 pane = 基础信息表 factCells(12 条件项) + 国家/发行 `--full` + 演员 + 剧照）；sources/seasons pane 逻辑原样平移。
- 删除：isWideDetail/useIsMobile 分支、heroRef + --detail-hero-h ResizeObserver、infoGridRef + 半宽 span 测量脚本、overviewNode、ClockIcon/GlobeIcon/FilmIcon/DollarIcon、Star/Calendar import、infoCoreNode 双渲染。
- 新增通用折叠 `CollapsibleValue`（页内组件，lines 参数化；克隆挂**原父节点**量自然高，规避 scrollHeight 漏检与 body 字号假阳性两处 Chromium 坑，注释已写明）。
- `Detail.css`：hero 区重写（grid 基座单列→≥768 两列 clamp(160px,17vw,300px)；旧 G1 全出血/双层渐变/噪声层移除；文本色白字→主题色；back/official/按钮/进度改底纹区配色）；info-card/info-row/≥1024 C1 两栏块/右栏定高滚动块整体删除 → `.detail-facts-grid`（25% 封顶 4 列）+ `.detail-fact(--hi/--full)` + `.detail-collapse*`；TV `detail-hero-content`→`detail-hero-info`；lint 整改：裸 px 换 token、font-weight 900→var(--fw-bold)、stylelint --fix 属性排序。
- `DetailSkeleton.tsx/.css` 同构重构（海报列+文本区+资料区 tabs+7 格+2 整行）；`scripts/skeleton.spec.ts` SKEL-013 断言同步（__side→__poster、__info-card→__fact 7、__side-line 3→__fact-full 2）。
- 移动端/app：海报列 display:none 单列堆叠，返回钮随海报列隐藏（原 mobile-web/app 隐藏规则保留）；TV 走 ≥768 两列规则。
- 待办：全量 E2E 未跑（行为级改动，未经用户放行不跑全量）；改动未 commit，待用户确认视觉效果后提交。

## 追加（同日落地后真机反馈三轮）：v2.4 可读性结构案 + 移动端撤底纹 + v2.6 两列等高且等比

- **v2.4 文本区可读性**（用户：「降透明度仍不清晰，按你方案调」）：单压 img 透明度不够——backdrop 原图明暗不可控致对比度随条目漂移。改为 `.detail-hero-info` 铺 `--color-surface` 实色底，底纹图叠 `--hero-bg-o`（亮 0.12/暗 0.16）；⚠️ 新坑：`heroBgReveal` 写死 `to{opacity:1}` 被 `fill:both` 冻结在全图实度，基础透明度形同虚设——动画终点必须改用同一 `var(--hero-bg-o)`。veil 渐变同步换 surface 同系（无跨底色）；tagline 三→二级色；官方页面 hover 不再换半透背景（透图致文字看不清）改提实色边框；chip 骨架公式真机校准（line-height ×1.5 + 2px 边框，偏差 19%→0.3%）。
- **v2.4 移动端**（用户：「detail-hero-bg 在移动端不要变化」）：<767px 与 app 副本内隐藏 `.detail-hero-bg/.detail-hero-veil`，info 往 `background:none;border-radius:0`，文本区回归页底无卡形态。
- **v2.5→v2.6 两列等高且等比**（用户两轮：先「视口变小两列脱节」后「不要机械拉高盒，宽度也要变」）：先试 stretch 被判为拉高裁图；终案 = **文本区为高度主，JS（heroInfoRef + RO）量 info 高写 `--poster-w = 高×2/3` 到 .detail-hero**，grid 首列轨道 = `var(--poster-w, clamp(160px,17vw,330px))`，海报撤 aspect、width 100% 随轨道 → 盒恒 2:3 宽高同变零裁切；width transition 平滑。防振荡：取整 + >2px 才写；**上限 330**（真机 1024 展开简介 h≈473，300 顶会破 2:3）；**路径迟滞修复**：window resize 先 removeProperty 让轨道回视口公式，RO 再收敛（双稳态下旧值不残留）。骨架无 JS：用默认 clamp 轨道 + 灰块 stretch，真实内容到达后接管。
- 验证（均本轮实测）：build ✓ stylelint 0（顺手修 SourceChecker.css 存量 order）✓ · detail.spec 8/8 ×3 轮 ✓ · 真机 1024/1280/1440/1920 四视口：折叠/展开态 aspect ∈ [0.6655,0.6667]、两列 bottom 差 0px、resize 回环无迟滞、移动端 display:none 生效；⚠️ 后台标签页 RO/动画冻结属测量环境限制，removeProperty 链路已经真实 resize 事件验证，原生 RO 端到端待前台窗口（用户实机自然可用）。
- demo v2.4/v2.6 同步（surface 实色底/移动端隐藏/syncPosterW 脚本）；未 commit，待用户验收。
