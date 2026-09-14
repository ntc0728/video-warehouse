---
date: 2026-09-14 22:13
module: RecordShell / 收藏页 / 历史页 — 空状态垂直居中修复
type: fix
build: |
  npx tsc -b 通过；npx vite build --emptyOutDir false 通过；
  Playwright 实测 3 断点 × 2 页（1440×900 / 1024×768 / 800×900）全部居中，偏差 ≤5.5px
files:
  - src/components/RecordShell/RecordShell.css（≥1024 块 .record-main align-items: flex-start → stretch）
  - src/pages/Collections/Collections.css（空状态 min-height: 0 → var(--layout-loading-min-height)）
  - src/pages/History/History.css（同上）
demo: .tmp-shots/（六张断点截图，已验证后清理）
---

## 问题

用户反馈：**收藏 / 历史页在无数据时，「暂无收藏 / 暂无观看记录」提示信息位置靠上**，没有垂直居中。

## 一、根因定位（Playwright 实测）

三断点实测各层高度（`.app-shell__scroll` clientH = 840 / 708 / 840）：

| 断点 | `.record-main` | `.record-content` | `.empty-state-wrapper` | 内容高度 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1440×900 | 832 `row` `flex-start` | **153** | 153 | 153 | ❌ 贴顶 68px |
| 1024×768 | 701 `row` `flex-start` | **161** | 161 | 161 | ❌ 贴顶 67px |
| 800×900 | 833 `column` | 784 | 772 | 165 | ✅ 居中 421–586 |

**`800px` 是好的** —— 因为 `<1024` 时 `.record-main` 是 `flex-direction: column`，主轴即纵向，`flex: 1 1 0` 正常生效，整条拉伸链完整。

**只有 `≥1024` 坏掉**，两个缺陷叠加：

### 缺陷 1（主因）—— 主轴换向导致纵向拉伸链断裂

`RecordShell.css` L718 `@media (width >= 1024px)` 块内，rail 布局把 `.record-main` 改成：

```css
display: flex;
flex-direction: row;
align-items: flex-start;   /* ← 问题所在 */
```

后果：

- 主轴变成**横向** → 所有 `flex: 1 1 0` 的 `flex-grow` 只作用于**宽度**，对高度完全无效；
- 交叉轴（纵向）由 `align-items: flex-start` 决定 → 子项高度**退化为内容自然高度**（`Result` 组件自然高 153px）；
- 于是 `.record-content → .empty-state-wrapper → Result` 三层纵向拉伸链在该断点**全断**。

### 缺陷 2（帮凶）—— 安全底线被反向覆盖

`Collections.css` L59 / `History.css` L30 的页面级空状态规则写了 `min-height: 0`，**反向覆盖**了全局 `.empty-state-wrapper` 的：

```css
min-height: var(--layout-loading-min-height);   /* ≥1024 实算 480px */
```

这本是设计给低断点的安全垫，在 rail 断点被清零，内容连 480px 的下限都保不住。

## 二、修复（方案 A + B）

### A（主修）`RecordShell.css` ≥1024 块

```diff
-    align-items: flex-start;
+    align-items: stretch;
```

**为何对 rail 无副作用**：`.record-aside` 在同一媒体查询块内已显式声明：

```css
align-self: flex-start;          /* 纵向自锁 */
width: var(--rail-w);            /* 横向自锁 */
```

两个轴的尺寸都由自身锁定，**不依赖父级 `align-items`**，所以改父级不会让 rail 变宽或变高。实测 railW 恒为 148px（1440 / 1024 一致）。

### B（护栏）`Collections.css` / `History.css`

```diff
-  min-height: 0;
+  min-height: var(--layout-loading-min-height);
```

显式继承同一变量，语义更清楚，同时保住安全垫。

## 三、验证（修复后实测）

| 页面 | 断点 | content 高 | empty 高 | railW | 可用区中 | 空态中 | 偏差 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 收藏 | 1440×900 | **832** | 832 | 148 | 484 | 484 | **0.0** |
| 收藏 | 1024×768 | **701** | 701 | 148 | 418 | 418 | **0.0** |
| 收藏 | 800×900 | 784 | 772 | 771(横栏) | 508 | 503 | 5.0 |
| 历史 | 1440×900 | **832** | 798 | 148 | 496 | 501 | 5.5 |
| 历史 | 1024×768 | **701** | 666 | 148 | 430 | 435 | 5.0 |
| 历史 | 800×900 | 784 | 772 | 771(横栏) | 508 | 503 | 5.0 |

- `content` 从 153/161 → **832/701**，完全撑满 ✅
- 剩余 5px 级偏差来自 `Result` 自然高度与页面 `padding`（`.page-padding` 上下各 `--space-sm` = 12px），属正常内边距，非缺陷
- **历史页偏差 5.5px 属正确行为**：其 `content` 内含 `.record-content-head`（"观看历史 / 共 0 条"，高 23–25px），空态是在**去掉头部后的剩余空间**里居中，不与标题一同居中

### 非空态回归（关键）

因改动涉及 `.record-main` 的 `align-items`，注入 12 条收藏 / 6 条历史实测：

- 网格 `display: grid`，7 列（`150.906px × 7`）
- `.record-card` 尺寸 **151×252**，首行 6 张 y 坐标全为 **109**（严格对齐）
- 卡片高度由「封面 16:9 + 标题」自身决定，**未受 stretch 影响**

### 补充观察

收藏页首屏仅挂载 **1 个 `<img>`** —— 与上一轮 LazyImage 改动（`2026-09-14-2116-detail-person-image-lazy.md`）协同正常，说明图片延迟加载未被本次布局改动破坏。

## 四、截图

六张断点截图（1440 / 1024 / 800 × 收藏 / 历史）已确认全部正常居中，验证后清理，未入库。

## 五、经验固化

**CSS flex 容器改 `flex-direction` 会静默反转主轴语义** —— 原来在 column 容器里可靠的 `flex: 1` 纵向拉伸，在 row 容器里只作用于宽度。跨断点切换主轴方向时，必须重新检查「谁在拉伸谁」，并优先用 `align-self` 让子项自锁尺寸，而非依赖父级 `align-items`。

**排查手法**：`getComputedStyle(el).flexDirection` + 逐层 `getBoundingClientRect().height` 对照，能一眼看出在哪一层高度开始塌陷。仅靠肉眼截图容易误判为「居中写错」，实际是拉伸链在某一断点断裂。
