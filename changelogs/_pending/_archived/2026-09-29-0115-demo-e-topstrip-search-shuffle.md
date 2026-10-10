---
date: 2026-09-29 01:15
---

# 精简评审三项：删公告带 / 搜索可点 / 换一换对齐 HeroBili

- date: 2026-09-29 01:15
- module: demos/home-style-e-typographic.html
- type: refactor+fix
- build: lint:all 7 门全绿 + smoke-e.mjs SMOKE OK + check-demo ALL OK
- files: demos/home-style-e-typographic.html (+137/−81)

## 旧 ↔ 新

1. **公告带 .topstrip 删除**：HTML/CSS/`renderTopstrip()`/三处调用全删；头注释映射重排①–⑨；02 区注释、footer、底部说明同步去。收藏计数权威在 footer。
2. **搜索按 SearchBox 逻辑接入**：静态 span →可点按按钮，点击展开输入框并 focus；输入过滤本地池弹建建议下拉（≤8 条，海抩+标题+年份）；回车/放大镜 = `handleSearch` 出结果面板（.rcard 网格 + 条数 + 滚动定位）；建议点击 = handleSuggestionClick →搜索；Esc/✕ 收起；⌘K/Ctrl+K 唤起。未匹配空态 `empty`。
3. **换一换对齐 HeroBili**：删卡片整体转圈（文字也转）与 track `.fading` 淡出淡入；改为仅 `.sh-ic ↻` 图标转圈 0.6s `cubic-bezier(.16,1,.3,1)`+`.spinning` 动画锁防抖，点击整批推进 `SIDE_OFF`（shuffleOffset 同款）。

## 验证

- smoke-e.mjs 升级交互断言：搜索链路 6 项全过（展开/建议/回车/放大镜/关闭/⌘K）、换一换 4 项全过（换批/锁开/防抖/锁释放）、topstrip 无残留。
- grep 残留：`topstrip|renderTopstrip|ts-|fading` 仅头注释说明性文字。
- `npm run lint:all` 7 门全绿。
