---
date: 2026-09-14 21:16
module: 图片懒加载（Detail 剧照 / Person 头像）+ Browse 组合搜索审计
type: fix
build: |
  npx tsc -b 通过；npx vite build --emptyOutDir false 通过；
  Playwright 冒烟（1440×600 / 390×844 双视口，tmdb-movie-872585）4 项断言全过
files:
  - src/pages/Detail/index.tsx（剧照裸 <img> → LazyImage）
  - src/pages/Detail/Detail.css（补 .detail-stills-img 容器撑满规则 + .detail-stills-more z-index）
  - src/pages/Person/index.tsx（头像裸 <img> → LazyImage）
  - src/pages/Person/Person.css（补 .person-avatar-img 容器撑满规则）
demo: .pw-shots-final/stills-verify.png（gitignored）
---

## 背景：用户两条诉求

1. **Browse 页**：TMDB 接口不支持具体条件筛选，项目用「组合搜索」处理 → 检查各搜索是否有**逻辑冲突或重复调用**。
2. **图片页**（首页/收藏/历史/person/detail 剧照）：**不要一次全部加载**，先检查现状，再做到「只加载可视范围的图，滚动到一定距离再加载一部分，如此循环」。

## 一、Browse 组合搜索审计结论：**无重复调用，架构已收敛**

### 取页出口唯一（2026-09-14 已收敛）

全仓 grep 确认 `fetchDiscover` / `fetchTopRated` / `search` 的调用点**只有一处**：

```
src/pages/Browse/index.tsx:441-444   ← fetchTmdbPage 内，唯一出口
```

三层职责分离，无第二拍：

| 层 | 职责 | 是否发请求 |
| --- | --- | --- |
| `useBrowseData` | URL ↔ FilterBarValue；filterSig 防抖后只 `setFilter` 对齐 store | ❌ 不发 |
| `useLogicalPage` | 逻辑页 L → TMDB 合并页 t 的算术定位 + 页缓存 + seq 仲裁 | ❌ 不发（调 fetchPage） |
| `index.tsx` `fetchTmdbPage` | 唯一发请求的地方 | ✅ |

`useBrowseData` 的文档注释已明示这条不变量：**「本 hook 一拍、逻辑分页层又一拍，会让同一页被请求 2~3 次（重复请求的根因）」**。
CMS 直链搜索走自己的 `useCMSSearch`（并发多源 + 滚动追加），不进逻辑分页层，两条链路不交叉。

### 潜在冲突点已由既有机制覆盖

- **防抖 vs 取页竞态**：`fetchTmdbPage` 第一段 `while` 轮询等 `filterOptions` 对齐（guard 40×100ms），
  第二段等 `loading.discover` 落地。延迟对齐 ≡ 延迟取页 → 连点筛选只发一次。
- **并发 goto**：`seqRef` 仲裁，后发者胜；被取代者返回 `false` 且**不收尾**，由接管者收尾。
- **快照被覆盖**：取页后校验 `discoverPagination.page === t`，不符重试一次（最多 2 次）。
- **列数跨档**：P 变化由 `useLogicalPage` 内部 effect 重切，用 `targetPageRef`（非 `page`）保住用户目标页。

### 发现的两个**非阻断**问题（未改，仅记录）

1. `LazyImage` 的 `rootRef` 未进 IO effect 依赖（`[threshold, src, disabled, rootRef]`）。
   ref 对象引用恒定 → 若 `rootRef.current` 在首次 IO 创建时仍为 null，会退化成视口判定。
   TMDBMovieRow 传的是 `rowRef`（挂载即有值），实际未触发；属潜在脆弱点。
2. `useBrowseData` 返回的 `isUpdating` / `hadOldData` 在 `index.tsx` 解构后被**读取但未使用**于渲染分支
   （`showResultsLoading` 用的是 `logical.loading || isRefreshing || (isLoading && !smartHasData)`）。
   不构成 bug，属冗余字段。

## 二、图片加载审计：项目**已有**完整方案，仅 2 处缺口

### 现状（`LazyImage` = IntersectionObserver + 骨架 + 品牌兜底 + 失败重试）

| 页面 | 图片懒加载 | 分批渲染 | 结论 |
| --- | --- | --- | --- |
| 首页 | ✅ rootRef=行容器 | ✅ TMDBMovieRow 标题 IO 门控 | 已最优（双层门控） |
| Browse | ✅ root=视口 | ✅ 逻辑分页 cols×5 | 已最优（≤40 张/页） |
| 收藏 | ✅ | ✅ 30/批 | 可用（rootMargin 100px 偏小） |
| 历史 | ✅ | ✅ 30/批 | 已最优 |
| Person | ⚠️ 头像裸 `<img>` | ✅ 30/批 | 已修 |
| Detail 剧照 | ❌ 裸 `<img>` | ⚠️ 截断非增量 | 已修 |

### 用户拍板（关键约束）

> 「无论怎样，外面始终都是两行，别追加」
> 「只加载外面的图片，不加载全量图片」

即：**「分批」不在网格上做，只在「图片下载」这一层做**。
网格是固定 2 行的窗口，滑动窗口只作用于图片加载；全量剧照仍由点开灯箱查看
（`StillsLightbox` 本身已按 `Math.abs(i - currentIndex) <= 2 ? 'eager' : 'lazy'` 懒加载）。

### 修复内容（旧 ↔ 新）

**Detail 剧照**（`src/pages/Detail/index.tsx` L1011）

