# 文档同步协议 · 协同开发 · .gitignore 策略

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

## 文档同步协议（AI Agent 必读）

> 完成代码变更后，逐项检查以下规则。满足条件的必须同步更新，不得跳过。

### 规则 1：测试脚本 — 与代码同提交

```
IF 你修改了 CSS 类名 / DOM 结构 / 选择器
THEN 同一次 commit 中更新 scripts/*.spec.ts 对应的选择器

IF 你新增了用户交互流程（新按钮、新 Tab、新模式）
THEN 新增对应的 E2E 测试用例

IF 你删除了某个 UI 区块（如 suggestions）
THEN 删除或重写依赖该区块的测试用例
```

**位置**: `scripts/*.spec.ts`  
**时机**: 必须与代码变更在同一个 commit 中

### 规则 2：改动留痕与知识分层 — 当天写片段，push 前提炼

```
IF 你完成了一处实质改动（修 bug、加功能、重构、技术选型）
THEN 写 changelogs/_pending/<YYYY-MM-DD-HHmm>-<slug>.md 片段
     （不要直接写当日 changelogs/YYYY-MM-DD.md，也不要把当日流水直接塞进 AGENTS.md / MEMORY.md）

IF 到了 push 代码前（或用户明确要求提炼时）
THEN 把当日片段里「跨会话仍然成立」的结论按主题归位：
     · 团队共享的架构 / 约定 / 根因  → docs/
     · 个人上下文的细则              → .workbuddy/memory/ref-*.md
     · 只有「不可协商的不变量」       → AGENTS.md / .workbuddy/memory/MEMORY.md
```

**位置**: `changelogs/_pending/`（当天流水）→ 合并后 `changelogs/YYYY-MM-DD.md`  
**时机**: 改动当天写片段；**push 前**做一次提炼  
**内容**: 做了什么 + 为什么这么做 + 踩了什么坑（不要写"搜索了XX文件"这种过程噪音）  
**禁止**: 把当日流水直接写进 `AGENTS.md` / `MEMORY.md`；把一次性细节、实测数值表、代码片段、历史演变过程塞进这两处（应下沉到 `docs/` 分片或 `ref-*.md`）

**配套约定（个人记忆层）**: 本地记忆为 **`MEMORY.md`（索引层，自动注入）+ `ref-*.md`（按需 Read 的细则）** 两层结构，`MEMORY.md` 只放不变量 + 指针；**待办清单整段替换前，必须先与用户确认上一版待办是否已完成**。

### 规则 3：知识库 — 架构变了才动

```
IF 新增了 Store / Service / 核心组件 / 页面路由 / 代理配置
THEN 更新 AGENTS.md 对应章节 + CONTEXT.md（如涉及新术语）

IF .gitignore 策略变化
THEN 更新 AGENTS.md ".gitignore 策略"章节
```

**位置**: `AGENTS.md`（综合）+ `CONTEXT.md`（术语）  
**时机**: 架构变更时  
**不更新**: Store 内部逻辑修改、组件 props 调整、CSS 微调

### 规则 4：页面原理图 — 布局结构变了才动

```
IF 页面布局结构变化（新增/删除区域、核心组件替换）
THEN 更新 docs/page-diagrams/<page>.html

IF 新增交互模式（如 toast.replace、懒加载策略变化）
THEN 在对应原理图的"交互"或"数据流"区追加说明

IF 新增页面
THEN 创建 docs/page-diagrams/<page>.html + 更新 index.html 索引
```

**位置**: `docs/page-diagrams/*.html`  
**时机**: 页面结构变更时  
**不更新**: 颜色、间距、内部逻辑优化

### 规则 5：流程图 — 导航/架构变了才动

```
IF 新增/删除页面（导航地图变）
THEN 更新 flowchart.html 的"页面导航地图"SVG

IF Store/Service 层新增/删除
THEN 更新 flowchart.html 的"数据流架构"SVG

IF 代理配置变化
THEN 更新 flowchart.html + AGENTS.md 代理表
```

**位置**: `docs/page-diagrams/flowchart.html`  
**时机**: 导航或架构变更时  
**不更新**: 页面内部变化、内部重构

### 快速判断表

