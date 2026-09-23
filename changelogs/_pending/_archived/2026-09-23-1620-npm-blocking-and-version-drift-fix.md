---
date: 2026-09-23
module: 工程/工具链（npm 指令阻塞 + 版本漂移）
type: 修复（测试门禁 / 构建预打包 / 版本一致性）
build: ✅ node scripts/lint-all.mjs（6 门全绿）
tests: 护栏 exit=2 实测 ✓；skeleton 65s / boot-iso 59s ✓；optimize-deps rc=0 ✓
files:
  - scripts/run-tests.ps1
  - scripts/optimize-deps.mjs
  - scripts/sync-android-version.mjs
  - scripts/lint-all.mjs
  - scripts/e2e-suite.mjs
  - scripts/README.md
  - package.json
  - capacitor.config.ts
  - docs/agents/testing.md
demo: （无 UI 改动；证据为命令实测输出）
---

# 实施「npm/node 阻塞 + 版本漂移」修复计划（P1–P6）

来源：`.workbuddy/memory/plans/2026-09-23-npm-blocking-and-drift-fix-plan.md`（用户拍板 A+B+C / exit 2 / 拆档 / 版本护栏入 lint:all / 删 test:smart）。

## P1 `test:changed` 退化成全量回归（P0）→ `scripts/run-tests.ps1`

- **旧**：`git diff --name-only HEAD~1` 冒充「未提交改动」（HEAD~1↔工作树）；工作树干净也会命中
  Layout/StickyHeader 的 11–13 spec 映射；默认 `-Retries 2` → 单轮实测 828s（曾被误判为挂死）。
- **新（A+B+C 全上）**：
  - **A**：默认侦测「未提交改动」= `git diff` + `git diff --cached` + `git ls-files --others`；
    旧语义改由新增 `-Since <ref>` 显式提供。
  - **B**：新增 `[switch]$Full` 与 spec 数护栏 —— 自动侦测命中 **>3 个 spec** 时打印清单并
    **exit 2（未执行任何测试）**；显式 `-Files` / `-Grep` 不受限（那是使用者意图）。
  - **C**：`-Retries` 默认 **2 → 0**；`test:regression` 显式 `-Full -Retries 2 -Group regression`。

## P2 沙箱内依赖预打包静默失败（P0）→ `scripts/optimize-deps.mjs`

- **旧**：`spawnSync(vite optimize)` 删 `node_modules/.vite/deps`（实测 86–89 文件 > 护栏阈值 50）
  → `SAFE_DELETE_BULK_CONFIRM_REQUIRED` → rc=1 → 脚本容错 `exit 0` = **看着成功其实没预打包**
  （dev 首启 12.9s vs 稳态 5.2s）。
- **新**：`spawnSync` → **异步 `spawn`**；仅对该子进程注入 `CODEBUDDY_SAFE_DELETE_ENABLED=0`
  （实测子进程确实收到该值；沙箱外无此变量 → 对 CI / 本机终端零影响）；保留「永不非零退出」硬约束，
  失败原因改为醒目 `⚠️`。

## P3 骨架 E2E 卡 120s 看门狗边界 → 拆档

- **旧**：`test:e2e:skeleton` = skeleton + boot-splash-iso + boot-splash 合跑 110–128s（09-22 被击杀过）。
- **新（先实测后拆）**：单 spec 实测 skeleton 25s / boot-splash 55s / boot-splash-iso 59s；
  改为 `test:e2e:skeleton`（skeleton + boot-splash，**实测 65s / 39 passed**）+
  新增 `test:e2e:boot-iso`（boot-splash-iso，**实测 59s / 42 passed**），两者均留 ≥45% 余量。

## P4 版本漂移（P1）→ `capacitor.config.ts` + `sync-android-version.mjs` + lint:all

- **旧**：仓库副本 `capacitor.config.ts` 停留在 1.27.1 / 127010（`package.json` 已 1.27.2）；
  CI 只在**临时 checkout** 里 sync、不回写仓库。另 `:5`/`:42` 存在 **CR 混排**（两个键挤同一物理行）。
- **新**：① 一次性纠正为 1.27.2 / 127020 并修 CR（`\r` → `\n`，共 2 处）；
  ② `sync-android-version.mjs` 新增 `--check`（只校验不写、漂移 exit 1；`android/` 未 `cap add`
  时跳过 gradle 校验，避免 CI 新 checkout 误报）；③ `package.json` 新增 `lint:version-sync`，
  `lint-all.mjs` 插入第 6 门（位置在 `lint:json` 之后，全跑不短路）。

## P5 基线与知识口径

- `docs/agents/testing.md` 新增「耗时基线口径（冷跑 vs 稳态）」：首次跑比复跑慢 2–3 倍
  （Defender + FS 冷缓存），基线取同会话第二次起的稳态值；09-22 的 `lint 62.2s`/`build 60.5s`
  标注为冷跑（稳态 15.8s / 40.8s）。
- `.workbuddy/memory/ref-code-runtime.md` 修正被证伪结论：「`spawnSync` 一律 EBUSY」→
  **表现不稳定**（同会话内既有 EBUSY 也有正常返回），一律用异步 `spawn`；
  并补记「删除护栏的关法」= 子进程 env 传 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。

## P6 删除语义重复入口

- `package.json` 删 `test:smart`（与 `test:changed` 等价，AutoDetect 被 `$Files.Count -eq 0` 短路）；
  同步更新 `docs/agents/testing.md`、`docs/knowledge/03-dev-guide.md`、`scripts/README.md`。

## 验证证据

- `node scripts/sync-android-version.mjs --check`：纠正前 **exit 1** 并列出两项漂移 → 纠正后 **exit 0**。
- 护栏实测：临时放入 `src/components/StickyHeader/__wb_guard_probe.ts`（未跟踪）→ 命中 11 spec
  → `exit 2` + 清单；未跟踪文件确实被侦测到（`git ls-files --others` 生效）。
- `node scripts/optimize-deps.mjs`：rc=0，`Hash is consistent. Skipping.`（4.4s）；
  子进程 env 注入经 stub 替身验证可控（注入的开关值在子进程可见）。
- 骨架拆档：`skeleton+boot-splash` 65s rc=0；`boot-splash-iso` 59s rc=0。
- `lint:all`（6 门）全绿；`run-tests.ps1` BOM 保留（`ef bb bf`）、`Parser::ParseFile` 0 错误。

## 未做 / 遗留

- 未跑全量 E2E（红线：需明确放行）；未 commit（等用户确认）。
- `test:smoke` 保留 `-AutoDetect`（语义现为默认侦测，无副作用）。
- 同会话另一分支正在改 `index.html` / `src/components/HeroBanner/HeroBili.css`（未触碰）。
