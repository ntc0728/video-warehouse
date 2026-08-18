# 历史页 UI 整改实施计划（history-redesign-plan）

> 配套原型：`changelogs/demos/demo-history-redesign-2026-08-18.html`（已验证交互：tab 切换 / 筛选 / 批量 / 列数 4→2→1）
> 仅改 history 页，Collections 零波及。时间轴逻辑保持不变。

## 一、已确认决策（来自多轮迭代）

| 项 | 决策 |
|---|---|
| 顶部标签 | 原「影视/IPTV 分段 + 状态筛选标签页」合并为一组 `StatusTabs`：`综合 / 视频 / IPTV`（彩色圆点 + 计数） |
| 「综合」语义 | 视频 + IPTV 按 `_histTime` 时间戳混合排序展示（1a） |
| 操作按钮 | 移除搜索图标；保留「更多筛选 / 清空历史 / 批量管理」图标+文本胶囊；窄屏降级为仅图标（C 方案） |
| 卡片形态 | 视频/IPTV 同尺寸横版（左媒体 + 右 3 行正文）；IPTV 左圆 logo + 右文字（2a） |
| 卡片正文 | 3 行：标题 / 类型·来源·集数 / 状态·时间 |
| 卡片列数 | ≤375px → 1 列；376–677px → 2 列；≥678px → 固定 4 列 |
| 状态筛选归属 | 「未看完/已看完」仅作用于视频项；IPTV 不涉及该状态，恒显示 |
| 「更多筛选」范围 | 仅含状态 chips（全部/未看完/已看完）+ 排序，不扩展其他维度 |
| 时间轴 | 「今天 / 昨天 / 本周 / 本月 / 更早」分组保留，`getDateGroup` / `GROUP_ORDER` / 算珠联动逻辑不变 |
| 范围 | 仅 history |

## 二、现状与改动边界

- `src/components/RecordShell/RecordShell.tsx`：`record-aside` 内 `category-segmented`（影视/IPTV）+ `record-status-group`（StatusTabs 全部/未看完/已看完）。**Collections 复用此组件**，故不能直接改内部结构，需新增可选 prop 兼容。
- `src/pages/History/index.tsx`：`activeTab('video'|'iptv')` + `statusFilter('all'|'unfinished'|'finished')` 两套状态；`grouped`/`timelineItems`/`IntersectionObserver` 算珠逻辑全部在此，**时间轴仅依赖 grouped，不依赖 tab 形态**。
- `src/components/StatusTabs/StatusTabs.tsx`：已支持 `tab.key/label/icon/color/count`，直接复用渲染融合 tab。
- `src/components/VideoCard` 有 `variant="landscape"`（横版 16:9 + 底部进度叠加），`IPTVChannelCard` 为竖版卡；两者尺寸/布局不一致，需统一为「左媒体 + 右 3 行」。

## 三、组件契约变更

### 3.1 RecordShell（向后兼容）
新增两个可选 prop：
- `fusedCategories?: { tabs: RecordStatusTab[]; active: string; onChange: (k: string) => void }`
  - 传入时：用 `StatusTabs` 渲染融合分类栏（综合/视频/IPTV），隐藏原 `category-segmented` 与 `record-status-group`。
  - 不传时：保持原行为 → Collections 零改动。
- `actions?: ReactNode`：渲染在 `record-aside` 右侧，承载「更多筛选 / 清空历史 / 批量管理」三组按钮（容器 `.record-actions`，CSS 负责图标+文本 → 仅图标降级）。

### 3.2 History.tsx 状态模型
- `activeTab: 'video' | 'iptv'` → `mainTab: 'all' | 'video' | 'iptv'`。
- 移除顶层 `statusFilter`；改为「更多筛选」折叠面板内的 chips（全部 / 未看完 / 已看完）+ 排序。
- **状态筛选归属**：`未看完/已看完` 仅对视频项生效（IPTV 直播不涉及观看进度，不携带该状态）；当状态非「全部」时，IPTV 项始终显示，不被过滤掉。
- 数据源：
  - `mainTab==='all'`：`historyVideos` 与 `iptvHistory` 合并，按 `_histTime` 降序。
  - `mainTab==='video'`：仅 `historyVideos`。
  - `mainTab==='iptv'`：仅 `iptvHistory`。