| 变更类型          | 测试    | 留痕 / 提炼 | 知识库 | 原理图    | 流程图 |
| ------------- | ----- | ------- | --- | ------ | --- |
| CSS bug 修复    | —     | 片段      | —   | —      | —   |
| 类名/选择器变更      | ✅ 同提交 | 片段      | —   | —      | —   |
| 新增页面          | ✅     | 片段+提炼   | ✅   | ✅ 新建   | ✅   |
| 新增核心组件        | ✅     | 片段+提炼   | ✅   | ✅ 受影响页 | —   |
| 架构分层变化        | ✅     | 片段+提炼   | ✅   | ✅      | ✅   |
| 代理配置变化        | —     | 提炼      | ✅   | ✅      | ✅   |
| .gitignore 策略 | —     | 提炼      | ✅   | —      | —   |
| 新增领域术语        | —     | —       | ✅   | —      | —   |
| 内部重构（不改外部接口）  | ✅     | 片段      | —   | —      | —   |

> 「留痕 / 提炼」列 = 三层流程：**片段** = 改动当天写 `changelogs/_pending/`；**提炼** = push 前把跨会话结论归位到 `docs/` / `.workbuddy/memory/ref-*.md` / `AGENTS.md`（只收不变量）。

---


## 协同开发与知识库维护

> 多人协作时，AI 辅助工具（Cursor / Claude / Copilot 等）会在每位开发者机器上各自维护一份**本地记忆**。本节规定「哪些文件必须一致、哪些允许不同、冲突怎么办」，避免同事之间因本地文件不一致而踩坑。

### 两类文件的定位

| 类别                    | 文件                                                                                                                              | 是否提交                      | 协同策略                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- |
| **共享知识库（唯一事实源）**      | `AGENTS.md` `CLAUDE.md` `.cursorrules` `.github/copilot-instructions.md` `CONTEXT.md` `docs/page-diagrams/` `docs/KNOWLEDGE.md` | ✅ 提交（团队共享）                | 全队一致，靠 git + PR review 同步 |
| **本地 AI 记忆（个人上下文缓存）** | `.workbuddy/memory/`（`MEMORY.md` 索引层 + `ref-*.md` 细则 + 每日日志）、`~/.workbuddy/MEMORY.md`、云端 profile | ❌ 不提交（已被 `.gitignore` 忽略） | 每位开发者独立、天然允许不同，无需统一 |

### 核心原则

1. **共享知识库是唯一事实源**：所有架构 / 约定以提交进仓库的 `AGENTS.md` 等为准，而非某个人机器上的本地记忆。
2. **本地记忆只是补充、允许不同**：`.workbuddy/` 不进仓库，每位同事的 AI 各自积累，过期也无妨；但它**不得在与提交文档冲突时喧宾夺主**。
3. **冲突时以提交的文档为准**：若某同事本地记忆记的旧结论与最新 `AGENTS.md` / `KNOWLEDGE.md` 不一致，AI 应优先读提交文档（见下条）。
4. **聊天约定的「提升」规则**：任何非显然的约定（布局断点、命名、技术选型），必须落进 `AGENTS.md` / 原理图 / `KNOWLEDGE.md` 的 ADR 才算「团队共享」；只留在某人本地记忆里等于没共享。
5. **知识库变更走 PR + review**：改 `AGENTS.md` 等同改代码，小步提交，避免多人同时大改导致合并冲突（它本就是代码级文档）。

### AI 行为约束（本文件的意图）

- 当本地记忆与提交的 `AGENTS.md` / `KNOWLEDGE.md` 冲突时，**信提交文档**。
- 完成实质改动后：**当天只写 `changelogs/_pending/` 片段**；**push 前**再按上方「文档同步协议」把跨会话结论提炼归位（团队共享 → `docs/`；个人细则 → `.workbuddy/memory/ref-*.md`；不变量 → `AGENTS.md` / `MEMORY.md`）。

### 新同事 onboarding

1. `git clone` → 自动获得 `AGENTS.md` + 原理图 + `KNOWLEDGE.md`
2. 其 AI 工具读取这些文件 → 立刻了解架构与约定
3. 本地 `.workbuddy/memory/` 在前几次对话中自动积累，不影响上手

### 相关文件

- 人类协作流程与提交规范：`CONTRIBUTING.md`
- 架构决策留痕（ADR 模板与示例）：`docs/KNOWLEDGE.md` → 「架构决策记录（ADR）」

---


