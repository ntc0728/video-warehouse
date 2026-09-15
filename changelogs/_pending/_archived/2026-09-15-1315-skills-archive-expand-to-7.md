---
date: 2026-09-15
module: docs
type: chore
build: pass
files: ['skills/README.md', 'skills/project-skills.zip', 'skills/playwright-cli/SKILL.md', 'skills/frontend-design/SKILL.md', 'skills/tdd/SKILL.md', 'skills/grill-me/SKILL.md', 'skills/handoff/SKILL.md', 'docs/agents/RULES-MANIFEST.md', 'changelogs/2026-09-15.md']
demo:
---

## skills 归档扩至 7 个（含第三方协同工作流）+ 补 changelog 片段

- 问题：上一批 skills 归档只收了自研 2 个（`fullscreen-overlay-portal`、`check-environment`），协作者仍缺本项目协同流程依赖的第三方工作流 skill（E2E 调试、设计取向、TDD、方案追问、会话交接）；且上一批（`fe6cd28`）为纯文档改动，**未留 `changelogs/_pending/` 片段**，与「每日改动流水唯一出口」约定不符。
- 旧逻辑：`skills/` 仅 2 个自研目录，`skills/README.md` 明确排除第三方 skill；`changelogs/_pending/` 为空，`fe6cd28` 的改动只存在于 commit message 中，跨会话追溯缺对照记录。
- 新逻辑：
  1. 补录 5 个第三方协同工作流 skill：`playwright-cli`、`frontend-design`、`tdd`、`grill-me`、`handoff`——目录名按各自 `SKILL.md` 的 `name` 字段规整（去掉 `-3__skillhub` / `-tool__skillhub` 安装后缀）；
  2. 剔除 `_meta.json` / `_user_meta.json` / `_skillhub_meta.json` / `_icon.png` 等本机安装元数据，只保留 `SKILL.md` 与随附脚本；
  3. 重打包 `skills/project-skills.zip`（10 条目 / 33051 B）并重写 `skills/README.md`（7 行清单表：来源列区分「自研」与「第三方（含上游链接）」、安装说明、版权与可移除声明）；
  4. `docs/agents/RULES-MANIFEST.md` 的 `skills/**` 行与备注段同步为「自研 2 + 第三方 5」，并在第 6 节基线追加 2026-09-15 记录；
  5. 按「每日改动流水」约定补 `changelogs/_pending/` 片段，push 前跑 `changelog-collect.mjs` 合并归档。
- 涉及文件：
  - `skills/playwright-cli/`、`skills/frontend-design/`、`skills/tdd/`、`skills/grill-me/`、`skills/handoff/`（新增）
  - `skills/README.md`（重写）、`skills/project-skills.zip`（重打包）
  - `docs/agents/RULES-MANIFEST.md`（清单与备注同步）
  - `changelogs/_pending/2026-09-15-1243-extract-local-memory-to-shared-docs.md`、`changelogs/_pending/2026-09-15-1315-skills-archive-expand-to-7.md`（本片段）→ 合并入 `changelogs/2026-09-15.md`
- 不收录：金融数据类第三方 skill（NeoData 金融搜索、WeStock Data）与本视频项目无关，避免仓库噪声。
- 关联 Demo：（无，纯文档 / 资源归档）
- 构建：`tsc -b` 通过；`vite build --emptyOutDir false` ✓（`VITE_EXIT=0`）
