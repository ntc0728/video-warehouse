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
3. 设置页反馈（2026-09-28 晚，多轮拍板）：① source-manager 面板**去卡**、`.source-manager__item` 条目**保留卡片**（先「三源恢复卡片」→ 再「面板不要卡片」→ 最终「条目保留」）；② 设置项之间间距太大收紧；③ 子项标题左侧的「黑点」移除（移动端同样处理）；④ 鼠标悬浮设置项不出现背景色变化；⑤ 设置页各个字体、图标尺寸有点大 → 整体缩档；⑥ 按钮、图标、tab、方型按钮尺寸过大 → 控件尺寸族续缩；⑦ 第三轮修正：左栏完全不改（字号/图标/tab 内边距回原值），只改右侧内容区，按钮系数 0.93 加码到 0.8（7% 不可感知）；⑧ 第四轮：界面缩放下拉换 Select 组件（原生 select 样式突兀，对齐 TMDB 语言下拉）、个人设置行标题字号对齐 list-item__title（原 inherit 16px vs 13px）、一键导入/恢复按钮方框 44.7-52→40.6px。

## 修法

**去卡（分层）**

- 组件层：基础规则本就在桌面 media 内的直接删（`HeroBili.css .hero-bili/.hero-side-card`、`Home.css .home-topstrip` 等）；基础规则全端生效的用 `@media (width >= 768px) { html:not([data-device="app"]) ... { 四件套置空 } }` 覆盖（`Home.css`、`VideoCard.css`、`Browse.css`、`Settings.css`、`RecordShell.css`、`ProxySetup.css` 等）。
- 浮层例外：Modal / Popover / Select dropdown / SearchBox dropdown **保留背景色**只删 border/radius/shadow——无底色会与底层内容重叠不可读。
- 表单控件（Select trigger、开关、chips）属控件不属于卡片，保留。
- 去卡后防隐形：`.home-topstrip__pill` 底色 `--color-background` → `--color-surface`。
- 页面级第二批（Chart / Person / Detail / SourceChecker + SourceManager 条目）：`Detail .detail-hero-side` 本就在 ≥1024 + not app/tv 块内直接删四件套；`Chart .chart-card`、`Person .person-hero/.person-grid-card`（1024 档）、`SourceChecker` 四卡（页头/统计卡/tab 条/检测面板）基础规则全端生效 → 覆盖块。细则：Person hero 深色底是 hero 语义底非 surface 保留。

**设置页反馈修正（同日晚，多轮）**

