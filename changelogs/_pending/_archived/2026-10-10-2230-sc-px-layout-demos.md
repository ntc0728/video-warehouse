---
date: 2026-10-10
module: source-checker,proxy-setup
type: demo
build: n/a（纯 demo，未动 src）
files:
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/index.html（新增，单页切换壳）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/a-single-column.html（新增）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/b-domain-cards.html（新增）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/c-task-flow.html（新增）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/d-terminal.html（新增，二轮）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/e-dashboard.html（新增，二轮）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/f-ticket-split.html（新增，二轮）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/g-ops-feed.html（新增，二轮）
  - changelogs/demos/demo-sc-px-layouts-2026-10-10/_base.css（新增，共享样式层）
  - changelogs/README.md（Demo 索引登记）
demo: changelogs/demos/demo-sc-px-layouts-2026-10-10/index.html
---

# 源检测/代理配置 布局重设计 · 三款候选 Demo

【问题】监控台方案落地后，用户要求推倒重排布局，并「去除未实现的功能、交互必须真实有效」。

【旧逻辑】现版两页存在界面承诺但后端未实现的控件：
- 行级「最近」列 = 全局 lastCheckTime 复制到每行（SourceChecker/index.tsx）
- 「近 5 次」历史柱/连续失败次数 = 仅检查域级历史，非真实逐源逐次
- 「自定义域名」= 只改前端 URL 字符串，DNS CNAME 需用户手动配置
- 「检测将自动切换代理链路复检」类文案 = 不存在自动切换

【新逻辑】三款布局 Demo（数据为静态演示、页顶标「演示数据」；交互仅保留真实功能映射：分段筛选/行展开/表单校验/剪贴板复制/两页互跳）：
- **甲 a-single-column**：保留 Hero 结论 + dense 表，右栏 inspector 改**行内 accordion**，删行级时间列/历史柱；代理页单栏纵向（流水线→入口→凭证→CTA→控制台→结果条）。
- **乙 b-domain-cards**：**五检查域大卡**为主角（值+状态点+异常红描边），点卡展开组内明细与出口；密表降级 `<details>` 折叠区；代理页纵向三步编号 + 右列控制台。
- **丙 c-task-flow**：体检→定位→复检**单时间线**，未开始步骤淡出、部署完成解锁复检按钮；信息量最小（无 Hero 大数字、无密表）。
- 三款均已删除：自定义域名字段、自动复检文案、行级时间列。

【预览】`http://127.0.0.1:3001/changelogs/demos/demo-sc-px-layouts-2026-10-10/index.html`

【三】单页切换壳（同日追加，用户要求「把 demo 放在一个 html 内可点击切换」）
- 新增 `index.html`：顶栏一套按钮切 **七款 × 两页**，内容区 iframe；`?embed=1` 时七款各自移除内壳顶栏（避免双壳），各款 showPage 写 `location.hash`，壳轮询 hash 将内部跳页（如「去配置代理 →」）回同到页按钮高亮。
- 键盘：`1`–`7` 直选方案、`←`/`→` 步进、`Q`/`W` 切页；`?scheme=&page=` 可直达分享；「新窗口打开」跟当前款。
- 七款均补两行脚本（embed 隐藏内壳 + showPage 同步 hash），样式/数据零变更。

【验证】只读校核：八文件 `</html>` 完整、embed/hash 注入到位（PowerShell 正则）；**未跑浏览器/截图脚本**（无许可），渲染与切换效果待用户验收。

【四】选型拍板：己 + 结论带 hybrid（同日）
- 用户在 戊（仪表盘）/己（三栏）间选型；主代理推荐 **己**（戊 的健康环+延迟条形靠单次采样撑「大盘」预期，与「去除未实现」红线最接近），用户拍板 **己 + 顶部结论带**。
- `f-ticket-split.html` 改造：`head` 与三栏之间新增全宽 **`.verdict` 结论带**——大号 N/5（只用数字，**不用健康环/不用趋势线**）+ 待修复一句话 + 五个域 chip（网速/IPTV/视频/CORS/IPTV代理，只用当前真实字段）。
- **交互真实**：chip 与左栏共用 `applyFilter(f)` 单入口，三者高亮同步；chip 点 = 筛选对应分组（非装饰）。为让「网速」chip 有对应行，ROWS 补一条 network 行、左栏补「网速」项（列表 7→8 条）。
- 未动真页 src；仅 demo。验证：`new Function` 解析内联脚本无语法错 + `?embed=1` HTTP 200。

【状态】**已选定 己+结论带**（hybrid）；下一步待用户确认是否落地到真实 SourceChecker/ProxySetup 页（真页落地为行为/布局类改动，需跑对应 E2E 档位）。其余六款保留作候选存档。

