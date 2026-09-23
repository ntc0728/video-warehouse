---
date: 2026-09-23
module: 文档（测试计数口径）+ 工程/工具链（全量 E2E 实跑验证）
type: 校准（E2E 计数表纠偏 + 死指针清理）+ 验证（16-spec 全量实跑）
build: ✅ 无需构建（纯文档改动）；lint:all 6 门本轮未受影响（上次 52s 全绿结论仍成立）
tests: 默认套 test:e2e rc=0 / 总墙钟 217s（预算 300s）/ 132 条（A 108 passed + B 23 passed + 1 flaky）；--list 246 条 / 22 spec
files:
  - docs/agents/testing.md
  - docs/agents/runtime-conventions.md
demo: （无 UI 改动；证据为 --list 枚举 + 两阶段实跑输出）
---

# E2E 计数口径校准（116/16 → 132/16）+ 全量实跑验证

延续同日 `2026-09-23-1640-e2e-runner-for-incremental.md` 末尾的「附带发现」：文档/记忆里的
「116 条 / 16 spec」与实际枚举数不符。本轮用 `npx playwright test --list` + 一次全量实跑**双证校准**。

## 旧（错在哪）

| 位置 | 旧表述 | 问题 |
| --- | --- | --- |
| `docs/agents/testing.md:80` | 快照停在 **2026-09-18：163 条 / 20 个 spec** | 已过期两个 spec（boot-splash-iso 42 条 + boot-splash-shots 29 条）|
| `docs/agents/testing.md:88` | 「`--workers=2` 全量 = 127 条中 126 passed / 1 skipped」 | 数字来自 2026-09 更早的口径，且默认套并发档早已不由使用者手定 |
| `docs/agents/testing.md:246-248` | 描述 `test:e2e` = `e2e-skeleton --all --dev`，并提到 `test:e2e:preview` / `test:e2e:raw` | **后两个入口 2026-09-21 已删除**；`test:e2e` 实际是 `e2e-suite.mjs` 两阶段（A dev + B preview）|
| `docs/agents/runtime-conventions.md:87` | 「基线：116 条 / 16 spec。新增删改用例须同步 **AGENTS.md 计数表**」 | 数字过期；且 **`AGENTS.md` 里已经没有计数表了**（grep 无命中）→ 死指针 |
| `.workbuddy/memory/MEMORY.md` / `ref-code-runtime.md` | 同上 116/16 + 指向 AGENTS.md | 同上 |

## 新（2026-09-23 实测校准）

**权威三档**（`docs/agents/testing.md` 新增「📌 当前口径」表，声明为**唯一事实源**）：

| 口径 | 条数 | spec |
| --- | --- | --- |
| 全仓枚举 `--list`（`scripts/`） | **246** | **22** |
| **默认套 `test:e2e`** | **132** | **16** |
| └ A dev 行为套 | 108 | 12 |
| └ B preview 播放器系 | 24 | 4 |
| 回归组 `test:regression` | **121** | 13 |
| 按需 `test:e2e:skeleton` / `boot-iso` / `shots` / `subpages` | 39 / 42 / 29 / 4 | 2 / 1 / 1 / 2 |

**三条恒等式自证**（防再漂）：`108 + 24 = 132`；`132 + 114 = 246`（114 = 骨架 18+21+42 + 取证 29 + 子页 4）；
`回归组 13 spec = 默认套 12 个 dev spec + player`。

**治本动作**：计数表**不再放 `AGENTS.md`**（该处已无表），统一收敛到 `docs/agents/testing.md`，
另两处（runtime-conventions / 本地记忆）改成**指针 + 现数**，避免两处维护必漂。
这与 `e2e-suite.mjs` 头注释「本文件不重复维护指令表，避免两处漂移」同一原则。

## 全量实跑证据（`npm run test:e2e`，用户明确授权）

| 项 | 值 |
| --- | --- |
| 退出码 | **rc=0** |
| 总墙钟 | **217s**（套件自报 214.3s）/ 预算 **300s** → 余量 28% |
| Stage A（dev，3 worker） | `108 passed`（147s，退出码 0） |
| Stage B（preview，5 worker） | `23 passed + **1 flaky**`（66s，退出码 0） |
| 合并报告 | `Running 132 tests` → `playwright-report/`（html + list，两 blob 归集正常） |
| 动态端口 | Stage A 50967 / Stage B 各自 OS 分配 → 跑完全释放，无 `e2e-vite-server` 孤儿 |
| 浏览器残留 | `headless_shell` / `chromium` **0** |
| node 进程 | 回基线（MCP 5248/10380、pnpm 壳 12024、用户 dev 8628 未触碰） |

**flaky 定性**：`scripts/player.spec.ts:263` 「4.11 移动端播放器整改 › PLAYER-M01/M07/M08」首次在
`reloadPlayer()`（`player.spec.ts:68`）等 `.up-universal-player:not(.up-placeholder)` 超时，
**retry #1 通过**。属已知并发 flake（Stage B 5 worker 抢真实 CMS 代理；该 describe 是 `serial`，
失败会连带后续两条一起重试——日志里 25/26/27 三条 retry 即此）。**已在 testing.md 标注为已知项，勿当回归。**
本轮无真实失败。

## 未做 / 遗留

- 表中「test 数」列（按源文件逐行）仍是历史快照 —— 该列上方本来就有「以 `--list` 为准」的警告，
  本轮只校准**总口径**，未逐行重算（逐行重算需按源文件→spec 映射反推，属另一件事）。
- 未 commit（等用户确认）。
