---
date: 2026-09-24
module: Home / HeroBili / CategoryQuickAccess
type: 导航（右键新开页签）
build: ✅ npm run lint:all 通过
files:
  - src/components/HeroBanner/HeroBili.tsx
  - src/components/HeroBanner/HeroBili.css
  - src/pages/Home/HomeTopStrip.tsx
  - src/pages/Home/Home.css
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
demo: 无
---

# hero-bili 右卡 + 热度榜入口改 Link 支持右键新标签页

## 旧逻辑 → 新逻辑

- **HeroSideCard**：外层 `div[role=button] onClick=onItemClick` → `<Link to=/detail/:id state.from>`；收藏按钮补 `preventDefault`（仅 stopPropagation 挡不住浏览器跟 href）；删 role/tabIndex/onKeyDown。
- **HomeTopStrip「完整热度榜」**：`button onClick=navigate('/chart')` → `<Link to=/chart>`。
- **CategoryHeatRow「查看完整榜单」**：同上改 Link；组件内 navigate 删除。
- CSS：三处补 `text-decoration: none`（hero-side-card 另补 `color: inherit`）。

## 不改

HeroBili banner CTA 的 onItemClick（Home handleBannerItemClick 仍服务 banner）；换一换；收藏 toggle 逻辑。

## 验证

- `npm run lint:all` ✅
- `home.spec` 相关断言（hero-side-card count=6 / cqa-heat-row__more count=0 on rail）预期不变
