# 收藏页 UI 整改实施计划（collections-redesign-plan）

> 配套原型：`changelogs/demos/demo-collections-redesign-2026-08-18.html`（已验证交互：融合 Tab 切换 / 排序 / 批量勾选 / 删除 / 清除全部 / IPTV 收藏爱心）
> 仅改 collections 页，复用历史页已落地的 `RecordShell.fusedCategories/actions` 模式；历史页零波及。收藏页无时间轴。

## 一、已确认决策（来自多轮迭代）

| 项 | 决策 |
|---|---|
| 顶部主分类 | 原「影视/IPTV 分段 + 状态筛选标签页」合并为一组 `StatusTabs`：`综合 / 视频 / IPTV`（彩色圆点 + 计数） |
| 「综合」语义 | 视频（竖版海报墙）+ IPTV（原项目竖排卡）**分区并排**展示，**不混合进同一网格**——两类卡封面宽高比不同（2:3 vs 3:2），同网格行会高度不齐，必须分区 |
| 视频卡布局 | 保留竖版海报（2:3）；封面角标重组：**左下角 = 年份 + 类型合并**，**右下角 = 观看状态**（未观看/正在看/已看完） |
| IPTV 卡布局 | **完全保持原项目** `IPTVChannelCard` 竖排样式（封面 3:2 + 标题在下 + 封面右下分组/左下来源/右上收藏爱心），不改 |
| 状态筛选归属 | 「未观看/正在看/已看完」仅作用于**视频**项；IPTV 直播不涉及观看进度，恒显示，不被状态过滤（与历史页一致） |
| 状态筛选去向 | 状态筛选（全部/未观看/正在看/已看完）**移入「更多筛选」折叠面板**（与历史页一致），不再作为 tab 下方独立行或顶层标签 |
| 综合 tab 状态过滤语义 | 综合下选非「全部」状态时，**影视分区仅显示对应状态**，直播分区恒全量——**符合预期**（已确认） |
| 「更多筛选」范围 | 与现有历史页**完全一致**：仅「状态 chips（全部/未观看/正在看/已看完）+ 排序」，**不扩展其他维度**（如来源） |
| 排序 | 保留顶部排序（`Select`：最近收藏/最早收藏/名称/评分）；仅对视频与综合有效，IPTV 区域按最后播放时间倒序 |
| 批量管理 | 保留；综合 tab 下跨两分区选择（视频 + IPTV id 共存 `selected`） |
| 范围 | 仅 collections；复用 `RecordShell` 现有 `fusedCategories`/`actions`，Collections 切换为融合模式即可 |

## 二、现状与改动边界

- `src/components/RecordShell/RecordShell.tsx`：**已支持** `fusedCategories`（融合 tab）+ `actions`（右侧操作按钮组）。历史页整改时已落地，Collections 当前仍走旧分支（`activeTab` 分段 + `statusTabs`）。切到融合模式只影响 Collections 自身，`RecordShell` 零改动。
- `src/pages/Collections/index.tsx` 现状：
  - `activeTab: 'video' | 'iptv'` + `statusFilter: 'all'|'unwatched'|'watching'|'watched'`。
  - 视频卡：`<VideoCard video={video} rating={video._rating} hideFavorite batchMode={batchMode} …/>`，包在 `.record-card` 内，附 `.record-card__check`/`.record-card__delete`。
  - IPTV 卡：`<IPTVChannelCard channel={ch} hideFavorite batchMode={batchMode} epgIndex={epgIndex} />`，同样包 `.record-card`。
  - 两个独立网格：`.video-card-grid`（`--card-cols` 响应式）、`.iptv-channel-grid`。
  - 顶部搜索回调按 tab 切换 placeholder；`videoStatusMap` 从 history 映射视频观看状态；`statusCounts` 统计状态分布。
- `src/components/VideoCard/VideoCard.tsx`：**全局组件**，被 Browse/Home/Detail 等多处复用。当前角标：左上评分/右上收藏/左下年份/右下类型。**整改只能靠新增可选 prop 分支隔离，绝不能改默认渲染路径**，否则污染其他页面。
- `src/components/IPTVChannelCard`：现状符合方案 B 要求，零改动。

