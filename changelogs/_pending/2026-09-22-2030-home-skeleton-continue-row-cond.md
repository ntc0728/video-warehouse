---
date: 2026-09-22
module: Home
type: 行为修复（骨架同构缺口）
build: ✅ npm run build + lint:all 全绿
files:
  - src/pages/Home/index.tsx
---

# 首页骨架「继续观看」行存在条件镜像真实页

## 现象 / 根因

骨架（isInitialLoading 分支）无条件预告「继续观看」行，但真实页的渲染条件是
`userDataLoading || continueItems.length > 0`。IndexedDB 读取通常远快于 TMDB 请求，
**无观看历史的用户** DB 读完后真实页无此行 → 骨架→真实页切换时整行消失、
下方内容上移约一行高（同构缺口，2026-09-22 用户确认修复）。

## 修复

- 新增单真源条件 `showContinueRow = userDataLoading || continueItems.length > 0`
  （紧跟 continueItems memo 定义）；
- 骨架两分支（宽屏两栏 / 窄屏单栏）改 `{showContinueRow && homeSkeletonContinueRow}`；
- 真实页两分支的原内联条件统一替换为 `{showContinueRow && (...)}`，四处共用同一判定。

行为：有历史 → 骨架与真实页该行恒在；无历史 → 骨架期 DB 读完即提前收行
（收行发生在纯灰阶段），切换时几何与真实页一致，零位移。

## 验证

- `npm run build` ✓、`npm run lint:all` ✓
- 全仓 spec 无对骨架「继续观看」行无条件存在的断言（grep 0 命中），无回归面。
