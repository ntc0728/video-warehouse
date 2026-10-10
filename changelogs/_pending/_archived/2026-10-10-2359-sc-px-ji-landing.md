---
date: 2026-10-10
module: source-checker,proxy-setup
type: feature-refactor
build: 通过（npm run build）
lint: 通过（lint:all 七门全过）
e2e: 通过（source-checker + proxy-setup + settings 调试档 14/14）
files:
  - src/pages/SourceChecker/index.tsx（重构为「己 · 三栏 + 健康带」；删历史柱/行级最近列与其数据层；新增单源重测）
  - src/pages/SourceChecker/SourceChecker.css（token 化重写：健康环/延迟条/五域磁贴/三栏条件分栏/详情坞）
  - src/pages/ProxySetup/ProxySetup.tsx（改为分步向导：左步骤导航+分步面板+上/下一步，部署仅第3步，右控制台常驻，保留自定义域名）
  - src/pages/ProxySetup/ProxySetup.css（三栏分步 token 化）
  - scripts/proxy-setup.spec.ts（PROXY-003 先经左导航跳第3步再点部署）
demo: changelogs/demos/demo-sc-px-layouts-2026-10-10/f-ticket-split.html
---

# 源检测 / 代理配置 落地「己 · 三栏 + 健康带」

【问题】demo 方案「己」拍板后，把其布局落到真实两页；且真实源检测页缺少「单独测某一个源」的能力。

【旧逻辑】
- 源检测 = Hero 大号 N/5 + 五指标横条 + dense 表格（含行级「最近」列）+ 点行开右栏 inspector（含「近 5 次历史柱」）。
- 代理配置 = 顶部四步横向流水线 + 单页纵向表单堆叠 + 下方控制台。
- 重测只有「组级」（一键/按维度），无法只重探一条源。

【新逻辑】
- **源检测**（`SourceChecker/index.tsx` + `.css` 重写，检测/缓存/并发 4/pull-to-refresh/SubPage 全保留）：
  1. 顶部**健康带**：健康环（SVG 弧=域通过率 okCount/5，满则 success-text 色、未检 text-disabled）+ 待修复一句话 + **延迟对比条形**（有实测 ms 的行一根，宽度=ms/barScale，异常标红「超时」，点条=选中对应行）+ **五域磁贴**（`.stat-card.tile`，点=筛选对应分组）。
  2. **三栏**：左分组导航（`.tab-btn`，首个「全部」带 `.active`，含「异常/未配置」待办档）/ 中单列大卡列表（`.vrow`）/ 右**详情坞**（选中才出现，`.source-checker-cols.is-rail` 才升第三列；未选中 mid 撑满，对齐真实 is-rail）。详情坞含 建议动作 / 去配置代理 CTA / **重测该源** / 重测本组。
  3. **删除未实现/易误读项**：近 5 次历史柱 UI + 其数据层（appendHistory/CheckHistory/recordHist/history 入缓存）、行级「最近」时间列（全局时间复制到每行）。
  4. **新增单源重测**：`probeIPTVSource`/`probeVideoSource` 抽出复用（组探测 mapWithConcurrency 与单源共用），`handleCheckOne(row)` 只重探选中源、就地更新该行并存缓存；network/proxy 行走 `handleCheck` 对应维度。
  5. 环 stroke 用 `--color-warning-text/success-text`、动画时长用 `--dur-*`（过 design 门禁 fill-as-text / timing-literal）；无裸 hex、无 `transition: all`。
