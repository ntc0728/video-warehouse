# KinoTV 三端设计规范实施方案（2026-09-15）

> **上游**：《[三端设计规范审查报告](./DESIGN-REVIEW-2026-09-15.md)》（2026-09-15，只读审查）
> **本文件定位**：可执行实施方案。每批含「改动清单（文件:行号）+ 可直接粘贴的代码 + 实测预期值 + 验收标准 + 回归风险 + 回滚方式」。
> **状态**：方案待执行（尚未改动任何源码）。

---

## 〇、拍板结论与落地口径

| 审查报告 §七 待拍板项 | 你的决策 | 本方案落地口径 |
| --- | --- | --- |
| ① `tertiary` 提档 | **接受** | 全站辅助文字提亮一档：浅色 `#999 → #6b6b6b`、暗色 `#666 → #8c8c8c`；新增 `--color-text-disabled` 承接原「低对比灰」场景，把「灰蒙蒙」从信息性文字里彻底清出去 |
| ② 桌面段2 字号 | **按行业标准合理设计，不设可读性下限** | **作废**报告 §五 的 `clamp(下限, 递减曲线, 上限)` 写法。改为：**取消递减**，把段2 端点直接设计成行业标准档常量（常量本身即 ≥ 下限，无需额外钳制）；并把「大屏字不缩小」设为契约 |
| ③ TV 字号 | **符合行业主流标准即可** | 按 10-foot UI 实践区间重设：1080p 正文 **20px**（原 15）、次要 18、角标 14、标题 30/36；4K 保持 2× |

**与既有决策的关系**：② 会**部分改写** 2026-09-05 拍板的「密度契约 v2.1 段2 递减曲线」（字号族），但**不动**同一次拍板的**间距族 E2 紧凑端点**（`--space-*` / `--grid-gap` 一行不改）。密度收益由间距族继续承担，字号族改由可读性标准承担 —— 这是本方案的核心取舍。

---

## 一、不可违反的约束（来自 `AGENTS.md` 与既有契约）

1. 改完必须 `npm run build` 通过（禁 `--skipLibCheck` 替代）。流程：改码 → build 通过 → commit → push。
2. 每批独立 commit，不堆积；子代理操作前先 commit / stash 保护。
3. CSS 改动 grep 全部 `display:none` / `visibility:hidden` 确认无遗漏；收尾用 `tasklist` + `netstat` 双确认零遗留。
4. 观感类改动（本方案 B1/B3/B5 属观感类）必须附**可预览 demo** → 放 `changelogs/demos/`。
5. 当日改动只写 `changelogs/_pending/<日期>-<slug>.md` 片段；push 前跑 `node scripts/changelog-collect.mjs`。
6. 断点宪法：新增桌面样式默认放 `@media (width >= 1024px)`；涉及 TV 的分档 `@media` 必须带 `html:not([data-device="tv"])` 前缀；TV 覆盖集中在文件末尾 `[data-device="tv"]` 块。
7. **本方案不动的部分**：三段式（375 / 768→2200 / TV 2×）、2200 内容封顶、`--card-cols` 列数梯度（3/4/5/6/7/8）、间距族 E2 端点、TV `clamp(A, (A/19.2)vw, 2A)` 契约形态、`--ui-scale` 大屏补偿曲线。
8. `--text-*` 常量**必须写成 token**（custom property），组件内继续 `var(--text-*)`。原因：`.stylelintrc.json` 已禁 `font-size: <裸 px>`（`declaration-property-unit-disallowed-list`），直接写 px 会 lint 失败。

---

## 二、执行顺序（含依赖关系）

```
B0  基线准备（快照 + demo + 回滚点）      —— 零风险
├─ B1  色彩四档 + 状态色双档              —— 直击「灰蒙蒙 / 颜色怪」，P0-1 + P1-1
├─ B2  键盘焦点环恢复                     —— 独立，可与 B1 同批，P0-2
└─ B4  根字号解耦（前置，零渲染变化）      —— 解除 --text-base ↔ rem 的耦合
     └─ B3  字号阶梯重构                   —— P0-3 + P1-4（字号部分）
          ├─ B5  TV 字号 10-foot 基线      —— P1-2（仅 TV）
          └─ B6  移动端触摸/安全区/缩放     —— P1-4（其余）
B7  工程化收口（规范文档 + 护栏 + 清理）    —— 固化前 6 批成果，防规范再次漂移
```

**B4 必须早于 B3**：`--text-base` 同时充当根字号（`html { font-size: var(--text-base) }`），全仓 **≈200 处 `rem` 消费点**（PlaylistModal 40 / UniversalPlayer 33 / History 20 / StillsLightbox 13 / SourceManager 12 / Timeline 11 / Detail 10 …）会跟着它变。不先解耦，B3 会让这些布局整体漂移 +7.7%。

---

## 三、B0 基线准备（零风险，半天内）

| 步骤 | 内容 | 产出 |
| --- | --- | --- |
| B0-1 | 跑基线探针：8 组视口（390/768/1024/1440/1920/2560/1920-TV/3840-TV）× 5 页（首页/收藏/Browse/设置/Chart），记录 `--text-*` `--space-*` `--comp-*` 解析值 + 关键区块截图 | `.tmp-baseline.json`（临时，不入库） |
| B0-2 | 建对照 demo：`changelogs/demos/demo-design-ladder-2026-09-15.html`（左旧右新两栏，纯静态内联 CSS，不依赖 dev server，可直接双击打开） | demo 文件（入库，观感类改动必备） |
| B0-3 | 打回滚点：`git tag design-baseline-2026-09-15` | tag |
| B0-4 | 每批落地后单独 commit，tag 依次 `design-b1` … `design-b7` | tag 链 |

> 探针脚本要点见附录 A。**注意**：本项目 Playwright 打开应用页会崩渲染进程（已复现），探针必须用「注入源 CSS + `setContent`」方式量 token，不要 `page.goto` 拿计算值。

---

## 四、B1 色彩：文字四档 + 状态色双档

**改动文件**：`src/assets/styles/variables.css`（token 定义）、若干组件 CSS（消费端替换，见 B1.6）

### B1.1 文字语义四档（核心修复）

落地口径：**只有「禁用 / 占位 / 装饰」允许低于 4.5:1，其余一律 ≥4.5:1。**

