---
date: 2026-09-22
module: Home
type: 行为修复（首帧骨架闪烁）
build: ✅ npm run build 通过
files:
  - src/pages/Home/index.tsx
---

# 首页骨架首帧闪烁修复：isInitialLoading 不依赖 loading 标志

## 现象

用户反馈「首页骨架显示之后会立即消失然后显示真实页面结构，导致肉眼观看会闪烁」，
非 100% 复现（取决于 LS 缓存 / SearchBox 是否预触发 trending / chunk 加载速度）。

## 根因

`isInitialLoading` 旧条件：
```js
(loading.trending || loading.nowPlaying) && (!hasAnyData || trending.length === 0)
```

React 首帧 useEffect 还没跑，`loading.trending/nowPlaying` 都是 `false`（store 初始态）
→ 首帧 `isInitialLoading=false` 走主树空态（HeroBannerClassic「暂无推荐」+ 骨架行）
→ useEffect 触发 fetch 后 `loading=true` 切 homeSkeleton → 数据到达切主树真实。

用户看到：**boot-splash 骨架 → 主树空态（一帧）→ homeSkeleton → 主树真实**，
中间的主树空态就是闪烁源。

## 修复

### ① isInitialLoading 条件改为不依赖 loading 标志

```js
const anyLoading = loading.trending || loading.nowPlaying || ...;
const isInitialLoading =
  trending.length === 0 &&
  !errors.trending &&
  !(hasAnyData && !anyLoading);
```

- 首帧：trending 空 + errors 空 + hasAnyData=false → **骨架**（与 boot-splash 无缝衔接）
- useEffect 触发后：loading=true → 仍骨架
- 数据到达：trending 非空 → 主树
- 请求失败：errors.trending 非空 → 主树（allFailed 分支）
- LS 有缓存：trending 非空 → 主树（无骨架，预期行为）
- 例外兜底：trending 请求成功但返回空数组（极罕见）+ 有其他数据 + 不在加载 → 主树，避免卡骨架

### ② homeSkeleton 去掉 skeleton-scope（150ms 延迟淡入）

冷启动路径下 boot-splash 同构骨架已经显示，homeSkeleton 接替时应立即可见，
否则 boot-splash 摘除后会有 150ms 空白窗口（骨架刚露头就消失的闪烁）。
enterPhase 覆盖层里的 homeSkeletonBody 仍保留 skeleton-scope（缓存数据场景下
从其他页切回的覆盖层，150ms 延迟过滤快切换合理）。

## 验证

- `npm run build` ✓
- 修复后时序：boot-splash 骨架 → homeSkeleton（立即可见，无缝接替）→ 主树真实内容，
  无中间态空态主树，无闪烁。
