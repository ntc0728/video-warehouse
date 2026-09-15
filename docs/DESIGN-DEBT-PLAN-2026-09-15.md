# 遗留债分析与整改方案（KinoTV · 2026-09-15）

> **上游**：《[设计规范审查报告](./DESIGN-REVIEW-2026-09-15.md)》→《[实施方案](./DESIGN-PLAN-2026-09-15.md)》
> **基线真源**：[`docs/design/BASELINE.md`](./design/BASELINE.md)、[`docs/design/a11y-CHECKLIST.md`](./design/a11y-CHECKLIST.md)
> **本文定位**：B1–B7 落地后剩余债务的**性质分析**与**分档整改方案**。不改代码，只定方案。
> **数据采集**：2026-09-15，基于 commit `6fe6728`。所有数字均为脚本实测，非估算。

---

## 0. 摘要

遗留债的原始命中数是 **2517 处**（stylelint 1617 + design-audit 897 + 本次新发现 3）。按性质拆开后：**823 处改配置即可消化（33%）**，1694 处需改代码且其中 92% 可自动或批量（1554 处），最终只剩 **140 处需人工逐条判断**。

| 性质 | 处数 | 处置 | 改代码? |
| --- | ---: | --- | --- |
| **A. 真 bug**（配置/注释说了但实现没做） | 8 | 逐个修 | ✅ 必改 |
| **B. 规则与架构冲突**（stylelint 落后于 B3/B5 重构） | 712 | 改规则清零 186 / 补 token 10 / 清真债 204 | ⚙️ 大半自动 |
| **C. 纯格式**（无行为影响） | 880 | `--fix` 批量 | ⚙️ 自动 |
| **E. 一致性债**（视觉/维护性） | 897 | 按模块分批，值不变 | ✅ 必改 |
| **F. 真冗余** | 20 | 逐条甄别 | ✅ 必改 |
| （叠加维度）**D. 沙盒孤岛** | 637 | **隔离**，不整改 | ❌ 不改 |

> D 不是独立的第六类，而是**叠加维度**：两个调研 demo 页贡献的 637 处（px 312 + hex 113 + 格式 212）**已分散计在 B / C / E 之中**。单列是因为它的处置方式与其他四类完全不同——**隔离**。

**结论**：债的主体不是"代码烂"，而是**三类错配**——① 规则没跟上架构重构；② 数字没跟上设计意图；③ 沙盒页没有隔离出验收范围。修完这三类，需人工判断的只剩 140 处（处置路径见文首漏斗）。

---

## 1. 债务全景：数字会骗人

### 1.1 分层总表

| 类 | 项 | 处数 | 代表证据 |
| --- | --- | ---: | --- |
| **A** | `--ui-scale` 同块重复定义 | 1 | `variables.css:757-758` |
| **A** | `tap-highlight-color` 无标准属性名 | 1 | `index.css:416` |
| **A** | TV `--header-height` / `--layout-logo-size` clamp 系数错误 | 2 | 实测偏差 −4.75px / −4px @1080p |
| **A** | `--layout-dropdown-max-h` 同类系数偏差 | 1 | 实测 374.39 / 748.80 |
| **A** | `declaration-property-value-keyword-no-deprecated` | 3 | `word-break: break-word` 已废弃 |
| **B** | `declaration-property-unit-disallowed-list`（禁 px） | 516 | 其中 312 属沙盒 → 真债 204 |
| **B** | `number-max-precision`（限 4 位小数） | 186 | 流体公式天然需要 5 位 |
| **B** | `letter-spacing`/`line-height`/`flex-basis` 的 px 值禁令 | 10 | 项目无对应 token，规则无解 |
| **C** | `order/properties-order` | 665 | 纯排序 |
| **C** | `declaration-block-single-line-max-declarations` | 141 | 单行多声明 |
| **C** | `at-rule-empty-line-before` / `custom-property-empty-line-before` / `order/order` | 36 | 空行与顺序 |
| **C** | `media-feature-range-notation` | 11 | `min-width:` → `width >=` |
| **C** | `property-no-vendor-prefix` / `selector-no-vendor-prefix` | 11 | 已有 autoprefixer |
| **C** | `color-hex-length` / `length-zero-no-unit` 等微格式 | 9 | 微格式 |
| **C** | `selector-class-pattern` / `function-url-quotes` | 7 | 类名 BEM 偏离 + 微格式 |
| **D** | PlayerLab + PlayerMobileLab 全部违规 | 637 | px 312 + hex 113 + 格式 212 |
| **E** | 裸 hex | 274 | 含沙盒 113 → 非沙盒 161（其中彩色仅 30） |
| **E** | fill 档语义色当文字色 | 48 | `--color-success` 等 4 档，`*-text` token 已全部就绪 |
| **E** | 裸 z-index | 125 | 值 ≥50 需迁移 23 处（含 modal 档 8）；值 <50 的 102 处按基线允许 |
| **E** | 字重 800/900 | 8 | `--fw-bold` 已就绪 |
| **E** | 内联 transition/animation 时长 | 442 | 5 档主流值 vs 3 个 `--dur-*` token |
| **E** | TV 块内 rem 写法（依赖根字号公式耦合） | 12 | 10 处"碰巧正确"，2 处已坏 |
| **F** | `no-duplicate-selectors` | 20 | 真冗余，需逐条甄别 |