- **代理配置**（`ProxySetup.tsx` + `.css` 重写，state/handler/cloudflare 链路零改）：三栏 = 左步骤导航（① 选部署项 / ② 登录凭证 / ③ 部署回写，派生 is-done/is-on）/ 中分步面板（一次一步 + 上一步/下一步，`hidden` 切显隐）/ 右深色控制台常驻。**部署按钮仅在第 3 步**（按用户拍板）。自定义域名字段**保留**（真实可用，归入第 2 步）。自动回写 + 结果块保留在第 3 步内。
- **spec 锚点保留**：`.source-checker-page` / `.proxy-setup` / `.proxy-setup__title`（含「一键配置代理」）/ `.proxy-setup__card`×2 + `is-selected` / `.proxy-setup__console`（右栏常驻可见）/ `开始一键配置 Worker` / `.tab-btn` 首个 active / `.stat-card` / `.btn-small`（一键检测 + 详情坞重测）。`.proxy-setup__pipe*/__body/__form/__entries` 等旧类名全仓无引用（已 grep 确认）。

【测试影响】`proxy-setup.spec.ts` PROXY-003：分步向导下部署按钮在第3步，改为先点左导航「部署与回写」跳到第3步再点部署（左导航按钮常驻、唯一，strict 模式安全）。source-checker.spec 锚点未变。

【验证】`npm run build` ✓；`npm run lint:all` 七门全过 ✓（stylelint --fix 归位属性顺序 + 手改环 stroke/动画 token）；`e2e-skeleton` source-checker+proxy-setup+settings **14/14（8.3s，retries=0 调试档）**；测试服务动态端口、globalTeardown 已清，`tasklist`/`netstat` 双确认零残留（3001 为用户自有 dev server 未动）。**未跑全量 E2E**（未经用户允许）。

【待验收】浏览器实际观感（健康环弧长、磁贴点筛选、详情坞展开收起、单源重测、px 分步上/下一步）由用户验收；demo 外壳未删（保留作方案存档）。

【补充·延迟条形 Top-N】用户指出真实页源多、条形全铺不合理；拍板选「Top-N 关注优先」。
- `SourceChecker/index.tsx`：barRows 改为「异常/超时优先 + 按 latencyMs 降序」取前 BAR_TOP_N=6；快且健康的源不进图；新增 barsHidden 计数与 `.band-bars-note` 诚实标注「仅显示最慢/异常 N 条，另有 X 条未列出（完整清单见左导航列表）」。
- 环=全量域结论、磁贴=分组概览，Top-N 不丢信息。CSS 新增 `.band-bars-note`（token）。
- demo（f）本就 ≤Top-N 条，无需改。
- 验证：build ✓ + lint:all 七门全过 ✓ + e2e source-checker/proxy-setup **4/4**（2.6s 调试档）。

【补充·px 分步向导 bug 修复】用户反馈真实页与 demo「相差甚远」；经 Browser 子代理 1440 截图对比定位根因。
- **根因**：`.proxy-setup__panel{display:flex}` 优先级盖过 UA `[hidden]{display:none}` → `hidden={step!==n}` 失效 → 三步面板**同时全显**（两个下一步/两个上一步同屏），看起来是长表单而非向导。
- 修复（均 ProxySetup.css，无 tsx 逻辑变更）：① 新增 `.proxy-setup__panel[hidden]{display:none}` 反制；② 入口卡 `.proxy-setup__grid` 1fr 1fr → **1fr 竖排整宽**（对齐 demo）；③ 右栏控制台 min/max-height 18/28rem → 26/34rem + align-self:stretch（消除右栏下方大片空白）；④ ≥1024 左导航加 `border-right` 竖向分隔线 + 中栏左右 padding。
- 验证：`npm run lint:all` 七门全过 ✓；e2e source-checker+proxy-setup **4/4**；Browser 子代理**二次 1440 截图复核**——已只显示当前步、卡竖排、控制台加高、分隔线可见、点② 切到登录凭证正常。子代理误写入仓库根的两张临时 png 已删。
- 未跑全量 E2E（未经允许）。

