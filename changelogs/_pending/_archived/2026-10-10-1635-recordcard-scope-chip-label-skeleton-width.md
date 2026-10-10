---
date: 2026-10-10 16:35
---

# 2026-10-10 16:3x — RecordCard 作用域扩展 + chip 计数右对齐 + Browse 骨架真实宽度

## 背景（用户三项质询）

1. 「收藏页 iptv card 你的整改是认真的吗？确定和历史页中的 iptv card 一致？」
2. 「record-inline-filter 内每个 tab 按钮内右侧也要显示数量，整改 3 次后有类似 status-tab__count？」
3. 「browse 页左栏胶囊按钮左对齐，间距与真实元素保持一致」

## 根因与改动

### ① RecordCard.css 作用域缺陷（#2 真实根因，上轮遗留 bug）
- 上轮把收藏页 IPTV 卡换成 `RecordCard`，但 **RecordCard.css 全部 50 条规则
  作用域收在 `.history-page` 下**（文件头注释自述「避免影响收藏页共用全局
  .record-card」——那是收藏页还在用 `.record-card` 当批量包裹层的旧前提）。
  收藏页根类是 `.collection-page` → 换卡后**卡内样式全部不生效**（hover/
  媒体区 16:9/台标 cover/标题跑马灯/类型徽标/LIVE 角标/进度条全丢），
  只剩裸结构——用户质疑完全成立。
- 修法：`.history-page` → `:is(.history-page, .collection-page)`（:is() 特异性
  = 单类，与原前缀完全一致，History 零变化）；文件头注释同步改写。

### ② chip 计数右对齐（#3 布局差距）
- 计数链路（数据 statusCounts → TSX 渲染 → .status-tab__count 同款徽章 CSS）
  三层本来就在，但 **fused status-tab 的 label span 有 `flex:1` 把计数推到
  按钮右缘**，chip 的 label 是裸文本节点不参与 flex 分配 → 计数贴着文字，
  「label 左 / count 右」的两端布局不存在 → 用户观感「不像 status-tab__count」。
- 修法：`RecordShell.tsx` label 包 `.record-filter-chip__label` span；
  `RecordShell.css` ≥1024 块加 label `flex:1 + ellipsis` 规则（镜像
  status-tab 的「> span:not(dot):not(count)」规则）→ 计数贴按钮右缘。

### ③ Browse 骨架胶囊真实宽度（#1）
- 网格几何（2 列 / gap --space-xs·--space-2xs / margin-top --space-xs /
  justify-self:start 左对齐）本就复用真实 `.filter-bar__chips-*` 规则；
  观感差异来自**胶囊盒宽**：旧骨架 3.2em/2.6em 交替（2.6em 无真实对应），
  真实 chip = 文本宽 + 左右 padding(--space-sm×2)。
- 修法：`BrowseChromeSkeleton.tsx` 地区/年份组用真实常量标签
  （REGION_OPTIONS 12 个 / YEAR_OPTIONS+其他 13 个）逐个注入
  `--chip-w`（CJK 1em、ASCII 0.55em/字 + 2×space-sm）；分类 genre 来自
  接口无法预知 → 恒 2 字档兜底。删 nth-child(2n) 假交替。
  超出 MOBILE_CHIPS=8 的真实标签标 --fill（移动端不渲染、≥1024 复活），
  移动端数量仍克制。

## 验证

- `tsc -b` + `vite build`：pass；stylelint 3 文件 0 问题；eslint 0 error。
- 产物断言：`is(.history-page,.collection-page)` 进 CSS 产物 ✓；
  `record-filter-chip__count` 进 RecordShell chunk ✓；`--chip-w` 进 index chunk ✓。
- 未实跑 E2E / 未 commit（等验收）。

## 遗留疑点（待用户确认）

- 用户三轮「看不到改动」的模式（⑥ 计数右对齐 / ② 卡片不一致 / ③ 计数不可见）
  与「代码在、产物在」持续矛盾 → 高度怀疑浏览器在跑旧 bundle
  （dev server 未热更 / 服务worker / 或看的是历史发布链接）。
  已请用户强刷（Ctrl+Shift+R）并确认查看入口。
