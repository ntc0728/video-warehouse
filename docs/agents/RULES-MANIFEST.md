# RULES-MANIFEST.md — 公共规则文件清单与自检

> 用途：协同开发时，主用户的本地规则/公共文件必须进入 GitHub 仓库，协作者 clone 后才能拿到一致的项目约定。
> 本清单列出**应入库**的规则文件，并给出在「另一台设备（权威源）」上自检、补提交、推送的命令。
> 本机（F:\video-warehouse）已于 2026-09-15 验证：核心规则文件均已 tracked 并推送至 `origin/master`（`edf4d0c`）。本清单作为对照基线。

---

## 1. 应入库的公共规则文件

| 文件路径 | 类别 | 必须 | 说明 |
|---|---|:---:|---|
| `AGENTS.md` | AI 协作指南 | ✅ | Cursor/Aider/Claude/Copilot 通用入口 |
| `CLAUDE.md` | AI 协作指南 | ✅ | Claude 专用 |
| `CONTEXT.md` | AI 协作指南 | ✅ | 领域术语 + 架构概览 |
| `.cursorrules` | AI 协作指南 | ✅ | Cursor IDE 规则 |
| `.github/copilot-instructions.md` | AI 协作指南 | ✅ | GitHub Copilot 规则 |
| `docs/KNOWLEDGE.md` | 共享知识库 | ✅ | 跨会话架构/约定/根因（ADR） |
| `docs/agents/**` | 共享知识库 | ✅ | 架构/页面/数据格式/模式/测试等分立文档 |
| `docs/TEST-CASES.md` | 共享知识库 | ✅ | 测试用例 |
| `docs/KNOWN-ISSUES.md` | 共享知识库 | ✅ | 已知问题 |
| `docs/PRODUCTION-REVIEW-*.md` | 共享知识库 | ✅ | 生产审查记录 |
| `docs/knowledge/**`、`docs/test-cases/**` | 共享知识库 | ✅ | 知识库分片 |
| `eslint.config.js` | 工程配置 | ✅ | ESLint 规则 |
| `.gitattributes` | 工程配置 | ✅ | 统一行尾为 LF（跨平台协作必需） |
| `package.json` | 工程配置 | ✅ | 依赖与脚本 |
| `vite.config.ts` | 工程配置 | ✅ | 构建配置 |
| `tailwind.config.js` | 工程配置 | ✅ | Tailwind 配置 |
| `postcss.config.js` | 工程配置 | ✅ | PostCSS 配置 |
| `tsconfig.json` / `tsconfig.node.json` | 工程配置 | ✅ | TS 配置 |
| `vitest.config.ts` | 工程配置 | ✅ | 单元测试配置 |
| `playwright.config.ts` | 工程配置 | ✅ | E2E 配置 |
| `capacitor.config.ts` | 工程配置 | ✅ | Capacitor/Android 配置 |
| `scripts/fetch-diagram-data.mjs` | 脚本 | ✅ | 原理图数据生成 |
| `scripts/sync-android-version.mjs` | 脚本 | ✅ | Android 版本同步 |
| `scripts/diag-coldstart.mjs` | 脚本 | ✅ | 冷启动诊断 |
| `scripts/changelog-draft.mjs` / `scripts/changelog-collect.mjs` | 脚本 | ✅ | changelog 合并机制 |
| `scripts/setup.mjs` | 脚本 | ✅ | 环境自检 |
| `scripts/optimize-deps.mjs` | 脚本 | ✅ | postinstall 依赖预打包 |
| `scripts/global-setup.ts` / `scripts/global-teardown.ts` | 脚本 | ✅ | 测试全局钩子 |
| `scripts/fixtures/**` | 测试 fixtures | ✅ | mock 数据（含 HLS 流） |
| `skills/**` | 协同 skills 归档 | ✅ | 7 个 skill（自研 2 + 协同工作流第三方 5；原始目录 + `project-skills.zip`），协作者解压即用；清单见 `skills/README.md` |

> 其他 AI 工具规则（如 Windsurf 的 `.windsurfrules`、Trae 的 `.trae/rules/`）若项目使用，也应一并入库；其中 `.trae/` 当前在 `.gitignore` 中被忽略，如需共享需调整忽略规则或在 `docs/agents/` 下另存。

> **本地记忆（`.workbuddy/memory/`）的提炼**：个人记忆层里「跨会话仍成立」的结论应提炼进 `docs/agents/*.md`
> （如 CSS/布局/断点细则 → `css-layout-conventions.md`，播放器/跨页签/竞态/E2E 细则 → `runtime-conventions.md`），
> **不得**为共享而入库 `.workbuddy/`（含个人 MEMORY.md / 每日日志）。
> **协同 skills 归档**：本项目自研 skill（`fullscreen-overlay-portal`、`check-environment`）与协同工作流第三方 skill
> （`playwright-cli`、`frontend-design`、`tdd`、`grill-me`、`handoff`）统一放 `skills/<name>/`，并生成 `skills/project-skills.zip`，
> 协作者解压后放入自己的 `~/.workbuddy/skills/` 或项目 `.workbuddy/skills/` 即可复用。目录名以 `SKILL.md` 的 `name` 字段为准，
> 安装元数据（`_meta.json` / `_user_meta.json` / `_skillhub_meta.json` / `_icon.png`）不入库。金融数据类第三方 skill 不予收录。

---

## 2. 禁止入库（保持忽略）

以下含**个人上下文或密钥**，绝不提交：