> 合计 8 + 712 + 880 + 897 + 20 = **2517** ✓。其中「TV 块内 rem 写法」（12 处）位于 token 定义层（`variables.css`），`design-audit` 不扫 token 文件，故不计入上表 E 的 897（详见 §2.5 E6）。

### 1.2 三个反直觉的发现

**① 516 处裸 px 里，token 层是 0 处。**

| 层 | px 违规数 |
| --- | ---: |
| token / 基础层（`variables.css` / `skins.css` / `animations.css`） | **0** |
| 组件与页面层 | 516 |

B3/B5 重构时，token 内部的 px 全部写在 `clamp(...)` 表达式里（不触发规则），**架构是干净的**。违规全在消费侧。

**② 60% 的 px 债和 41% 的 hex 债来自两个"调研 demo 页"。**

| 文件 | px 违规 | hex 违规 | 定位 |
| --- | ---: | ---: | --- |
| `pages/PlayerMobileLab` | 157 | 65 | "移动端横屏/全屏/画中画整改 demo，不进入正式导航" |
| `pages/PlayerLab` | 155 | 48 | "播放器整改调研 demo，不进入正式导航" |
| **小计** | **312** | **113** | 占全部命中约 **25%**（含格式违规共 637 处） |

这两个页面是**设计方向验证沙盒**，其色板刻意偏离正式规范（B 站青蓝 `#00aeec`、TDesign 灰阶 `#646a73/#1f2329/#e5e6eb`）。它们的存在是合理的，**问题在于它们没有从 lint 范围里隔离出去**。

**③ 裸 hex 的病灶是"五套并行色板"，而不是"零星硬编码"。**

| 色板族 | 代表值 | 处数 | 来源 |
| --- | --- | ---: | --- |
| 媒体上的黑/白 | `#fff` 119 / `#000` 12 | 131 | 播放器、封面图、Hero 上的固定白字 |
| Tailwind 默认调色板 | `#ef4444` `#10b981` `#f59e0b` `#3b82f6` `#e11d48` … | ~30 | `var(--color-*, #fallback)` 的**半迁移残留** |
| TDesign / 播放器灰阶 | `#00aeec` `#646a73` `#1f2329` `#e5e6eb` | ~59 | PlayerLab 沙盒专属 |
| AntD 警示黄系 | `#ffe58f` `#ad6800` `#594214` `#332b00` | 6 | `IPTV.css` 单处自定义 alert |
| GitHub Dark 色板 | `#0d1117` `#30363d` `#8b949e` `#3fb950` | 7 | `ProxySetup.css` |
| 自研绿/红 | `#2bbf6a` `#3ecf8e` `#e5534b` `#2e9e5b` `#17a34a` `#e5484d` | ~17 | Detail 源检测/播放列表 |

**同一语义（"可用 = 绿"）项目里有 6 个不同的绿**：`#52c41a`(token) / `#10b981` / `#2bbf6a` / `#3ecf8e` / `#22c55e` / `#17a34a`。这是"用户看到颜色不一致"的根因。

**扣除沙盒后，彩色 hex 实际只有 30 处**——色板合并比想象中小得多。

---

## 2. 逐项分析

