---
date: 2026-09-15
tags: [eslint, guardrail, lint]
---

## lint:all 全绿收官 + 护栏演进落地

### ESLint 历史 error 清零（11 → 0）

| 类型 | 处数 | 修复方式 |
| --- | ---: | --- |
| `prefer-const` | 3 | `categoryPanelData.ts` / `useBackdropLoader.ts` 直接改 const；`iptvService.ts` 的 `maxTimer` 是「未初始化 + 仅赋值一次」，声明移到唯一赋值点改 const（executor 同步执行，回调期才读，无 TDZ 风险） |
| `no-explicit-any` | 5 | `routeConfig.ts` 按文件既有惯例补 disable 注释；`database.test.ts` ×4 新增结构化 `RawDB` 接口替代 `as any`（比 4 条 disable 更有价值） |
| `react-hooks/rules-of-hooks` | 1 | **真 bug 类**：`isNativePlatform() \|\| useIsRealPhone()` 短路使 Hook 条件调用，Hook 链跨端不一致。改为无条件调用再取或（`useIsRealPhone` 是一次性 `useState(getIsRealPhone)`，零副作用） |
| `no-useless-escape` | 1 | `useScreenshot.ts` 文件名正则 `\"` → `"` |
| `no-restricted-imports` | 1 | `CmsSourceBlockedModal.tsx` 改走 `@/lib/navigation` 的 `useCustomNavigate` 统一导航入口 |

验证：ESLint src 全绿、`tsc -b` ✓、`database.test.ts` 7/7 ✓。

### 护栏演进（方案 §5.2）

- **`lint:all` 全跑不短路**：新 `scripts/lint-all.mjs` 总闸——五个门（design-audit / stylelint / json-dup-key / ESLint / build）顺序全跑，失败也继续，末尾汇总，任一失败 exit 1。原 `&&` 链前面的门一失败，后面的根本不执行。
- **JSON 重复 key 检查**：新 `scripts/json-dup-key-check.mjs`（`pnpm run lint:json`）。`JSON.parse` 对重复 key 静默保留最后一个（A1「静默失效」家族根因），字符级扫描支持 JSONC 注释，同对象层级重复即报错。**不能**用 reviver 实现（解析后调用，重复已被折叠）。已做阳性自测：构造 3 处重复（含嵌套层级）全中。
- **stylelint 基线棘轮：评估后不做**——存量已归零，`lint:css` 本身就是 0 容忍的「活棘轮」，再加快照机制是纯冗余维护面。理由记入方案 §5.2。

### 连带

- `BASELINE.md` #12 护栏命令补 `lint:json`，`lint:all` 注明「全跑不短路」
- 方案 §5.2 标注落地方式、§5.3 / §6 状态更新
- `.gitignore` 白名单登记两个新脚本（`scripts/*.mjs` 默认忽略策略）