【五】结论带→健康带（用户反馈「chip 结论带不好」，同日）
- 用户要求将 戊 的 **健康环 + 延迟对比条形** 融入 己；替掉原 `.verdict`（大号 N/5 + 五域 chip）。
- 新 `.band`：左健康环（SVG 圆弧=域通过率 3/5，满则变绿）+ 待修复文案；右延迟条形（每条可测延迟的源一根横条，宽度=ms/60 基准，超时行满格红）。条可点→`applyFilter('all')`+`openDock(i)` 选中对应行并开详情。
- **数据诚实**：环=当前 okCount/总域数（真实），条=每条源当前单次实测延迟（真实字段）；因无逐次历史，仍不做趋势线。未配置代理行无延迟→不入图。
- 重构：行点击与条点击共用 `openDock(i)`（消除重复），`applyFilter` 不再管 chip。chip 相关 CSS/JS/HTML 已全部移除（grep `v-chip` 残留 0）。
- 验证：`new Function` 解析内联脚本无语法错（len 8865）+ `?embed=1` HTTP 200；**未跑浏览器/截图**（无许可），观感待用户验收。

【状态更新】**己 = 三栏 + 健康带（环+延迟条）**；是否落地真页仍待用户确认。

【六】健康带与 戊 完全对齐 + 并入 c-domains（同日）
- 用户要求：健康环 + 延迟条形**与 戊 保持一致**，并把 戊 内部的 `.c-domains` 五域磁贴也带进 己。
- 健环改为 戊 同款：SVG 108×108、r=46、stroke-width=10、dasharray `172.9 289.4`、中心 `3/5`+检查域；文案区改 `.health-txt`（b + 两个 `.bad` span）。
- 延迟条形改为 戊 同款类名与几何：`.bar-row .n / .bar-track / .bar-fill(.err) / .v(.err)`；**满格基准 60→200**，使条宽与 戊 一致（32→16%、47→24%、58→29%、超时 100% 红）。
- 新增 `.c-domains` 五域磁贴（网速/IPTV/视频源/CORS/IPTV代理，同 戊）；**磁贴可点→`applyFilter(group)` 筛选**（与左栏/环高亮同步；戊 原版磁贴无行为，属违规 #20，本版修正为真交互）。
- 数据诚实不变：环=当前 okCount/总域、条=单次实测延迟、磁贴=域级可用数；均真实字段，无趋势线。openDock 条选中选择器 `.bar`→`.bar-row`。
- 验证：`new Function` 内联脚本无语法错（len 9366）+ `?embed=1` HTTP 200 + grep 确认 v-chip/band-lat/band-health/SCALE=60 等旧 token 零残留。**未跑浏览器/截图**（无许可），观感待用户验收。

【状态更新】**己 = 三栏 + 健康带（与 戊 一致：环 + 延迟条 + c-domains 磁贴）**；是否落地真页仍待用户确认。

【七】详情坞改为「选中才展开」（同日）
- 用户要求：mid 未选中时撑满容器剩余宽，选中后才变（对齐真实 SourceChecker `is-rail`）。
- CSS：`.cols` base 仍为三栏 `190px 1fr 330px`（**代理配置段需控制台常驻，不能改 base**）；新增仅作用于源检测段的 `[data-stage="sc"] .cols:not(.has-dock){grid-template-columns:190px 1fr}` 与 `:not(.has-dock) .dock{display:none}`；选中时 `openDock` 给 sc 的 cols 加 `has-dock` → 升三栏，dock 淡入（`dock-in` keyframes，受 _base 全局 reduced-motion 守卫）。
- 交互：dock 新增 `.dock-x` 关闭按钮（`d-close`→closeDock）；行再点一次取消选中（curSel 同值则 closeDock）；条形点击仍 openDock（先 applyFilter('all')）。closeDock 同时抹掉 vrow/bar-row 的 is-sel。
- 验证：`new Function` 无语法错（len 9940）+ HTTP 200；grep 确认 hide 规则仅限定 `[data-stage="sc"]`（px 段不受影响）。**未跑浏览器/截图**，观感待验收。

【八】代理配置段补「上一步」按钮（同日，用户补充反馈）
- 问题：px 三步只有「下一步」（panel1→2、panel2→3），panel2/panel3 无回退入口。
- 修正：panel2 动作行改为 `[← 上一步(data-goto=1)] + [下一步→(data-goto=3)]`；panel3 部署按钮旁加 `[← 上一步(data-goto=2)]`（panel1 为首步不需回退）。
- 复用现有 `data-goto`→`goPanel` 真实逻辑（同时切 lnav 步骤高亮与面板显隐），无新 JS。
- 验证：`new Function` 无语法错（len 9940，仅 markup 变更）+ `?embed=1#px` HTTP 200 + grep 确认 2 个上一步按钮。未跑浏览器。

_以下为首轮/二轮历史选型快照（已被【四】【五】覆盖）_
【状态】**甲乙丙首轮三款被用户全否**；第二轮追加丁–庚四款（同目录）：
- **丁 d-terminal**：终端/CLI 工具风，命令行交互+输出流逐条回显（整页深色为演示，落地走主题 token）。
- **戊 e-dashboard**：运维仪表盘 bento：健康环+延迟对比条形+五域磁贴；只用真实字段，刻意不做趋势线（需逐次历史，未实现）。
- **己 f-ticket-split**：工单三栏：左分组导航/中大卡列表/右详情坞常驻固定（布局不跳动，区别于旧版点行才挤出的右栏）。
- **庚 g-ops-feed**：运维事件流：一条 feed、事件全由当场操作产生（含真实时间戳），部署跨页汇入同一时间轴。
七款顶栏可互切；待用户拍板选型，未动 src。
