---
date: 2026-09-12 03:00
module: ui/Drawer（移动端筛选面板宿主）
type: perf
build: tsc -b 通过；vite build 通过；stylelint 相对 HEAD 零新增（基线 18 条未动）；vitest 389 全过；browse.spec 8 条全过
files:
  - src/components/ui/Drawer.tsx
  - src/components/ui/Drawer.css
demo: 无
---

## 背景

移动端 Browse 筛选面板（`BrowseMobileBar` → `ui/Drawer` → Radix Dialog）打开期间滑动系统性卡顿。
根因：Radix 模态链上的 `react-remove-scroll@2.7.2`（`SideEffect.js` L139-141）在 Dialog 打开期间
向 `document` 挂 `wheel`/`touchmove`/`touchstart` 三个 **非 passive** 监听——非 passive 使每帧
触摸滚动（含面板内滚动）都必须过主线程，失去合成器线程 fast-path；Radix 源码写死
`<RemoveScroll allowPinchZoom shards={[contentRef]}>`，`noIsolation`/`enabled` 均未透传，props 无解。

## 旧 → 新（方案B：`modal={false}` 绕开 RemoveScroll）

| 项 | 旧（modal=true 默认） | 新（modal={false}） |
| --- | --- | --- |
| RemoveScroll / document 三监听 | 打开期间挂载 | **整个不挂载**（DialogOverlay 非模态恒 null） |
| 遮罩 | `<Dialog.Overlay>`（Radix 渲染） | 自绘 `<div class="drawer-overlay" data-state={open...}>`（Portal 每子节点单独包 Presence，退出动画时序不变） |
| 背景滚动锁 | remove-scroll 事件锁 | 打开期间 `html/body overflow:hidden`（无监听，useEffect 挂/卸恢复）+ `.drawer-content` `overscroll-behavior: contain`（`.drawer-body` 原有） |
| 关闭路径 | Esc / onOpenChange | 不变：Esc ✓、面板头部返回键 ✓（fullscreen 抽屉 content 全屏覆盖、遮罩本就不可点） |

## 实测（Playwright + CDP `DOMDebugger.getEventListeners`）

- 打开面板期间 `document` 上 **wheel / touchmove = 0**；`touchstart` 仅剩 Radix DismissableLayer
  的 passive 版本（每手势一次，非每帧，无害）。
- 滚动锁：开 = `html/body "hidden"`，关（Esc / 返回键）= 恢复为 `""`。
- `browse.spec.ts` 8 条全过（含 BROWSE-077/079 筛选面板交互、081/082 底部操作区固定）。

## 后续（未做，可同法跟进）

`components/ui/BottomSheet.tsx`、`Modal.tsx`、`ConfirmDialog.tsx` 同为 Radix Dialog，打开期间同样
挂这三只监听；若对应场景也有滑动诉求，可按同模式（modal={false} + 自理滚动锁）逐个跟进。
注意：非模态下焦点不再 trap（react-focus-guards 仅模态挂载）、背景不再 aria-hidden——对全屏
移动面板可接受，桌面弹窗迁移前需评估读屏场景。
