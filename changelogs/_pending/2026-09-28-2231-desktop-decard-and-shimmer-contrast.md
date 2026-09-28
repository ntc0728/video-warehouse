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

## 修法

**去卡（分层）**

- 组件层：基础规则本就在桌面 media 内的直接删（`HeroBili.css .hero-bili/.hero-side-card`、`Home.css .home-topstrip` 等）；基础规则全端生效的用 `@media (width >= 768px) { html:not([data-device="app"]) ... { 四件套置空 } }` 覆盖（`Home.css`、`VideoCard.css`、`Browse.css`、`Settings.css`、`RecordShell.css`、`ProxySetup.css` 等）。
- 浮层例外：Modal / Popover / Select dropdown / SearchBox dropdown **保留背景色**只删 border/radius/shadow——无底色会与底层内容重叠不可读。
- 表单控件（Select trigger、开关、chips）属控件不属于卡片，保留。
- 去卡后防隐形：`.home-topstrip__pill` 底色 `--color-background` → `--color-surface`；hover 态阴影/边框改用 `--color-surface-hover` 背景承接。
- 折叠面板 `.source-manager` 只留 `gap` 过渡（`var(--dur-lg) var(--ease-in-out-quart)`，修 lint timing-literal）。
- 页面级第二批（Chart / Person / Detail / SourceChecker + SourceManager 条目）：`Detail .detail-hero-side` 本就在 ≥1024 + not app/tv 块内直接删四件套；`Chart .chart-card`、`Person .person-hero/.person-grid-card`（1024 档）、`SourceChecker` 四卡（页头/统计卡/tab 条/检测面板）、`SourceManager .source-manager__item` 基础规则全端生效 → 覆盖块。细则：Person hero 深色底是 hero 语义底非 surface 保留；拖拽落点顶线 `is-drop-target` 是功能指示，特异性抬高保留；`source-manager__popover` 属浮层例外只删 border/radius/shadow。

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
- 页面级第二批 E2E：`node scripts/e2e-skeleton.mjs chart/person/detail/source-checker 4 spec` → 19/19 通过；settings 复跑 9/10（唯一失败仍是已证实预存在的 SET-050），无新增失败。
- 对比 demo：`demo/card-removal-demo.html`（亮/暗切换 + before/after 布局 + 三态旧新对比）。