| token | 现值 | 新值 | 对比度（白卡 / 页面底） | 允许用途 |
| --- | --- | --- | --- | --- |
| `--color-text`（主） | `#000` | 不变 | 21.00 / 19.26 | 标题、正文、可点文本 |
| `--color-text-secondary`（次） | `#666` | 不变 | 5.74 / 5.27 | 次要信息、表单标签、时间戳 |
| `--color-text-tertiary`（辅助） | `#999` ❌ 2.85 | **`#6b6b6b`** | **5.33 / 4.89** ✅ | 辅助说明、单位、补充信息 |
| `--color-text-disabled`（禁用，新增） | — | **`#bfbfbf`** | 1.84 / 1.69（允许不达标） | **仅**禁用态、占位符、纯装饰图标 |

暗色侧（`[data-theme="dark"]`）：

| token | 现值 | 新值 | 对比度（`#1f1f1f` / `#141414`） |
| --- | --- | --- | --- |
| `--color-text-secondary` | `#a0a0a0` | 不变 | 6.30 / 7.04 ✅ |
| `--color-text-tertiary` | `#666` ❌ 2.87 | **`#8c8c8c`** | **4.90 / 5.48** ✅ |
| `--color-text-disabled`（新增） | — | **`#5a5a5a`** | 2.39 / 2.67（允许） |

```css
/* :root —— 浅色 */
--color-text-tertiary: #6b6b6b;      /* ← #999（2.85:1）提档；辅助文字契约 ≥4.5:1 */
--color-text-disabled: #bfbfbf;      /* 新增：仅禁用/占位/纯装饰，允许 <4.5:1 */
--color-tab-inactive-text: #6b6b6b;  /* ← #a0a0a0（2.61:1）；若 B7 确认是死 token 则直接删除 */

/* [data-theme="dark"] */
--color-text-tertiary: #8c8c8c;      /* ← #666（2.87:1）提档 */
--color-text-disabled: #5a5a5a;
```

> `--color-tab-inactive-text` 在审查中列为「定义但零引用」；实际 Tabs 未激活色走 `--color-text-secondary`（`ui/TabBar.tsx` 的 `data-[state=inactive]:text-[var(--color-text-secondary)]`）。**二选一**：接线（改 TabBar 用该 token）或删除（进 B7 死 token 清理）。

### B1.2 状态色双档：`fill`（装饰底）+ `text`（承载信息）

现状是「只有一档品牌饱和色」，导致它既当填充又当文字，两头不达标。新增第二档（**一个值同时满足「浅色底上的文字」与「白字角标底」两种角色**）：

| 语义 | fill（不变，装饰/描边） | 新增 `*-text` | 白底 | `#f5f5f5` 底 | 白字 on 它 |
| --- | --- | --- | --- | --- | --- |
| success | `#52c41a`（2.27 ❌） | **`#237804`** | 5.59 ✅ | 5.12 ✅ | 5.59 ✅ |
| warning | `#fa8c16`（2.38 ❌） | **`#a05c00`** | 5.22 ✅ | 4.78 ✅ | 5.22 ✅ |
| error | `#ff4d4f`（3.27 ⚠️） | **`#cf1322`** | 5.57 ✅ | 5.11 ✅ | 5.57 ✅ |
| info | `#1677ff`（4.10 ❌） | **`#0958d9`** | 6.16 ✅ | 5.65 ✅ | — |

> 备选 `#ad6800` 只有 4.41 / 4.05（差 0.09 不达标），**不要用**；已在脚本中实测排除。

```css
/* :root —— 新增文字/图标档 */
--color-success-text: #237804;   /* 5.59 : 1（白卡）——兼作白字角标底 */
--color-warning-text: #a05c00;   /* 5.22 : 1 */
--color-error-text:   #cf1322;   /* 5.57 : 1（原 error #ff4d4f 仅 3.27） */
--color-info-text:    #0958d9;   /* 6.16 : 1（原 info #1677ff 仅 4.10） */
--color-danger:       #cf1322;   /* 唯一用途是 LIVE / 年份类型徽标底 + 白字（原 #ef4444 白字 3.76 ❌） */

/* [data-theme="dark"] —— 暗底需「亮档」而非「深档」 */
--color-success-text: #73d13d;   /* #1f1f1f 上 8.57 */
--color-warning-text: #d89614;   /* 6.51（现值即达标，直接复用） */
--color-error-text:   #ff7875;   /* 6.43（原 dark error #d32029 仅 3.15） */
--color-info-text:    #3c9ae8;   /* 5.48（原 dark info #177ddc 仅 3.93） */
--color-error:        #ff7875;   /* 暗底错误色提亮（原 3.15 不达标） */
--color-info:         #3c9ae8;   /* 暗底链接色提亮（原 3.93 不达标） */
```

### B1.3 角标 / 状态徽标统一口径 —— 中性玻璃底 + 白字

**根因**：`.video-card-badge-item`（年份+类型）与 `.video-card-status--*` 的对比度取决于**封面图**（不可控），浅色封面上白字低至 **2.04:1**。任何「半透明彩底 + 白字」都注定不稳定。

**方案**：角标统一为「**中性深玻璃底（`rgba(0,0,0,0.6)`）+ 白字**」，色义改由**左侧 4px 圆点 / 图标颜色**承载。

实测（任意封面图下的最坏情况）：

| 底图 | 白字对比度（α=0.6） |
| --- | --- |
| 纯白封面 | **5.74** ✅ |
| 浅灰 `#c8c8c8` | 8.06 ✅ |
| 中灰 `#808080` | 12.63 ✅ |
| 深灰 / 黑 | 18.42 / 21.00 ✅ |

> α=0.55 时最坏 4.74（勉强达标），α=0.6 起全档 ≥4.5 且留有余量 —— **定 α=0.6**。

```css
/* 新增基类（建议放 index.css 的「徽标」段）：所有封面上的角标统一引用 */
.badge-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  padding: 1px var(--space-sm);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.6);   /* 跨主题一致：不随 [data-theme] 翻转 */
  color: #fff;                      /* 任意封面图上最坏 5.74:1 */
  font-size: var(--text-xs);
  line-height: var(--lh-tight, 1.25);
  backdrop-filter: blur(4px);
}
.badge-chip__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentcolor;         /* 由 --color-success-text 等驱动 */
}
```

**LIVE 角标**（唯一允许用红底的场景）：`background: var(--color-danger)`（新值 `#cf1322`）+ 白字 = **5.57 ✅**。

