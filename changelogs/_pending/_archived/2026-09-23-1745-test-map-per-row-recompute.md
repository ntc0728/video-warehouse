---
date: 2026-09-23
module: 文档（tests 映射表逐行重算）+ 工程/工具链（计数与映射一致性门禁）
type: 治本（计数/映射由「手抄文本」改为「可重算产物 + CI 门禁」）+ 死映射清理（21 死 grep 片段 + 2 死 pattern）
build: ✅ lint:all 7 门全绿（build 34.3s；lint:design / lint:css / lint:json / lint:version-sync / **lint:test-map** / eslint / build）
tests: `test:count --check` rc=0「映射引用 / grep 命中 / 档位恒等式 / 文档生成块 全部一致」；未跑浏览器（无需）
files:
  - scripts/test-count-report.mjs（新增）
  - scripts/run-tests.ps1
  - docs/agents/testing.md
  - scripts/lint-all.mjs
  - package.json
  - AGENTS.md
  - docs/agents/runtime-conventions.md
  - docs/knowledge/03-dev-guide.md
  - scripts/README.md
  - scripts/regression.spec.ts
  - docs/test-cases/04-detail.md
  - CLAUDE.md / README.md（根）
demo: （无 UI 改动；证据 = `npm run test:count` 报告 + `npm run lint:test-map` rc=0 + lint:all 7 门）
---

# 映射表「test 数」逐行重算 + 计数口径治本（手抄 → 可重算产物 + 第 7 门）

承接同日 `2026-09-23-1715-e2e-count-recalibration-and-full-run.md` 的「未做」：那份只校准了**总口径**，
并自己写明「表中『test 数』列（按源文件逐行）仍是历史快照」。本轮**逐行重算**，并把根因拔掉。

## 旧（错在哪）

| 位置 | 旧状态 | 问题 |
| --- | --- | --- |
| `docs/agents/testing.md` 映射表 | 逐行「test 数」列 = 历史快照，靠人眼维护 | 表上方虽有「以 `--list` 为准」的警告，但**警告不能防漂**——数字依旧错 |
| `scripts/run-tests.ps1` `$uiTestMap` / `$uiPrecisionMap` | grep 片段与 pattern 长期未随 spec 改名同步 | **21 个死 grep 片段**（regex 永不命中）+ **2 个死 pattern 基路径** |
| `docs/agents/runtime-conventions.md` | 「基线 116 条 / 16 spec … 须同步 **AGENTS.md 计数表**」 | 数字过期 + **死指针**（`AGENTS.md` 里根本没有计数表） |

### 死映射实样（两条典型）

1. **合并标题陷阱**：`run-tests.ps1` 原写 `grep = "BROWSE-020|BROWSE-023|BROWSE-025"`，
   但 spec 侧标题已合并成 `BROWSE-020/023/025: …`。`-grep` 是**对整串标题做子串正则**，
   `BROWSE-023` 在 `BROWSE-020/023/025` 里**没有独立出现** → 该片段**永远零命中**（同理 025）。
   同类：`BrowseMobileBar.tsx` 原逐个列 `BROWSE-070|071|072|074|077|078|079|080|081|082`，
   实际标题是 `BROWSE-070/071/072/074/078/080: …` → 只有「斜杠段首编号」能命中。
2. **pattern 基路径失效**：`src/pages/Browse/FilterBar/**` 与 `src/pages/Browse/SortBar/**` 这两个 key
   **指向的目录早已不存在**（FilterBar 迁到 `src/components/FilterBar/`，排序 UI 与 FilterBar 同目录）
   → 这两个 pattern 永远匹配不到任何改动文件，静默失效。

## 新（治本：计数 = 可重算产物，不是文本）

### 1) 新增 `scripts/test-count-report.mjs`（唯一出口）

读四个事实源后自算，**不再手抄**：

| 读取对象 | 取什么 |
| --- | --- |
| `npx playwright test --list` | 每 spec 的**真实用例数** + 全部用例标题（供 grep 命中验证） |
| `scripts/run-tests.ps1` | `$uiTestMap` / `$uiPrecisionMap` / `$logicTestMap` + `$testGroups`（大括号深度感知切片，保留 regex 转义原样） |
| `scripts/e2e-suite.mjs` | 两阶段名单（`PREVIEW_SPECS` 数组 + `A_EXCLUDE` 的**逗号拼接字符串**形态） |
| `package.json` | 按需档（`test:e2e:skeleton` / `boot-iso` / `shots` / `subpages`） |

CLI：`--markdown`（打印）｜`--list-file <p>`（离线复用枚举）｜`--write`（写回 testing.md 生成块）｜`--check`（只校验）。

`--check` 五验，任一失败 `exit 1`：
① 映射引用的 spec 文件**存在**；② pattern 基路径**存在**；③ grep 每个 `|` 片段**真的命中 ≥1**
（按 `--grep` 的真实语义套在真实标题上，非纸上推演）；④ **档位恒等式**（Stage A + B = 默认套；默认套 + 按需 = 全仓）；
⑤ `testing.md` 生成块**未过期**。

### 2) `docs/agents/testing.md` 映射章改为「说明 + 生成块 + 手写口径」

- 生成块用 `<!-- test-counts:begin ⚙️ … -->` / `<!-- test-counts:end -->` 包裹，内含三张表：
  ① 档位汇总（10 行）② 每 spec 用例数 + 归属档位（22 行）③ 源文件 → spec 事实表（61 行，
  含「全量合计 / 精粒度 grep / grep 命中」三列——**「grep 命中」列即用户要的逐行真值**）。
