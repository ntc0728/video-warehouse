---
date: 2026-10-11 17:30
module: CategoryQuickAccess / Layout
type: refactor
build: pass
files:
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
  - src/components/CategoryQuickAccess/categoryPanelData.ts
  - src/components/CategoryQuickAccess/index.ts
  - src/components/Layout/AppLayout.tsx
  - src/assets/styles/index.css
demo: 无
---

# 2026-10-11 17:30 — mega 面板死代码清理（收口 4a986d2 退役遗留）

## 背景

顶栏分类 chips（CategoryQuickAccessNav）与宽屏 mega 面板（CategoryQuickAccessPanel +
useCategoryOverlayStore + categoryPanelData）已随 4a986d2「首页大屏整改」退役触发链
（StickyHeader 不再挂载 Nav），但组件本体仍在、AppLayout 仍全局挂 `<CategoryQuickAccessPanel />`
overlay——当日 changelog「全量 E2E 整改」节标注为建议后续单独清理项，本次落地。

## 改动（旧↔新）

- 【旧】CategoryQuickAccess.tsx 内含 Nav/Panel/InfoTip/useCategoryOverlayStore 四导出（≈570 行）；
  CategoryQuickAccess.css 含 ≥1024 mega 面板样式分支（≈462 行）；categoryPanelData.ts 214 行热度聚合数据层；
  AppLayout 全局挂载 `<CategoryQuickAccessPanel />`。
- 【新】三件套 + 数据层整体删除；目录只留圆卡本体（CategoryQuickAccess.tsx 3.4KB 全端彩色圆卡，
  点击跳 /browse）与 CategoryInlineBoard（宽屏合集推荐行）。index.ts 导出收敛为
  default + CategoryInlineBoard/Skeleton + CategoryKey。AppLayout 去挂载与 import。
- 历史注记保留在组件头注释与 index.css 共用骨架注释中；home.spec 1.3c 已锁
  `.cqa-nav`/`.cqa-overlay` 恒 0 回归锁（上一批用例更新落地，本次删除与其一致）。

## 验证

- `npm run build` ✓（tsc -b 无悬空引用）；`npm run lint:all` 7 门全过。
- grep 确认 src/ 内 CategoryQuickAccessNav / CategoryQuickAccessPanel / useCategoryOverlayStore /
  categoryPanelData 仅剩注释性提及，无代码引用；stores/index 无 overlay store 导出。