**年份 / 类型徽标**（原为危险红底）：改 `.badge-chip` 中性底 —— **红色从此只表示「危险」与「LIVE」**，直接回应「颜色设置得很奇怪」。

### B1.4 `--color-action-blue`（首页右侧浮层刷新按钮）

现值 `#00aeef` + 白图标 = **2.53:1**，连 WCAG 1.4.11 非文本 3:1 都不满足。两个方案：

| 方案 | 做法 | 结果 | 取舍 |
| --- | --- | --- | --- |
| **A（推荐）** | 保留品牌青蓝 `#00aeef`，**前景由白改深**（`color: var(--color-text)` → 浅色主题 #000 = **8.30 ✅**；hover `#16b8f2` 上 8.9 ✅） | 达标，品牌色零改动 | 图标变深色，需 demo 确认观感 |
| B | 底色加深至 `#0077b3`（白图标 4.90 ✅） | 达标 | hover 色 `#16b8f2` 无法同时满足白字 ≥4.5（实测 3.5–4.4），需连带改 hover 色 → 改动面更大 |

> 推荐 A：只改一个 `color` 的取值来源，不动品牌色与 hover 色。

### B1.5 消费端替换清单（grep 驱动）

| 目标 | 检索式 | 处理 |
| --- | --- | --- |
| 原「低对比灰」误用 | `grep -rn "color-text-tertiary" src --include=*.css`（167 处） | 信息性用法**无需改代码**（token 值已提档）；仅需把「禁用/占位/装饰」场景**改判**到 `--color-text-disabled` |
| 显式占位符/禁用态 | `grep -rn "::placeholder\|:disabled\|cursor: not-allowed" src --include=*.css` | 就近改 `color: var(--color-text-disabled)` |
| 状态色硬编码 | `VideoCard.css:367-375`、`Collections/index.tsx:69-78`、`History/index.tsx:170` | 换 `.badge-chip` + `--color-*-text` |
| 年份/类型徽标 | `VideoCard.css:344-352` | 换 `.badge-chip`，删 `--color-danger` 底 |
| LIVE 角标 | `index.css:1033-1046` | 底改 `var(--color-danger)`（新值） |
| 播放器 OSD 硬编码灰 | `IPTVOSDBar.css:256/360/438/444`（`#aaa`/`#ccc`/`#bbb`） | 换 `--color-text-secondary` / `--color-text-disabled`（播放器为常暗上下文，用 `--player-*` 或 `--color-on-image` 档） |

### B1.6 验收

- 对比度脚本复算：附录 B 全表 ✅（`scripts/design-audit.mjs`，B7 交付）。
- 截图对比：6 页 × 明/暗 × 3 端（390 / 1440 / 1920-TV），重点看榜单简介、设置说明、时长、角标。
- 风险：**低**（纯色值变更；`tertiary` 影响 167 处，方向单一 = 变清楚）。回滚：`git revert`。

---

## 五、B2 恢复键盘焦点指示（P0-2，WCAG 2.4.7 AA）

**改动文件**：`src/assets/styles/index.css`

`index.css:584-591` 现状：非 TV 全站 `:focus-visible { outline: none !important; box-shadow: none !important }` —— 等于让键盘 / 开关控制 / 语音输入用户**完全失去位置感知**。

**替换为该块**（与 TV 侧统一用 `outline`，避免 `overflow:hidden` 裁切的老问题）：

```css
/* 非 TV：恢复键盘焦点指示（WCAG 2.4.7 / 2.4.11）。
   :focus-visible 仅在键盘 / 辅助技术触发时命中，鼠标点击不会命中
   → 历史上「点一下留下焦点框」的问题本就不会出现，无需全局屏蔽。
   用 outline 而非 box-shadow：box-shadow 会被 overflow:hidden / border-radius 祖先裁切。
   例外：.no-interaction-visual（logo / 品牌名）保持无框。 */
:root:not([data-device="tv"]) :focus-visible:not(.no-interaction-visual) {
  outline: var(--layout-outline-width, 2px) solid var(--color-primary) !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}

/* 分段控件（容器 overflow:hidden 会吃掉外侧 outline）→ 内嵌方框，与 TV 侧同源 */
:root:not([data-device="tv"]) .category-segmented__item:focus-visible,
:root:not([data-device="tv"]) .browse-search-tab:focus-visible {
  outline: var(--layout-outline-width, 2px) solid var(--color-primary) !important;
  outline-offset: calc(-1 * var(--layout-outline-width, 2px) - 2px) !important;
  box-shadow: none !important;
}
:root:not([data-device="tv"]) .category-segmented__item.active:focus-visible,
:root:not([data-device="tv"]) .browse-search-tab.active:focus-visible {
  outline-color: var(--color-text-inverse) !important;
}
```

**连带处理**：
- `index.css:1190-1200`（`@media (width > 1440px)` 内 `.video-card:focus-visible` / `.iptv-channel-card:focus-visible` 用 box-shadow 焦点环）→ 改为同一 outline 口径，消除「大屏与其它尺寸焦点样式不一致」。
- `--focus-ring` / `--shadow-focus` 恢复为「显式双层环」用途（tooltip/浮层内部），不再承担全局焦点。
- 组件内零散 `outline: none`（约 6 处）需 grep 复核：只允许出现在 `.no-interaction-visual` 这类「无交互」元素上。

**验收**（写入 `docs/design/a11y-CHECKLIST.md`）：Tab 键遍历 8 个页面，逐个确认焦点框可见、不被裁切、不被遮挡（WCAG 2.4.11）；鼠标点击后不得出现残留焦点框。

**风险**：低（仅新增可见样式，不影响鼠标用户）。回滚：`git revert`。

---

## 六、B4 根字号解耦（B3 的前置，零渲染变化）

### 问题

`index.css:262` `html { font-size: var(--text-base) }` → `--text-base` 既是最常用的正文 token，又是 rem 基准。于是：

- 改字号（B3）会连带移动 **≈200 处 `rem` 消费点**（组件 CSS 内的 rem 字面量 + Tailwind 默认数值工具类 `p-4 / gap-3 / w-6 / h-6 / gap-1.5` 等）；
- TV 块整体用 rem 书写（如 `--header-height: clamp(4.75rem, 0.2474vw, 9.5rem)`），实际 rem = 15px ≠ 设计假设的 16px → **实测值比文档低 6.25%**（header 71.25 vs 声称 76）。