| 路径 | 原因 |
|---|---|
| `.workbuddy/` | 个人记忆/上下文（含 `memory/MEMORY.md`），协议规定共享事实应提炼进 `AGENTS.md`/`docs/` 而非个人记忆 |
| `.env` / `.env.local` / `.env.*.local` | 含密钥 |
| `node_modules/` | 依赖，自动安装 |
| `dist/` `dist_verify/` `build/` | 构建产物 |
| `research/` `prototypes/` | 本地研究草稿 |
| `backups/` `*.bak` | 备份 |
| `test-results/` `playwright-report/` | 测试产物 |
| `android/` `*.apk` | Capacitor/Android 产物 |

> 若主用户把「应共享的项目约定」沉淀在了 `.workbuddy/memory/` 中，正确做法是用 `scripts/changelog-collect.mjs` + `docs/agents/docs-protocol.md` 的流程将其**提炼进 `AGENTS.md`/`docs/`** 并提交，**不要**为共享而强加入库 `.workbuddy/`。

---

## 3. 在另一台设备自检（复制执行）

在另一台设备的仓库根目录运行下面脚本，逐项确认规则文件是否已入库、与远端是否一致：

```bash
#!/usr/bin/env bash
# 在另一台设备的 video-warehouse 仓库根目录执行
set -u

echo "===== 1) 本地未提交改动（重点看规则文件）====="
git status --porcelain

echo ""
echo "===== 2) 工作区存在但未 tracked 的文件（排除已 gitignore）====="
# 这些文件在另一台设备上存在却没提交——对照第 1 节清单判断要不要 add
git ls-files --others --exclude-standard

echo ""
echo "===== 3) 核心规则文件是否已被 git 跟踪 ====="
for f in AGENTS.md CLAUDE.md CONTEXT.md .cursorrules \
         .github/copilot-instructions.md docs/KNOWLEDGE.md \
         eslint.config.js .gitattributes package.json vite.config.ts \
         tailwind.config.js postcss.config.js tsconfig.json tsconfig.node.json \
         vitest.config.ts playwright.config.ts capacitor.config.ts; do
  if git rev-parse --verify "HEAD:$f" >/dev/null 2>&1; then
    echo "OK       $f"
  else
    echo "MISSING! $f  (未提交，需 git add)"
  fi
done

echo ""
echo "===== 4) 与远端差异（联网；显示本地领先远端的提交）====="
if git fetch origin >/dev/null 2>&1; then
  echo "--- 以下提交尚未推送到 origin/master ---"
  git log --oneline origin/master..HEAD
  echo "--- 远端是否存在、本地规则文件内容是否与 origin/master 一致 ---"
  for f in AGENTS.md CLAUDE.md CONTEXT.md .cursorrules .github/copilot-instructions.md; do
    if git diff --quiet origin/master -- "$f" 2>/dev/null; then
      echo "IN_SYNC  $f"
    else
      echo "DIVERGE! $f  (本地与 origin/master 不同，需 push 或先 pull 解决冲突)"
    fi
  done
else
  echo "（无法 fetch，请手动检查后 git push，再到协作者机器 git pull 验证）"
fi
```

判读：
- 第 2 步列出的文件若属于第 1 节清单 → 应 `git add`。
- 第 3 步出现 `MISSING!` → 该规则文件从未提交，必须补提交。
- 第 4 步出现 `DIVERGE!` → 另一台设备的版本与 GitHub 不同，推送前先 `git pull --rebase` 解决冲突再 `push`。

---

## 4. 补提交并推送

确认缺失后，在另一台设备执行：

```bash
cd /path/to/video-warehouse
# 加入公共规则（按需增删，不要加第 2 节禁止项）
git add AGENTS.md CLAUDE.md CONTEXT.md .cursorrules .github/copilot-instructions.md
git add docs/ scripts/ eslint.config.js .gitattributes
# 其他工程配置按需：package.json vite.config.ts tailwind.config.js 等
git commit -m "docs: 同步主用户本地规则到仓库"
git pull --rebase origin master   # 先拉取，避免冲突
git push origin master
```

推送后，本机及所有协作者执行 `git pull` 即同步。

---

## 5. 防漏推（建议）

1. **本清单备案**：本文件即规则清单，clone 后对照第 3 节自检。
2. **CI 断言（可选）**：加轻量 check，断言第 1 节文件均已 tracked，未跟踪即失败，PR 时拦截。
3. **习惯**：主用户改完规则文件立即 `commit` + `push`，不堆积（本项目 `AGENTS.md` 红线亦要求改动及时 commit）。

---

## 6. 本机基线（2026-09-15 验证，仅供参考）

- 分支 `master`，已与 `origin/master` 同步（无落后/超前），本地零未提交改动。
- 已 tracked 并推送的核心规则：`AGENTS.md` `CLAUDE.md` `CONTEXT.md` `.cursorrules` `.github/copilot-instructions.md` `eslint.config.js` `.gitattributes`。
- `.workbuddy/`（含个人 `memory/MEMORY.md`）正确被 `.gitignore:41` 排除，未跟踪。
- 结论：GitHub 远端**不缺**本机已知的公共规则；若另一台设备有更新未推送，缺口只在那台设备本地。
- **2026-09-15 追加**：本地记忆（`ref-css-layout.md` / `ref-code-runtime.md`）已提炼为共享文档
  `docs/agents/css-layout-conventions.md` + `docs/agents/runtime-conventions.md`；
  `skills/` 归档扩至 7 个（自研 2 + 协同工作流第三方 5）。此两批改动即本节基线之后的新增内容。
