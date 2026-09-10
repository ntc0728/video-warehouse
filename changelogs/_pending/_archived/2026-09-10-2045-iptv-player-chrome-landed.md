---
date: 2026-09-10 20:45
module: IPTV 播放页（频道列表宽度 + OSD 栏）
type: fix
build: 通过（npm run build）
files:
  - src/assets/styles/variables.css
  - src/components/UniversalPlayer/UniversalPlayer.css
  - src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.css
  - src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.tsx
  - changelogs/demos/demo-iptv-channel-list-osd-2026-09-10.html
  - changelogs/README.md
demo: changelogs/demos/demo-iptv-channel-list-osd-2026-09-10.html
---

## IPTV 播放页三项整改落地（议题一 A 方案 / 议题二宽度曲线 / 议题三 v1）

承接同日提案（`changelogs/demos/demo-iptv-channel-list-osd-2026-09-10.html`），
用户 2026-09-10 逐项拍板：**议题一选 A**、**窄屏隐藏质量徽章**、
**议题二 78vw + 上限 1400（与 4K 屏匹配）**、**议题三 v1 直接落地**，
并追加两项：**「音轨」也一并落地**、**「列表 / 节目单 / 换源 / 音轨」间距调大一点**。
§4 播放器 primary 单独立项修（本轮未动）。

### 议题一：频道列表一/二级宽度 → 方案 A

**旧逻辑**：`.up-channel-groups` 与 `.up-channel-channels` 的 `width` / `max-width`
都写死 50%（`UniversalPlayer.css`）。而一级是**10 条写死的固定分类**（长度有上限），
二级是**自由频道名**（长度无上限）—— 50/50 把一半宽度让给了有上限的一侧。
1440 实测：一级栏 222.3px 而内容只需 113.3px（**空转 109px，占 49%**），
同时二级名称只剩 122.2px、最长名 157px **截断 34.9px**；375 下二级名称可用仅 54.5px。

**新逻辑**：
- 新增 token `--layout-channel-group-w`（`variables.css`）。取值 **132px 定值**，不是 vw 曲线 ——
  逐档实测「最长分类名 + 计数药丸 + 行内边距」只有
  **109.8 / 114.0 / 113.7 / 113.5 / 113.3 / 116.5px**（480 / 768 / 1024 / 1280 / 1440 / 1920），
  行内边距随档变大、字号 768 后反而变小，两者相抵 →**与视口宽度没有强相关**。
  132px = 116.5 + 13% 余量（余量给足是因为「中文 + 拉丁数字」混排的宽度实测会漂 3–5%）。
- `.up-channel-groups` 改 `flex: 0 0 auto; width: var(--layout-channel-group-w); max-width: 44%`（兜底）；
  `.up-channel-channels` 改 `flex: 1 1 auto; min-width: 0`（`min-width: 0` 必需，否则内部 marquee
  的 max-content 会把二级栏撑开、挤回一级栏）。
- **窄屏档（≤479）**：`--layout-channel-group-w: 116px`（+ `:root` 覆写）。
  280px 面板上 132px 会占 47%、与 50/50 相差无几，所以这一档同时把组项字号降到
  `--text-sm`、行内边距降到 `--space-sm`（需要宽度随之降到 99.5px），
  并**隐藏质量徽章**（`.up-channel-item-quality`，含 `html[data-device="app"]` 副本）。
  断点处（479→480）一级栏 116→132px 有一次 16px 跳变，与面板宽度自身的档位跳变同步。

**落地后实测**（真实播放器，测法：把 `.up-channel-groups` 临时放开成
`width: max-content / max-width: none`，取最长一行渲染宽度）：

| 视口 | 一级栏 | 一级需要 | 空转 | 二级栏 | 名称可用 | 画质徽章 |
| --- | --- | --- | --- | --- | --- | --- |
| 375 | 116（41.4%） | 99.5 | +16.5 | 164 | **140**（旧 54.5，+157%） | 隐藏 |
| 480 | 132 | 109.8 | +22.2 | 183.6 | 108.3 | 显示 |
| 768 | 132（31.9%） | 114.0 | +18.0 | 281.3 | 199.9 | 显示 |
| 1024 | 132（31.0%） | 113.7 | +18.3 | 293.3 | 211.1 | 显示 |
| 1280 | 132（30.2%） | 113.5 | +18.5 | 305.2 | 222.2 | 显示 |
| 1440 | 132（29.7%） | 113.3 | +18.7 | 312.6 | **229.2**（旧 122.2，+88%） | 显示 |
| 1920 | 133.3（28.3%）※ | 116.5 | +16.8 | 338.2 | 250.6 | 显示 |
| 2560 | 142.5（27.5%）※ | 126.7 | +15.8 | 375.8 | 279.7 | 显示 |

