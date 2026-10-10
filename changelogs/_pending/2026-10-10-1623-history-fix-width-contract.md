---
date: 2026-10-10
module: History / SourceChecker / ProxySetup
type: bugfix + 契约接入 + demo + UI 改版落地
build: npm run build ✓ / stylelint 两页 ✓ / e2e subpages 4/4 ✓
files:
  - src/pages/History/index.tsx（updateBeadPositions 贴底测量）
  - src/pages/History/History.css（固定高兜底注释）
  - src/pages/SourceChecker/SourceChecker.css（2200 封顶 + 侧距；监控台改版重写）
  - src/pages/ProxySetup/ProxySetup.css（2200 封顶 + 侧距；流水线 + 双栏新增）
  - src/pages/SourceChecker/index.tsx（监控台 render 重构：Hero/表格/inspector）
  - src/pages/ProxySetup/ProxySetup.tsx（四步流水线 + 表单/控制台双栏 JSX）
  - changelogs/demos/demo-status-console-2026-10-10/index.html（新增，任务流走查壳）
  - changelogs/demos/demo-status-console-2026-10-10/_console.css（新增，监控台样式层）
  - changelogs/demos/demo-status-console-2026-10-10/_steps.js（新增，步骤机与演示交互）
  - demos/e-proxy-setup.html（新增）
  - changelogs/README.md（Demo 索引登记一行）
demo: changelogs/demos/demo-status-console-2026-10-10/index.html
---

# 历史页假滚动条修复 + 源检测/代理配置宽度契约接入 + 双候选 Demo

## 一、历史页「单条数据也有滚动条」修复（阶段 0–1，已落地）

【问题】历史页只有一条观看记录时，`.app-shell__scroll` 出现假滚动条（range>0 但内容
并不需要滚动）；收藏页同类报告在标准视口（≥1280×566）8 视口 sweep 无法复现。

【旧逻辑】`.history-timeline` 桌面端固定 `height: calc(100vh - var(--header-height))`
（History.css:188），该式仅在 sticky 吸附后（面板顶缘=容器顶缘）成立；scrollTop=0 未吸附
时面板位于容器顶距 chromeTop 之下，固定高度向下溢出 chromeTop 像素 → 内容列被撑高 →
产生本不该有的滚动范围。

【新逻辑】`History/index.tsx` `updateBeadPositions` 每帧先测 `chromeTop = panelRect.top −
scRect.top` 与祖先链 `belowSpace`（padding-bottom + margin-bottom 逐层累加），写
`nextH = floor(scRect.height − chromeTop − belowSpace)`（内联 style 覆盖 CSS）——面板底缘
恒不越过容器底缘；吸附后 chromeTop=0 自然退化为原 calc 值。先批量读再统一写、仅值变才写
（防 ResizeObserver 回环），deps 补 `[scrollContainerRef]`。CSS 固定高保留为 JS 未运行兜底
并加注释。

【预览】dev server `/history` 单条/多种子滚动对比；无独立 demo（纯行为修复）。

【验证】diag-sweep 8 视口（1024×640 ~ 390×844）range=0 无溢出；diag-hist-long 长列表
多种子（今天/昨天/本周/本月/更早 各 8–10 条）3 视口 × 顶/中/底 9 组：贴底（overTl=false）、
内联高=计算高、sticky 吸附 tlTop=0、5 组算珠 transform 正常、range>0 可滚、0 JS 错。
【已拍板跳过】收藏页同类问题标准视口（≥1280×566）8 视口 sweep 无法复现，用户拍板
暂不排查（无复现条件不动手）。

## 二、源检测/代理配置 接入 `--layout-content-max-width` 2200 封顶 + `--page-pad-x` 侧距（阶段 2，已落地）

【问题】两页是全站仅剩未接宽度契约的页面：源检测根容器用 `padding: var(--space-xs)`
短手整块覆盖 `.page-padding` 侧距（≈4.5px 贴边），且无 2200 封顶——超宽屏（2560/3440）
内容被无限拉宽；代理配置桌面侧距仅 `--space-md`≈9.5px，同样贴边且无封顶。

【旧逻辑】SourceChecker.css:10 `padding: var(--space-xs)`（短手覆盖四向）；
ProxySetup.css `padding: var(--space-xl) var(--space-md)`；两根容器均 `width:100%` 无 max-width。

【新逻辑】两根容器同构接入：
- `max-width: var(--layout-content-max-width); margin-inline: auto;`
  （:root 100%，≥768 `min(100%,2200px)` —— ≤1920 逐像素零回归，>2200 封顶居中）
- 侧距：源检测改 `padding-top/bottom` 短手（左右交还 `.page-padding` 统一规范：
  <768 `--space-sm`、≥768 `--page-pad-x` 60/100/140 分档）；代理配置 ≥768 显式
  `padding-inline: var(--page-pad-x)`（移动端 `--space-md` 保持现状）。

【预览】当时经双候选壳 demo 验证（该 demo 后随整体重做删除）；现预览即两页真实页面
（1440/1920/2560 视口直开）。

【验证】diag-width 实测 1440/1920/2560：A 根宽 1440/1920/2200、侧距 60/100/140，
hScroll=0；2200 封顶命中徽章正确。

## 三、UI 改版 Demo（阶段 3 → 整体重做，已拍板 → 已落地真实页面，见 §四）

【问题】两页接入契约后，改版方向需评审；首轮「iframe 四维对比壳 + 候选 A/B」被用户
拍板否决——「整个 demo 重来，换个思路」（A v1 保守合规版亦先被否「定位太保守」）。

