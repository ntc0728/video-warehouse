---
date: 2026-09-22
module: boot-splash / Home
type: 视觉修复（骨架↔真实尺寸抖动）
build: ✅ npm run build + lint:all 全绿
tests: boot-splash 21/21 · skeleton 18/18 · boot-splash-iso 42/42 · home 1.1 ✓（ad-hoc 调试档）+ 三态实测审计（临时 spec 跑完已删）
---

# 首页骨架三态尺寸对齐（消除骨架→真实的抖动跳变）

## 需求（用户 2026-09-22）

「首页骨架元素尺寸与真实架构不一致，显示真实元素时有明显抖动（如 banner 尺寸不一致）」

## 审计手法

临时 spec 三态实测（A=启动骨架第二段 / B=React 页级骨架 / C=真实内容），
5 视口（1024/1280/1440/1920/2560）量 banner、右卡、过渡带、榜行、续看行 bbox，迭代收敛。

## 抖动源与修复（修复前 A vs C 偏差）

| # | 抖动源 | 修复前 | 修复 |
| --- | --- | --- | --- |
| 1 | splash home 形态不镜像 `--page-pad-x` 分档与 2200 封顶（固定 16px 铺满） | banner 宽 A 比真实**宽 78–327px**，React 挂载瞬间横缩 | `.bs-body` padding-inline 分档 14.333/60/100/140 + `.bs-home` max-width 2200 居中 |
| 2 | splash 缺「继续观看」行 | React 挂载凭空多一整行（200–320px）纵向跳 | BUILD.home 补 `contRow()`（head + 5 张 16:9 双行文本卡，镜像 .home-continue-row 占高） |
| 3 | `.bs-herobili` 卡壳 padding 12/16 vs 真实 space-sm/md (7/9.5) | banner 可用宽窄 ≈10px | padding 改 7px 9.5px 9.5px |
| 4 | React 骨架过渡带 item 高 = 纯字号 | B 比 C 矮 10px（骨架→内容纵向抖） | Home.css item 高 → `text-xs × lh-base + 2×space-3xs`（复测差 ≤1px） |
| 5 | splash 榜行海报 40×60 vs 真实 64×96（≥1920 72×108） | 左栏行高差 44px | `.bs-heat__poster` 64px + ≥1920 72px + 行 padding 4px |
| 6 | gap 硬编码 16/10/12px vs 真实 space-lg / --hero-main-gap / --home-rail-gap | 累计纵向偏移 | 统一 14.333px（space-lg clamp 顶）与 `clamp(7.2px, 4px+0.4167vw, 12px)` |
| 7 | 非宽屏 banner `max-height:42vh`（真实 classic hero 无封顶） | 矮视口比例被裁 | 删除，纯 aspect 16/9 |
| 8 | splash 过渡带三根裸条 vs 真实卡片壳 | 密度不符 | `.bs-home__strip` 补 surface+border+radius+padding（dark 规则同步） |

## 修复后残差（复测数据）

- banner：高差 ≤1.7px；宽差 +2.4~+11px（0.4–1.4%，ui-scale 自动档乘数为已知取舍）
- 续看行起 y 差 ≤24px（含 header 高度 6px 累计）；topstrip B/C ≤1px；heat 行 104 vs 103.3 ✓

## 遗留说明

- ui-scale 自动档（bundle @media token）骨架读不到，宽屏档 ±1% 宽度残差为已知取舍；
  要归零需把 --ui-scale 分档挪进 layout-tokens.css（影响面大，未动）。
- 全量 E2E 未跑（未放行）；iso 42/42 确认列数同源契约无回归。