### 2.1 【A 类】真 bug —— 8 处，有明确对错

#### A1 `--ui-scale` 同块内重复定义，第一条永远失效

```css
/* variables.css:754-759 */
@media (width >= 1920px) and (resolution < 1.5dppx) {
  html:not([data-device="app"]):not([data-device="tv"]) {
    /* 静态回退：见上方「降级安全」说明，勿删 */
    --ui-scale: 1;
    --ui-scale: clamp(1, calc(0.76 + 0.000125 * tan(atan2(100vw, 1px))), 1.08);
  }
}
```

**根因**：作者意图是"不支持 `tan()`/`atan2()` 的浏览器回退到 `1`"。但 CSS 自定义属性在同一声明块内**后者无条件覆盖前者**——不存在"表达式解析失败则用上一条"的语义。所谓"静态回退"从未生效。

**行业标准做法**：用 `@supports` 显式分流。

```css
@supports (width: calc(1px * tan(atan2(1, 1)))) {
  html:not([data-device="app"]):not([data-device="tv"]) {
    --ui-scale: clamp(1, calc(0.76 + 0.000125 * tan(atan2(100vw, 1px))), 1.08);
  }
}
```

> 与 B7 挖出的 `.stylelintrc.json` 重复 key 属**同一类 bug**：**静默失效**——不报错、不崩溃，只是没按意图工作。建议把"同块内重复自定义属性"和"JSON 重复 key"都纳入 CI 检查。

#### A2 `tap-highlight-color` 不存在（缺 `-webkit-` 前缀）

```css
/* index.css:414-417 */
* {
  -webkit-tap-highlight-color: transparent;   /* ✅ 有效 */
  tap-highlight-color: transparent;            /* ❌ 标准里没有这个属性 */
}
```

**根因**：注释写"标准属性覆盖其余"，但该属性**从未进入标准**，只有 `-webkit-` 形式。第二行是死代码。

**处置**：删除第二行（保留 `-webkit-` 形式并加注说明）。

#### A3 TV 两个尺寸 token 的 clamp 系数错误（**实测确证**）

```css
/* variables.css:964-967 */
--header-height:    clamp(4.75rem, 0.2474vw, 9.5rem);   /* 注释：76→152 */
--layout-logo-size: clamp(4rem,    0.2083vw, 8rem);     /* 注释：64→128 */
```

**实测**（Playwright 注入源 CSS，`data-device="tv"`）：

| token | 视口 | 实测 | 注释宣称 | 偏差 |
| --- | --- | ---: | ---: | ---: |
| `--header-height` | 1080p | **71.25px** | 76px | **−4.75px** |
| `--header-height` | 4K | **142.50px** | 152px | **−9.50px** |
| `--layout-logo-size` | 1080p | **60.00px** | 64px | **−4.00px** |
| `--layout-logo-size` | 4K | **120.00px** | 128px | **−8.00px** |

**根因**：TV 根字号是 `clamp(15px, 0.78125vw, 30px)`（1080p = 15px，不是 16px）。作者把「76px ÷ 16 = 4.75」当成 rem 值写进 min，又把 mid 误算成 `0.2474vw`（1920 下仅 4.75px，**远小于 min**）→ `clamp(min, mid, max)` 恒返回 `min`，即 `4.75rem × 15px = 71.25px`。

**对照组**：B5 已改为 px 写法的 `--layout-brand-font-size: clamp(24px, 1.25vw, 48px)` 实测 **24 / 48px 精确命中** ✓。证明 px 写法是正确的方向，`--header-height` / `--layout-logo-size` 是 B5 的**遗漏项**。

**正确写法**（对齐 B5 契约 `clamp(A, (A/19.2)vw, 2A)`）：

```css
--header-height:    clamp(76px, 3.9583vw, 152px);
--layout-logo-size: clamp(64px, 3.3333vw, 128px);
```

**视觉影响**：TV 端导航栏矮 4.75px、logo 小 4px——用户可直接感知。

#### A4 `--layout-dropdown-max-h` 精度偏差 0.39px（轻微）

实测 374.39 / 748.80 vs 注释 374 / 748。mid 系数 `19.5vw` 反算误差，量级 <1px，**不构成视觉问题**，但属同类"注释 ≠ 实测"。顺手在同批修正为 `clamp(374px, 19.4792vw, 748px)`。

