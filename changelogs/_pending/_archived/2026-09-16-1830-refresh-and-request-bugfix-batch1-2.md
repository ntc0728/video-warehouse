---
date: 2026-09-16 18:30
module: Home/IPTV/Detail/Player/PTR/store
type: fix
build: tsc -b 通过 / vite build ✓ / ESLint 0 error 3 warning（均既有）
files: [src/stores/useTMDBStore.ts, src/stores/useIPTVStore.ts, src/stores/useUserStore.ts, src/pages/Home/index.tsx, src/pages/Detail/index.tsx, src/pages/IPTV/index.tsx, src/services/httpClient.ts, src/hooks/useInfiniteScroll.ts, src/components/UniversalPlayer/UniversalPlayer.tsx, src/components/ui/PullToRefresh/PullToRefreshContext.tsx]
demo: none
---

# 2026-09-16 18:30 刷新链路与请求 bug 修复（批 1-2）

前置：`docs/reviews/2026-09-16-page-api-usage-audit.md`（页面×接口审查）、`docs/reviews/refresh-buttons-audit.md`（刷新入口×17）、`docs/reviews/2026-09-16-refresh-and-lazy-load-plan.md`（整改方案）。

## 问题

1. **下拉刷新是"假成功"**：`Home/index.tsx` 调 `void fetchAllHomeData()`，撞 store 内 TTL 判定 → 实际 0 请求；而 `PullToRefreshOverlay` 把 `settle` 同时挂 fulfilled/rejected → 任何失败都显示「刷新成功」。
2. **IPTV 首屏骨架永驻**：bootstrap 无 `try/finally`，异常时 `bootstrapped` 永为 false。
3. **IPTV 刷新按钮连点放大请求**：`isLoading` 的语义是"无频道"，被 `disabled` 复用 → 有数据时不禁用，连点并发拉 ~17MB。
4. **超时策略被架空**：`httpClient.getJSON` 的 `withTimeout` 未传业务 `ms`，10s 硬顶覆盖所有业务 timeout（`getText` 无此问题 → 两函数口径不一）。
5. **无限滚动自放大**：`useInfiniteScroll` 的 IO effect deps 含 `hasMore`（与文件自身注释矛盾）→ observer 反复重建。
6. **播放器刷新按钮是死代码**：`ControlBar` 依赖 `onRefresh`，而 `UniversalPlayer`/`Player`/`IPTVPlayer` 均未传 → 生产环境不渲染。

## 旧逻辑 → 新逻辑

- `useTMDBStore`：8 个 `fetchX` 无 `signal` 入参；`_homeFetchAbort` 只置位没人读；`fetchAllHomeData()` 无 force 参数。
  → 全部加 `signal?: AbortSignal` 并透传 tmdbService；`fetchAllHomeData(opts?: {force?})`，`shouldFetch = force || 空 || TTL过期`；`Promise.all` 后 `if (ctrl.signal.aborted) return`（旧轮次不再写 `homeFetchedAt` / localStorage）；各 catch 加 `signal?.aborted` 早退（取消 ≠ 失败，不写 error）。
- `Home`：`void fetchAllHomeData()` → `fetchAllHomeData({ force: true })` 且返回 Promise（下拉浮层等真结果）。
- `Detail`：`useLayoutEffect` 内重置 `cmsLastFetchRef.current = 0` —— 修「切 id / 下拉刷新撞 2s 防抖 → 永久停在暂无匹配资源」。
- `httpClient`：`getJSON` 的 timeout 跟随 `opts.timeout`；注释说明 `getText` 不受影响。
- `useInfiniteScroll`：IO deps 移除 `hasMore`，补注释禁止把业务布尔量放进 deps。
- `useIPTVStore`：新增 `isRefreshing` + 模块级单飞锁 `_iptvRefreshing`（在飞时后到者直接 return）。
- `IPTV/index.tsx`：两处刷新按钮 `disabled={isLoading || isRefreshing}`；bootstrap 补 try/catch/finally。
- `UniversalPlayer`：传 `onRefresh={() => { setHasError(false); setRetryCount(c => c + 1); }}`（复用 `usePlayerCore` 主 effect deps 含 retryCount 的既有重载语义）。用户拍板：播放器刷新 = 重载直播流。
- `PullToRefreshContext`：新增 `PTR_DEFAULT_ERROR_TEXT` + `usePullToRefresh` 的 `toastOnError?: string | false`；handler 包 try/catch，失败弹 error toast。**动效/视觉语义不变**（仍无条件 success + 回弹），只补反馈。
- `IPTV` 下拉回调改 async，把「无频道 + 有 error」翻译成 reject（部分源失败不提示，避免多源噪音）；两个 `<Empty>` 补 `status` + `onRetry` + `isRetrying`（原来失败态无重试入口）。**订正**：不统一给 Collections/History 加 onRetry —— 合法空态不该加。
- `useUserStore.reload`：catch 由「只 console.error」改为 `throw err`，使「读库失败」与「真的没数据」在 UI 可区分（现有调用点均已处理 rejection）。

## 说明

- FAB 悬浮刷新语义**未改**（用户拍板暂缓，等接口缓存重试一并做）。
- 涉及文件：见 front-matter `files`。
