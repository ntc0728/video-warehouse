---
date: 2026-09-23
module: 工程/工具链（增量测试 E2E 跑批链）
type: 修复（playwright 调用改走自建 server 跑批器 + 封顶 + 收尾）
build: ✅ 无需构建（纯脚本/文档改动）；lint:all 6 门未受影响的既有结论仍成立
tests: 增量档实测 17–18s rc=0 ×3；-Budget 8 到点击杀 rc=2 ✓；preview 档 subpages 复跑 ✓；13-spec test:regression rc=0 / 221s / 121 passed（0 flaky / 0 retries，预算 1200s 用 18%）✓
files:
  - scripts/run-tests.ps1
  - scripts/e2e-skeleton.mjs
  - scripts/README.md
  - docs/agents/testing.md
  - AGENTS.md
demo: （无 UI 改动；证据为命令实测输出）
---

# `run-tests.ps1` 的 playwright 调用：自建 server + 封顶 + 收尾

紧接着同日 `2026-09-23-1620-npm-blocking-and-version-drift-fix.md` 的 P1 遗留项（「增量路径没有
`e2e-skeleton` 那层清场/封顶」）落地。

## 旧（根因）

`run-tests.ps1` 直接 `pnpm exec playwright test …`，服务器交给 `playwright.config.ts` 的 `webServer`：

- `webServer.command` 是**字符串** → Windows 下由 shell（`cmd /c`）启动 → 收尾只杀到 shell，
  vite 变成孤儿继续占端口；
- playwright 等不到 webServer 关闭 → **用例与 `globalTeardown` 早已跑完，进程 632s 不返回**
  （只剩 `globalTimeout` 30min 兜底），并残留 `node scripts/e2e-vite-server.cjs --port <n>`；
- 无预算、无健康探活、无进程树收尾 → 与 `e2e-skeleton` 的两套机制并存，行为不一致。

## 新

**`scripts/run-tests.ps1`**

- playwright 段改委派给 `node scripts/e2e-skeleton.mjs --dev <specs> -g <grep> --workers N
  --retries R --budget S`：动态端口 + HTTP 200 探活 + 预算封顶 + 进程树收尾（`e2e-suite.mjs`
  各阶段同源，行为已被套件验证）。因 `E2E_PORT` 指向**已探活**的自建 server，config 的
  `reuseExistingServer` 直接命中 → playwright **不会再起第二个 server**（孤儿消失的根因）。
- `--dev` 保持原语义：增量档测源码态，不要求 `dist` 是最新构建。
- 新增 `[int]$Budget`：默认**增量档 180s / `-Full` 回归档 1200s**；到点按进程树击杀并 **退码 2**。
  `-Full` 另传套件口径超时（`--test-timeout 45000 --global-timeout 1200000`）。
- 退出码仍原样透传（失败用例不再假绿）。
- 顺带修子进程中文输出乱码：`[Console]::OutputEncoding` / `$OutputEncoding` 置 UTF-8
  （此前跑批器中文诊断在日志里是「璺戞壒寮€濮�」）。

**`scripts/e2e-skeleton.mjs`**

- 头注释改述定位：**全仓唯一「自建 server + 探活 + 封顶 + 收尾」的单轮跑批器**，被
  `test:e2e:*` / `e2e-suite.mjs` 各阶段 / `run-tests.ps1` 增量档共用；文件名保留（多处引用，不值得改名）。
  明确「凡要跑 playwright 都走它，别裸调 `playwright test`」。
- 预算击杀由 `spawnSync(..., { timeout, killSignal:'SIGKILL' })` 改为**异步 `spawn` + 自建看门狗**：
  Windows 上 SIGKILL 只杀 playwright CLI 本身，worker / 浏览器会成孤儿 → 改为
  `taskkill /PID <pw> /T /F` 按**进程树**击杀。
- `cleanup()` 抽出 `killTree()`，并把 playwright 子进程也纳入收尾（`SIGINT` / `exit` 均覆盖）。

**跳线说明（红线 8 的口径）**：跑批器预算档位（180 / 1200）属**封顶**，与既有 120s/300s 看门狗同类，
非「放宽单步等待」；ad-hoc 调试档的 120s 口径不变。

**文档**：`docs/agents/testing.md` 增量测试节「行为变更」补第 4 条；`scripts/README.md` 补
`e2e-skeleton.mjs` 行与 `-Budget` 用法；`AGENTS.md` 红线 7 修正过表述（`spawnSync timeout` →
跑批器看门狗按进程树击杀 + 别裸调 playwright）。

## 验证证据（同机同时段）