```tsx
// 旧：裸 img，全量挂载、无骨架、无兜底
<img src={url} alt={`剧照 ${i + 1}`} loading="lazy" width={1280} height={720} />

// 新：LazyImage，只加载进入视口的剧照
<LazyImage src={url} alt={`剧照 ${i + 1}`} className="detail-stills-img" />
```

- `visibleCount`（2 行窗口）逻辑**完全未动** → 外面恒 2 行，不追加。
- 附带收益：加载期骨架占位（原白块）、失败品牌兜底（原裂图 + alt 文本）。
- `width/height` 移除无 CLS 风险：`.detail-stills-item` 有 `aspect-ratio: 16/9`，容器 100% 撑满。

**Person 头像**（`src/pages/Person/index.tsx` L212）

```tsx
// 旧
<img src={avatarUrl} alt={person.name} />

// 新
<LazyImage src={avatarUrl} alt={person.name} className="person-avatar-img" />
```

头像是 hero 首屏元素（必然在视口内），**懒加载收益为零**；改它只为拿到骨架占位 + 失败兜底。

### 配套 CSS（两处，同一根因）

`LazyImage` 会在 `<img>` 外包一层 `.lazy-image-container`，而 `.lazy-image` 是
`position: absolute; width: 100%; height: 100%` → **容器无尺寸则格子撑不起、骨架塌陷**。
故两处都补「容器撑满」规则：

```css
.detail-stills-item .lazy-image-container.detail-stills-img { width: 100%; height: 100%; }
.person-avatar .lazy-image-container.person-avatar-img     { width: 100%; height: 100%; }
```

> **可复用经验**：任何把裸 `<img>` 换成 `LazyImage` 的改造，都必须检查父容器是否有确定尺寸，
> 并给 `.lazy-image-container` 补 `width/height: 100%`。这是本轮最容易踩的坑。

## 三、过程记录：一次方向偏离与纠正

首轮实现我把「滚动到底部追加 2 行」+ 底部「再加载 2 行」按钮一并做了，
但用户拍板是「**外面始终两行，别追加**」——我**误把「图片分批加载」理解成了「网格分批渲染」**。

处置：`git checkout --` 回退 4 个文件后重做，最终 diff 只保留「裸 img → LazyImage」这一件事。
**教训**：「每次只加载可视范围内的图片，滚动到一定距离再加载一部分」在本项目的既有架构下
（分页/分批渲染已普遍存在）**指的是图片下载层，不是列表渲染层**——先审计再动手，别默认要新造机制。

---

## 四、补记：改造引入的 z-index 回归（已修 + 已验证）

改完后我做冒烟测试，发现**自己引入了一个视觉回归**，差点漏掉。

### 现象

剧照最后一张的「+N 查看更多」半透明遮罩**被图片盖住、不可见**。

### 根因

`.lazy-image-container` 是 `position: relative` 但 **`z-index: auto` → 不创建层叠上下文**。
于是它的子节点与遮罩处在同一层叠上下文里直接比 z-index：

| 元素 | z-index |
| --- | --- |
| `.lazy-image-placeholder`（骨架） | 1 |
| `.lazy-image`（图片） | 2 |
| `.detail-stills-more`（+N 遮罩，DOM 里在 LazyImage **之后**） | auto(=0) |

即便遮罩在 DOM 中排后，`z=0` 仍被 `z=2` 的图压住。
改造前裸 `<img>` 无 z-index（auto），遮罩靠 DOM 顺序盖在上面 —— **所以这是改造引入的**。

### 修复

```css
.detail-stills-more {
  position: absolute;
  inset: 0;
  z-index: 3;   /* 高于 LazyImage 内部所有层（占位 1 / 图片 2） */
  ...
}
```

### Playwright 验证（1440×600 与 390×844 双视口，`tmdb-movie-872585`）

```
[1] 网格行数 = 2.00                        → ✓ 恒 2 行（未追加）
[2] +N 遮罩命中测试: 顶层="detail-stills-more__count" → ✓ 在最上层
    遮罩文案: "+120 | 查看更多"
[3] 1440×600 初始: 视口内 5 挂载 5 | 视口外 5 挂载 0  → ✓ 视口外未发请求
    滚动 350px 后: 挂载 10/10，新增 5                → ✓ 滚动触发加载
    390×844: 4 格(2列×2行)全部在视口内，全挂载         → ✓ 一致
```

用 `document.elementFromPoint(center)` 做命中测试（而非 `isVisible`），
因为 `isVisible` 只判 CSS 可见性、**不判遮挡** —— 这个 bug 用 `isVisible` 会**漏检**（它返回 true）。

### 可复用经验（两条）

1. **裸 `<img>` → `LazyImage` 必查两件事**：① 父容器是否有确定尺寸（否则格子塌陷）；
   ② **同格内是否有 absolute 覆盖层**（否则被 `z-index:2` 的 `.lazy-image` 压住）。
2. **验证遮挡必须用 `elementFromPoint`**，`isVisible()` / `toBeVisible()` 只判 CSS 可见性，不判层叠覆盖。
3. **本项目滚动容器是 `.app-shell__scroll`，不是 `window`** —— 冒烟脚本里 `window.scrollTo` 无效，
   必须 `document.querySelector('.app-shell__scroll').scrollTo(...)`，否则会得出「图片从没加载」的错误结论
   （我第一轮脚本就踩了这个坑，误报成「视口内 0 个」）。