---

### 2.2 【B 类】规则与架构冲突 —— 712 处，应改规则而非改代码

#### B1 stylelint 禁止布局 px（516 处），但项目架构就是 px 基准

当前配置：

```json
"declaration-property-unit-disallowed-list": [{
  "font-size":["px"], "padding":["px"], "gap":["px"], "width":["px"],
  "height":["px"], "border-radius":["px"], "top":["px"], ...
}, { "severity": "error" }]
```

**冲突点**：B3/B5 之后，项目的 token 定义**统一用 px 基准的 clamp**（如 `--space-xs: clamp(...)`、TV 契约 `clamp(A, (A/19.2)vw, 2A)` 里 A 必须是 px）。规则却把"布局属性出现 px"一律判错。

**但要区分两种子情况**：

| 子情况 | 处数 | 判定 |
| --- | ---: | --- |
| 沙盒页（PlayerLab / PlayerMobileLab） | 312 | **隔离**，不参与验收 |
| 组件/页面消费层直接写裸 px | 204 | **真债**，应改 token |

**结论**：规则**方向正确、不该放宽**——组件层消费 token 是行业标准（ITCSS/OOCSS 分层：组件不定义视觉常量）。只是要先把沙盒隔离，再把 204 处真债按文件清零。

**例外**：`letter-spacing` / `line-height` / `flex-basis` 的 px 被 `declaration-property-value-disallowed-list` 单独禁止（10 处），而项目**没有对应 token 可用**：

| 处 | 位置 | 应有 token |
| --- | --- | --- |
| `letter-spacing: 0.2px` `1px` | `skins.css:130,224`、`PlayerLab.css:90` | 需新增 `--ls-tight/normal/wide` |
| `line-height: 18px` | `Chart.css:250` | 应改 `--lh-*` 或比例值 |
| `flex-basis: 112px` ×6 | `Chart.css` 骨架 | 需组件级 token |

→ **规则合理，但缺 token 供给**。属"先补 token 再清债"。

#### B2 `number-max-precision: 4` 与流体公式冲突（186 处）

流体 clamp 公式天然产生 5 位小数（`0.52289`、`2.52289`、`0.12723`…），当前规则限 4 位 → 186 处全在 `variables.css`。

**行业标准**：stylelint 该规则**官方默认值就是 5**。本项目被手动收紧到 4，无收益（4 位与 5 位的渲染差异远低于亚像素）。

**处置**：恢复为 `5`。这是**唯一一处"改规则即清零 186 处"**的高杠杆项。

#### B3 前缀规则（11 处）与 autoprefixer 冲突

`postcss.config.js` 已配置 `autoprefixer`，但源码仍手写 `-webkit-` / `-moz-`（`property-no-vendor-prefix` 10 处 + `selector-no-vendor-prefix` 1 处）。

**行业标准**：配置 autoprefixer 后，源码**不应**手写前缀（Autoprefixer README 明确说明）。

**处置**：删除手写前缀。**前置**：`package.json` 缺 `browserslist` 字段——autoprefixer 当前走默认目标（`>0.5%, last 2 versions, Firefox ESR, not dead`）。应显式声明目标（含 Android TV / WebView 对应版本），再删前缀，否则产出目标不可控。

---

### 2.3 【C 类】纯格式噪音 —— 880 处，其中 668 处 `--fix` 可解

| 规则 | 处数 | 可否自动修 |
| --- | ---: | --- |
| `order/properties-order` | 665 | ✅ `--fix` |
| `declaration-block-single-line-max-declarations` | 141 | ⚠️ 需人工（换行） |
| `at-rule-empty-line-before` | 27 | ✅ `--fix` |
| `media-feature-range-notation` | 11 | ✅ `--fix` |
| `property-no-vendor-prefix` / `selector-no-vendor-prefix` | 11 | ✅ 删前缀（见 B3） |
| `order/order` | 6 | ✅ `--fix` |
| `custom-property-empty-line-before` | 3 | ✅ `--fix` |
| `color-hex-length` / `length-zero-no-unit` / `shorthand-property-no-redundant-values` / `declaration-block-no-redundant-longhand-properties` | 9 | ✅ `--fix` |
| `selector-class-pattern` / `function-url-quotes` | 7 | ⚠️ 需人工（命名） |