【补充·px 分步校验 + 第3步确认摘要】用户反馈：① 缺表单校验（未选/未填就能下一步）② 部署与回写栏只有一个按钮显空。用户定：校验用「点击时提示、不拦截」；第3步加「部署确认摘要」卡。
- `ProxySetup.tsx`：新增 `hint` 态 + `goNext`（step1 未选卡 / step2 未填 token+account → 停留本步 + 页内红字，不置灰；填了即清 hint）+ `goStep`（左导航/上一步自由跳并清 hint，不破 PROXY-002）。token/acct 输入在未填且有 hint 时加 `is-invalid` 标红（自定义域名可选不标）。
- 第3步顶部新增 `proxy-setup__summary` 确认摘要（真实字段派生）：部署项 / 目标 Worker(kino-*-proxy) / 访问链接(自定义或默认) / Account 尾号；再部署按钮 + 提示 + 上一步，成功出结果块。
- `ProxySetup.css`：`.proxy-setup__hint--error` / `.is-invalid` 边框 / `.proxy-setup__summary` 系列（均 token）。
- 验证：`npm run lint:all` 七门全过 ✓；e2e source-checker+proxy-setup **4/4**；Browser 子代理 1440 逐路复核 4/4（未选卡下一步不跳转+红字、选卡入第2步、未填下一步停留+两输入框标红、填入后入第3步摘要卡值正确）。截图存系统 Temp未落仓。未跑全量 E2E。

【补充·一批体验/一致性修正（用户多点位反馈）】
1. **左栏参考收藏/历史**：两页左导航（源检 `.source-checker-seg` / 代理 `.proxy-setup__stepnav`）改为**带描边胶囊分组**，active 用 `--color-primary`（与收藏/历史 `.category-segmented__item.active` 同 token；light 主题下=#000黑，属一致非缺陷），文本 text-sm/600，计数徽标仿 `.status-tab__count`（bg hover-bg/圆角/min-width badge-size）。
2. **proxy-setup 页签标题**：`ProxySetup.tsx` 加 `useDocumentTitle('一键配置代理')`（此前未设）。
3. **聚焦去黑框**：输入框 `:focus` 边框/光环由 `--color-success`（深绿看似黑）改为 `--color-info`（蓝）。
4. **上一步胶囊**：两处上一步按钮去掉 `--ghost`（无边框），改为基础 `proxy-setup__btn--sm`（带描边胶囊）。
5. **stepnav 校验标记**：`stepCls` 在 `hint && step===s` 时加 `is-error`（当前步导航项红底/红字），填完/选完 hint 清空自动恢复（Browser 实测①/② 标红与恢复均正常）。
6. **源检返回顶部**：去掉之前误加的 `.source-checker-page{overflow-y:auto}`（BackToTopButton 监听共享 `useScrollContainer()`，页内自滚使按钮不现）；overflow 已确认恢复 visible。
7. **延迟条形固定 5 槽 + 联动**：barRows = 网速 / IPTV代理 / 视频CORS代理 / 一条IPTV代表源 / 一条视频代表源（有异常取异常、否则最慢）；idle 代理显“未配置”灰条。点条 `selectFromBar` → setSegTab(group)+setSelectedKey+滞动 vrow：左导航切组、中列表只剩该组且选中行黑描边、右详情坞展开、对应 stat 磁贴高亮（Browser computed 实测全链路联动成立）。
- 验证：build + `lint:all` 七门全过 ✓；e2e source-checker+proxy-setup+settings **14/14**；Browser computed-style 逐项复核（active色=primary黑与参考一致、is-error标记✓、聚焦 info 蓝非黑✓、上一步描边胶囊✓、第3步摘要卡✓、条形顺序与联动✓、overflow 已去除✓）。截图存系统 Temp。未跑全量 E2E。
- 遗留：BackToTop 因注入 iframe 未溢出未能目测到按钮（overflow 修复已经 computed 证实，真实短窗有 26 条数据时会滚动出现）；建议用户真实浏览器目测验收。

【修正·初始日志方位】用户指出“请在上方选择一个配置入口”有误（分步向导步骤导航在左侧）。`ProxySetup.tsx` 初始日志改为按布局动态：`isDesktop && !isMobile ? '左侧' : '上方'`（≥1024 非 app 三栏→左侧；app/窄视口导航横排顶部→上方）。新增 `useIsDesktop` 引入。验证：lint:all 七门全过 ✓ + e2e proxy-setup 2/2 ✓。

