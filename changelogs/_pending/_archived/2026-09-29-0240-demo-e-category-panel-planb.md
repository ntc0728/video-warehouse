---
date: 2026-09-29 02:40
---

# 分类 chip 面板方案 B：chip 行 + 子分类列表（无内容网格）

- date: 2026-09-29 02:40
- module: demos/home-style-e-typographic.html
- type: feat
- build: lint:all 7 门全绿 + smoke-e.mjs 44 项断言 SMOKE OK + check-demo ALL OK
- files: demos/home-style-e-typographic.html (+174/−11)

## 旧 ↔ 新

1. **顶栏左侧**：原 7 个静态文字链接（首页/剧集/电影/综艺/动漫/榜单/IPTV，href=# 无交互）→ 对齐项目 `CategoryQuickAccessNav` 的 **8 chip**（首页/电影/剧集/综艺/动漫/纪录片/排行榜/全部分类 ›，黑底白字选中语言），IPTV 移到功能链接区。
2. **子分类面板（新增 `.cqa-panel`）**：点击或 hover（首开 200ms 延迟）chip 弹出报刊「栏目」抽屉——`fixed` 贴 mast-nav 下缘、**锚定 chip 左缘 + clamp 防溢出**、上直角下圆角；面板头 = 分类名 + 眉批「点子分类 → 下方结果面板」；子分类 chip 行（当前项 accent 高亮）。**无 3×3 内容网格与分页**（方案 B 范围，待评审决定是否升级方案 A）。
3. **子分类数据**：综艺/动漫/纪录片/排行榜 = 项目 `categoryPanelData.ts` 同值静态表；电影/剧集 = 快照 `DATA.genres` 全量 genre（20 chips，全部 + 19 genre）。
4. **子分类点击** → `showPanel(title, list)`（自 `runSearch` 抽出复用）：genre 走 `genreIds AND + type 过滤`、排行榜走 trending 池按 mediaType 过滤，统一 **popularity 降序** top20，进既有结果面板（四角标卡片）。
5. **交互契约**（对齐项目）：hover 首开 200ms / 移出 120ms 收起缓冲 / 面板内 hover 取消收起 / 点外部 mousedown 关 / Esc 关 / **滚动立即关** / resize 关 / 首页与全部分类 chip 不开面板（首页=关+回默认高亮）。
6. **骨架期**：8 chip 纳入 `.booting` 横条组 + `disabled`，boot 完解锁。

## 验证

- smoke 12 项新断言：开面板/子分类 20 chips/眉批/子分类→结果面板（「电影 · 冒险 · 14 条」）/关+回首页高亮/结果四角标/排行榜 4 项/toggle 关/Esc 关/外点关/首页不开。
- `npm run lint:all` 7 门全绿。