**注意**：`--fix` 会大范围重排属性顺序。需 ① 先在沙盒隔离之后跑（否则改动量翻倍）；② 单文件粒度提交，便于 review 与回滚。

---

### 2.4 【D 类】沙盒孤岛 —— 637 处，隔离而非整改

`PlayerLab` / `PlayerMobileLab` 在 `routeConfig.ts` 里被明确注明"不进入正式导航"。它们的存在价值是**验证播放器交互方向**，色板刻意与正式规范不同。

**处置（行业标准做法）**：把 demo/沙盒从 lint 与验收范围排除，而不是强行让它们符合生产规范。

三种方案：

| 方案 | 做法 | 评价 |
| --- | --- | --- |
| **D-a 配置排除**（推荐） | `.stylelintrc.json` 加 `ignoreFiles`；`design-audit.mjs` 加 `EXCLUDE` | 一处配置，最清晰 |
| D-b 文件头豁免 | 每文件加 `/* stylelint-disable */` | 分散，易被误删 |
| D-c 归档/删除 | 移出 `src/` | 若方向已验收通过则最优 |

**关键**：若将来它们要"转正"，则需在转正时**补齐规范**——排除不等于豁免债务，只是把它移出当前验收口径。

---

### 2.5 【E 类】一致性债

#### E1 裸 hex（161 处，非沙盒）

细分：**黑白 131 处 + 彩色 30 处**。

**黑白（`#fff` / `#000`）** —— 主要来自播放器、封面图、Hero 上的固定白字。这类颜色**不应随主题翻转**（在视频画面上的白字，浅色主题下也得是白的）。当前只有 `--player-text-secondary/tertiary`，缺主档。

**处置**：新增媒体上下文 token 族：

```css
--color-on-media:        #fff;   /* 媒体/深底上的主文字 */
--color-on-media-muted:  rgba(255, 255, 255, 0.86);
--color-media-scrim:     rgba(0, 0, 0, 0.6);   /* 与 .badge-chip 底一致 */
```

> 与 `.badge-chip` 的"中性深玻璃底 + 白字"是同一原理：**媒体上下文的颜色必须与主题解耦**。

**彩色（30 处）** —— 按色板族收敛到既有 `--color-*` 或补语义 token。五套并行色板 → 一套。

**特别标注**：`var(--color-error, #ef4444)` 这类**带 fallback 的半迁移写法**共 ~30 处。fallback 值是 Tailwind 默认调色板残留，**实际永远不会被用到**（token 一定存在），属纯噪音 → 直接删除 fallback 部分。

#### E2 fill 档语义色当文字色（48 处）

`--color-success/warning/error/info` 是**填充档**，在白底上对比度仅 2.27–4.10:1（低于 WCAG 2.2 AA 正文 4.5:1）。

**好消息**：`--color-*-text` 四档**已在 variables.css 全部就绪**（浅色 + 暗色两套），替换是**零成本批量操作**。

```
var(--color-warning)  →  var(--color-warning-text)
var(--color-error, #ef4444)  →  var(--color-error-text)
```

**需甄别**：深色播放器上下文中的少数用法（如 `UniversalPlayer.css:751`）。这类应换**暗色档** `--color-*-text`（它们在暗底上对比度达标）——语义一致，无需例外。

#### E3 裸 z-index（23 处，值 ≥50）

B7 已迁移 29 处页级浮层，剩 23 处：

| 值 | 处数 | 判定 |
| --- | ---: | --- |
| `1000` / `1001` | 8 | modal 档，**应迁移**到 `--z-modal-overlay` / `--z-modal` |
| `60` `65` `70` `80` `95` | 15 | 夹在 `--z-fixed(55)` 与 `--z-overlay(100)` 之间的野生档位 |

**注意**：`60-95` 这组说明有人需要"比固定导航高、比页级覆盖层低"的层——**当前 ladder 缺这一档**。应先判断它们的语义：
- 若是"局部浮层" → 归 `--z-float(90)`
- 若是"需要压住固定导航的临时态" → 需新增 `--z-fixed-raised(60)` 档

**其余 102 处（值 <50）**按 BASELINE 属"组件内局部层叠"，**允许字面量**，不动。

#### E4 字重 800/900（8 处）

