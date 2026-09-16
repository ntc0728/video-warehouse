---
date: 2026-09-16 19:30
module: Home/Detail/hooks/common
type: feat
build: tsc -b 通过 / vite build ✓ 15.05s / ESLint 0 error 0 warning
files: [src/hooks/useInViewport.ts, src/components/common/LazyBlock.tsx, src/stores/useTMDBStore.ts, src/pages/Home/index.tsx, src/pages/Detail/index.tsx, src/hooks/index.ts, src/components/common/index.ts]
demo: none
---

# 2026-09-16 19:30 模块视口懒加载 L1+L2+L3

## 问题

图片侧本就达标（`LazyImage` + `TMDBMovieRow` 标题 IO，视口外 100+ 张海报零请求）；真正的浪费在**接口侧**：Home 进入即打 9–16 个请求（含 Hero + 7 排），Detail 挂载即拉剧照。改造是「接线 + 补守卫」，不是从零做。

## 新逻辑

### L1 新增 `src/hooks/useInViewport.ts`
IntersectionObserver 通用 hook，5 个关键设计（都有踩坑来源）：
- **回调式 ref**（`useState<Element|null>` + `useCallback`）——元素可能晚于 hook 挂载（Detail 剧照哨兵在 tab 内），用 `useRef` 对象则 effect 只在挂载那刻读 `ref.current`，为 null 就永不建 observer。
- 滚动 root 默认取 `.app-shell__scroll`（不是 window）。
- rAF 首帧主动判定（覆盖首屏区块 / 滚动恢复落点）。
- 容器 `clientHeight === 0`（隐藏期）跳过判定。
- **deps 只放结构性参数**，`inView` / 业务布尔量绝不进 deps（避 `useInfiniteScroll:157` hasMore 同类坑）。

### L2 新增 `src/components/common/LazyBlock.tsx`
- `enabled=false` 立即渲染且不调 onEnter；触发一次**永久保持**（不回退 → 滚回去不出骨架、滚动恢复高度不反复）。
- `preload` 不依赖视口直接触发（TV 焦点 ±1 行）。
- `children` 是**渲染函数** `(entered) => ReactNode`：只有调用方知道骨架怎么写，且骨架必须与真实内容**等高**。

### store 区块级取数
- `useTMDBStore` 新增 `HomeBlockKey` / `HOME_BLOCK_KEYS` / 模块级 `_homeBlockFetchedAt`（全局 `homeFetchedAt` 无法表达「这一排是刚滚到才取的」）+ `ensureHomeBlock(key, {force})`：单区块取数，幂等（有数据且区块 TTL 未过 / 正在 loading → return），**绝不顺手 fetchAllHomeData**（否则首次滚入就把剩下全部打出去，等于没做）。`popularTv` 复用 `fetchNowPlaying` 的内部并行结果（在飞时 return，避免同接口打两次）。`clearHomeData` 同步清区块时间戳。

### Home
- `HOME_FIRST_SCREEN_BLOCKS = ['trending','nowPlaying']`（Hero + 第一排不懒加载，保 LCP）。
- 7 排 `homeRows` 带 `key`，`renderHomeRows()` 用 `<LazyBlock enabled={i >= 1} preload={isTV && tvFocusRow !== null && Math.abs(i - tvFocusRow) <= 1} onFocusRow={...}>` 包 `TMDBMovieRow`；未解锁传「空 items + isLoading=true」→ TMDBMovieRow 渲染**等高** SkeletonCards（零图片请求）。
- 「任一区块为空就 fetchAllHomeData」的兜底 effect **收窄到首屏档**（否则懒加载收益被兜底抵消）。
- TTL 定时器 / visibilitychange 改为只遍历「已加载（有数据）」区块调 `ensureHomeBlock`。

### Detail
- 剧照 effect 用 `useInViewport({rootMargin:'300px'})` 门控：`if (!stillsInView && pullRefreshNonce === 0) return;`，**`stillsInView` 必须进 deps**（否则哨兵命中后 effect 不重跑）。
- 新增常驻零高哨兵 `<div ref={stillsSentinelRef} aria-hidden />` 置于简介之后、剧照区之前（剧照区本身条件渲染，不能承担哨兵职责）。缓存回显分支与下拉刷新（nonce>0）绕过视口限制不变。

## 用户拍板

TV 端 = 焦点行 ±1 行预加载；不出 demo 直接改真实页面。

## E2E 风险提示

`scripts/home.spec.ts:256` 断言 `.home-rows > *` 计数（LazyBlock 包一层仍满足）；若有用例依赖「进首页即 8 区块全请求」，需按 `docs/agents/testing.md` 更新。
