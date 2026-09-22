---
date: 2026-09-22
module: boot-splash / Person / E2E
type: 视觉修复（全站骨架↔真实尺寸对齐，home 续条）
build: ✅ npm run build + lint:all 全绿
tests: boot-splash 21/21 · skeleton 18/18 · boot-splash-iso 42/42 ✓（ad-hoc 调试档）+ 全站三态审计（临时 spec 与 .audit-geo 产物已删）
---

# 全站启动骨架尺寸对齐（browse/chart/collections/history/iptv/detail/person/player）

承接 `2026-09-22-1620-home-skeleton-geo-align.md`（home 页），本轮把三态实测
（A=启动骨架第二段 / B=React 页级骨架 / C=真实内容）推广到其余全部 shape。

## 系统性修复（index.html，影响所有 shape）

| # | 问题 | 修复 |
| --- | --- | --- |
| S1 | `.bs-body` 固定 16px padding、无 2200 封顶 → 各页主列比真实宽 30–250px，挂载瞬间横缩 | padding-inline 按 `--page-pad-x` 分档（≥768: 14.333 / 1440: 60 / 1920: 100 / 2560: 140）+ `.bs-body > *` max-width 2200 居中（play 形态除外）；home 专属规则并入通用 |
| S2 | `.bs-body` flex column 默认 shrink 把超视口内容等比压扁（person hero 17rem 实测 171px） | `.bs-body > * { flex-shrink: 0 }`（溢出由 overflow:hidden 裁剪，块高自洽） |

## 各页修复

| 页 | 问题（修复前实测） | 修复 |
| --- | --- | --- |
| chart | 榜单行灰块 46px vs 真实行卡 231px（差 5 倍，数据到达榜单区跳一整屏） | `chartRows()` 改结构行卡 `.bs-chartitem`（16:9 图槽 + 两行文本；桌面 17.5rem / 移动 16.1rem，行 gap 5px） |
| collections | 顶部 filterBar 结构错构（真实页无筛选条） | BUILD 删 filterBar → sec + 双分区网格 |
| history | 同上 filterBar 错构 | BUILD 删 filterBar → sec + record 网格 |
| person | A 态「16:9 hero(378px) + 文本行」vs 真实 hero(≈224 有图档) + tabs + 作品网格 | 新 `.bs-person-hero`（桌面 17rem / 移动 21.2rem）+ tabs + `.bs-row--work`（读 `--person-work-cols` 三方同源）；FILL 改补作品网格 |
| player | 移动档舞台 16:9 vs 真实 16:10（矮 34px） | `@media ≤767 .bs-player__stage { aspect-ratio: 16/10 }` |
| PersonSkeleton.css | 移动档 hero min-height:0 比真实矮 ≈58px | 移动/app 档 min-height 21.2rem（对齐实测 293px）；**桌面 17rem 保留**（C 态实测 119px 是 mock 无头像降级档，非产品缺陷——审计曾误改 9rem，已回滚并注释留痕） |
| iptv / detail / browse | 宽度经 S1 对齐（iptv main 1236→1148 vs 真实 1155.5；detail top 1408→1320=C；browse 主列差 112→24px） | 无需专属改动 |

## 复测收敛（A vs B/C）

- person hero：A==B（224.4 / 296.8），移动 A/B vs C 差 3.3px
- chart 行：A 231 == B/C 231（移动 213 ✓）
- collections/history/iptv/detail/browse 主列宽差 ≤24px（修复前 100–250px）
- player 舞台：桌面 A 1044.8 vs C 1069.1（2%）；移动 A 214.4 vs C 226.9（3%，移动 page-padding 6px 档残差）

## 残差 / 遗留

- 移动档 `.bs-body` padding 16px vs 真实 `.page-padding` 移动档 ≈6px → 全 shape 移动宽度差 ~20px（未动，观感影响小，需要时下轮对齐）。
- ui-scale 自动档 / `--page-pad-x` <1440 档的 fluid 乘数仍是近似（14.333px 常量）。
- history 的 B 态与 detail 的 mock 态受审计数据限制未采到（holdIndexedDB 精简版对 history 无效；detail 27205 mock 无数据落 not-found）——两者 A 态已按已知契约（SKEL-011/013）构型修正。
- 全量 E2E 未跑（未放行）。`.audit-geo/` 空目录为审计遗留（json 已删），可随手删。
