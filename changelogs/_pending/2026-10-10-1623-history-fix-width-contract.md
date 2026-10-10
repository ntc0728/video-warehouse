---
date: 2026-10-10
module: History / SourceChecker / ProxySetup
type: bugfix + 契约接入 + demo
build: npm run build ✓ / npm run lint:all 七门 ✓
files:
  - src/pages/History/index.tsx（updateBeadPositions 贴底测量）
  - src/pages/History/History.css（固定高兜底注释）
  - src/pages/SourceChecker/SourceChecker.css（2200 封顶 + 侧距）
  - src/pages/ProxySetup/ProxySetup.css（2200 封顶 + 侧距）
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

## 三、UI 改版 Demo（阶段 3 → 整体重做，待拍板）

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

## 四、验证与后续

- `npm run build` ✓（tsc -b + vite build）
- `npm run lint:all` 七门 ✓（design/css/json/version-sync/test-map/eslint/build）
- `node scripts/e2e-skeleton.mjs scripts/history.spec.ts scripts/collections.spec.ts
  scripts/source-checker.spec.ts scripts/proxy-setup.spec.ts` → **13/13 passed（11s，retries=0，
  调试档 ≤120s 预算内）**，跑批进程零遗留。
- **下一步**：① 按拍板把「任务流走查 × 状态监控台」方案落地到两页真实 UI（实施中）；
② 收藏页已拍板跳过（无复现条件不动手）；③ push 前跑 `node scripts/changelog-collect.mjs`
（本轮片段勿与 `2026-10-10-1330-detail-layout-demos.md` 混并）。
