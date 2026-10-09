---
date: 2026-09-30 02:07
module: CSS 约定（去卡片化生效范围）
type: docs
build: pass
files:
  - docs/agents/css-layout-conventions.md
---

# 登记约定：去卡片化只做桌面，移动端保留卡片

## 需求

用户 2026-09-30：「还有一件事，去卡片化样式，移动端不改」。经确认口径为
**「仅登记约定、不改码」**，且 `Settings` 移动分支的既有去卡**保持现状**。

## 核查（全站去卡档实测）

按 `@media` 帧栈解析全部 `src/pages/*/*.css`，筛四条去卡声明
（`border:none` / `border-radius:0` / `box-shadow:none` / `background(-color):transparent`），得到现状：

| 页面 | 去卡所在档 | ≤767 移动 web |
| --- | --- | --- |
| Chart / Detail(第二批) / Home / ProxySetup / SourceChecker / History(时间轴) | `@media (width >= 768px)` + `:not(app):not(tv)` | 保留卡片 |
| Browse | `≥768`（双卡 chrome）+ `≥1024`（结果卡） | 保留卡片 |
| Person | `≥1024` + `:not(app):not(tv)` | 保留卡片 |
| Settings（桌面批） | `≥768` + `:not(app)` | 保留卡片 |
| **Settings（移动 / App 分支）** | `width <= 767px` **与** `html[data-device="app"]` | **section 已是去卡态**（2026-09-08 起该页移动设计：整页一张卡、section 靠分割线/留白、`list-item` 各自成卡） |
| IPTV | 类名 `.iptv-page--rail`（JS `isDesktopRail`，非媒体查询） | 保留卡片 |

→ 除 Settings 移动分支（属该页移动设计，非桌面去卡）外，去卡块**全部从 768 起且排除 app/tv**，
`≤767` 本就未被改。唯一灰区 = **768–1023**（`useIsMobile()`=≤1023 判「移动」，而 CSS 去卡已生效）。

## 改动

`docs/agents/css-layout-conventions.md` 新增 **§12 去卡片化（de-card）生效范围**：

- 铁律 + 标准写法（基础规则保留四件套，另加 `@media (width>=768px){ html:not([data-device="app"]):not([data-device="tv"]) … }` 覆盖块）；
- 生效档：`≥768` 起，`≤767` / `app` / `tv` 恒保留；
- 例外 1：Settings 移动与 App 分支的 section 去卡属该页移动设计，不要顺手还原；
- 例外 2：IPTV 走 `.iptv-page--rail` 类名，天然隔离；
- 灰区 768–1023 已确认不处理（用户选择只登记、不抬档到 1024）；
- 反面清单：改基础规则 / 漏 `:not(app)` / 挂 `≤767` 档 = 回归。

同步落个人记忆：`.workbuddy/memory/ref-css-layout.md`（细则 + 可复用扫描手法）、
`.workbuddy/memory/MEMORY.md`（一行不变量）。

## 验证

- 纯文档改动（无 `src/` 代码变更）→ 不涉及构建与用例映射；`git status` 确认仅
  `docs/agents/css-layout-conventions.md` 由本轮修改。
- ⚠️ 该文件同时被**另一会话**持有未提交改动（同文件 `--history-cols` 段，L71 起）——
  本轮为**文件末尾新增 §12**，与其改动区不重叠；若对方以整文件覆写方式提交，§12 可能丢失，需复查。
- 未跑 E2E / 未跑截图脚本（红线）；未 commit（待用户确认）。