- ① source-manager 最终态：`.source-manager` 面板去卡（border/radius/bg 移除，仅留折叠 `gap` 过渡 `var(--dur-lg) var(--ease-in-out-quart)`），面板/条目 hover 反馈删除；`.source-manager__item` 条目**保留卡片**（上一轮恢复的卡片不进覆盖块），拖拽 `is-dragging`/`is-drop-target` 指示为原生规则；popover 属浮层例外仅删 border/radius/shadow。
- ② 间距收紧：项间 `margin-top` 16→8（`--space-sm`）；`.list-item__row` 上下 16/12→8/4；`.list-item__desc` 上下 12/24→4/8（项间视觉 40→16px）。仅桌面行式；移动端子页双行卡不动。
- ③ 黑点根因：`List.tsx` 的 tailwind `list-item` 类 = `display:list-item` + UA 默认 `list-style-type:disc` → 标题左侧渲染 disc marker。`.settings-page .list-item` / `.settings-subpage .list-item` 全端置 `list-style:none`（display 不动，布局零影响）。
- ④ hover 静默：删除本日新增的 `list-item:hover` / `settings-card__body:hover` 背景反馈与 `transition: background`；`.settings-profile-card:hover` 撤掉 background 行（保留 border/shadow 屏蔽，hover 完全无变化）。左栏导航 tab、按钮类 hover 属原有行为，不动。
- ⑤ 字号/图标缩档：`html .settings-page` 作用域重定义 `--text-2xs…3xl` 为全站值 ×0.93（≥768 档同步乘系数保持大屏 clamp 形态）；`--icon-*` 的 `calc(var(--text-*)×系数)` 在元素处延迟解析 → 图标连锁缩 ~7%。`--space-*`/`--card-size` 不动，作用域外全站不受影响。实测：tab 文字 13→12.09、图标 18.2→16.89；source-manager 标题 18→16.74、图标 21.5→20.02。
- ⑥ 控件尺寸族缩档（第二轮，第三轮加码 ×0.8）：同块追加 `--comp-btn-min-height/-width`、`--comp-tab-height`、`--comp-input-height`、`--comp-thumb-size` 全站式 ×0.8（base + ≥768 桌面递减档双覆盖，`--ui-scale` 用户缩放相乘保留；二轮 0.93 视觉不可感知 → 加码）→ theme-btn/back-btn 方块、counter-btn ±、Button min-h、settings-input、settings-btn-mini、滑块手柄全连锁；`--comp-input-min-w`（宽度类）不缩。`.skin-btn__swatch` 定点 `calc(var(--layout-logo-size)*0.8)`（不动全局 logo/TV）。实测@1280：theme-btn 49.5→39.61、swatch→38.39。
- ⑦ 第三轮「左栏不改，只改右侧内容区」：`html .settings-page .settings-sidenav` 豁免 `--text-*` 回全站原式（特异性 0,2,1；icon 经 calc 延迟解析自动回原值；base + 桌面档双豁免，必须与缩档块**平级**——嵌套会展开成永不匹配的 `html…html…` 选择器）；sidenav tab 与横排 tab 内边距均回原档（md/sm、xs/md）。右侧内容区 text ×0.93 保留。实测@1280：左栏 tab 13px/padT 10.57/h 42.63（原值），右侧 section 标题 16.59（×0.93）。
- ⑧ 第四轮三处：界面缩放 `<select>`（原生样式突兀）→ 项目 `Select` 组件（options value 转 string、onChange 转 number，与 TMDB 语言下拉同款）；`.settings-row__title` 补 `font-size: var(--text-base)`（原无声明 inherit 16px，其他 tab 的 list-item__title 是 tailwind text-base=13.02px → 对齐）；`.settings-action-btn--inline` `min-height --avatar-xs(44.7-52)` → `--comp-btn-min-width`（40.6 仍偏大）→ 第五轮再降 `--comp-tab-height`（×0.8 ≈29.5px，与同页 Select trigger 等高）。

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
- 设置页反馈修正 E2E：`settings.spec` 两遍 **10/10 全过**。其中 SET-050 的 `count()` 一次性读取异步源列表属测试缺陷（stash 原版对照同样失败）→ 改 web-first `toBeAttached`（同 home.spec LazyImage 教训），两遍复跑均过。playwright 实探复核：`list-styleType=none`（黑点消）、hover 背景前后均 `transparent`、项高 117→97px、面板 `border 0 + transparent` 而条目 `1px border + 16.6px radius + 白底`（面板去卡/条目卡片并存）、字号图标 ×0.93 连锁生效。
- 控件缩档第二轮验证：build 后 probe 实测 computed（`--comp-*` 均 `*1*.93`、theme-btn 46.05、swatch 44.63、tab 高 35.55）+ 截图目检；`lint:all` 7 门全绿；`settings.spec` 10/10。注：e2e-skeleton 跑 dist 产物，改 CSS 后须先 build 再 probe 才读到新值。
- 第三轮验证：probe 复核左栏 `--text-sm=calc(13px*1)`（原值）/右侧 `×.93`、theme-btn 39.61、swatch 38.39、左栏 tab padT 10.57 h 42.63；截图目检左栏复原/右侧缩档；`lint:all` 7 门全绿；`settings.spec` 10/10。
- 第四轮验证：probe 复核界面缩放 `nativeSelect=false`（Select 组件 trigger h 29.53）、个人页 `rowTitle=13.02=listTitle`（对齐）、一键按钮 h 40.56；双页截图目检；`lint:all` 7 门全绿；`settings.spec` 10/10。
- 第五轮验证：一键按钮 h 29.53（=Select trigger 高）截图目检；`lint:all` 7 门全绿（test-map 过期经 `test:count --write` 同步 testing.md 生成块）；`settings.spec` 10/10。
- 对比 demo：`demo/card-removal-demo.html`（亮/暗切换 + before/after 布局 + 三态旧新对比）。