| 场景 | 命令 | 结果 |
| --- | --- | --- |
| 增量档（显式 Files+Grep） | `test:changed -- -Files src/pages/Browse/useBrowseData.ts -Grep BROWSE-020` | rc=0 / 17s；动态端口 58204、探活 4.8s、`1 passed`、teardown 已跑 |
| **预算击杀** | 同上 `-Budget 8` | rc=**2** / 14s 结束；日志含「⛔ 超出单轮预算 8s —— 按进程树击杀 playwright」 |
| 自动侦测档（默认路径） | 临时 `src/components/TokenRequired/__wb_probe.ts` → `test:changed` | 命中 1 spec（settings 6.2）、rc=0 / 18s；探针已删 |
| `-Full` 档参数构造 | `test:changed -- -Full -Files … -Grep "6\.2"` | 打印「预算 1200s」+ 实参含 `--timeout=45000 --global-timeout=1200000`，rc=0 |
| preview 档未被改坏 | `node scripts/e2e-skeleton.mjs scripts/source-checker.spec.ts scripts/proxy-setup.spec.ts` | 见本轮结论（两 spec 通过） |
| 孤儿清查 | 每次后查 `netstat` + `tasklist` | 端口全释放；node 进程回到基线（MCP 5248/10380、pnpm 壳 12024、用户 dev 8628），**零测试残留** |

## 追加（同日 17:00 起）：`-Group` 显式分组档修正 + 13-spec 回归档实跑

用户要求「把 13-spec `test:regression` 也实跑一轮确认新预算档够用」。**实跑前先撞上一个入口缺陷**：

### 缺陷（旧语义残留）

`-Group regression` 且未给 `-Files` / `-Grep` 时，`$Files.Count -eq 0` 触发**改动侦测分支** →
工作树无 `src/*` 改动就 `No changed files detected.` + `exit 0`。即改完侦测语义（P1-A）之后，
**发版回归档会静默什么都不跑**；旧版是 `git diff HEAD~1` 的错误侦测"歪打正着"才总有东西可跑，
所以这个洞一直没暴露。`test:regression` = `run-tests.ps1 -Full -Retries 2 -Group regression`，
是本仓发版前唯一回归入口，静默空跑等于回归门失效。

### 修法（`scripts/run-tests.ps1`，两处）

1. 侦测分支条件加前置互斥：`-not $AutoDetect -and $Group -ne "all" -and $Files.Count -eq 0 -and -not $Grep`
   → 「显式分组档」跳过侦测并打印 `Explicit group '<name>' → 跳过改动侦测，直接跑该组 spec`。
2. 在 `$matchedPlaywrightTests` 初始化之后补分支：条件与上条**完全镜像**，从 `$testGroups[$Group]`
   直接装载该组 spec 并打印清单（后续 478 行的组过滤对同一集合求交 → 结果不变，语义一致）。

**语义边界（刻意保留）**：`test:smoke` 带 `-AutoDetect` → 仍走「侦测 ∩ smoke」，不受影响；
`test:changed` 无参（`$Group=all`）→ 侦测路径不变；`-Files` / `-Grep` 显式意图优先。

### 实测证据

`npm run test:regression`（`-Full -Retries 2 -Group regression`）：

| 项 | 值 |
| --- | --- |
| 加载 spec | **13/13**（browse/collections/cross-tab/detail/history/home/iptv-player/iptv/person/player/regression/settings/source-checker） |
| 用例 | **121 passed / 0 failed / 0 flaky / 0 retries**（无一条需要重试） |
| 退出码 | **rc=0** |
| 墙钟 | **221s**（跑批器自报 playwright 218s；dev server 就绪 5.4s） |
| 预算占用 | 1200s 用 **18%（218/1200）**，余量 **5.5×** |
| 动态端口 | 62391（OS 分配，跑批器探活）→ 跑完已释放 |
| 孤儿 | `headless_shell`/`chromium` 零残留；node 回基线（5248/10380 MCP、12024 pnpm 壳、8628 用户 dev，未触碰）；chrome 13 个进程全属用户自己 14:29 起的那个实例 |
| 产物 | 仅 `test-results/.last-run.json`（`.gitignore:61` 已覆盖）；`globalTeardown: 测试产物已清理` |

**分档归因**：09-22 记录的「828s / 疑似挂死」= 错误侦测（几乎必命中全量）× `-Retries 2` × 无封顶；
本次同组 13 spec 干净跑 218s。→ 说明 1200s 预算档**明显偏松**，如需收紧可降到 600s（仍有 2.7× 余量），
但按红线 8 的「封顶不收紧」原则暂不动。

### 附带发现（未处理）

`AGENTS.md` / `MEMORY.md` 记的 E2E 基线是「116 条 / 16 spec（2026-09-09）」，而 13-spec 回归组
现为 **121 条**。两者口径可能已漂移（16 spec 含骨架类 boot-splash/skeleton 等，13 spec 是回归组），
计数表待核。

## 未做 / 遗留

- 未跑全量 `test:e2e`（16 spec，红线：需明确放行）；本轮跑的 13-spec `test:regression` 已获用户明确授权。
- 未 commit（等用户确认）。
- `test-results/.last-run.json` 由 playwright 在 `globalTeardown` 之后回写（1 文件、已 gitignore），非残留。
