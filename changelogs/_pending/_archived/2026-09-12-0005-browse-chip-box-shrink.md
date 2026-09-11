---
date: 2026-09-12
module: Browse（左栏 filter-bar chip）
type: fix
build: vite build EXIT=0（前台，--emptyOutDir false）
files:
  - src/pages/Browse/Browse.css
---

## 背景

用户反馈「browse 页 filter-bar 内按钮 hover/选中态背景框太大」。首轮只压 padding（chip 26→22px 估算值），
用户追问根因——**真实问题：背景框的宽度与高度都不是由文字决定的**。

## 根因（1440 / `--ui-scale=1` 实测口径）

| 维度 | 真实来源 | 数值 |
| --- | --- | --- |
| 高度（组件层） | `FilterBar.css:133` `height: var(--comp-tab-height)` | 36.37px 写死，与字号无关 |
| 高度（页面层） | 继承 `line-height: 1.5` × `--text-sm` 12.22px | 18.33px（改 `height:auto` 后成为主因） |
| 高度（页面层） | `padding: var(--space-xs)` 上下 | 3.97 × 2 = 7.94px → 合计 **26.3px** |
| 宽度 | `width: 100%` + grid `repeat(auto-fill, minmax(56px, 1fr))` | 左栏 148px → 2 列，每格 ≈65px；两字选项也被拉到 65px |
| 宽度（长词） | `--full` 的 `justify-self: stretch` | 横跨整栏 ≈132px |

结论：padding 已到 `--space-xs` 下限，**再压只省 4px**；必须动的另外两处是 `line-height` 与 `width`。

## 旧 ↔ 新

```css
/* 旧 */
.filter-bar .filter-bar__chip {
  width: 100%;                       /* 被 grid 1fr 拉满格 */
  height: auto;
  padding: var(--space-xs) var(--space-sm);
  /* line-height 继承 1.5 → 18.3px */
}
.filter-bar .filter-bar__chip--full { justify-self: stretch; }

/* 新（用户拍板：宽度贴合文字 + 高度 ≈22px） */
.filter-bar .filter-bar__chip {
  justify-self: start;               /* 色块宽 = 文字 + padding */
  width: auto;
  height: auto;
  padding: var(--space-xs) var(--space-sm);
  line-height: 1.2;                  /* 26.3 → ≈22.6px */
}
.filter-bar .filter-bar__chip--full { justify-self: start; }
```

## 影响面

仅 Browse ≥1024 左栏（`html:not([data-device="app"]):not([data-device="tv"])` 作用域内）；
FilterBar 其他调用方、TV / App / 移动端零影响。JSX 未动。

## 二轮（同日，用户：高度还是高）

padding + line-height 推导仍不可控，改成**显式高度**：

```css
.filter-bar .filter-bar__chip {
  display: flex;
  justify-self: start;
  align-items: center;
  width: auto;
  height: calc(var(--text-sm) * 1.5);   /* padding 只管左右 */
  padding: 0 var(--space-sm);
}
```

高度 = 字号 × 1.5，跨断点随 `--text-sm` 自动缩放（不再受 padding / line-height 影响）：
1280 ≈18.9px → 1440 ≈18.3px → 1920 ≈16.8px → 2560 ≈18.0px（`--text-sm` clamp 下限 12px）。
对比：组件层基准 36.4px → 一轮 22.6px → 二轮 18.3px。

⚠️ 既有 rail 参照物不可用：`RecordShell.css:881` 的 rail-item 是 `padding: 8px`（≈34px 高），
比改动前还高，不能当作「rail 就应该这么高」的依据。

## 三轮（同日，用户：适当加一些上下 padding）

⚠️ 全局 `box-sizing: border-box`（`index.css:255`）→ 固定高度下直接加 padding **只会挤压文字、色块不变高**，
必须把垂直 padding 计入高度公式：

```css
height: calc(var(--text-sm) * 1.3 + var(--space-2xs) * 2);
padding: var(--space-2xs) var(--space-sm);   /* 上下 ≈1.97px @1440 */
```

高度：1280 ≈20.0px / 1440 ≈19.8px / 1920 ≈19.2px（二轮 18.3 → 三轮 19.8，回补约 1.5px）。

## 四轮（同日，用户：加了没生效）

**不是没进构建**——产物断言 `index-DY-dPdqv.css` 里规则确实存在。真实原因是三轮的加法自我抵消：
padding 只给到 `--space-2xs`(≈2px×2)，同时系数由 1.5 → 1.3 又把增量吃回去，**净增仅 1.5px = 肉眼无感**。

```css
height: calc(var(--text-sm) + var(--space-xs) * 2);   /* 三轮 1.3 系数 → 直接用字高 */
padding: var(--space-xs) var(--space-sm);             /* 上下 2px → 4px，翻倍 */
line-height: 1;                                       /* 内容区 = 字高，避免行高挤出 padding 区 */
```

高度：1280 ≈20.3px / 1440 ≈20.2px / 1920 ≈19.8px（三轮 ≈19.8 → 四轮 ≈20.2，总高几乎不变，
但**上下留白由 2px 变 4px**，这才是能看出来的部分）。

产物断言：`dist/assets/index-DY-dPdqv.css` 命中
`height:calc(var(--text-sm) + var(--space-xs)*2);padding:var(--space-xs) var(--space-sm)`。

## 五轮（playwright 实测，用户授权起 dev server + playwright）

实测（1440×900，dev）：规则**全部生效**（chip 20.2px / padding 3.97 / justify-self start），
但抓到真正让左栏松散的根因——**Chromium 对 `repeat(auto-fill, minmax(56px,1fr))` 的 grid
作为 flex 子项参与内在高度计算时按 1 列假设**：

| 证据 | 数值 |
| --- | --- |
| chips-scroll 容器高 | **285.7px**（13 chip 按 1 列 = 13×20.16+12×1.97 = 285.656 精确吻合） |
| 真实内容高 | 153.2px（2 列 × 7 行） |
| 行距（视觉） | 41.1px（行轨被 align-content:stretch 撑到 39.1px） |
| 组间空白 | ≈130px（虚高尾巴堆在组尾） |
| 决定性试验 | 同元素 display:flex=108.7px / block=152.9px / 1 chip=20.2px；无任何 height 规则命中 |

修复（Browse.css ≥1024 块）：
1. `.filter-bar__row`：`flex-direction:column + gap` → **`display: block`**（切断 flex 污染链；label↔chips 间距由 chips 容器 `margin-top: --space-xs` 补回）
2. chips 容器加 **`align-content: start`**（行轨不再被 stretch 撑大）+ `flex: 0 0 auto`（覆盖组件层 flex:1，防御）
3. `gap: var(--space-xs) var(--space-2xs)`——**row-gap 提到 ≈4px、column-gap 刻意保持 ≈2px**（用户「间距稍微调大」；列间距变大会挤掉 auto-fill 列数）

效果（1440 实测）：行距 41.1 → **24.2px**；组间空白 ≈130px → ≈16px（分割线 + margin）；
filter-bar 总高 654.2 → 368.3px。纯 CSS，JSX 未动，TV/App/移动零影响。

## 验证

- `vite build` EXIT=0（15.38s，前台跑；后台跑会假挂起；`fs.rmSync('dist')` 撞批量删除保护被 SIGTERM，
  故用 `--emptyOutDir false` + 按 mtime 断言本轮产物）
- stylelint 15 条 < HEAD 基线 16，零新增
- dev server（3001）已停，`.pw-*` 临时脚本已清，端口零遗留

未 commit、未 E2E（待用户确认）。
