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
  - changelogs/demos/demo-width-contract-2026-10-10/index.html（新增，壳）
  - changelogs/demos/demo-width-contract-2026-10-10/a-source-checker.html（新增）
  - changelogs/demos/demo-width-contract-2026-10-10/a-proxy-setup.html（新增）
  - demos/e-proxy-setup.html（新增）
  - changelogs/README.md（Demo 索引登记一行）
demo: changelogs/demos/demo-width-contract-2026-10-10/index.html
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

【预览】`changelogs/demos/demo-width-contract-2026-10-10/index.html`（阶段 3 双候选壳，
含「叠加改前」旧↔新切换，实测徽章读 iframe 内容 DOM）。

【验证】diag-width 实测 1440/1920/2560：A 根宽 1440/1920/2200、侧距 60/100/140，
hScroll=0；2200 封顶命中徽章正确。

## 三、双候选 UI 对比 Demo（阶段 3，待拍板）

【问题】两页接入契约后，是否进一步换风格需对比评审。

【旧逻辑】候选 A v1 曾以「现网真实结构 + 直链源码 CSS」为基准（保守合规版）；用户拍板
「A 定位太保守」——A 必须是新 UI 设计方案，且选定风格方向 = 现代工具风 · 去卡片化。

【新逻辑】壳页 = 页面切换（源检测/代理配置）× 视口切换（1440/1920/2200/2560/3440，
iframe 宽=视口、媒体查询真实生效、`box-sizing:content-box` 保档位精确）× A/B 并排·单显 ×
旧↔新切换 + 实测徽章（A/B 根宽、左右侧距、封顶命中）。
- **候选 A 现代工具风 · 去卡片化版（a2-* 内绘，未落地）**：`a-source-checker.html` /
  `a-proxy-setup.html` 已按 A v2 重写 —— 白底 + 现网绿色语言、报头 + 五统计横条竖分隔、
  下划线 tab、分隔线分区、聚合源表格行；保留 2200 封顶 + `--page-pad-x` 侧距与「叠加改前」
  对比，根类 `.source-checker-page`/`.proxy-setup` + `.page-padding` + old-mode override
  兼容壳页徽章测量（链 variables.css，不链现网页面 CSS）。无论 A/B 落选与否，阶段 2 的
  契约接入均保留。
- **候选 B Demo E 报刊版**：`demos/e-source-checker.html`（已有）+ `demos/e-proxy-setup.html`
  （本次新建，入口双卡/部署日志/Cloudflare 表单/结果四段对齐真实 ProxySetup，部署动作全为
  演示日志不虚构结果，空 Token 出「演示提示」），自带 2200 封顶与同曲线留白天然符合契约。
  B 页徽章在 ≥1920 档可能小于视口宽——iframe 高 760 触发 style-e 自身
  `min-aspect-ratio:21/9 → 92vw` 超宽规则（真实 21:9 显示器同款行为），壳页已注明。

【预览】`changelogs/demos/demo-width-contract-2026-10-10/index.html`（dev server 3001 直开，
已登记 changelogs/README.md 索引）。

【验证】diag-demo Playwright 全量：5 视口 × 两页面 × A/B/旧切换，徽章值全部符合预期
（1920→1920/100、2560/3440→2200/140 封顶命中、1440→1440/60、旧模式侧距塌回 4px），
切页/切视图/B 内交互出演示日志，0 pageerror/console error；A v2 重写后复跑 diag-demo
全过（磁盘/HTTP 内容核对均为新版），截图 `A2-sc-1440-new`/`A2-sc-2560-new` 确认现代
工具风渲染与封顶徽章正确。

## 四、验证与后续

- `npm run build` ✓（tsc -b + vite build）
- `npm run lint:all` 七门 ✓（design/css/json/version-sync/test-map/eslint/build）
- `node scripts/e2e-skeleton.mjs scripts/history.spec.ts scripts/collections.spec.ts
  scripts/source-checker.spec.ts scripts/proxy-setup.spec.ts` → **13/13 passed（11s，retries=0，
  调试档 ≤120s 预算内）**，跑批进程零遗留。
- **下一步**：① 用户拍板候选 A（现代工具风 v2）/ B / 组合 / 否决后才动两页 UI 风格；
② 收藏页已拍板跳过（无复现条件不动手）；③ push 前跑 `node scripts/changelog-collect.mjs`
（本轮片段勿与 `2026-10-10-1330-detail-layout-demos.md` 混并）。
