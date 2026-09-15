---
name: fullscreen-overlay-portal
description: 播放器/应用全屏场景下 portal 到 body 的浮层（toast/菜单/弹窗）会被 top layer 或伪全屏高 z-index 容器盖住——排查与修复模式，以及 Playwright toBeVisible 遮挡假绿的教训。适用于 React + portal 浮层 + 元素级全屏/CSS 伪全屏的任何项目。
---

# 全屏遮挡：portal 浮层不可见的排查与修复

## 核心机制（先记住再动手）

1. **fullscreen-api 档**：进入全屏的元素进入浏览器 **top layer**。top layer 之外的任何元素（包括 body 下的 z-index:99999 浮层）**全部被盖住，z-index 无效**——这不是层级问题，是渲染层级规则。
2. **CSS 伪全屏**（无元素级全屏能力的 WebView，如 App 端）：JS 给容器加 `position:fixed; inset:0; z-index:9998` 之类的类。portal 到 body、z-index 低于该值的浮层同样被盖。
3. **两种档位同时存在**（同一产品 Web + App 双端）时，浮层必须按「容器是否处于全屏态」动态选择 portal 目标。

## 修复模式

```ts
// lib/overlayPortal.ts
export function getOverlayPortalTarget(container?: HTMLElement | null): HTMLElement {
  if (!container) return document.body;
  const fs = document.fullscreenElement
    ?? (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
    ?? null;
  if (fs != null && fs === container) return container;
  return document.body;
}
```

- **坐标无需换算**：全屏时 container rect = (0,0,vw,vh)，视口坐标 == 容器坐标。
- 非全屏保持 portal 到 body 的原因：逃出滚动容器的 `contain: layout`（它会劫持 fixed 包含块）。
- **Radix 弹窗**：`Dialog.Portal` 原生支持 `container` prop；Radix Portal 仅在 open 时挂载，届时传入的 DOM 节点必然存在，无需担心时序。
- in-container 树内渲染的浮层（absolute/fixed 后代）天然可见，不用改；只有 `createPortal(..., document.body)` 的才要改。

## 排查清单（新项目套用）

1. `grep -rn "createPortal" src/` + 检查第三方弹窗组件（Radix/HeadlessUI 默认 portal 到 body）。
2. **必须同时 grep 第三方 Portal 关键字**（漏扫会反复踩坑）：
   `grep -rnE "Dialog\.Portal|Popover\.Portal|DropdownMenu\.Portal|Select\.Portal" src/`
   Radix 的 `<Dialog.Portal>`/`<Popover.Portal>` 默认无 `container` prop → portal 到 `document.body`，全屏下同样被盖。需给封装组件加 `portalContainer`/`container` prop 并透传。
   ⚠️ sonner 等全局 toast 封装（`toast.show({...})` 及 `toast.warning/error/success/info` 糖方法）也是 body 级 portal，扫描残留要用
   `grep -rnE "toast\.(show|warning|error|success|info)\b|import \{ toast \}"` 全模式，单扫 `toast.show` 会漏掉糖方法。
3. 对每个浮层问：全屏状态下可达吗？（右键菜单、控制栏弹出菜单、角落按钮打开的弹窗、更多设置抽屉、二级弹窗往往可达。）
4. 注意「全屏整改只对移动端生效」的分支：桌面全屏时移动端专属 prop（如 `fullscreen`）为 false，桌面路径的浮层可能仍渲染。

## ⚠️ E2E 假绿教训

`expect(locator).toBeVisible()` 只查 display/visibility/尺寸，**不检测被其他元素遮挡**。全屏下的 portal bug 因此全绿假通过。锁定方式：

```ts
// 断言浮层归属（portal 目标正确性）
const inContainer = await toast.evaluate((el) => el.closest('.up-universal-player') != null);
expect(inContainer).toBe(true);
```

或在必要时用 `document.elementFromPoint(x, y)` 断言点击命中的是最上层浮层。
