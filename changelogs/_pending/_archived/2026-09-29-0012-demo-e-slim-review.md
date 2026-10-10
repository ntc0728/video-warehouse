---
date: 2026-09-29 00:12
module: demos
type: change
build: pass
files:
  - demos/home-style-e-typographic.html
demo: demos/home-style-e-typographic.html
---

# Demo E 精简评审落地：6 项方案中的 ①–⑤（⑥ 行数据去重待拍板）

评审质疑多区块存在意义后，按用户批准的 6 项精简方案执行 ①–⑤；⑥「7 行跨行去重」因
CMS 数据源结构性缺口（电影类目仅 3–4 条、评分覆盖 ≈1%）改弦，待用户选定行名策略再动。

## 旧 ↔ 新

| 位置 | 旧 | 新 |
| --- | --- | --- |
| 头条 CTA | 「＋ 加入待看」死按钮（项目无待看功能） | 「＋ 收藏」接 FAVS localStorage，点按切换 ♥ 已收藏，联动公告带收藏 pill；切 slide 随条目渲染态 |
| 01 继续观看 | 固定 `slice(0, 6)`，与 `--cont-n`（4/5/6）脱节会溢出第二行 | `slice(0, --cont-n)` 单行满编截断 |
| 03 本周新声（TOP20 + 升降列） | h2「本周新声」与公告带「完整热度榜›」两个名字指同一数据；20 条双栏 `repeat(10,auto)`；升降为哈希假值 | 统一命名「今日趋势榜」（公告带锚同名同物）；10 条双栏 `repeat(5,auto)`；删 delta 列（CSS 5→4 列、mobile 4→3 列、night 配套删）；sub 标注「热度为演示值」 |
| 11 为你推荐 | 整区（tabs 5 桶 + 海报行 + fading 切换 + 骨架，~90 行 JS + 20 行 CSS） | 整区删除（HTML/CSS/JS：TABS/TAB_POOL/renderRecTabs/renderRecRow/initRecTabs/recTab/renderPosterSkeleton 全删） |
| 02 分类索引 | 独立区块（4 类 + IPTV 拼链接，`renderCategories`） | 降级为 footer 行内「收录统计 · 电影 X · 剧集 Y · 综艺 Z · 动漫 W」（`renderFootStats`，离线显示 —）；`.cat-index` CSS 与骨架删 |
| 区块编号 | 01 继续 / 02 分类 / 03 趋势 / 04–10 七行 / 11 推荐 | 01 继续 / 02 趋势 / 03–09 七行（renderRows 与骨架 `i+4→i+3`） |

## 验证

- 语法+id 引用校验脚本：script×2 OK、refs 15/15 全命中、无删除物残留
- 红线 grep：`display:none` 仅剩滚动条隐藏 + mobile heat 隐藏（既有响应式）；无 `visibility:hidden`
- `npm run lint:all`：design / css / json / version-sync / test-map / eslint / build 7 门通过