※ ≥1920 的值含 `--ui-scale`（1920 → ×1.0096、2560 → ×1.08），与其它 token 一致。

一级栏占面板比从 50% 降到 **41.4%（375）/ 29.7%（1440）/ 27.5%（2560）**，且全程正向空转。

**量测口径（两个坑，勿踩）**：① 必须按分类**活跃态 `font-weight:600` 的自然宽度**量
（最长的「央视 CCTV」随时可能成为活跃项）；② **不能**用 `.up-channel-group-text` 的渲染宽度 ——
它带 `text-overflow: ellipsis`，栏一窄渲染宽就被裁到可用宽，等于自证「刚好放得下」。
提案 demo 第一版用「四项相加」的公式估需要宽度，药丸那项比真值高约 11px（方向保守、结论不变），
已在 demo 里换成实测打表并注明。

### 议题二：OSD 栏宽度曲线

**旧逻辑**：`--layout-osd-max-width` 是「以 1080p 为锚点」的两段式 clamp
（`:root` 一段 + `@media (width >= 768px)` 块内 ≥1024 一段覆盖）。
该曲线在**约 420–1158px 视口区间恒大于「视口 − 2×--space-md」**，被 `.iptv-osd-bar` 的
`max-width` 兜底规则吃掉 → 这一段 OSD 实际是**贴边**的，宽度 token 完全不起作用：
1024 处占视口 **98.0%**（左右各剩 10px）、768 处 **97.5%**，而 1920 反而只有 69.9%。

**新逻辑**：合并为单条比例曲线 `clamp(320px, 78vw, 1400px)`（`variables.css` :root），
**删掉段2 里的 ≥1024 档覆盖**（留着会造成「token 生效区间分裂」，正是本轮要修的问题）。
`.iptv-osd-bar` 的兜底留白由 `--space-md` 提档到 `--space-lg`。

落地后实测（含 `--ui-scale`）：

| 视口 | 旧 OSD 宽 | 旧占视口 | 新 OSD 宽 | 新占视口 |
| --- | --- | --- | --- | --- |
| 375 | 320 | 85.3% | 320 | 85.3% |
| 768 | 749（token 被吃） | 97.5% | 599 | 78.0% |
| 1024 | 1003.9（token 被吃） | 98.0% | 798.7 | 78.0% |
| 1280 | 1168.7 | 91.3% | 998.4 | 78.0% |
| 1440 | 1208.9 | 84.0% | 1123.2 | 78.0% |
| 1920 | 1342.4 | 69.9% | 1413.4 | 73.6% |
| 2560 | — | — | 1512 | 59.1% |

> 1920 处是 1413.4 而不是 1400：本 token 整体乘 `--ui-scale`，而 ≥1920 的曲线
> `0.76 + 0.000125 × 视口宽` 被压缩后系数成 **0.00013**（源码字面量 0.000125，
> 构建产物里读回来是 0.00013），1920 处得 1.0096 → 1400 × 1.0096。这是既有行为
> （旧曲线同样被乘：1329.6 × 1.0096 = 1342.4，与旧实测一致），非本次引入。

全程留白单调、不再有「token 失效段」。TV 档 `clamp(1600px, 83.333vw, 3200px)` 是独立 2× 契约，未动。

### 议题三：OSD 内部布局 → v1（+ 用户追加两项）

**旧逻辑**：左翼固定 `--layout-channel-num-w`（120→180）、右翼 `min-width: --layout-quality-badge-min-w`
（84→120），**左翼恒大于右翼** → 中列中心 ≠ OSD 中心 → 位于中列的控件行整体右偏
（1440 实测左翼 169.4 / 右翼 113.6，差 55.8 → **控件右偏 27.9px**）。
右翼还堆了三行小字（网络速度 / 线路 / 时间）；控件行 `flex-wrap: wrap`。

**新逻辑**：
1. `@media (width >= 1024px)` 下 `.iptv-osd-left, .iptv-osd-right { flex: 0 0 var(--layout-channel-num-w) }`
   → 左右翼等宽、中列真正居中。`<1024` 不生效（给右翼 120–163px 会把中列节目名挤到不可用，
   那一档保留「中列优先」的不等宽布局，代价是控件仍有 18–24px 偏移，已知取舍）。