## 三、组件契约变更

### 3.1 RecordShell（`RecordShell.tsx` 组件逻辑零改动，复用已落地的 `fusedCategories`/`actions`）

> 注：组件 `.tsx` 逻辑零改动（融合 tab + 右侧操作区能力已存在），但 `RecordShell.css` 需按 §4.1 补充通用样式（`.record-actions`/`.action-btn`/`.record-status--fused` 从 `History.css` 迁入），否则收藏页的 `actions` 与融合 tab 会无样式。

Collections 切换为融合模式，传入：
- `fusedCategories={{ tabs: [...三 tab...], active: mainTab, onChange: setMainTab }}`
- `actions={<排序 Select/> <更多筛选按钮（触发 RecordFilterPanel）/> <批量管理按钮/>}`（容器 `.record-actions`，CSS 负责图标+文本 → 窄屏仅图标降级）

不再传 `activeTab`/`statusTabs`/`activeStatus`/`onStatusChange`（旧分支自动隐藏）。

### 3.2 Collections/index.tsx 状态模型

- `activeTab: 'video'|'iptv'` → `mainTab: 'all'|'video'|'iptv'`。
- **状态筛选去向（已确认）**：`statusFilter` 移入「更多筛选」折叠面板（`RecordFilterPanel`，与历史页一致），状态 chips：全部/未观看/正在看/已看完，**仅过滤视频项**；IPTV 恒显示。综合 tab 下该面板同时作用于影视分区，直播分区不受影响。
- 数据源（保持现有 `collectedVideos`/`favoriteChannels` 计算逻辑，仅按 mainTab 选择展示）：
  - `mainTab==='all'`：影视分区 = 过滤后 `collectedVideos`；直播分区 = `favoriteChannels`（不受状态过滤）。
  - `mainTab==='video'`：仅影视分区。
  - `mainTab==='iptv'`：仅直播分区。
- 融合 tab 计数：
  - `综合` = 过滤后视频数 + IPTV 数（IPTV 不受影响，恒为全量）。
  - `视频` = 过滤后视频数。
  - `IPTV` = IPTV 数（全量）。
  - 状态 chips 计数复用现有 `statusCounts`（仅统计视频）。
- 排序：`Select` 保留，作用于影视分区（综合/视频 tab 显示，iptv tab 隐藏）。
- 顶部搜索：保持按 mainTab 注册回调；综合 tab 下同时过滤视频与 IPTV。
- 删除逻辑：`executeDelete` 按项类型选 `removeCollection` / `toggleFavorite`，跨分区兼容（沿用现有实现）。
- 离开页面清空、`useInfiniteScroll`、`BackToTopButton`、`ConfirmDialog` 全部沿用。

### 3.3 VideoCard 角标重组（向后兼容，靠 `status` prop 分支隔离）

新增可选 prop：
- `status?: 'unwatched' | 'watching' | 'watched'` —— 仅收藏页传入 `video._status`；其他页面不传。

渲染分支（位于封面内，与原角标同级，`!batchMode` 守卫不变）：
- **传入 `status` 时（收藏页）**：
  - 左下角：组合容器 `.video-card-badges-bl`（flex 并排）内含 `<年份 span>` + `<类型 span>`（类型用现有 `typeLabels` 映射）。
  - 右下角：新增 `<span className="video-card-status status--{status}">`，文字取 `STATUS_CONFIG` 的 label（未观看/正在看/已看完），配色沿用原型绿/橙/蓝。
  - 收藏页视频卡同时传 `hideFavorite`（收藏页已用 `record-card__delete` 管理删除，封面不再显示收藏按钮，与原行为一致）。
- **未传 `status` 时（默认，Browse/Home/Detail）**：完全保持原渲染——左上评分/右上收藏/左下年份/右下类型，源码改动点外的 JSX 路径一字不改。

> 隔离原则：用「是否传入 `status`」作为开关，而非新增 `variant` 或全局 CSS 覆盖，确保其他页面零回归。

