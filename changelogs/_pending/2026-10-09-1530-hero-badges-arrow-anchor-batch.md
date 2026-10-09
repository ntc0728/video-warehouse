# 2026-10-09 15:3x — Hero 角标对齐 / 行箭头封面锚点 / 换一换骨架 / chip 徽章化 / 收藏页封面圆角 / 设置项窄屏显图标

## 用户指令（8 项，其中 6 项实施、2 项待确认）

1. **公告条内容建议** → 未动码，方案 + 问句待拍板。
2. **hero-bili__right 卡封面标签对齐 video card** → 已实施。
   - `HeroBili.css` `.hero-side-card__corner*` 重写：裸字 + text-shadow → 黑底胶囊
     （bg rgba(0,0,0,.72) / .55（年份）、--radius-sm、--text-xs、blur 6px），
     评分 = --color-rating + 600 + line-height 1，逐项对齐 VideoCard.css
     `.video-card-rating` / `__year-badge` / `__type`；位置口径不变。
   - `--hero-corner-fs` 不再被此块消费（定义保留，HeroBanner 经典版仍在用
     `--color-on-image-rating` 系）。
3. **行切换箭头以封面为垂直参考** → 已实施。
   - `TMDBMovieRow.css`：`top: 50%` → `top: var(--tmdb-arrow-cy, 50%)`。
   - `TMDBMovieRow/index.tsx`：新增 wrapperRef + 实测 effect —— 取首个
     `.video-card-cover`（竖版/横版同根类名）中心相对 wrapper 的 Y 注入变量；
     ResizeObserver 覆盖断点/列数变化，数据替换（骨架→真实、分类切换）由
     effect deps [items, continueItems, isLoading] 重跑覆盖；无封面回退 50%
     （骨架态箭头本就不显）。:active 的 translateY(-50%) scale 不受影响。
4. **换一换骨架与真实同尺寸** → 已实施（index.html bs-shuffle）：
   去 width:1.75rem 固定宽（28px，真实 ≈38px 内容撑出），padding 10px 2px →
   9.5px（--space-sm 冻结值），图标条 14→17px（--icon-sm），文本条 10×40 →
   14×37（--text-2xs 11px 竖排 3 字 + 0.15em 字距换算）。boot-splash 无全量
   token，按既有惯例冻结值硬编码，注释留换算依据。
5. **收藏页 hero-bili__right 右对齐** → ⚠️ 语境未定：`hero-bili__right` 只存在于
   首页 Hero（HeroBili.tsx:359），收藏页无此元素 —— 已问用户。
6. **chip 计数徽章化（对齐 fused status-tabs）** → 已实施：
   `RecordShell.css` `.record-filter-chip__count` 重写为 `.status-tab__count`
   同款（min-width --badge-size、padding 3xs/2xs、radius-full、--color-hover-bg、
   text-xs 600），删右对齐/弱化；选中态徽章底 = --chip-dot-color（对齐
   status-tab 的 --status-tab-color 逻辑）、反色字。排序按钮无计数（本就无）。
7. **收藏页 video card 封面缺圆角** → 已实施：
   `Collections.css` 增 `@media ≥768 非 app/tv .collection-page .video-card-cover
   { border-radius: var(--radius-md) }`（对齐首页 2026-09-29 口径，补去卡片化削掉的
   圆角；≤767/app 卡容器自带圆角无需补）。.record-card 包装层无 overflow/radius
   干扰（index.css:992 已核实）。⚠️ 历史页同为 record-card 包装（横版卡），
   用户未点名，未动 —— 已在汇报中问是否同步。
8. **导航字号恒定 + 设置项窄屏显图标** → 已实施：
   - 字号：上一轮已恢复 1024–1280 --text-sm，本轮复核无其它视口缩水点。
   - `StickyHeader.tsx` 设置入口加 `--icon-only` modifier；`StickyHeader.css`
     ≤1280 块增反转规则（svg display:block + label display:none，同特异性靠
     源码顺序压过通用去图标规则）。

## 用户三项拍板后追加实施（15:4x）

- **topstrip 数据源状态（B 方案落地）**：`HomeTopStrip.tsx` 左侧「公告」后加
  「数据源 N/M 在线」—— useSourceManagerStore video 场景，在线 = 已启用且
  最近测速有 latency；全部未测速（latencyCheckedAt 全空）时整段隐藏（避免
  误导性 0/N）。`Home.css` 增 `__source` / `__source b`（数字主文字色 +
  tabular-nums）。store 走直接模块导入（与 Settings 页同模式，不出 stores/index）。
- **「收藏页 hero-bili__right 右对齐」实义 = `collection-section-head__count`
  右对齐**（用户澄清）：`Collections.css` `__count` 加 `margin-left: auto`。
- **历史页封面圆角同步**（用户确认）：`History.css` 增 ≥768 非 app/tv
  `.history-page .video-card-cover { border-radius: var(--radius-md) }`
  （横版/竖版同根类名，一并覆盖）。
- 复验：tsc + vite build pass；stylelint（Home/Collections/History.css）0；
  eslint（HomeTopStrip.tsx）0。
