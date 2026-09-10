---
date: 2026-09-10 21:35
module: player
type: fix
build: npm run build 通过 · e2e player.spec 9/9、--workers=2 全量 122 passed / 1 skipped
files:
  - src/components/UniversalPlayer/PlayerToast.tsx
demo: 无
---

## 修正上一轮的移动端提示隐藏策略（本轮回归发现）

### 问题

上一轮把「播放器可见高度 < 96px」直接判成「不渲染提示」，回归发现它误伤了
**设置弹窗自身触发的反馈提示**：

`PLAYER-M02/M03` 稳定失败（3/3）。现场 dump 显示，二级字幕设置弹窗打开时
播放器容器已被滚到 `top: -653, bottom: -416`（完全在视口外），
于是 `mobileSettingsToast('字幕大字号已开启')` 被整条吞掉 —— 而这条提示正是用户当次操作的直接反馈。

### 改法

拆出 `resolveCenterAnchor()`，返回 `{ x, y, roomy }`，并把两种情形分开：

| 情形 | 行为 |
| --- | --- |
| 提示触发时播放器**可见** | 锚到「播放器 ∩ 视口」的交集内（跟随播放器）；此后被滚走 → **隐藏**（用户原始诉求：下滑后提示不该悬在已滑过去的播放器上方） |
| 提示触发时播放器**已在视口外** | 退回视口定位显示，并记 `viewportAnchoredRef`；这类提示此后不随滚动自动隐藏 |

- `measureCenterPos()`（scroll / resize 重测路径）只在非视口兜底锚定时才隐藏；
- `showCenter()` 里改用 `resolveCenterAnchor()` 一次性拿到锚点，避免「先 setState 再被滚动事件覆盖」；
- 提示结束后复位 `viewportAnchoredRef`，不影响下一条提示的判定。
