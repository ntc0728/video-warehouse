---
date: 2026-09-11 16:20
module: docs（AGENTS.md / 知识分层流程）
type: docs
build: 纯文档改动，未触碰 src → 无需 build（git status 确认仅 7 个文档文件变更）
files:
  - AGENTS.md
  - docs/agents/docs-protocol.md
  - docs/agents/collaboration.md
  - CONTRIBUTING.md
  - CLAUDE.md
  - .cursorrules
  - .github/copilot-instructions.md
demo: 无（非观感类改动）
---

## 知识分层流程固化：当天只写 changelogs/_pending，push 前提炼归位

### 问题

原流程缺「长期文档写入闸门」：`AGENTS.md` 与个人记忆 `MEMORY.md` 都没有内容准入限制，
导致 9-10 一整天（Hero 第六/七轮大改）的踩坑细节被**静默追加**进 `MEMORY.md` 正文——
一天内从 4914 字符涨到 ≈8891 字符（**+81%**），把 9-09 刚做的分层治理成果整个吃掉。
同时 `docs/agents/docs-protocol.md` 规则 2 仍写着「确立了项目级约定 → 追加到 MEMORY.md」，
与「长期文档只收不变量」的口径直接矛盾。

### 旧逻辑

- `AGENTS.md`「改动留痕（changelogs）」只讲 `_pending` 片段 → push 前合并归档，**没说提炼去哪**；
  `MEMORY.md` 无准入清单，任何细节都能塞。
- `docs/agents/docs-protocol.md` 规则 2「记忆库 — 做完就写」：
  `完成了实质性工作 → 写 .workbuddy/memory/YYYY-MM-DD.md`；
  `确立了项目级约定 → 追加到 MEMORY.md`。→ 等价于「长期记忆随写随塞」，且与 changelogs 机制职责重叠。
- 快速判断表「记忆」列取值为 `日志` / `日志+长期`，未区分「当天流水」与「push 前提炼」。
- 四处入口文件把「文档同步协议」的**位置**写成 `AGENTS.md`（实际已下沉 `docs/agents/docs-protocol.md`），属死引用。

### 新逻辑

**三层各司其职，当天只落片段，push 前才提炼：**

| 层 | 写什么 | 时机 |
| --- | --- | --- |
| `changelogs/_pending/` | 每日改动流水 | 改完当天，**唯一指定出口** |
| `docs/agents/*.md` / `docs/KNOWLEDGE.md`(ADR) | 跨会话仍成立的架构 / 约定 / 根因 | **push 前**提炼 |
| `.workbuddy/memory/ref-*.md`（细则）/ `MEMORY.md`（**只放不变量**） | 个人上下文 | **push 前**提炼 |

- `AGENTS.md`：「改动留痕」→ **「改动留痕与知识沉淀（changelogs → 知识分层）」**，新增三层表 + 5 条规则
  （唯一出口 / push 前提炼 / **内容准入** / 待办整段替换且**替换前先问用户上一版是否完成** / 走 PR + review）；
  「本地记忆」节改写为「索引层 `MEMORY.md` + 按需 Read 的 `ref-*.md` + 每日日志」三层结构。
- `docs/agents/docs-protocol.md`：规则 2 重写为「改动留痕与知识分层」，
  明确 `IF 完成实质改动 THEN 写 _pending 片段` / `IF push 前 THEN 按主题归位`，
  新增**禁止**条（一次性细节、实测数值表、代码片段、历史演变过程不得进 `AGENTS.md` / `MEMORY.md`）；
  快速判断表「记忆」列 → **「留痕 / 提炼」**（取值 `片段` / `提炼` / `片段+提炼`）+ 表下口径注；
  协同开发表的本地记忆描述补 `ref-*.md`；「AI 行为约束」节删掉「会话结束写日志」的旧表述。
- `docs/agents/collaboration.md`：§6 新增 bullet「push 前提炼归位（2026-09-11 起）」。
- 四处死引用统一改指 `docs/agents/docs-protocol.md` 并补「先写 `_pending` 片段」：
  `CONTRIBUTING.md` §5 + §8、`CLAUDE.md`、`.cursorrules`、`.github/copilot-instructions.md`。

### 涉及文件

`AGENTS.md` / `docs/agents/docs-protocol.md` / `docs/agents/collaboration.md` / `CONTRIBUTING.md` /
`CLAUDE.md` / `.cursorrules` / `.github/copilot-instructions.md`

### 验证

- `git status --porcelain` 确认本次仅上述 7 个文档变更（**未触碰**工作区内 9-10 Hero 轮次的 src WIP）。
- `AGENTS.md` 体量 **6057 B**，仍在「≤8KB」红线内。
- 纯文档改动、无 src 变更 → 不触发 build。

### 备注

- `.gitignore` 含 `!docs/agents/`（2026-09-09 文档瘦身时加入）→ **`docs/agents/` 是入库的**，本改动是真实团队共享变更。
- 个人记忆层（`.workbuddy/memory/`）同步做了同一套分层：`MEMORY.md` 移出 stylelint 细则、细节下沉 `ref-css-layout.md`；
  该目录被 gitignore，不进本 commit。
