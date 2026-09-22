---
date: 2026-09-22 22:05
module: scripts/run-tests
type: fix
build: true
files:
  - scripts/run-tests.ps1
  - docs/agents/testing.md
---

# run-tests.ps1 Home 段映射漂移修复 + 失效检测防注释假阳性

## 问题

home.spec.ts 激进合并（46→13 条）后用例标题改为中文+裸数字，`$uiPrecisionMap` Home 段仍用 `HOME-001|...` 前缀，playwright `--grep` 零命中（`--list` 实证 0 tests）。失效检测用 `$specContent -match` 匹配原始文件，头注释 `HOME-001~005` 造成假阳性，旧映射静默存活。

## 旧↔新

| 映射 | 旧 grep | 新 grep |
| --- | --- | --- |
| `src/pages/Home/index.tsx` | `HOME-001\|...\|HOME-058`（全死） | `1\.1\|1\.2\|1\.3\|1\.4\|1\.5\|1\.7` |
| `src/pages/Home/Home.css` | `HOME-030\|...\|HOME-058`（全死） | `1\.[1-7]` |
| `src/pages/Home/continueItems.ts` | `$uiPrecisionMap` + 死 grep | 移入 `$logicTestMap` → vitest |
| `src/components/TMDBMovieRow/**` | `HOME-030\|...\|HOME-058`（全死） | `1\.4` |
| `UniversalPlayer/ControlBar/**` | 含死号 `PLAYER-002\|003\|090` | `4\.1[^0-9]\|4\.5\|4\.8`（防吞 4.11+） |
| 失效检测 | 匹配原始内容（注释假阳性） | 先剥 `/* */` 与 `//` 再匹配；空 grep 跳过 |

## 验证

- `playwright --list`：`1\.1|...|1\.7` → 13 tests；`1\.4` → 1；`4\.1[^0-9]|4\.5|4\.8` → 3
- 映射模拟：stale-check 0；死映射 `HOME-001...` / `PLAYER-002...` 均被正确标警 2/2
- `.ps1` BOM 保留 `EF BB BF`；`npm run build` ✓
- `docs/agents/testing.md` 示例 `-Grep "HOME-010|..."` → `"1\.4|1\.5"`