【修正·左栏去错加的描边胶囊（用户追问 .tab-btn 为何设 border/背景）】
- **错因承认**：上一轮引用 `.record-filter-chip`（实为「更多筛选」面板 chip）作依据，给两页左栏每项加了 `border:1px + background:--color-surface + radius-full`；而收藏/历史**常显条目**用 `.status-tab`（computed 实测 `border:0 none`、透明背景），故该描边胶囊**无参考依据**，等于每行做了个假芯片；容器卡片（上一轮已去）同理。
- 修正（两页一致）：`.tab-btn` / `.proxy-setup__stepnav-item` 改为 **`border: none` + `background: transparent` + `border-bottom: 2px solid transparent`**；hover 仅变文字色（去 background）；active/is-on = `--color-text` + `font-weight:600` + `border-bottom-color: var(--color-primary)`；weight 基线 500→active 600（照搬 `.status-tab--active`）；is-done/is-error 仅文字色（去填充），is-error 下划线转 error；清掉 <1024/app 重复的描边覆盖。
- 计数徽标：`.tab-cnt` 保留 `--color-hover-bg` 底（对齐 `.status-tab__count`，属参考页真实样式）；原 active 态反色徽标在去底色后不可见，已改回深文字 + hover-bg。
- 保留：健康带五域磁贴（`.stat-card`）仍有描边底，它是 戊 数据块、不属于左栏（若也要扁平化请说）。
- 间距：行间距仍 `--space-sm`（实测 7.94px，与 `.record-aside` 区块间距同档）。
- 验证：build + `lint:all` 七门全过 ✓；e2e source-checker+proxy-setup **4/4** ✓。未跑全量 E2E。

【修正·竖向导航选中态应用左侧竖条非下划线】用户追问“.tab-btn 选中态怎么是下划线”。下划线是从横向 tabs（`.status-tab--active`）错搬到竖向列表。仓库竖向导航先例 = AppLayout `.sidebar-nav-indicator`（左 0、宽 space-2xs、高 60%、primary、右侧圆角）。修正（两页一致）：`.tab-btn` / `.proxy-setup__stepnav-item` 去 `border-bottom`、改 `position:relative` + `.active::before`/`.is-on::before` 画左侧竖条；hover 恢复浅底（同 sidebar 行 hover，非胶囊）；is-error 时竖条转 error 色；<1024 横排 chip 下隐藏竖条改用 hover-bg 胶囊。验证：lint:all 七门全过 ✓ + e2e 4/4 ✓。

【再修正·左栏选中态回到 primary 实心底（用户要我对比收藏/历史后才找到真参照）】上一段的「左侧竖条」仍是错的：`.sidebar-nav-indicator` 是 **AppLayout 主导航**，非收藏/历史。权威参照 = `RecordShell.css` @media(width>=1024) 的桌面左栏 rail-item（line 880-950），其注释 line 930 明确“选中态：实心底+反色字 600，**改掉「左侧高亮条」改法**”。
- 最终（两页一致）：选中态 `background: var(--color-primary)` + `color: var(--color-text-inverse)` + `font-weight:600` + `border: none` + `border-radius: var(--radius-md)`（圆角矩形，非胶囊/非下划线/非左竖条）；未选透明无框、hover `--color-surface-hover`；padding `--space-md --space-sm`；active 时计数徽标改半透明白底+反白。PX is-on/is-error 同理改实心底（is-error = `--color-error-bg`+error-text），删所有 `::before` 左竖条与下划线、删 position:relative。
- 同步纠正记忆（上轮把“左竖条”当正解记错了）：竖向 rail-item 选中态=primary实心底；左竖条仅限 AppLayout 主导航；下划线仅限横向 tabs。
- 验证：`npm run lint:all` 七门全过 ✓；e2e source-checker+proxy-setup 4/4 ✓。
