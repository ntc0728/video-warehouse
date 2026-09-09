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

### 规则 2：记忆库 — 做完就写

```
IF 你完成了实质性工作（修 bug、加功能、重构、技术选型）
THEN 在 .workbuddy/memory/YYYY-MM-DD.md 追加一条记录

IF 你确立了项目级约定或可复用模式
THEN 追加到 .workbuddy/memory/MEMORY.md
```

**位置**: `.workbuddy/memory/YYYY-MM-DD.md`（日志）+ `.workbuddy/memory/MEMORY.md`（长期）  
**时机**: 每次工作会话结束时  
**内容**: 做了什么 + 为什么这么做 + 踩了什么坑（不要写"搜索了XX文件"这种过程噪音）

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

| 变更类型          | 测试    | 记忆    | 知识库 | 原理图    | 流程图 |
| ------------- | ----- | ----- | --- | ------ | --- |
| CSS bug 修复    | —     | 日志    | —   | —      | —   |
| 类名/选择器变更      | ✅ 同提交 | 日志    | —   | —      | —   |
| 新增页面          | ✅     | 日志+长期 | ✅   | ✅ 新建   | ✅   |
| 新增核心组件        | ✅     | 日志+长期 | ✅   | ✅ 受影响页 | —   |
| 架构分层变化        | ✅     | 日志+长期 | ✅   | ✅      | ✅   |
| 代理配置变化        | —     | 长期    | ✅   | ✅      | ✅   |
| .gitignore 策略 | —     | 长期    | ✅   | —      | —   |
| 新增领域术语        | —     | —     | ✅   | —      | —   |
| 内部重构（不改外部接口）  | ✅     | 日志    | —   | —      | —   |

---


## 协同开发与知识库维护

> 多人协作时，AI 辅助工具（Cursor / Claude / Copilot 等）会在每位开发者机器上各自维护一份**本地记忆**。本节规定「哪些文件必须一致、哪些允许不同、冲突怎么办」，避免同事之间因本地文件不一致而踩坑。

### 两类文件的定位

| 类别                    | 文件                                                                                                                              | 是否提交                      | 协同策略                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- |
| **共享知识库（唯一事实源）**      | `AGENTS.md` `CLAUDE.md` `.cursorrules` `.github/copilot-instructions.md` `CONTEXT.md` `docs/page-diagrams/` `docs/KNOWLEDGE.md` | ✅ 提交（团队共享）                | 全队一致，靠 git + PR review 同步 |
| **本地 AI 记忆（个人上下文缓存）** | `.workbuddy/memory/` `~/.workbuddy/MEMORY.md` 云端 profile                                                                        | ❌ 不提交（已被 `.gitignore` 忽略） | 每位开发者独立、天然允许不同，无需统一       |

### 核心原则

1. **共享知识库是唯一事实源**：所有架构 / 约定以提交进仓库的 `AGENTS.md` 等为准，而非某个人机器上的本地记忆。
2. **本地记忆只是补充、允许不同**：`.workbuddy/` 不进仓库，每位同事的 AI 各自积累，过期也无妨；但它**不得在与提交文档冲突时喧宾夺主**。
3. **冲突时以提交的文档为准**：若某同事本地记忆记的旧结论与最新 `AGENTS.md` / `KNOWLEDGE.md` 不一致，AI 应优先读提交文档（见下条）。
4. **聊天约定的「提升」规则**：任何非显然的约定（布局断点、命名、技术选型），必须落进 `AGENTS.md` / 原理图 / `KNOWLEDGE.md` 的 ADR 才算「团队共享」；只留在某人本地记忆里等于没共享。
5. **知识库变更走 PR + review**：改 `AGENTS.md` 等同改代码，小步提交，避免多人同时大改导致合并冲突（它本就是代码级文档）。

### AI 行为约束（本文件的意图）

- 当本地记忆与提交的 `AGENTS.md` / `KNOWLEDGE.md` 冲突时，**信提交文档**。
- 完成实质性工作后，按上方「文档同步协议」更新对应文档；同时可在本地 `.workbuddy/memory/` 记日志（不提交、无妨）。

### 新同事 onboarding

1. `git clone` → 自动获得 `AGENTS.md` + 原理图 + `KNOWLEDGE.md`
2. 其 AI 工具读取这些文件 → 立刻了解架构与约定
3. 本地 `.workbuddy/memory/` 在前几次对话中自动积累，不影响上手

### 相关文件

- 人类协作流程与提交规范：`CONTRIBUTING.md`
- 架构决策留痕（ADR 模板与示例）：`docs/KNOWLEDGE.md` → 「架构决策记录（ADR）」

---


