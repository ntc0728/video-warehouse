---
date: 2026-09-23
module: HeroBili / boot-splash
type: 布局修复 + 视觉微调
build: ✅ npm run build + lint:all 全绿
tests: home 1.2 ✓（1 passed / 8s）
files:
  - src/components/HeroBanner/HeroBili.css
  - index.html
demo: （无独立 demo，真实页 1440 直接预览）
---

# HeroBili 三连：banner 撑满行高 + 桌面文案/按钮收档 + 右卡角标间距收窄

## ① banner 未撑满父容器（1440 下比右栏矮 ~11px）

- **旧逻辑**：`.hero-bili__banner { height: var(--hero-banner-h) }` 恒定值
  （1440 ≈255.2px = main-w×0.24），右栏两行 16:9 卡实测 ≈266px → 左右下沿不齐。
- **新逻辑**：`height: 100%` 撑满网格行（行高取右栏内容高），token 降级为
  `min-height` 兜底；骨架共用 `.hero-bili__banner` 同类同步生效。
  `index.html` boot-splash `.bs-herobili__banner` 的 `height` → `min-height`
  同步，防 boot→真实交接 ~11px 跳变。

## ② 桌面端文案/按钮稍大、与圆点距离过近

- **旧逻辑**：title `clamp(--text-2xl, 3.2vw+8px, --text-3xl)`（≥1024 恒命中
  28px 上限，vw 项死代码）；CTA `padding --space-xs --space-md` + `--text-sm`；
  dots `margin-top --space-xs`（按钮↔圆点仅 4px）。
- **新逻辑**：title `calc(--text-3xl * 0.9)`（25.2px，删 stylelint px-disable）；
  CTA `padding --space-xs --space-sm` + `--text-xs`；dots `margin-top --space-sm`
  （caption 底锚 → 按钮↔圆点 4→8px，文案/按钮整体上移）。meta 不动。
  **追修**：首版 CTA 纵向用 `--space-2xs`（桌面仅 ~2px）被反馈「按钮扁」，
  纵向回 `--space-xs`（~4px）、横/字号维持收窄——胶囊高宽比复原。

## ③ 右卡四角标间距

- **旧逻辑**：rating/year/type/fav 的 top/left/right/bottom 均 `--space-sm`（≈7.94px）。
- **新逻辑**：全部改 `--space-xs`（≈3.97px），注释同步 `--space-sm` → `--space-xs`。

## 验证

- build ✓ lint:all ✓（design/css/json/version-sync/eslint 全绿，35 warnings 均既有）
- home 1.2 Banner 交互 1 passed / 8s（preview dist，OS 动态端口）
- 全量 E2E 未跑（未放行）。
