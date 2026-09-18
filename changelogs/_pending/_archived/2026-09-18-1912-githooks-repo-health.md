---
date: 2026-09-18
module: scripts/githooks
type: feature
build: N/A（shell 钩子，不参与前端构建；已端到端实测）
files:
  - scripts/githooks/reference-transaction（新增）
  - scripts/githooks/repo-health-check（新增）
  - scripts/githooks/post-commit（新增）
  - scripts/githooks/post-merge（新增）
  - scripts/githooks/post-rewrite（新增）
  - scripts/githooks/README.md（新增）
  - .git/config core.hooksPath=scripts/githooks（本地配置，不入库）
demo: 无 UI；验证方式见「验证」节
---

# githooks：git 写操作后自动仓库健康自检

## 背景

本机存在「git 写引用报成功但不落盘 / refs 目录整体消失」病史（2026-09-18 事故：
`refs/` 整目录消失 + 松散对象被清；fetch 输出 `[new branch]` 但磁盘无文件）。
用户要求：写项目钩子，在 git 写操作后自动跑 `for-each-ref` + `fsck` 两道检查。

## 方案

- 钩子放 `scripts/githooks/`（可入库、团队共享），`git config core.hooksPath scripts/githooks` 挂载
  （注意：该配置存于 `.git/config`，`.git` 重建后需重挂）。
- `reference-transaction` 钩子（git ≥2.28，本机 2.53）：**每次引用事务 committed 后逐条比对**
  「声称写入的 SHA」vs「磁盘实际可解析值」——比事后 for-each-ref 更精准，覆盖
  commit/fetch/merge/rebase/reset/branch/tag/stash 一切 ref 更新；删除操作（new=全零）跳过。
- `post-commit` / `post-merge` / `post-rewrite` → 调 `repo-health-check`：
  ① 当前分支引用在位 ② 上游引用在位（refs/remotes 病变征兆）③ `fsck --connectivity-only` 连通性快检。
- **只告警不阻断**（exit 恒 0），输出走 stderr，前缀 `[repo-health]`；
  病发处置指引：停止 git 写操作 → node 按 ls-remote 权威 SHA 手工补写引用（2026-09-18 恢复流程）。

## 旧↔新对照

| 旧 | 新 |
| --- | --- |
| 人工事后手动 `git for-each-ref` 抽查 | 每次引用写入自动逐条值比对 |
| fsck 只在出事后全量跑 | 每次写操作后 `--connectivity-only` 快检兜底 |
| 病发无任何报错、发现即滞后 | 钩子即刻 stderr 告警 |

## 验证

- `git tag` 建/删 → `reference-transaction` 静默通过（成功路径无输出，符合设计）。
- `git commit --allow-empty` → `[repo-health] ✓ ok` 实际触发；`git reset --hard HEAD~1` 复位，
  HEAD 回 `7cf541a`，refs 完好（`for-each-ref` 实证）。
- `PortableGit bash` 直跑 `repo-health-check` → `✓ ok`。
- 失败路径（引用未落盘告警）为代码评审确认，未实际模拟。