- 块外保留人写不出来的东西：**11 条读表与使用口径**（精粒度优先于兜底、并集语义、懒加载契约、
  `A_EXCLUDE` 形态、flaky 定性、改映射流程…），块内不出现任何人写解释 → 机器改块、人改口径，边界清晰。
- **逐行重算结果**：61 行「全量合计」全部由 22 个 spec 的 `--list` 实数累加得来，不再取快照
  （例：`src/components/Layout/**` 12 spec 合计 **110**，grep 命中 **40**；`FilterBar` 存续行改挂
  `src/components/FilterBar/**`，命中 **4**）。

### 3) `scripts/run-tests.ps1` 死映射清理（21 + 2）

- `$uiTestMap["src/pages/ProxySetup/**"]`：`scripts/regression.spec.ts` → `scripts/proxy-setup.spec.ts`
  （09-21 拆分后老引用已废）。
- 去死 grep 片段（保留并补注释说明**为什么**）：`useBrowseData.ts` → `BROWSE-020|030|060`；
  `BrowseMobileBar.tsx` → `BROWSE-070|077|081`；`Layout/**` 去 `13\.1|13\.12|3\.17` 且去重 `regression.spec.ts`（原 3 次）；
  `SearchBox/**` 去 `5\.9`；`VideoCard/**` 去 `2\.5|2\.6`；`RecordShell/**` 去 `7\.6` + `收藏页动画`；
  `IPTVChannelCard/**` 去 `IPTV 卡片`；`EPGProgramList/**` 去 `5\.9`（备注 11.5 缺口）；`epgService.ts` 去 `5\.9`；
  `usePlayerStore.ts` 去 `4\.10`。
- 换死 pattern：`src/pages/Browse/FilterBar/**` + `.../SortBar/**` → `src/components/FilterBar/**`。
- 补注释两处易误判点：① `$uiTestMap` 仅在**未命中任何精粒度条目**时生效；
  ② 运行时 stale 检测是**宽松口径**（只在整条 grep 全零命中时告警），抓不到个别失效片段 → 逐片段校验只能靠 `test:count`。

### 4) 门禁化（防再漂）

| 改动 | 内容 |
| --- | --- |
| `package.json` | 新增 `test:count`（`node scripts/test-count-report.mjs`）与 `lint:test-map`（`… --check`） |
| `scripts/lint-all.mjs` | 门数 **6 → 7**，插入 `lint:test-map (测试映射/计数漂移)`；沿用「跑完不短路」的汇总口径 |
| `AGENTS.md` 红线 6 | 追加「改 `run-tests.ps1` 映射 / 加删用例后**必须**跑 `npm run test:count`」，并记下本次查出 21+2 的事实 |
| `docs/agents/runtime-conventions.md` | 计数事实源 = `testing.md` 生成块一处；删死指针（AGENTS.md 计数表） |
| `docs/knowledge/03-dev-guide.md`、`scripts/README.md`、`CLAUDE.md`、`README.md` | E2E 命令段同步（禁裸 playwright / 动态端口 / 勿加 `--workers` / 新脚本与新档位） |
| `scripts/regression.spec.ts` | 头注释纠偏：**55 → 30**（并写明 proxy-setup 于 09-21 拆出） |
| `docs/test-cases/04-detail.md` §3.10 | 指向改为 `regression.spec.ts` 的「详情页回归」（原指向已拆走的 `regression-detail.spec.ts`） |
| `docs/fix-plan-2026-08-12.md` | 历史计划加注（顶部提示 + 两处 `~~AGENTS.md 计数表~~` 划除并指向 `test:count`），只加注不改原结论 |
| **`.gitignore`** | **补 `!scripts/test-count-report.mjs`** ——见下方「差点漏掉的一环」 |

### 5) 差点漏掉的一环：新脚本本会被 `.gitignore` 吃掉

`.gitignore:117` 是 `scripts/*.mjs`（默认忽略所有 scripts 下的 mjs，只对被已跟踪文件无效）。
`test-count-report.mjs` 是**新文件** → 落进忽略区 → `git status` 里根本不出现 → **commit 会漏掉它**，
结果是：本地门禁绿、CI/新克隆上第 7 门直接找不到脚本而失效，生成块也永远没法 `--write` 刷新。
已按同区既有写法补显式白名单（附注释说明「缺此文件门禁与生成块全失效」）。
**教训**：`scripts/` 下新增 `*.mjs` 一律先 `git check-ignore -v <path>` 自检，别只看 `git status` 有没有。

## 验证

| 项 | 结果 |
| --- | --- |
| `npm run test:count -- --check` | **rc=0**，「✓ 映射引用 / grep 命中 / 档位恒等式 / 文档生成块 全部一致」 |
| 计数复核 | 全仓 **246 / 22 spec**；默认套 **132 / 16**（A 108/12 + B 24/4）；回归组 **121 / 13**；smoke 37/3；shots 29/1；skeleton 39/2；boot-iso 42/1；subpages 4/2 |
| `npm run lint:all` | **7 门全绿**（`lint:design` / `lint:css` / `lint:json` / `lint:version-sync` / `lint:test-map` / `lint` / `build` 34.3s） |
| 冲突排查 | `docs/` 内已无「116 条 / 16 spec」「AGENTS.md 计数表」等旧口径与死指针；`scripts/e2e-suite.mjs` 头注释本就委派 testing.md，无需改 |

## 遗留

- 未 commit（等用户确认）。
- 未跑浏览器 E2E：本轮全为文档/映射/工具链改动，`test:count` + `lint:all` 已覆盖其风险面；
  全量 `test:e2e` 需用户明确放行。
