---
date: 2026-09-28 22:31
module: 全站（首页 / 设置 / 页面级 / 模块组件 / 浮层）
type: feature
build: pass
files:
  - src/assets/styles/variables.css
  - src/assets/styles/index.css
  - src/pages/Home/Home.css
  - src/pages/Settings/Settings.css
  - src/pages/Browse/Browse.css
  - src/pages/IPTV/IPTV.css
  - src/pages/ProxySetup/ProxySetup.css
  - src/pages/Chart/Chart.css
  - src/pages/Person/Person.css
  - src/pages/Detail/Detail.css
  - src/pages/SourceChecker/SourceChecker.css
  - src/components/VideoCard/VideoCard.css
  - src/components/HeroBanner/HeroBili.css
  - src/components/CategoryQuickAccess/CategoryQuickAccess.css
  - src/components/RecordShell/RecordShell.css
  - src/components/RecordFilterPanel/RecordFilterPanel.css
  - src/components/SearchBox/SearchBox.css
  - src/components/SourceManager/SourceManager.css
  - src/components/ui/HelpPopover.css
  - src/components/ui/Select.tsx
  - src/components/LazyImage/LazyImage.css
  - scripts/home.spec.ts
demo: demo/card-removal-demo.html
---

# 桌面端全站去卡片化 + 卡片三态背景与页面底色区分

## 需求

1. 去掉桌面端（首页 / 设置 / 元素 / 模块）的卡片式布局：移除四件套 `border + border-radius + surface 背景 + shadow`；移动端与 `html[data-device="app"]` 副本不改，TV 端保留卡片。
2. 卡片封面三态（加载扫光 / 失败 / 缓存等待）背景色与页面背景色相似度过高（`--color-placeholder` 亮色 `#f5f5f5` 与 `--color-background` 同值，ΔE=0；shimmer ΔL≈3–6 不可见）。
3. 设置页四点反馈（2026-09-28 晚）：① 视频源/IPTV 源/EPG 源三个面板**恢复卡片样式**；② 设置项之间间距太大收紧；③ 子项标题左侧的「黑点」移除（移动端同样处理）；④ 鼠标悬浮设置项不出现背景色变化。

## 修法

**去卡（分层）**

- 组件层：基础规则本就在桌面 media 内的直接删（`HeroBili.css .hero-bili/.hero-side-card`、`Home.css .home-topstrip` 等）；基础规则全端生效的用 `@media (width >= 768px) { html:not([data-device="app"]) ... { 四件套置空 } }` 覆盖（`Home.css`、`VideoCard.css`、`Browse.css`、`Settings.css`、`RecordShell.css`、`ProxySetup.css` 等）。
- 浮层例外：Modal / Popover / Select dropdown / SearchBox dropdown **保留背景色**只删 border/radius/shadow——无底色会与底层内容重叠不可读。
- 表单控件（Select trigger、开关、chips）属控件不属于卡片，保留。
- 去卡后防隐形：`.home-topstrip__pill` 底色 `--color-background` → `--color-surface`。
- 页面级第二批（Chart / Person / Detail / SourceChecker + SourceManager 条目）：`Detail .detail-hero-side` 本就在 ≥1024 + not app/tv 块内直接删四件套；`Chart .chart-card`、`Person .person-hero/.person-grid-card`（1024 档）、`SourceChecker` 四卡（页头/统计卡/tab 条/检测面板）基础规则全端生效 → 覆盖块。细则：Person hero 深色底是 hero 语义底非 surface 保留。

**设置页四点反馈修正（同日晚）**

- ① 三源恢复：撤销对 `.source-manager` 面板（Settings.css）与 `.source-manager__item`/`__popover`（SourceManager.css）的去卡，规则与去卡前逐字一致（含 `gap 0.35s` 过渡原行，回 lint 基线）。
- ② 间距收紧：项间 `margin-top` 16→8（`--space-sm`）；`.list-item__row` 上下 16/12→8/4；`.list-item__desc` 上下 12/24→4/8（项间视觉 40→16px）。仅桌面行式；移动端子页双行卡不动。
- ③ 黑点根因：`List.tsx` 的 tailwind `list-item` 类 = `display:list-item` + UA 默认 `list-style-type:disc` → 标题左侧渲染 disc marker。`.settings-page .list-item` / `.settings-subpage .list-item` 全端置 `list-style:none`（display 不动，布局零影响）。
- ④ hover 静默：删除本日新增的 `list-item:hover` / `settings-card__body:hover` 背景反馈与 `transition: background`；`.settings-profile-card:hover` 撤掉 background 行（保留 border/shadow 屏蔽，hover 完全无变化）。左栏导航 tab、按钮类 hover 属原有行为，不动。

**三态区分（改 token 色源，59 处引用自动生效）**

| 态 | 亮色 | 暗色 |
| --- | --- | --- |
| placeholder（等待底） | `#f5f5f5` → `#e9e9e9`（与页底 ΔE≥8） | `#262626` 不变（页底 `#0a0a0a`，本就可分） |
| shimmer-a | `#f0f0f0` → `#ececec` | → `#262626` |
| shimmer-b | `#e6e6e6` → `#dcdcdc` | → `#333` |
| 失败态 | 新增 `inset 0 0 0 1px var(--color-border)` 内描边（静止描边 = 失败，扫光动画 = 加载中） | 同左 |

## 验证

- `npm run lint:all` 7 门全过（design/css/json/version-sync/test-map/eslint/build）。
- E2E：`node scripts/e2e-skeleton.mjs scripts/home.spec.ts scripts/settings.spec.ts` → home 13/13 通过（HOME-088 断言随去卡更新：边框 `width=0px`，`border-style` 恒 solid 是 Tailwind preflight 全局值）；settings 10 条中 SET-050 失败经 **stash 对照实验证实为预存在失败**（回滚本次全部 src 改动后同样失败），与本次改动无关。
- `npm run test:count` 映射/grep/档位恒等式全部一致。
- 页面级第二批 E2E：`node scripts/e2e-skeleton.mjs chart/person/detail/source-checker 4 spec` → 19/19 通过。
- 设置页反馈修正 E2E：`settings.spec` → **10/10 全过**（含此前 stash 对照证实预存在的 SET-050，本次恢复源面板卡片后不再复现）；playwright 实探复核四点：`list-styleType=none`（黑点消）、hover `background` 前后均 `transparent`、项高 117→97px、三源面板 `1px border + 16.6px radius + 白底` 恢复。
- 对比 demo：`demo/card-removal-demo.html`（亮/暗切换 + before/after 布局 + 三态旧新对比）。