### 修复：新增独立 token `--root-font-size`，复刻现状曲线

```css
/* :root */
--root-font-size: 14px;              /* 复刻现状：375–767 恒 14 */

/* @media (width >= 768px) 块内（与现 --text-base 段2 曲线逐字节一致） */
--root-font-size: calc(clamp(13px, 14.91429px - 0.11905vw, 14px) * var(--ui-scale));

/* [data-device="tv"] 块内 */
--root-font-size: 15px;              /* 复刻现状：TV 根字号 15px（非 16） */
```

```css
/* index.css:262 */
html {
  font-size: var(--root-font-size);  /* ← 与 --text-base 解耦 */
}
```

### 零回归断言

| 视口 | 现根字号 | 新根字号 | 偏差 |
| --- | --- | --- | --- |
| 375 / 390 / 768 | 14.00 | 14.00 | 0.000% |
| 1024 | 13.70 | 13.70 | 0.000% |
| 1440 | 13.20 | 13.20 | 0.000% |
| 1920 / 2560 | 13.00 | 13.00 | 0.000% |
| TV 1080p / 4K | 15.00 | 15.00 | 0.000% |

**验收**：B4 单独 commit 后，探针复测 8 组视口的 `--header-height` / `--layout-logo-size` / `--layout-sidebar-width` / `--layout-bottomsheet-max-h` 与 B0 基线**逐值一致**（差值 0）。
**风险**：低（值不变，仅换引用源）。但若探针发现任何 rem 消费点变化 → 说明有 rem 挂在其它 token 上，需就地修正。

### 后续（可选，B7 内）

把「需按 px 契约」的 rem token 显式 px 化（脚本计算 `rem × 根字号` 后改写，**渲染值 0 变化**）：`--header-height`、`--layout-logo-size*`、`--layout-sidebar-width`、`--layout-bottomsheet-max-h`、`--layout-detail-hero-max-h`、`--layout-modal-max-h`、`--layout-program-guide-max-h`、`--layout-epg-max-height`、`--layout-dropdown-max-h` + TV 块内全部 rem。收益：文档声称值 = 实测值，P1-3 的 −6.25% 偏差消失。

---

## 七、B3 字号阶梯重构（P0-3 + P1-4 字号）

### 设计原则（替代原「递减 + 下限钳制」）

1. **四档正文字号恒定**：`2xs / xs / sm / base` = **11 / 12 / 13 / 14**，全端不流动（仅乘 `--ui-scale`）。恒定 = 无逆递减、无档位塌缩、无 rem 循环。
2. **大四档（lg / xl / 2xl / 3xl）**：段1（375→768）保持流体，段2 改为「768 连续 → 1440 命中标准档 → 冻结」。标准档取 **16 / 18 / 22 / 28**（M3 title-large 22、headline-medium 28）。
3. **相邻档位差 ≥1px**（含 `--ui-scale` 放大后），杜绝 `xs = 2xs` 类塌缩。
4. **不设「可读性下限」钳制**：常量本身就 ≥ 行业下限，钳制是多余的。

### 新阶梯（px，`--ui-scale` 已计入）

| token | 390 | 768 | 1024 | 1440 | 1920 | 2560 | 1920 变化 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--text-2xs` | 9.05 → **11.00** | 10.33 → **11.00** | **11.00** | **11.00** | **11.00** | **11.88** | +0.13 |
| `--text-xs` | 12.03 → **12.00** | 12.67 → **12.00** | **12.00** | **12.00** | **12.00** | **12.96** | +1.00 |
| `--text-sm` | 13.03 → **13.00** | 13.67 → **13.00** | **13.00** | **13.00** | **13.00** | **14.04** | +1.00 |
| `--text-base` | 14.00 → **14.00** | 14.00 → **14.00** | 13.70 → **14.00** | 13.20 → **14.00** | 13.00 → **14.00** | 14.04 → **15.12** | **+1.00** |
| `--text-lg` | 14.05 | 15.33 | 15.59 | **16.00** | **16.00** | 17.28 | +2.50 |
| `--text-xl` | 16.05 | 17.33 | 17.59 | **18.00** | **18.00** | 19.44 | +3.00 |
| `--text-2xl` | 20.10 | 22.67 | 22.41 | **22.00** | **22.00** | 23.76 | +2.25 |
| `--text-3xl` | 26.10 | 28.67 | 28.41 | **28.00** | **28.00** | 30.24 | +3.25 |

**相邻档位差实测（新）**：390 → 1 / 1 / 1 / 1.33 / 2 / 5.33 / 6；1440 → 1 / 1 / 1 / 2 / 2 / 4 / 6；2560 → 1.08 / 1.08 / 1.08 / 2.16 / 2.16 / 4.32 / 6.48 —— **全部 ≥1px ✅**（现状 2560 处 xs = 2xs = 11.88 塌缩已消除）。

### 代码（可直接粘贴）

**① `:root` 段（小四档改为恒定常量）**

```css
/* 小四档恒定（2026-09-15 阶梯重构）：不随视口流动，仅随 --ui-scale。
   依据：HIG caption2 11pt / 行业最小 11px；Ant Design 5 / TDesign / B站 正文 14px。 */
--text-2xs: calc(11px * var(--ui-scale));   /* ← clamp(9px, … ,10.333px)：390 实测 9.05 不可读 */
--text-xs:  calc(12px * var(--ui-scale));   /* ← clamp(12px, 11.364px + 0.17vw, 12.667px) */
--text-sm:  calc(13px * var(--ui-scale));   /* ← clamp(13px, 12.364px + 0.17vw, 13.667px) */
--text-base: calc(14px * var(--ui-scale));  /* 段2 递减取消 → 全端恒定 14 */
```

**② `@media (width >= 768px)` 段2 块：删 4 行 + 改 4 行**

```css
/* 删除（不再需要段2 覆盖，恒定值已在 :root）：
   --text-2xs / --text-xs / --text-sm / --text-base 四行 */