【旧逻辑】壳层 = 页面×视口×A/B×旧新四维切换，A/B 两份候选页各 ~150 行内绘样式；
评审对象被形式淹没，且 A/B 均为「页面重排」思路、缺乏任务叙事。

【新逻辑】按拍板重做为**「任务流走查 × 状态监控台」**单 demo
（`changelogs/demos/demo-status-console-2026-10-10/`，index.html + _console.css + _steps.js）：
- **呈现形式**：6 步任务流走查（场景→体检→定位→凭证→部署→复检闭环），顶部步骤条 +
  底部上/下一步 + 右下角每步「问题/旧逻辑/新逻辑」注释浮层；无 iframe、无多维切换。
- **设计方向**：状态监控台——源检测页 Hero 大号 3/5 可用结论 + 五指标横条 + dense 状态
  表格（异常行红 tint 直接可点）+ 右栏 inspector（错误/近 5 次/建议动作/「去配置代理→」
  出口）；代理配置页四步流水线常驻顶部 + 凭证表单 + 深色控制台逐条日志 + 结果块直通复检。
- **可玩交互**：一键检测扫描动画、行点击开 inspector、部署流水线自动推进 + 日志逐条、
  复检 Hero 3→5 翻绿、键盘 ←/→ 步进。
- 旧 demo `demo-width-contract-2026-10-10/`（含 A v2 现代工具风候选）已按拍板删除；
  阶段 2 契约接入保留在两页真实代码中。

【预览】`http://127.0.0.1:3001/changelogs/demos/demo-status-console-2026-10-10/index.html`
（dev server 直开，已登记 changelogs/README.md 索引）。

【验证】diag-console Playwright 冒烟 13 项全过：step0 场景可见、step1 表格 7 行 + Hero 3/5、
行点击开 inspector、建议 CTA 跳 step3、流水线步态、部署自动完成（日志 ≥8 行 + 结果块）、
复检 Hero 5/5 且无异常行、prev 可用、0 pageerror/console error；截图
`sc-step1 / sc-step2 / px-step4 / sc-step5` 目检通过。

## 四、「任务流走查 × 状态监控台」落地到两页真实 UI（已落地）

【问题】demo 方案已拍板，需把监控台语言搬进源检测/代理配置真实页面，且**行为零变化、
spec 锚点全保留**（`scripts/source-checker.spec.ts` / `scripts/proxy-setup.spec.ts`）。

【旧逻辑】源检测 = 五个 `check-panel` 面板（tab 切换单面板 + 各自检测按钮 + result-card
列表）；代理配置 = 卡片/面板纵向堆叠，控制台日志夹在入口卡与凭证表单之间。

【新逻辑】
- **源检测**（`SourceChecker/index.tsx` render 重构 + CSS 重写，检测逻辑/缓存/并发 4/
  pull-to-refresh/SubPage 全保留）：① Hero 大号 `N/5 检查域可用` + 状态一句话（五检查域
  由 networkResult/stats/代理结果派生）；② 五个 stat-card 指标横条沿用；③ 工具条 =
  `.tab-btn` 分段筛选（**首个「全部」带 active**，满足 spec 051）+ 分组 `.btn-small` 重测
  按钮 + 检测中 spinner 指示；④ 五类结果统一进 dense `source-checker-table`（状态
  pill/名称/地址/延迟，异常行红 tint，行点击选中）；⑤ 右栏 inspector（地址/延迟/错误/
  测试节点/估算带宽/建议动作 + `Link to="/proxy-setup"` 出口，`advice.toSetup` 时显示）。
- **代理配置**（`ProxySetup.tsx` 加派生流水线 JSX + CSS 新增 pipe/body 段，state/handler/
  日志逻辑零改动）：① 四步流水线常驻（01 凭证 / 02 入口 / 03 部署 / 04 完成，由
  token+accountId / kind / resultUrl 派生 is-done/is-on）；② 表单列 + 深色控制台双栏
  （≥1024 两栏、控制台 sticky；移动端/app 堆叠）；③ 结果块改成功语义描边。
- **spec 锚点全保留**：`.proxy-setup__title/__card/__console`（×2 卡）/`is-selected`/
  `/开始一键配置 Worker/`；`.btn-small`→spinner、`.tab-btn` 首个 active、`.stat-card`。
- CSS 全走 token（无裸 hex、`--dur-*`、`--text-2xs`），stylelint 两页 exit 0。

【预览】真实页面 `/source-checker` 与 `/proxy-setup`（1440/2560 截图目检通过：Hero/表格/
inspector/流水线/双栏控制台/选卡日志均正确）。

【验证】`npm run build` ✓；`npm run test:e2e:subpages`（source-checker + proxy-setup 调试
档，preview 自建 server + OS 动态端口）**4/4 passed（2.6s）**；截图
`sc-1440 / sc-checked-rail / px-1440 / px-selected` 目检通过；截图用临时 preview 已杀、
端口复检关闭。

## 五、验证与后续

- `npm run build` ✓（tsc -b + vite build，含改版后两页）
- stylelint 两页 CSS ✓（顺序类 --fix 自动修；字号/gap token 违规手工归位）
- e2e：history/collections/source-checker/proxy-setup 13/13（阶段 2 后）+ subpages 4/4
  （改版落地后，retries=0，调试档预算内），跑批进程零遗留
- **后续**：① 收藏页已拍板跳过（无复现条件不动手）；② push 前跑
  `node scripts/changelog-collect.mjs`（本轮片段勿与
  `2026-10-10-1330-detail-layout-demos.md` 混并）；③ 全量 E2E 未经用户允许不跑（本改版
  属布局/UX 类，如需全量档请用户明示）。
