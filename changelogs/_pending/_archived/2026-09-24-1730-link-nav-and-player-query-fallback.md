---
date: 2026-09-24
module: Player, Detail, Hero, CQA, Chart, StickyHeader
type: 功能（右键新开页签 + Player query 兜底）
build: ✅ npm run build 通过
files:
  - src/pages/Player/index.tsx
  - src/pages/Detail/index.tsx
  - src/pages/Detail/components/PlaylistModal.tsx
  - src/pages/Detail/Detail.css
  - src/pages/Detail/components/PlaylistModal.css
  - src/components/HeroBanner/HeroBanner.tsx
  - src/components/HeroBanner/HeroBili.tsx
  - src/components/HeroBanner/HeroBanner.css
  - src/components/StickyHeader/StickyHeader.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.tsx
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
  - src/pages/Chart/index.tsx
  - src/pages/Chart/Chart.css
demo: 无（行为类：导航方式切换）
---

# 播放/详情类控件改 `<Link>` 支持右键新开页签 + Player state/query 双读

## 范围（用户 2026-09-24 拍板 Q1）

全站带「播放」「详情」语义的按钮/可点行改为 `<Link>`（或 `<a>` 修饰键放行），支持右键/中键新开页签；Player 同时读 `location.state`（同标签优先）与 URL query（新页签兜底）。

## 旧逻辑 → 新逻辑

### Player query 兜底（`src/pages/Player/index.tsx`）

| state 键 | query 键 | 语义 |
| --- | --- | --- |
| `sourceIndex` | `src` | CMS 采集源索引 |
| `playUrl` | `play` | 精确播放地址 |
| `seasonNumber` | `season` | 季号 |
| `skipHistory` | `fresh=1` | 跳过历史恢复 |

`from` 仅同标签导航写 state，不进 query。数值 query 经 `Number.isFinite` 防 NaN。

### 改 `<Link>` 的入口

1. **Detail hero**：立即播放 / 从头播放（`?fresh=1`）、来源「立即播放」（`?src=N`）→ Link；无可用线路仍 disabled button。
2. **Detail 演员卡**：`<a>+preventDefault+navigate` → 纯 Link。
3. **PlaylistModal 选集/线路格**：有 `videoId` 时渲染 Link（href 带 `src/play/season`）；点击修饰键放行，普通点击 `preventDefault` 后走原 `playItem` 副作用；`onPlayLine` 去掉 `playType` 参数（Player 不读）。无 `videoId` 时回退 button。
4. **HeroBanner / HeroBili CTA**：继续播放 / 查看详情 → Link（`state.from`）。
5. **StickyHeader** 顶栏导航与 logo：`<a>` 保留，onClick 加修饰键放行。
6. **CQA** 热卡 / 榜头行 / 趋势行：`div[role=link]` 或 button → Link。
7. **Chart** 榜单行：`div[role=link]` → Link。

### CSS

转 Link 的类补 `text-decoration: none`（及 chart/CQA 行 `color: inherit`），避免浏览器默认下划线。

## 不改（按方案）

VideoCard / RecordCard / IPTV 卡（本就是 Link）、Player `playNextNow`、Hero 右侧 side cards。

## 验证

- `npm run build` ✅
- 受影响 spec：`detail.spec`（.detail-btn-play 仍可见可点）、`regression`（hero CTA / playlist-cell）、`home.spec`（.cqa-hotcard / .cqa-trend__row 点击）、`chart.spec`（.chart-row 点击）