`skins.css:63`(900)、`AppLoading.css:71,247`(800/900)、`HeroBanner.css:301`(800)、`HeroBili.css:158`(800)、`StickyHeader.css:130`(800)、`PlaylistModal.css:72,313`(800)。

`--fw-bold: 700` 已就绪。**在 4 个字重档的体系里，800/900 是伪档**——中文字体多数在 700 已是 max weight，800/900 会被静默回落到 700 或触发伪粗体（`text-stroke` 模拟，笔画变形、可读性下降）。

**处置**：全部收敛到 `var(--fw-bold)`。**视觉确认**：需检查这 8 处是否依赖伪粗体的"更黑"效果。

#### E5 内联时长（442 处）—— 本类最大单项

| 时长值 | 处数 | 现有 `--dur-*` |
| --- | ---: | --- |
| `0.2s` | 92 | ❌ 无对应（`--dur-base` 是 250ms） |
| `0.15s` | 83 | ≈ `--dur-fast`（150ms） |
| `0.18s` | 33 | ❌ |
| `0.3s` | 31 | ❌ |
| `0.25s` | 25 | = `--dur-base` |
| 其余 20+ 档 | 178 | ❌ |

**问题**：项目实际有 **5 档主流时长**（0.15/0.18/0.2/0.25/0.3），但只有 **3 个 token**。直接替换会**改变观感**（0.2s → 0.25s 是可感知的变慢）。

**行业标准**：动效时长应成"档位体系"（Material Design 用 100/150/200/250/300ms 五档；AntD 用 100/200/300ms 三档）。

**处置（两步）**：
1. **先扩 token 到 5 档**：`--dur-fastest: 150ms` / `--dur-fast: 180ms` / `--dur-base: 200ms` / `--dur-slow: 250ms` / `--dur-slower: 300ms`（**值与现有主流值一一对应 → 零观感变化**）
2. 再逐文件机械替换 442 处

> 关键：**token 值必须从既有代码反推，不能从"标准推荐"正向设计**——否则全站动效节奏会集体变。

#### E6 TV 块内 rem 写法（12 处）—— 脆弱但多数不破

TV 块（`variables.css` `[data-device="tv"]`）内 12 个 token 用 rem 书写（`clamp(3.75rem, 3.125vw, 7.5rem)`）。实测结果：

| 状态 | 处数 | 说明 |
| --- | ---: | --- |
| 碰巧正确（mid 落在 clamp 范围内） | 10 | 结果与 px 写法一致，但**依赖 TV 根字号公式** |
| 已坏（mid 系数算错，恒取 min） | 2 | `--header-height` / `--layout-logo-size`（见 A3） |

**风险**：rem 写法把"尺寸"与"根字号公式"**隐式耦合**——任何人改 TV 根字号，这 12 个 token 会**静默改变**，而注释不动（正是 A3 与 `--layout-brand-font-size` 历史漂移的成因）。

**处置**：全部改回 px 基准的 clamp（与 B5 的 `--layout-brand-font-size` 同款），消除耦合。**值不变**（10 处）+ **修正值**（2 处）。

---

### 2.6 【F 类】真冗余

#### F1 `no-duplicate-selectors`（20 处）

分两种：

| 类型 | 例 | 判定 |
| --- | --- | --- |
| **真冗余**（相邻两条同选择器可合并） | `CategoryQuickAccess.css:399/409`、`Settings.css:1781/1791`、`HeroBanner.css:449/462` | 合并 |
| **分节追加**（同选择器出现在不同小节，如 `:root` 在 37 与 1124 行） | `variables.css:1124`、`index.css:920/950` | **保留**（分节是刻意的），加注释说明 |

**处置**：逐条甄别，只合并真冗余。**不要盲改**——`index.css:414` 的 `*` 重复涉及 A2 修复。

---

## 3. 行业标准对照

