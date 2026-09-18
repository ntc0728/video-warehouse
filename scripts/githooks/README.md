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
| `reference-transaction` | 一切 ref 更新（commit/fetch/merge/rebase/reset/branch/tag/stash） | 逐条校验「声称写入」的引用是否真实落盘（值比对 + 对象存在性）；**未落盘自动按事务期望值补写（自愈）** |
| `post-commit` | 每次 commit | 调用 `repo-health-check` |
| `post-merge` | pull / merge 后 | 同上 |
| `post-rewrite` | rebase / amend 后（rebase 中断是 09-18 事故直接诱因） | 同上 |

## 写前传输预检：`repo-health-check transport-probe`

本机 SSH 数据传输会被静默挂起/杀掉，HTTPS+`http.proxy`(clash) 是已验证可靠通道。
**HTTPS 为默认通道（2026-09-18 用户定稿），SSH 仅在 HTTPS 不通时兜底。**
**每次 fetch / push / pull 之前必须先跑预检**（git 无 pre-fetch 钩子，此步为固定流程纪律）：

```bash
sh scripts/githooks/repo-health-check transport-probe
```

实测两条通道（端到端 `ls-remote`，BatchMode/低速超时防挂起），按结果行动：

| 结果 | 动作 |
| --- | --- |
| ✓ HTTPS 通（默认路径） | remote 为 SSH 时用单次重写执行，**不动 remote 配置**：<br>`git -c url.https://github.com/.insteadOf=git@github.com: <fetch\|push\|pull> origin`<br>remote 本身是 HTTPS 则原样执行 |
| ✓ 仅 SSH 通（兜底） | 直接用 remote 原样执行 |
| ❌ 都不通 | **exit 1，立即停止**，勿执行任何 git 网络操作；先查 clash（端口可能漂移）与网络 |

三分支已实测验证（2026-09-18）：SSH 通 / SSH 失败落 HTTPS / 双失败 exit 1。

## `repo-health-check` 做什么

1. 当前分支引用在位（`refs/heads/<branch>`）
2. 已配置上游的分支，`refs/remotes/...` 在位（refs 病变征兆）
3. `git fsck --connectivity-only` 对象库连通性快检

**只告警不阻断**（exit 恒 0），输出走 stderr，前缀 `[repo-health]`。

## 自愈机制（reference-transaction，2026-09-18 起）

- 校验失败 → **当场按事务 stdin 给的期望 SHA 补写 loose ref 文件**（`.git/<ref>`，不走 git 引擎避免递归触发）→ 复验（值比对 + `git cat-file -e` 对象存在性）→ 成功输出 `⚡ 已自动补写`，**无需再手动救**。
- 复验失败（对象缺失等）→ 降级为 ❌ 告警：refs/ 或对象库整体受损时补写救不了，走 09-18 `.git` 换血恢复流程。
- ⚠ 踩坑：`git rev-parse --verify` 对「ref 内容是 40 位 hex 但对象不存在」**不校验对象存在性、照常回显 exit 0**（假绿），一切 ref 校验必须叠 `git cat-file -e` 兜底。

病发时：**停止一切 git 写操作**，按 `.workbuddy/memory/2026-09-18.md` 的恢复流程处理
（用 node 按 `ls-remote` 权威 SHA 手工补写引用文件）。

需要全量体检时手动跑：`git fsck --full`
