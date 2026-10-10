---
date: 2026-10-09 17:25
---

# 2026-10-09 17:25 — 公告条未测速不再空缺 + 1024-1280 顶栏收口为「只去图标」+ 旧 bundle 实锤

## 背景（用户第五轮质询）
用户三项质询：① Browse 左栏骨架分类/年份胶囊「2 列无间距、年份没左对齐」；② 首页公告后面是空的；③ 1024-1280 导航字号变小（愤怒）。

## 关键发现：用户在看旧 bundle（实锤）
- `dist/assets/index-Bcol5dYC.css`（15:11 构建代次）**同时**含：
  - `html:not(...)...nav-label{font-size:var(--text-xs)}`（字号缩水规则）→ 吻合质询③；
  - 无骨架胶囊桌面宽度规则 → 胶囊 width:100% 满格灰条、2 列贴死无间距、无左对齐 → 吻合质询①。
- 最新构建 `dist/index.html` → `index-Dsz_MXKs.css`：字号缩水 0 条；骨架胶囊 `justify-self:start; width:var(--chip-w)`（Browse chunk `index-GyPfYV2x.css`）。
- 结论：质询①③在最新代码/产物中均不存在，用户页面缓存/入口停在 ≤15:11 代次。需强刷 Ctrl+Shift+R 或确认访问入口。

## 本轮真改动
1. **StickyHeader.css 1024-1280 段收口**（用户口径「只去除图标」）：
   删除原 ②（nav-item padding 收 2xs + gap:0 + height:auto + radius-sm）、③（left/right 组 gap 收 xs）、⑤（主导航 gap 收 2xs + margin-left:0）。该段现只保留：① svg 隐藏、①c 设置入口反转（显图标隐文本）、② logo 强制可见。字号/padding/gap/圆角与 >1280 完全同源（≥1024 段）。
2. **HomeTopStrip.tsx 未测速不再隐藏**（质询②真因）：
   原 `!enabled.some(latencyCheckedAt)` → 整段隐藏 → 公告后面空白。改为未测速显示「数据源 N 个已启用」；测过则「数据源 ok/N 在线」；enabled=0 才隐藏。文案待用户验收。

## 验证
- tsc -b ✓ / vite build ✓（12.7s）/ stylelint（StickyHeader.css）✓
- 产物断言：新主 CSS 无字号缩水、无 nav-item padding 覆盖；`HomeRoute-DIZxzKjx.js` 含「个已启用」。
- 未 commit / 未跑 E2E（按红线等用户验收）。