/* 大四档：768 处=段1 末值（连续无跳变）→ 1440 命中标准档 → 冻结 */
--text-lg:  calc(clamp(15.333px, 14.5707px + 0.09926vw, 16px) * var(--ui-scale)); /* 15.333@768 → 16@1440 → 16 */
--text-xl:  calc(clamp(17.333px, 16.5707px + 0.09926vw, 18px) * var(--ui-scale)); /* 17.333@768 → 18@1440 → 18 */
--text-2xl: calc(clamp(22px, 23.4293px - 0.09926vw, 22.667px) * var(--ui-scale));  /* 22.667@768 → 22@1440 → 22 */
--text-3xl: calc(clamp(28px, 29.4293px - 0.09926vw, 28.667px) * var(--ui-scale));  /* 28.667@768 → 28@1440 → 28 */
```

> 斜率校验（`clamp` 在 768 处精确等于段1 末值，满足「768 连续」契约）：
> `14.5707 + 0.09926 × 7.68 = 15.333` ✅ ／ `14.5707 + 0.09926 × 14.4 = 16.000` ✅
> `23.4293 − 0.09926 × 7.68 = 22.667` ✅ ／ `29.4293 − 0.09926 × 14.4 = 28.000` ✅

**③ TV 块字号**：见 B5（TV 独立，不受本节影响）。

### 连带影响（必须一并验收）

| 影响项 | 变化 | 说明 |
| --- | --- | --- |
| `html` 根字号 | **不变**（B4 已解耦） | 这是 B4 必须先做的原因 |
| `--icon-xs` = `--text-2xs × 1.40` | 390：12.67 → **15.40（+21%）** | 图标随文字派生是项目既定契约；需目视检查极小图标（角标旁图标、时间戳图标） |
| `--icon-sm` = `--text-sm × 1.30` | 基本不变（13.03→13.00） | — |
| `--icon-md` = `--text-base × 1.43` | 1920：18.59 → **20.02（+7.7%）** | 导航 / 卡片图标统一变大，属预期（比例恒定） |
| 卡片标题、榜单行高 | 随 base/sm +1px 微增 | 列数、卡宽由 token 固定，不会重排；仅需看截断/跑马灯触发点 |

**遗留小项（低优先）**：移动端 390 处 `--text-lg`（14.05）≈ `--text-base`（14.00）—— 段1 起点同名值，是既有情形（非本方案引入）。可选微调 `--text-lg` 段1 MIN `14 → 15`（移动端 `text-lg` 文本 +1px），需先统计移动端 `text-lg` 消费点再决定。

### 验收

1. 探针复测 8 组视口 × 8 档，与上表逐值比对（容差 ±0.01px）。
2. 截图对比 6 页 × 3 端：确认无溢出、无意外截断、卡片行高无跳变。
3. `npm run test`（组件/单元）+ `npx playwright test`（E2E，TMDB Mock）通过。
4. Demo 对照页（B0-2）供你目视确认。

**风险**：**中**（全站排版密度变化，`--text-base` 在 1920 处 +1px、`--text-lg~3xl` 在 1440+ 提升 +7%~+15%）。**必须过 demo + build**。回滚：`git revert <b3-sha>`（B4 可保留）。

---

## 八、B5 TV 字号：10-foot UI 基线（P1-2）

**依据**：Android TV / Google TV 10-foot UI 通行实践 —— 正文 ≥18sp@1080p（舒适区间 18–24）、次要 ≥16sp、角标 ≥14sp、标题 24–36sp。原基线（正文 15 / 角标 11）低于下限，且继承了暗色 `tertiary #666`（2.87:1），3m 视距下不可读。

| token | 现（1080p / 4K） | 新（1080p / 4K） | 10-foot 依据 |
| --- | --- | --- | --- |
| `--text-2xs` | 11 / 22 | **14 / 28** | 次要信息下限 14sp |
| `--text-xs` | 13 / 26 | **16 / 32** | 列表 / 标签 16sp |
| `--text-sm` | 14 / 28 | **18 / 36** | 次要正文 18sp |
| `--text-base` | 15 / 30 | **20 / 40** | 正文 20sp（3m 视距） |
| `--text-lg` | 16 / 32 | **22 / 44** | 小标题 22sp |
| `--text-xl` | 18 / 36 | **24 / 48** | 区块标题 24sp |
| `--text-2xl` | 24 / 48 | **30 / 60** | 页面标题 30sp |
| `--text-3xl` | 30 / 60 | **36 / 72** | Hero 标题 36sp |

```css
/* [data-device="tv"] 块：改为 px 基准书写（rem 在 TV 下=15px，与设计假设不符）。
   严格遵循项目 TV 契约 clamp(A, (A/19.2)vw, 2A)：1080p=A、4K=2A、中间线性。 */
--text-2xs:  clamp(14px, 0.72917vw, 28px);
--text-xs:   clamp(16px, 0.83333vw, 32px);
--text-sm:   clamp(18px, 0.9375vw,  36px);
--text-base: clamp(20px, 1.04167vw, 40px);
--text-lg:   clamp(22px, 1.14583vw, 44px);
--text-xl:   clamp(24px, 1.25vw,    48px);
--text-2xl:  clamp(30px, 1.5625vw,  60px);
--text-3xl:  clamp(36px, 1.875vw,   72px);

/* 品牌文字同步（原 clamp(1.5rem, 1.25vw, 3rem) 在 TV 根字号 15px 下 = 22.5→45） */
--layout-brand-font-size: clamp(24px, 1.25vw, 48px);   /* 24→48 */
--layout-brand-font-size-lg: clamp(28px, 1.4583vw, 56px);
--layout-brand-font-size-sm: clamp(20px, 1.0417vw, 40px);
```

**为什么必须写 px 而非 rem**：TV 根字号被 B4 钉在 15px；若沿用 rem 写法，`1.25rem` 会渲染成 18.75px 而不是 20px，形成「文档值 ≠ 实测值」的第二次偏差。

**布局复核清单（TV 实机 / 1080p 模拟器）**：

| 项 | 检查点 |
| --- | --- |
| 卡片网格 | `--card-cols` 恒 8 不变；标题条高度随 base +33%，需确认是否挤压缩略号位置 |
| 频道列表 | `--layout-channel-group-w` = 162/324 是为「TV 文字 1.137× 桌面」实测标定的；文字档位提升后需重新量测（一级栏分类名是否仍放得下） |
| EPG / 节目单 | 时间列 `--layout-epg-time-min-width`=100 是否仍够 |
| 搜索框 | `--comp-input-height-tv` 58→116 与字号档无关，但标签字号变大需确认不溢出 |
| 焦点框 | 字号变大后 `--tv-focus-offset: 2px` 是否仍能看清；TV 焦点遍历（遥控器方向键）逐个确认 |
| 安全区 | `--safe-area-x/y` 默认 3vw/3vh 与设置页 `tvOverscan: 5` 的**文档不一致**（`variables.css:823` 注释称「与滑块默认 3 对齐」）→ 一并修正注释或统一取值 |