### 3.4 IPTVChannelCard（零改动）

`src/components/IPTVChannelCard` 现状即为方案 B 要求的竖排布局，直接复用 `<IPTVChannelCard channel={ch} hideFavorite batchMode={batchMode} epgIndex={epgIndex} />`，无需任何修改。

## 四、CSS 改动

> **关键前提（核实结论）**：历史页整改已落地，但其通用样式**都定义在 `History.css` 且带 `.history-page` 页面级作用域**——`.record-actions`/`.action-btn`/`.record-status--fused` 在 `History.css`，「更多筛选」面板（`.history-filter-panel`/`.history-status-chip`/`.history-sort-chip` + 内联 JSX）也是历史页内联实现。收藏页根元素是 `.collection-page`，直接复用 `actions`/`fusedCategories` 时**这些样式不会生效**。必须先抽离。

### 4.1 通用样式抽离到 `RecordShell.css`（组件级，去页面前缀）

| 类名 | 当前位置 | 搬迁目标 | 原因 |
|---|---|---|---|
| `.record-actions` / `.action-btn` 系列 | `History.css`（无前缀，但随 History.css 编译） | → `RecordShell.css`（组件容器样式，天然归属） | `actions` 是 `RecordShell` 的 prop，样式应随之 |
| `.record-status--fused` 系列（`.history-page .record-status--fused`） | `History.css` 带 `.history-page` 前缀 | → `RecordShell.css` 并去掉 `.history-page` 前缀 | 融合 tab 是 `RecordShell` 能力，不该被历史页 scoped 锁死 |

搬迁后历史页 `.history-page .record-actions`/`.record-status--fused` 的覆盖规则需并入通用类或改为不带前缀（两页布局一致，无需页面级覆盖）。

### 4.2 「更多筛选」折叠面板抽公共组件（与历史页完全一致）

历史页的「更多筛选」面板（状态 chips + 排序）是**页面内联实现**（`History/index.tsx` 第 696–732 行 + `History.css` 第 444 行起）。建议抽为公共组件 `src/components/RecordFilterPanel/RecordFilterPanel.tsx` + `.css`：
- **范围锁定（已确认）**：面板内容**与现有历史页完全一致**——仅「状态 chips（全部/未观看/正在看/已看完）+ 排序」，**不扩展任何额外维度**（如来源筛选）。
- Props：`statusFilter` / `onStatusChange` / `sortBy` / `onSortChange`（或仅状态，排序已在 `actions` 常显）/ `statusOptions`。
- 样式用通用类（去掉 `.history-` 前缀，或保留为组件级），保证收藏页复用后视觉与历史页一致。
- 历史页先改为引用该组件（行为不变），收藏页再复用，**避免重复两份面板代码**。
- 若暂不愿抽公共组件，退路：在 `Collections.css` 独立复制一套（`.collection-filter-panel`/`.collection-status-chip`），但会产生重复代码，不推荐。

### 4.3 新增 `VideoCard` 角标重组样式（放 `VideoCard.css`，受 `status` prop 触发的 className 控制）

- `.video-card-badges-bl`：绝对定位 `left/bottom`，flex 并排，gap 4px，视觉继承现有半透明胶囊（复用 `.video-card-year-badge`/`.video-card-type` 配色）。
- `.video-card-status`：绝对定位 `right/bottom`，圆角胶囊；`.status--watched`(绿)/`.status--watching`(橙)/`.status--unwatched`(蓝)。
- 默认（不传 `status`）完全走原 `.video-card-year-badge`/`.video-card-type` 路径，不新增类。

### 4.4 网格体系保持不变

`.video-card-grid`（`--card-cols` 响应式）/`.iptv-channel-grid` 现状不变——方案 B 只调整「分区」结构，不改变列数体系（收藏页是资源库浏览，更多列更合适，不强制历史页的 4 列上限）。

### 4.5 分区间距

新增 `.section-head`（标题「影视」/「直播」+ 计数）样式；若 `Collections.css` 已有类似可复用则对齐命名。

## 五、实施步骤（建议次序）