- 融合 tab 计数：`综合` = 当前列表总量（视频+IPTV，受「更多筛选」状态过滤）；`视频` = 视频项数量；`IPTV` = IPTV 项数量。需新增一个 `memo` 计算三项计数（复用现有去重逻辑）。
- 保留 `grouped` / `timelineItems` / 算珠 `IntersectionObserver` 全部逻辑（时间轴不变）。
- 顶部导航搜索回调保留（placeholder 按 mainTab 切换）。
- `useInfiniteScroll`、`BackToTopButton`、`ConfirmDialog`、`executeDelete`（按 mainTab 选 removeHistoryByVideo / removePlayRecord / clearHistory / clearPlayHistory）沿用。

### 3.3 新组件 RecordCard
- 路径：`src/components/RecordCard/RecordCard.tsx` + `RecordCard.css`（初仅 History 使用）。
- Props：`variant: 'video' | 'iptv'`、`item`、`batchMode`、`selected`、`onToggleSelect`、`onDelete`。
- 结构：`record-card`（复用现有选中边框/批量勾选/删除按钮类名）+ 左媒体区 + 右 3 行正文。
  - 左媒体：video → LazyImage(poster/backdrop)；iptv → LazyImage(logo, 圆形裁切)。统一高度 96px，左侧媒体区约 138×78。
  - 正文 3 行：标题（单行省略）/ 类型徽标(视频/直播)+来源+集数 / 状态(已看完·橙 / 未看完·绿)+时间。
  - video 底部保留进度条（`progress/duration`）。
- 复用现成的 logo 回退（`resolveChannelLogoCandidates`）、`LazyImage`、删除/勾选逻辑，不再依赖 `VideoCard`/`IPTVChannelCard` 内部布局。

## 四、CSS 改动

- **保留**：`.history-content::before` 贯穿竖线、`.history-node-col`/`.history-dot`、桌面 `.history-timeline` 算珠面板、`@media (width >= 768px)` 规则——全部不动。
- **卡片网格**：新增 `.history-grid`（替代 `.video-card-grid`/`.iptv-channel-grid` 在该页的用法），列数通过视口媒体查询：
  - `max-width: 375px` → 1 列
  - `min-width: 376px` 且 `max-width: 677px` → 2 列
  - `min-width: 678px` → 固定 4 列（直接用 `repeat(4, minmax(0,1fr))`，不做外层限宽、不随超宽屏膨胀到 5+）
- `.record-actions`：图标+文本胶囊；`@media (max-width: 640px)`（或小屏断点）降级为仅图标圆钮。

## 五、实施步骤（建议次序）

1. 在 `RecordShell` 加 `fusedCategories` + `actions` 可选 prop（兼容模式，先不影响 Collections）。
2. 新建 `RecordCard` 组件（video/iptv 两变体，3 行正文 + 统一尺寸）。
3. 改 `History.tsx`：状态模型合并、`mainTab` 切换、混合数据源、`RecordCard` 接入分组渲染、移入「更多筛选」折叠面板。
4. 补 `history.css`：`.history-grid` 响应式列数、`.record-actions` 降级、`.record-card` 样式。
5. `npm run build` 必须过（`noUnusedLocals`）；必要时校准 `AGENTS.md` 测试计数表。

## 六、已确认事项（原待确认项均已拍板）

- **状态筛选归属（已定）**：「未看完/已看完」仅过滤视频项，`mainTab==='all'` 且状态非「全部」时，IPTV 项仍恒显示。
- **「更多筛选」范围（已定）**：仅状态 chips（全部/未看完/已看完）+ 排序，不扩展其他维度。
- **超宽屏列数（已定）**：固定 4 列，不做外层限宽、不膨胀到 5+。
- **tab 命名（已从始确认）**：用「IPTV」而非「直播」，与源数据 `iptvHistory` 一致。

## 七、遗留风险

- **「更多筛选」排序维度**：排序默认按 `_histTime` 降序；若「更多筛选」需提供「最近/最早/标题」等排序选项，需明确字段与默认项（建议默认「最近观看」）。落地时若用户未指定，默认仅保留降序并预留排序入口。
- **RecordCard 落地耦合**：`IPTVChannelCard` 现有竖版布局与新横版 3 行结构不一致，需在 `RecordCard` 内独立实现横版变体，避免改动 `IPTVChannelCard` 影响 IPTV 播放页。

## 八、验证

- 构建：`npm run build`（含 ESLint/Stylelint `npm run lint:all`）。
- 交互（手动或 E2E）：切综合/视频/IPTV 看混合 vs 单一流；展开「更多筛选」过滤；批量勾选/全选/删除/清空；拖动窗口宽度看列数 4→2→1；时间轴算珠联动不破坏。