**风险**：**中高**（仅 TV 端；文字 +33% 会改变 TV 全站观感与截断）。**必须**：TV 实机或 1080p 模拟器回归 + demo + 你的目视确认。回滚：`git revert`（TV 块独立，回滚面小）。

---

## 九、B6 移动端：触摸目标 / 安全区 / 缩放（P1-4 其余）

### B6.1 触摸目标 ≥44px

| 目标 | 现值（390） | 目标 | 做法 |
| --- | --- | --- | --- |
| 封面/海报按钮 `--comp-btn-min-height` | **34.66px** | **44px** | 改 `:root` 曲线（见下）；孤立元素、无热区重叠问题 |
| 筛选 / 标签 chip `--comp-tab-height` | ≈28px | **≥36px** | 视觉略增高 + 保证行间距 ≥8px（满足 WCAG 2.5.8 AA 的 24px，并逼近 HIG） |
| `--tap-target: 44px` | 仅 1 处真实消费 | 全量接线 | 把散落的 44px 硬编码改为 `var(--tap-target)`（`grep -rn "44px" src --include=*.css`） |

```css
/* :root —— 390 处由 34.66 → 44（HIG 44×44pt / WCAG 2.5.5 AAA），
   768 处保持 51.333 连续，段2 递减曲线不变（48.212 仍 ≥44）。 */
--comp-btn-min-height: calc(clamp(44px, 36.434px + 1.94vw, 51.333px) * var(--ui-scale));
/* 校验：390 → 36.434 + 7.566 = 44.00 ✅ ／ 768 → 36.434 + 14.899 = 51.33 ✅ */

--comp-tab-height: calc(clamp(36px, 18.545px + 4.479vw, 38.667px) * var(--ui-scale));
/* 校验：390 → 18.545 + 17.468 = 36.01 ✅ ／ 768 → 18.545 + 34.399 = 52.9 → 封顶 38.667 ✅（连续） */
```

> 注：`--comp-tab-height` 段1 封顶点 38.667 与现曲线相同，`390` 处的抬升只影响移动端。

### B6.2 安全区接线（重要：有连带效应）

| 步骤 | 内容 |
| --- | --- |
| ① `index.html:8` | viewport 改为 `width=device-width, initial-scale=1.0, viewport-fit=cover`（**同时移除** `maximum-scale=1.0, minimum-scale=1.0, user-scalable=no`，解除 WCAG 1.4.4 文本缩放 200% 的限制；合规替代是项目已有的应用内 `uiScale` 手动档，写入规范文档） |
| ② `Layout.css:231` `.mobile-tab-bar` | `height: calc(var(--layout-tabbar-height) + env(safe-area-inset-bottom))`；`padding-bottom: env(safe-area-inset-bottom)` |
| ③ 统一双实现 | `src/components/ui/TabBar.tsx:49` 已带 `env(safe-area-inset-bottom)`；`Layout.css` 的 `.mobile-tab-bar` 没有 → 两套实现必须收敛为一处（否则改一个漏一个） |
| ④ **连带回归（必须做）** | 加 `viewport-fit=cover` 后，现有 3 处 `env(safe-area-inset-*)`（Drawer / Player / 其它）**从恒 0 变为真实值** → 逐一检查是否与父容器 padding 叠加，出现「双份留白」。这是本次最容易漏的回归点 |
| ⑤ `--layout-page-min-height` | 其注释即「= 100dvh − header − tabbar − TV 安全区」，safe-area 生效后需复核该公式是否仍成立 |

### B6.3 验收

- 375 / 390 / 430 三档 + 真机（含刘海屏 / 手势条）目视；TabBar 不遮挡最后一个卡片、底部无白边。
- 触摸目标：DevTools 量 4 处主要按钮/芯片的命中盒 ≥44×44（chip 可 ≥36）。
- 缩放：pinch 至 200% 不丢内容（WCAG 1.4.4）；iOS 输入框聚焦不触发页面缩放（此前的 `maximum-scale=1` 已兜底，移除后需实测）。
- **风险**：中（安全区连带面广）。回滚：viewport 单独一行可即时回退。

---

## 十、B7 工程化收口（固化前 6 批成果）

### B7.1 对外规范文档

| 文件 | 内容 |
| --- | --- |
| `docs/design/BASELINE.md` | 一页表：文字四档 + 对比度契约、状态色双档、字号阶梯（含三端差异）、字重 / 行高 / 半径 / 层级 / 时长 token 清单、「只有禁用/占位/装饰可低于 4.5:1」红线 |
| `docs/design/a11y-CHECKLIST.md` | 提交前自查 8 条：对比度 ≥4.5、焦点可见且不被裁切、触摸目标 ≥44（移动）、减动效生效、安全区、200% 缩放、色义不歧义、图像替代文本 |
| `.gitignore` | 新增 `!docs/design/`（否则 `docs/*` 会把新文档全部忽略，白做） |

### B7.2 护栏（缺一不可，否则规范会再次漂移）

| 护栏 | 落点 | 说明 |
| --- | --- | --- |
| **修 `.stylelintrc.json` 的 duplicate key bug** | `.stylelintrc.json:186` 与 `:240` **两个同名 `declaration-property-value-disallowed-list`** → JSON 后者覆盖前者，`width/height: 100vw/100vh` 的禁令**实际已失效**。合并为一个对象 | 顺带把 `z-index` / `transition` 的裸数值禁令加进去 |
| 色值护栏 | `scripts/check-color-tokens.mjs` + `lint:all` | stylelint 的 `color-no-hex` **管不到 custom property 里的 hex**（`--color-x: #fff` 不是 `color:` 声明）→ 必须自研：扫 `--color-*: <hex>`，白名单放行 `variables.css` 与骨架内联样式 |
| ESLint 扩展 | `eslint-rules/no-hardcoded-colors.js` | 现仅查 `className`；扩展覆盖 `style={{}}` 对象值与 TS 常量对象（`Collections/index.tsx:69-78` 那类漏网之鱼） |
| 对比度巡检 | `scripts/design-audit.mjs` → 挂到 `lint:all` | 把附录 B 矩阵固化为断言：token 值一改就报错，防止「顺手调色」再次破坏可读性 |
| 死 token 巡检 | `scripts/find-dead-tokens.mjs` | 定义集合 − 引用集合（**必须同时扫 `.ts/.tsx`**，否则会误报内联消费的 token，如曾被误判的 `--sidebar-width`） |
| hover 触摸守卫 | 清单脚本 + 批量包裹 | 全仓 `:hover` 约 **330 条**，仅 3 文件带 `@media (hover: hover) and (pointer: fine)`。先产出「会产生粘滞观感」的 Top-N 清单（卡片 / chip / tab / 设置项 / 按钮），再逐条包媒体查询；新增护栏脚本检查未包裹的 `:hover`（白名单放行），禁止新裸 `:hover` |