| 判定项 | 依据 |
| --- | --- |
| fill 档不得承载文字（对比度 2.27–4.10 不达 AA 4.5:1） | WCAG 2.2 §1.4.3 / §1.4.11 |
| 组件层不定义视觉常量，只消费 token | ITCSS / OOCSS 分层原则 |
| token 三层：primitive → semantic → component | W3C DTCG（Design Tokens Community Group） |
| 字重档位收敛（避免 800/900 伪粗体） | Material Design 3 typography scale |
| 动效时长成档（100/150/200/250/300ms） | Material Design motion / AntD motion |
| 流体尺寸用 `clamp(A, (A/19.2)vw, 2A)`，A 为 px | 本项目 TV 契约（B5 定稿，实测验证） |
| `number-max-precision` 默认 5 | stylelint 官方默认值 |
| 配置 autoprefixer 后不手写前缀 | Autoprefixer README |
| 必须先声明 `browserslist` 再删前缀 | Browserslist best practice（否则产出目标不可控） |
| `overflow-wrap: break-word` 替代 `word-break: break-word` | MDN（后者已废弃） |
| `-webkit-tap-highlight-color` 是唯一有效形式 | MDN（无标准属性） |
| `clamp(min, val, max)` = `max(min, min(val, max))` | CSS Values 4 —— 精度的语义基础 |
| 媒体上下文颜色与主题解耦 | Material Design "surface on media" / iOS HIG vibrancy |
| demo/沙盒排除出 CI 验收范围 | 业界通用（storybook / sandbox 独立 lint 配置） |

---

## 4. 整改方案

### 4.1 批次依赖图

```
D0 规则校准 ──┬─→ D1 沙盒隔离 ──┬─→ D3 格式自动修复 ──→ D7 冗余清理
              │                  │
              └─→ D2 真 bug 修复 ┴─→ D4 色板收敛 ──→ D5 逐页一致性 ──→ D6 时长 token 化
```

**D0 必须最先**：规则不校准，后续所有批次的"新增违规"判定都会失真，且 `lint:css` 持续全红意味着 CI 完全无法守门。

### 4.2 D0 — 规则校准（改配置，不改代码）

| 动作 | 文件 | 效果 |
| --- | --- | --- |
| `number-max-precision: 4 → 5` | `.stylelintrc.json` | **清零 186 处** |
| 新增 `--ls-*` 字距 token、`--lh-*` 复用、Chart 骨架尺寸 token | `variables.css` | 为 10 处 value 禁令提供出路 |
| 补 `browserslist` 字段（含 Android TV / WebView） | `package.json` | 为 D3 删前缀铺路 |
| 规则分层：token 层 vs 组件层（`overrides`） | `.stylelintrc.json` | 层语义显式化 |

**验收**：`npx stylelint` 违规数 **1617 → 1431**（−186，且剩余均为"真需改代码"项）。

### 4.3 D1 — 沙盒隔离（改配置）

| 动作 | 文件 |
| --- | --- |
| `ignoreFiles` 增加 `src/pages/PlayerLab/**`、`src/pages/PlayerMobileLab/**` | `.stylelintrc.json` |
| `design-audit.mjs` 增加 `EXCLUDE_DIRS` 常量（与上者同源） | `scripts/design-audit.mjs` |
| 两文件头加注释说明"调研 demo，不参与规范验收" | `PlayerLab.css` / `PlayerMobileLab.css` |

**验收**：两处排除在报告外，stylelint 违规 **1431 → 约 901**（沙盒自身贡献 530 处）；`design-audit` hex **274 → 161**、px **516 → 204**。

### 4.4 D2 — 真 bug 修复（4 处，人工）

| 项 | 文件 | 修法 |
| --- | --- | --- |
| A1 `--ui-scale` 重复 | `variables.css:757` | 改 `@supports` 分流 |
| A2 `tap-highlight-color` | `index.css:416` | 删无前缀行 |
| A3 TV `--header-height` / `--layout-logo-size` | `variables.css:965,967` | 改 `clamp(76px, 3.9583vw, 152px)` / `clamp(64px, 3.3333vw, 128px)` |
| A4 `--layout-dropdown-max-h` | `variables.css:981` | 改 `clamp(374px, 19.4792vw, 748px)` |
| （附）TV 其余 rem → px | `variables.css` TV 块 | 消除根字号耦合 |

**验收**：重跑 Playwright 探针，10 个 TV token 全部精确命中（偏差 <0.05px）。

### 4.5 D3 — 格式自动修复（`--fix`）

**顺序**：先 `order/properties-order` + `at-rule-empty-line-before` + `media-feature-range-notation` + `color-hex-length` + `length-zero-no-unit`（约 750 处自动）；再人工处理 `declaration-block-single-line-max-declarations`（141 处）；再删手写前缀（11 处）。

