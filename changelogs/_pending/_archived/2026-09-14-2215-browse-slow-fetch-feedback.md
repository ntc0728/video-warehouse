---
date: 2026-09-14 22:15
module: Browse — 慢取页反馈 A′ + 取页出口收拢
type: feat
build: |
  npx tsc -b 通过；npx vite build --emptyOutDir false 通过；
  npx eslint 改动文件 0 error；npx vitest run 33 文件 / 389 用例全过
files:
  - src/hooks/useDelayedFlag.ts（新增：延迟标志，非防抖）
  - src/hooks/index.ts（导出 useDelayedFlag）
  - src/pages/Browse/constants.ts（新增 PENDING_FEEDBACK_DELAY_MS = 400）
  - src/pages/Browse/Browse.css（新增 .browse-results-body--pending）
  - src/pages/Browse/useLogicalPage.ts（targetPageRef + onCommit + force）
  - src/pages/Browse/useBrowseData.ts（移出全部取页逻辑，收拢到逻辑分页层）
  - src/pages/Browse/index.tsx（慢取页反馈判定 + hooks 调用修正）
  - src/components/common/Empty.tsx（新增 status 语义 prop）
  - src/components/ui/index.ts（导出 ResultProps / ResultStatus 类型）
---

## 一、慢取页反馈 A′（用户拍板）

**问题**：取页耗时 T 的取值域极宽 —— 内存页缓存 / 浏览器 HTTP 缓存命中时只有几十毫秒，真网络往返 0.3~2s，跨页边界还要 ×2。若一置 loading 就挂反馈：

- T 小时反馈只存在 1~2 帧 → 视觉抽搐（flash of loading state）；
- T 大时反馈又是必需的（否则界面静止，用户以为卡死）。

**方案**：延迟阈值过滤掉「瞬时完成」的那批，只给真正拖慢的等待挂反馈。

- 新增 `useDelayedFlag(active, delayMs)`：**延迟显示**而非防抖 —— 不合并任何调用、不推迟任何请求，只控制反馈何时出现在屏幕上。`active` 转 false 当帧即失效。与 `active` 取与，少一帧残留。
- `PENDING_FEEDBACK_DELAY_MS = 400`：低于此时长的取页视为瞬时完成，静默换图。
- `.browse-results-body--pending .browse-card-grid { opacity: .45; pointer-events: none }`

**设计取舍（写进注释，防后人踩）**：

- **不加 transition** —— 反馈出现时已进入慢网档，瞬时变淡比动画更明确；且动画若在 400~560ms 之间被数据落地打断，会留下半透明残影。
- **不复用 `.app-loading` 承载转圈** —— 桌面档的 `:has(> .app-loading)` 会把 body 切成 flex 且 `padding-bottom` 归零，连带布局跳动。加载指示复用右上角 `.browse-sort-bar__count` 的「搜索中… + 转圈」。
- **`pointer-events: none`** —— 等待期间旧卡片不可点，否则会点进旧页详情。

## 二、取页出口收拢（v6）

`useBrowseData` 移除全部取页逻辑（mount 立即拉取 / filterSig 重置拉取 / refreshNow / goToPage / loadMore / retry），**取页唯一出口 = 逻辑分页层**（`useLogicalPage.goto` → `Browse/index.tsx` 的 `fetchTmdbPage`）。

- 原「本 hook 一拍 + 逻辑分页层一拍」会让同一页被请求 2~3 次 —— 这是重复请求的根因。
- `filterSig` 变化时本 hook 只把新筛选「延迟写进」`store.filterOptions`；逻辑分页层第一段等待（轮询 filterOptions 对齐）自然形成防抖，连点筛选只会有最后一次对齐生效。

`useLogicalPage` 三处增强：

- `targetPageRef` —— 跨档重切依据**目标**逻辑页而非已生效的 `page`。二者只在「取页飞行中」有差异，用 `page` 会把用户目标页悄悄退回上一页（点了第 5 页途中改窗口宽度 → 退回原页，意图丢失）。
- `onCommit` —— 装载/重切成功提交或失败时回调，供调用方关闭 loading 遮罩。否则 hook 内部的隐式取页（列数跨档重切）会成为「接管了在飞取页却不收尾」的黑洞。走 ref 避免内联箭头函数进 deps 导致 effect 每渲染必跑。
- `fetchPage(t, force?)` —— `force = true` 表示绕过 store 当日缓存回显、必须真实请求。

## 三、顺带修复：hooks 违规调用

`index.tsx` L50 原为：

```tsx
const isPhone = useIsMobileLayout() || useIsMobile();
```

`||` 短路会让右侧 hook 在左侧为真时**不被调用**，hook 调用数随渲染变化，违反 rules-of-hooks（ESLint `react-hooks/rules-of-hooks` 已拦，CI 会挂）。改为分别求值再取或：

```tsx
const isMobileLayout = useIsMobileLayout();
const isNarrowViewport = useIsMobile();
const isPhone = isMobileLayout || isNarrowViewport;
```

## 四、Empty 组件 status 语义

`Empty` 原硬编码 `status="waiting"` —— 网络失败与「搜不到」共用同一副时钟图标，用户分不清「没有这个内容」和「没加载出来」。新增 `status?: ResultStatus`（默认 `'waiting'`，保持向后兼容），加载失败传 `error`。

## 五、验证

- `npx eslint` 改动文件：0 error
- `npx vitest run`：33 文件 / **389 用例全过**
- `npx tsc -b` + `npx vite build --emptyOutDir false`：通过