### B7.3 基础 token 补全

```css
/* :root —— 字重 / 行高（行高必须单位数，stylelint 已禁 line-height 用 px） */
--fw-regular: 400;
--fw-medium: 500;
--fw-semibold: 600;
--fw-bold: 700;                          /* 现存 800×6 / 900×2 一次性收敛到 700 */
--lh-tight: 1.25;                        /* 标题 */
--lh-base: 1.5;                          /* 中文正文下限 */
--lh-relaxed: 1.75;                      /* 长段落 */

/* 层级：现有 60 个字面量（1…10000）先跑清单脚本，再按此 8 档收敛 */
--z-base: 1;
--z-sticky: 55;                          /* 沿用既有 55 */
--z-rail: 100;                           /* sidebar 100 / overlay 90 合并到本档 */
--z-popover: 200;                        /* 既有 --z-popover */
--z-sheet: 900;
--z-modal-overlay: 1000;                 /* 既有 */
--z-modal: 1001;                         /* 既有 */
--z-toast: 1100;
```

**落地节奏**：`--fw-*` / `--lh-*` **先定义 + 文档化**，再分批替换组件字面量；**不做全局 `body { line-height }`**（会一次性改变全站行高 → 大面积位移，风险不可控）。行高先用在信息密集组件（榜单简介、设置说明、详情简介）。`--lh-*` 与 Tailwind 的 `fontSize` lineHeight 配置（`tailwind.config.js:52-58`）对齐统一。

### B7.4 清理清单

| 项 | 规模 | 做法 |
| --- | --- | --- |
| 死 token | **50 / 290（17%）** | 先三类分拣：① 应接线（`--glass-*` 5 个：实际玻璃态是组件内硬编码 `backdrop-filter`，应改引用 token）② 应删除（`--dot-active-h` / `--card-size` / `--breakpoint-*` 等）③ 误判（内联消费）→ 再删 |
| 硬编码色 | CSS `#fff` 96 / `#000` 4 / `#00aeec` 4 / `#ffc107` 3 … + TSX 12 处 | 逐类换 token；`#fff` 需区分「反色文字」(`--color-text-inverse`) 与「图上白字」(`--color-on-image`)，不可盲替 |
| 滚动条语义错配 | `index.css:273` 用 `var(--space-xs)` 当滚动条宽（`--scrollbar-width` 反而是死 token） | 改回 `--scrollbar-width`，恢复语义 |
| 减动效注释与实现不符 | `animations.css:414` 全局 `*` 压缩一切动画，注释却称「保留 loading spinner」 | 二选一：改注释，或加 `:not()` 豁免清单保留骨架扫光/加载态 |
| 过扫默认值不一致 | `variables.css:823` 注释「与滑块默认 3 对齐」，实际 `useSettingsStore.ts:91` = 5 | 统一取值并修正注释 |

---

## 十一、验收总表

| 批次 | 验证命令 / 手段 | 通过标准 | 风险 | 回滚 |
| --- | --- | --- | --- | --- |
| B1 色彩 | 对比度脚本 + 6 页 ×2 主题截图 | 附录 B 全绿（除 disabled） | 低 | `git revert` |
| B2 焦点 | Tab 遍历 8 页 + 鼠标点击 | 焦点框可见/不被裁切；鼠标无残留框 | 低 | `git revert` |
| B4 根字号 | 探针复测 8 组视口 rem 类 token | 与基线**逐值相同** | 低 | `git revert` |
| B3 字号 | 探针 8×8 + 截图 + `npm run test` + E2E | 与 §七 表逐值一致；无溢出 | 中 | `git revert`（B4 保留） |
| B5 TV | 1080p/4K 实测 + TV 焦点遍历 | 与 §八 表一致；卡片/频道/EPG 不溢出 | 中高 | `git revert` |
| B6 移动端 | 375/390/430 + 真机 | 命中盒 ≥44；TabBar 不遮挡；200% 缩放不丢内容 | 中 | 分批 revert |
| B7 工程化 | `npm run lint:all`（含 css + build） | 0 error；巡检脚本全绿 | 低 | `git revert` |

**每批固定动作**：改码 → `npm run build` → commit（tag）→ 探针/截图验收 → 写 `changelogs/_pending/` 片段 → 观感类改动附 demo。**push 前**再按 `AGENTS.md` 做一次知识提炼（跨会话结论 → `docs/`，个人细则 → `.workbuddy/memory/ref-*.md`）。

---

## 十二、仍需你确认的 5 项（全部附推荐，未确认不阻塞 B1/B2/B4）

| # | 事项 | 推荐 | 影响 |
| --- | --- | --- | --- |
| 1 | 正文字号取 **14px** 恒定（本方案）还是 15/16px？ | **14px**（Ant Design 5 / TDesign / B站正文口径，改动面最小；15/16px 会让全站卡片文本密度整体变松，需重跑列数/截断回归） | 影响 §七 全表 |
| 2 | 大四档（lg~3xl）在 1440+ 提升 +7%~+15%（16/18/22/28） | **接受**（大屏标题偏小是现状问题；需 demo 目视） | Hero / 区块标题观感 |
| 3 | `--color-action-blue` 走方案 A（保青蓝底 + 深色图标）还是 B（底色加深） | **A**（品牌色零改动，只改前景色） | 首页浮层刷新按钮 |
| 4 | 移动端 `--comp-btn-min-height` 34.66 → 44（封面按钮视觉变高） | **接受**（HIG 44pt，孤立元素无热区冲突） | 移动端封面按钮观感 |
| 5 | 移除 `user-scalable=no / maximum-scale` 并加 `viewport-fit=cover` | **接受**（WCAG 1.4.4；已有应用内 `uiScale` 作合规替代）；代价是必须完成 §B6.2 ④ 的 3 处 `env()` 连带回归 | 移动端全站 |

