# githooks —— 项目级 git 钩子（仓库健康自检）

本机存在「git 写引用报成功但不落盘 / refs 目录整体消失」的病史（2026-09-18 事故）。
本目录的钩子在**每次 git 写操作后自动跑健康检查**，病发即刻告警。

## 挂载（换机器 / 重建 .git 后需重跑一次）

```bash
git config core.hooksPath scripts/githooks
```

> `core.hooksPath` 存在 `.git/config` 里，不入库；`.git` 一旦重建需重新执行上面这行。

## 钩子清单

| 钩子 | 触发时机 | 检查内容 |
| --- | --- | --- |
| `reference-transaction` | 一切 ref 更新（commit/fetch/merge/rebase/reset/branch/tag/stash） | 逐条校验「声称写入」的引用是否真实落盘（值比对） |
| `post-commit` | 每次 commit | 调用 `repo-health-check` |
| `post-merge` | pull / merge 后 | 同上 |
| `post-rewrite` | rebase / amend 后（rebase 中断是 09-18 事故直接诱因） | 同上 |

## `repo-health-check` 做什么

1. 当前分支引用在位（`refs/heads/<branch>`）
2. 已配置上游的分支，`refs/remotes/...` 在位（refs 病变征兆）
3. `git fsck --connectivity-only` 对象库连通性快检

**只告警不阻断**（exit 恒 0），输出走 stderr，前缀 `[repo-health]`。
病发时：**停止一切 git 写操作**，按 `.workbuddy/memory/2026-09-18.md` 的恢复流程处理
（用 node 按 `ls-remote` 权威 SHA 手工补写引用文件）。

需要全量体检时手动跑：`git fsck --full`
