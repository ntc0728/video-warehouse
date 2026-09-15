---
date: 2026-09-15
module: docs
type: docs
build: pass
files: ['AGENTS.md', 'docs/agents/index.md', 'docs/agents/css-layout-conventions.md', 'docs/agents/runtime-conventions.md', 'docs/agents/RULES-MANIFEST.md', 'skills/README.md', 'skills/project-skills.zip']
demo:
---

## 本地记忆提炼为共享协作文档 + 自研 skills 归档（commit fe6cd28）

- 问题：主用户本地「跨会话仍成立」的工程结论只存在于个人记忆层 `.workbuddy/memory/ref-*.md`（该目录被 `.gitignore` 排除、不入库），协作者 clone 后拿不到这些约定；同时本项目自研 skill 只装在主用户机器上，协作者无对应能力。
- 旧逻辑：`.workbuddy/memory/MEMORY.md` 只放不变量索引，细则在 `ref-css-layout.md`（断点宪法 / 流体 token / 高度体系 / 列数梯度 / CSS 陷阱 / 跑马灯 / 基线隔离验证法 / stylelint 口径）与 `ref-code-runtime.md`（播放器自愈链 / 跨页签同步 / `reqSeqRef` 竞态 / 逻辑分页 / E2E 假绿坑 / 工具链陷阱）——两者均为个人记忆，**不进仓库**；`docs/agents/` 虽有 patterns.md / pages.md 覆盖「模式层」，但上述「细则层」无对应共享文档。skills 亦无仓库归档。
- 新逻辑：
  1. 新建 `docs/agents/css-layout-conventions.md`、`docs/agents/runtime-conventions.md`，把 `ref-*.md` 里跨会话仍成立的结论**提炼**（非搬运）为团队共享分片文档；
  2. `AGENTS.md` 与 `docs/agents/index.md` 索引表各增两行指向；
  3. `docs/agents/RULES-MANIFEST.md` 增加 `skills/**` 应入库行，并写明「个人记忆提炼进 docs、不得为共享而入库 `.workbuddy/`」与 skills 归档约定；
  4. 新增 `skills/`：自研 skill 原始目录 + `project-skills.zip` + `README.md`（安装说明），剔除 `_meta.json` / `_user_meta.json` / `_icon.png` 等本机元数据；
  5. 个人记忆层 `.workbuddy/memory/` 仍保持被忽略，未入库。
- 涉及文件：
  - `docs/agents/css-layout-conventions.md`（新增）
  - `docs/agents/runtime-conventions.md`（新增）
  - `AGENTS.md`、`docs/agents/index.md`、`docs/agents/RULES-MANIFEST.md`（索引/清单更新）
  - `skills/fullscreen-overlay-portal/`、`skills/check-environment/`、`skills/project-skills.zip`、`skills/README.md`（新增）
- 关联 Demo：（无，纯文档 / 资源归档，无观感改动）
- 构建：`tsc -b` 通过；`vite build --emptyOutDir false` ✓ 2296 modules / 47.77s（`VITE_EXIT=0`）
- 提交：`fe6cd28`（12 文件，+1539），已推送 `origin/master`