1. **抽离通用样式（前置，影响后续）**：把 `.record-actions`/`.action-btn`/`.record-status--fused` 从 `History.css` 搬到 `RecordShell.css`（去 `.history-page` 前缀）；历史页编译验证样式不丢。
2. **抽 `RecordFilterPanel` 公共组件**：从 `History/index.tsx` 抽出「更多筛选」面板（状态 chips + 排序），`History` 改为引用（行为不变），保证收藏页可复用。
3. **VideoCard 角标重组**：加 `status` 可选 prop + 分支（默认路径不变），补 `VideoCard.css` 新类。改完 `npm run build` 确认 Browse/Home/Detail 无回归（最关键隔离验证）。
4. **Collections 切融合模式**：`RecordShell` 传 `fusedCategories` + `actions`（含排序 `Select` + 「更多筛选」按钮触发 `RecordFilterPanel` + 批量管理），移除旧 `activeTab`/`statusTabs`；删除页面内 `record-edit-row`（其按钮已上移至 `actions`）。
5. **Collections 状态模型**：`mainTab` 三态、状态筛选进 `RecordFilterPanel`（仅过滤视频）、分区渲染（综合=两分区并排；视频/iptv=单分区）、tab 计数、跨分区批量、`currentListIds()` 综合返回两类 id 全集。
6. **Collections.css**：分区间距（`.section-head` 标题+计数）。
7. `npm run build`（必过 `noUnusedLocals`）+ `npm run lint:all`；校准 `AGENTS.md` 测试计数表（collections.spec.ts）。

## 六、已确认事项

本轮三处遗留点已在用户侧拍板，结论如下：

1. **状态筛选去向**：状态筛选（全部/未观看/正在看/已看完）**移入「更多筛选」折叠面板**，与历史页一致；不再作为 tab 下方独立第二行或顶层标签。仅过滤视频项，IPTV 恒显示。
2. **综合 tab 状态过滤语义**：综合下选非「全部」状态时，**影视分区仅显示对应状态、直播分区恒全量**——**符合预期**，按此实施。
3. **「更多筛选」范围**：与现有历史页**完全一致**——仅「状态 chips + 排序」，**不扩展来源等其他维度**。

至此所有决策项均已闭合，文档可直接作为落地依据。

## 七、遗留风险

- **样式作用域（已核实，最高优先级）**：`.record-actions`/`.action-btn`/`.record-status--fused`/「更多筛选」面板均定义在 `History.css`（`.history-page` scoped 或随 History.css 编译），收藏页复用 `actions`/`fusedCategories` 时**不会自动生效**。必须先按 §4.1/§4.2 抽离，否则收藏页顶部按钮组与筛选面板会「无样式裸奔」。这是本次落地最大的隐藏坑。
- **VideoCard 全局回归**：角标改动必须严格靠 `status` prop 分支隔离；实施第 3 步后需手动/截图验证 Browse/Home/Detail 卡片角标无变化（最大回归面）。
- **跨分区批量**：综合 tab 下 `selected` 同时含视频与 IPTV id，`executeDelete`/`selectAll` 已按类型分发，但需确保 `currentListIds()` 在综合下返回两类 id 全集。
- **抽公共组件的先后顺序**：`RecordFilterPanel` 必须先抽且历史页改引用验证通过，再让收藏页复用；不要在历史页未迁移完成时就删 History.css 里的原面板样式。

## 八、验证

- 构建：`npm run build`（含 ESLint/Stylelint `npm run lint:all`）。
- 交互（手动或 E2E）：
  - 切 综合/视频/IPTV 看两分区 vs 单分区；
  - 综合下影视卡封面左下「年份+类型」、右下「观看状态」；IPTV 卡保持原竖排；
  - 「更多筛选」状态 chips 仅过滤影视分区，直播恒显示；
  - 排序仅影响影视；批量跨分区勾选/全选/删除/清除全部；
  - 拖动窗口看 `record-actions` 图标降级；
  - **回归校验**：Browse/Home/Detail 的 VideoCard 角标布局与整改前完全一致。