2. `.iptv-osd-right` 改 `align-items: flex-end` + `text-align: right` + `gap: 0`。
3. 右翼三行并两行：TSX 里把 `网络速度` 与 `线路` 包进新增的 `.iptv-osd-meta-row`。
   分隔点做成 `.iptv-osd-source-text::before { content: '·' }` 而**不是**夹在中间的独立元素 ——
   ≤639 隐藏 `source-text` 时连分隔点一起消失，不会留下「- KB/S ·」这种悬空分隔符。
4. 控件行 `flex-wrap: nowrap`（原 wrap 一旦换行 OSD 高度跳变 ≈18px）；
   **间距放大**：组间 `--space-2xs`(1.97@1440) → `--space-sm`(7.94)，组内 `--space-3xs`(1.81) → `--space-xs`(3.97)。
5. ≤639（含 app 副本）：控件只留图标、图标放大到 `--icon-md`。
   4 个按钮带文字共需 ~200px，而 375 下中列只有 ~163px；去文字后 4 图标 + 放大后的间距仅需 ~157px。
6. **「音轨」恒显示**（用户追加）：去掉 `audioTracks.length > 1` 条件 —— 该条件会让控件行
   在 3/4 个按钮之间跳动、分组宽度不稳定。点击行为仍是「切到下一条音轨」，
   上游 `handleAudioTrackSelect` 在 `tracks.length <= 1` 时直接 return（安全空操作）；
   条数写进 `title`（`切换音轨（共 N 条）`）便于判断。

**落地后实测**：

| 视口 | 左翼 | 右翼 | 翼差 | 控件偏移 | 右翼行数 | 右翼高（旧 56.2） | OSD 高（旧） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 375 | 93 | 48.2 | 44.8 | +22.4 | 2 | 36.0 | 67.2（旧 72.6） |
| 768 | 99.1 | 50.8 | 48.3 | +24.1 | 2 | — | 80.3（不变） |
| 1024 | 163.6 | 163.6 | **0** | **0** | 2 | — | 91.4（不变） |
| 1280 | 167.1 | 167.1 | **0** | **0** | 2 | — | 90.8（不变） |
| 1440 | 169.4 | 169.4 | **0** | **0** | 2 | 35.3 | 90.5（不变） |
| 1920 | 177.8 | 177.8 | **0** | **0** | 2 | 34.8 | 93.5（不变） |
| 2560 | 194.4 | 194.4 | **0** | **0** | 2 | 37.2 | 102（不变） |

**溢出校验**（这是 `nowrap` 的主要风险点）：`.iptv-osd-controls-row` 的 `scrollWidth − clientWidth = 0`
且 `scrollWidth − 中列 clientWidth` 在全部 7 个视口均为负（−6 … −27）→ **没有任何视口被裁切**；
`.iptv-osd-bar` 自身 `scrollWidth − clientWidth = 0`。

### 涉及文件

- `src/assets/styles/variables.css`（新增 `--layout-channel-group-w` + ≤479 覆写 + TV 契约；OSD 宽度合并为单曲线、删除段2 覆盖）
- `src/components/UniversalPlayer/UniversalPlayer.css`（一/二级栏宽度 + ≤479 窄屏档）
- `src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.css`（右翼等宽/右对齐、meta 行、控件行 nowrap + 间距、≤639 图标化）
- `src/components/UniversalPlayer/IPTVOSDBar/IPTVOSDBar.tsx`（meta 行包裹 + 音轨恒显示）

### 验证

- `npm run build` 通过（exit 0）。
- `npm run test`：**32 文件 / 383 passed**。
- 全量 e2e：**117 passed / 1 skipped**，与基线一致。
- stylelint 逐文件与 stash 基线比对（新增 0，variables.css 还 −2）：
  variables.css 197→195 / UniversalPlayer.css 68→68 / IPTVOSDBar.css 8→8 /
  VideoCard.css 0→0 / HeroBili.css 13→13。
- `grep` 过本次改动 3 个 CSS 里的全部 `display: none`：新增 2 处
  （`.up-channel-item-quality` ≤479、`.iptv-osd-control-btn span` ≤639），
  均带 `html[data-device="app"]` 副本与注释，无遗漏。