**约束**：单文件粒度提交；每批跑 `build`；`--fix` 后 diff 需 review 属性顺序是否引入语义变化（理论上不会）。

**验收**：违规数 **901 → 约 250**。

### 4.6 D4 — 色板收敛（30 处彩色 + 131 处黑白）

| 步 | 动作 |
| --- | --- |
| 1 | `variables.css` 新增 `--color-on-media` 族（`on-media` / `on-media-muted` / `media-scrim`） |
| 2 | 删除 `var(--color-*, #fallback)` 的 fallback 部分（~30 处，纯噪音） |
| 3 | 逐页把彩色 hex 收敛到 `--color-*`：GitHub Dark 7 → `ProxySetup` 专用 token；AntD 黄 6 → `--color-warning*`；自研绿红 17 → `--color-success-text` / `--color-error-text` |
| 4 | `#fff` 119 处按语义分流：媒体上下文 → `--color-on-media`；主题相关 → `--color-text-inverse` |

**验收**：`design-audit` hex 检查归零（沙盒除外）。

### 4.7 D5 — 逐页一致性（fill 48 + z-index 23 + 字重 8）

按文件批量：
- fill 误用：`CategoryQuickAccess`(7) / `SourceManager`(7) / `Settings`(7) / `Detail`(4) / `SourceChecker`(4) 优先
- z-index：`1000/1001` 8 处先迁；`60-95` 15 处先定语义再迁
- 字重：8 处 → `--fw-bold`（附视觉确认）

**验收**：`design-audit` 三项检查归零。

### 4.8 D6 — 时长 token 化（442 处）

1. 扩 `--dur-*` 到 5 档，值从既有主流值反推（零观感变化）
2. 逐文件替换；`--dur-*` 无法覆盖的（`1s` / `7s` / `1.5s` 等长时长）单独判断是"装饰循环"还是"功能性等待"

**验收**：`design-audit` timing 检查（enforce 转 true）新增违规归零。

### 4.9 D7 — 冗余清理（20 处）

逐条甄别真冗余 vs 分节追加。只合并前者。

---

## 5. 目标与验收

### 5.1 量级目标

| 指标 | 现状 | D0-D1 后 | D2-D3 后 | D4-D7 后 |
| --- | ---: | ---: | ---: | ---: |
| stylelint 违规 | 1617 | ~901 | ~250 | **0** |
| design-audit 违规 | 897 | 784 | 784 | **~10** |
| 真 bug | 8 | 4 | **0** | 0 |
| `lint:css` 状态 | 🔴 全红 | 🟡 | 🟡 | **🟢 绿** |

### 5.2 护栏演进

1. **stylelint 加基线棘轮**：与 `design-audit` 同机制（存量快照、只拦新增），让 CI 从"D0 起就可守门"
2. **`lint:all` 改为全跑不短路**：当前 stylelint 先失败会短路后续检查
3. **新增 CI 检查**：JSON 配置重复 key 检测（B7 与 A1 同类 bug 的根因）

### 5.3 明确不做

| 项 | 理由 |
| --- | --- |
| 整改 PlayerLab / PlayerMobileLab 的色板 | 刻意偏离的沙盒，隔离即可 |
| 把 `60-95` 的 z-index 强行归入现有档位 | 需先判语义，否则改变层叠行为 |
| 让 442 处时长全部走 3 个现有 token | 会改变全站动效节奏 |
| 触碰值 <50 的 z-index（102 处） | BASELINE 已明确允许（局部 stacking context） |
| 强行统一 TV 块 10 处"碰巧正确"的 rem | 无收益；随 D2 一并改是顺路，不单独立项 |

---

## 6. 建议执行顺序

**D0 → D1 → D2 → D3** 是"低风险高收益"的一段：全部是配置调整 + 自动修复 + 4 处人工修复，**不动业务视觉**，却能把违规从 1617 压到 ~250、并把 4 个真 bug 清零。

**D4 → D5 → D6 → D7** 是"视觉敏感"的一段，需要逐页 review 与对照 demo。

两步之间建议**打 tag**（如 `design-debt-d3`），便于回滚与对照。

---

**维护**：本文件随整改推进更新。每批完成后在 §5.1 表内回填实际数字。
