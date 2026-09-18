---
date: 2026-09-18
module: scripts/githooks
type: feat
build: sh scripts/githooks/repo-health-check transport-probe 三分支实测通过（SSH 通 / 落 HTTPS / 双失败 exit 1）
files:
  - scripts/githooks/repo-health-check
  - scripts/githooks/README.md
---

# transport-probe 写前传输预检

## 旧 ↔ 新

| | 旧 | 新 |
| --- | --- | --- |
| 时机 | 只有写后健康检查（post-*） | 新增写前 `transport-probe` 子命令（fetch/push/pull 之前手动调用） |
| 传输选择 | 无，SSH 挂起只能事后救 | 实测 SSH / HTTPS(http.proxy)，用通的；都不通 exit 1 立即停 |
| remote 配置 | — | 一字不动；仅 HTTPS 通时用单次 `git -c url.https://github.com/.insteadOf=git@github.com:` 重写 |

## 实测记录

- SSH 通 → exit 0「直接用 remote 原样」。
- 强制 SSH 失败（ProxyCommand=exit 1）→ 自动落 HTTPS，输出单次重写命令。
- 双失败（死代理 127.0.0.1:9）→ exit 1 + 停止提示。
- 提交后 push（09d564d）时 reference-transaction 钩子当场抓到 refs/remotes/origin/master 未落盘（本机既有病），SSH ls-remote 亦抖动（UNKNOWN port 65535）；按预检落 HTTPS 重写通道取权威 SHA，node 手工补写引用恢复。