---

## 附录 A：探针与审计脚本

```js
// scripts/design-probe.mjs —— 8 组视口 × token 解析值（注入源 CSS，不用 page.goto）
// ① 读 variables.css + index.css 原文 → ② page.setContent(<html><style>源 CSS</style>…) 
// ③ 逐视口 + [data-device] + [data-theme] 组合，量 token：
const probe = (k) => {
  const el = document.createElement('div');
  el.style.fontSize = `var(${k})`;
  document.documentElement.appendChild(el);
  return getComputedStyle(el).fontSize;
};
// 组合矩阵：390/768/1024/1440/1920/2560 × ['', 'mobile-web', 'tv'] × ['light', 'dark']
```

```js
// 对比度（WCAG 2.2 相对亮度）—— 已用于本方案全部数值
const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
```

---

## 附录 B：达标矩阵（实测，本方案全部取值的依据）

**浅色（底 `#fff` / `#f5f5f5`）**

| 组合 | #fff | #f5f5f5 | 判定 |
| --- | --- | --- | --- |
| 主 `#000` | 21.00 | 19.26 | ✅ |
| 次 `#666` | 5.74 | 5.27 | ✅ |
| 辅助 `#6b6b6b`（新） | **5.33** | **4.89** | ✅ |
| 辅助 `#999`（旧） | 2.85 | 2.61 | ❌ |
| 禁用 `#bfbfbf` | 1.84 | 1.69 | 允许（仅禁用/占位） |
| success-text `#237804` | 5.59 | 5.12 | ✅ |
| warning-text `#a05c00` | 5.22 | 4.78 | ✅ |
| error-text `#cf1322` | 5.57 | 5.11 | ✅ |
| info-text `#0958d9` | 6.16 | 5.65 | ✅ |
| success `#52c41a`（fill） | 2.27 | 2.08 | 仅装饰填充 |
| warning `#fa8c16`（fill） | 2.38 | 2.18 | 仅装饰填充 |
| error `#ff4d4f`（旧） | 3.27 | 3.00 | 已被 `#cf1322` 取代 |
| action-blue `#00aeef` + 白 | 2.53 | — | ❌（黑字 8.30 ✅ → 方案 A） |
| border `#d9d9d9` | 1.41 | 1.29 | 装饰可、控件边界不足 |
| border-light `#e8e8e8` | 1.23 | 1.12 | 装饰 |

**暗色（底 `#1f1f1f` / `#141414`）**

| 组合 | #1f1f1f | #141414 | 判定 |
| --- | --- | --- | --- |
| 主 `#fff` | 16.48 | 18.42 | ✅ |
| 次 `#a0a0a0` | 6.30 | 7.04 | ✅ |
| 辅助 `#8c8c8c`（新） | **4.90** | **5.48** | ✅ |
| 辅助 `#666`（旧） | 2.87 | 3.21 | ❌ |
| 禁用 `#5a5a5a` | 2.39 | 2.67 | 允许 |
| success-text `#73d13d` | 8.57 | 9.58 | ✅ |
| warning-text `#d89614` | 6.51 | 7.27 | ✅ |
| error-text `#ff7875` | 6.43 | 7.19 | ✅ |
| info-text `#3c9ae8` | 5.48 | 6.12 | ✅ |
| error `#d32029`（旧） | 3.15 | 3.52 | ❌ → 已提亮 |
| info `#177ddc`（旧） | 3.93 | 4.39 | ⚠️ → 已提亮 |
| border `#363636` | 1.36 | 1.52 | 装饰 |

**白字 on 角标底**：`#237804` 5.59 ✅／`#a05c00` 5.22 ✅／`#cf1322` 5.57 ✅／中性玻璃 `rgba(0,0,0,.6)` 最坏 **5.74** ✅

---

## 附录 C：文件改动清单汇总

| 文件 | 批次 | 改动性质 |
| --- | --- | --- |
| `src/assets/styles/variables.css` | B1 / B3 / B4 / B5 / B6 / B7 | 文字四档、状态色双档、字号阶梯、`--root-font-size` 新增、TV 字号、触摸目标、字重/行高/层级 token |
| `src/assets/styles/index.css` | B1 / B2 / B7 | `.badge-chip` 新增、非 TV 焦点环恢复、滚动条宽度语义修正、减动效豁免 |
| `src/components/VideoCard/VideoCard.css` | B1 | 角标/状态徽标换 `.badge-chip` + `--color-*-text` |
| `src/components/Layout/Layout.css` | B6 | `.mobile-tab-bar` 安全区 |
| `src/components/ui/TabBar.tsx` | B6 | 与 Layout 侧收敛为单一安全区实现 |
| `src/pages/Collections/index.tsx`、`src/pages/History/index.tsx` | B1 | 硬编码状态色换 token |
| `src/components/UniversalPlayer/IPTVOSDBar.css` | B1 | OSD 灰阶换 token |
| `index.html` | B6 | viewport：`viewport-fit=cover`，移除缩放禁令 |
| `.stylelintrc.json` | B7 | **修复 duplicate key**（`100vw/100vh` 禁令失效）+ 新增 z-index / transition / hover 守卫 |
| `eslint-rules/no-hardcoded-colors.js` | B7 | 覆盖 `style={{}}` 与 TS 常量 |
| `scripts/design-audit.mjs`、`design-probe.mjs`、`find-dead-tokens.mjs`、`check-color-tokens.mjs` | B7 | 新增巡检脚本（挂 `lint:all`） |
| `docs/design/BASELINE.md`、`a11y-CHECKLIST.md` | B7 | 新增规范文档 |
| `.gitignore` | 本轮 / B7 | `!docs/DESIGN-PLAN-*.md`、`!docs/design/` |
| `changelogs/_pending/*.md`、`changelogs/demos/*.html` | 每批 | 留痕 + 观感 demo |

---

**编写**：AI 设计实施规划（WorkBuddy）
**依据**：`docs/DESIGN-REVIEW-2026-09-15.md` 实测数据 + 用户 2026-09-15 拍板（① / ② / ③）
**数值来源**：本方案全部对比度与字号读数均由脚本按 WCAG 2.2 公式与项目 clamp 曲线重算，非估算。
