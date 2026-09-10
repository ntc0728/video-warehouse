---
date: 2026-09-10 21:00
module: 首页 / StickyHeader / Browse / RecordShell·Settings·IPTV 左栏 / Detail·Person
type: design-proposal + feature
build: 通过（pnpm run build）
files:
  - changelogs/demos/demo-widescreen-overhaul-2026-09-10.html（新增提案台）
  - changelogs/README.md（Demo 索引登记）
  - src/pages/Home/index.tsx、Home.css、HomeTopStrip.tsx（新增）
  - src/components/CategoryQuickAccess/*（CategoryHeatRow rail 变体）
  - src/components/StickyHeader/StickyHeader.css（顶栏对齐）
  - src/pages/Browse/Browse.css
  - src/pages/Settings/Settings.css
  - src/pages/IPTV/IPTV.css
  - src/components/RecordShell/RecordShell.css
  - src/assets/styles/variables.css（--rail-w token）
demo: changelogs/demos/demo-widescreen-overhaul-2026-09-10.html
---

## 大屏 UI 整改四议题（用户 2026-09-10 拍板落地）

### 问题

四项待办全部属于「视觉尺寸 · UX」类改动，按 `docs/agents/collaboration.md` 第 1/3 条
先出可预览 Demo（`demo-widescreen-overhaul-2026-09-10.html`）再由用户逐项拍板。

### 旧逻辑（现状实测）

| 议题 | 现状 |
| --- | --- |
| ① 首页大屏 | Hero 通栏（`--hero-banner-h` = 内容宽 ×0.2727，1440/1920/2560 → 360/469/524px）→ 继续观看 → 分类热度榜横排行（实测行高 368px）→ 7 行。内容单列堆叠；顶栏 inner 只有 `--space-md`(≈9px) 内距且无封顶，大屏下 logo 与内容区左边缘最多错位约 130px |
| ② Browse 左栏 | 栏宽 `clamp(124px, 8.61vw, 224px)`（1440 → 124px）；chip `padding: 8px` 实测 61×32px；4 组 39 个 chip → 左栏总高 **836px**；chips 固定 2 列 |
| ③ 左栏样式 | 四处左栏（Browse / RecordShell / Settings / IPTV）宽度机制与断点各不相同，视觉上全部「无背景 + 无边框」 |
| ④ Detail / Person | Detail hero `min(65vh, clamp(450px, 423px+7.22vw, 700px))` 实测 515/527/562/608px；Person hero 纯色块实测 386/402/450/450px |

### 新逻辑（本轮已落地 ①②③⑤，④ 待拍板）

- **① 首页 = 方案 C 通体两栏 + 两个补强**（commit `8fa3646`）
  - `.home-two-col`：`grid [280px(≥1920: 300px)] + [1fr]`，2200 封顶居中；左栏 = 分类热度榜
    `variant='rail'`（sticky，3 卡竖排、条目缩略图 150×85 → 56×32）；右列 = Hero + 内容行；
    原内容区的独立热榜横排行删除（避免重复）。
  - HeroBili 的 `--hero-banner-h` / `--hero-side-w` 在右列内**按右列实际宽度重算**
    （否则主图被算高、右栏 3×2 卡溢出列宽）。
  - ⚠️ HeroBanner 祖先不得带 transform 动画（GPU 合成层闪烁）：`page-transition-enter`
    只包内容行，Hero 与其平级。
  - 补强一「顶栏对齐」：`.sticky-header__inner` 由固定 `--space-md` 改为 `--page-pad-x`
    （≥1440 为 60/100/140px）+ 2200 封顶居中，与内容区左右边缘严格同线（全站生效）。
  - 补强二「顶部过渡带」：新增 `HomeTopStrip`，header 与 Hero 之间的 44px 信息带
    （面包屑 / 今日趋势条数 / 最热分类 / 继续观看·收藏计数 / 完整热度榜入口）。
- **② Browse 左栏 = B+C**（commit `91dbf0a`）：栏宽改用共享 token `--rail-w`；
  chip 上下内边距 8 → `calc(--space-sm - --space-2xs)`≈5.7px（32 → 26px）、
  组间收紧；chips 网格 `repeat(2,1fr)` → `repeat(auto-fill, minmax(56px,1fr))`。
  实测左栏总高 836 → 694px（−17%）。
- **③ 左栏视觉语言 = 方案 B**（commit `91dbf0a`）：新增 token
  `--rail-w: clamp(148px, 10vw, 248px)`（variables.css），四处左栏统一引用；
  四处统一加 `border-right: 1px solid var(--color-border-light)` + 右侧内边距。
- **⑤ 暗色缺陷修复**（commit `91dbf0a`）：
  - Browse.css 去掉 20 条 rail 规则的 `html:not([data-theme="dark"])` 门控 ——
    原门控导致**暗色主题下整个左侧筛选栏塌回单列完全消失**；
  - RecordShell.css / IPTV.css 选中态硬编码 `color:#fff` → `var(--color-text-inverse)`
    （暗色下 `--color-primary` 是 #fff，原写法 = 白底白字不可读）；
    选中态计数徽标底色改 `color-mix(in srgb, var(--color-text-inverse) 22%, transparent)`。
- **④ Detail / Person = C，均已落地**（commit `fc99aaf` / `f561f56`）
  - 排列选定 **C1**：右栏只承载「文本类」信息（类型标签 + 基础信息 KV + 发行公司），
    演员（横滚条）/ 简介 / 剧照保持通栏 —— 横向铺开的内容放窄栏会严重缩水。
    实现要点：`.detail-top` 默认 `display: contents`（<1024 / TV / app 零布局影响），
    ≥1024 切 grid；同一份 JSX 由 `isWideDetail` 决定落在 hero 右侧还是 info tab 内；
    右栏 `max-height` 锁死为 hero 实测高度（`--detail-hero-h`），两栏下沿严格齐平。
    实测 1440：hero 449 / side 449，9 个字段无需滚动。
  - 追加要求①「右栏带上原图标 + 新增有颜色的图标」：保留原 `detail-info-card` 图标体系，
    另加语义化彩色 —— 评分=暖橙、预算/票房=绿、季/集=蓝（其余保持主色避免整栏花掉）。
  - 追加要求②修复「演员折叠第二行被裁一半」：原 `max-height: 16rem` 硬编码，
    而头像 `--layout-cast-avatar` 是流体值（桌面 80→88px × `--ui-scale`），
    实测 1440 下两行需 304.9px > 256px → 第二行被裁约 49px。
    改为 JS 按「首行条目高度 × 2 + grid row-gap」写入 `--cast-collapsed-h`。
  - 追加要求③剧照放大控件：放大镜居中、两侧为相邻档位百分比（点左缩小 / 点右放大，
    点图标重置），档位 0.75 / 1 / 1.5 / 2；列宽基准**乘以** `--stills-zoom`
    （写成除法会反向：125% 反而多一列、图更小，已实测）。
  - Person 页：`.person-hero` ≥1024 改左右布局（头像由绝对定位右上角改左列、信息右列、
    高度改内容撑开），实测 1440 下 402 → **262px（−35%）**；
    移动端 / 平板（<1024）与 TV 端保持原竖排不变。

### 预览

```
# 直接双击打开，或在仓库根起静态服务：
python -m http.server 8123
# http://localhost:8123/changelogs/demos/demo-widescreen-overhaul-2026-09-10.html
```

Demo 支持：4 议题切换、每议题 3~6 个方案、模拟视口 1280/1440/1920/2560、深浅主题切换。

### 验证

- `pnpm run build` 通过（Home / Browse / StickyHeader / CategoryQuickAccess 改动后各跑一次）。
- `pnpm run lint:css`：改动文件相对基线无新增问题
  （Browse 21→21 / RecordShell 40→39 / IPTV 25→23 / Settings 51→50）。
- `eslint` 改动文件 0 error。
- E2E：`home.spec.ts` 12/12、`browse.spec.ts` + `settings.spec.ts` 17/17、
  `collections` + `history` + `iptv` 14/14 全部通过。
- 浏览器实测：首页两栏 1440 → 280/1008、1920 → 300/1384、2560 → 300/1860；
  顶栏内距 1440 → 60px、1920 → 100px、2560 → 140px；
  Detail C1 右栏高度与 hero 严格齐平且不产生滚动（四档均验证）。
