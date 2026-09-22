---
date: 2026-09-22 21:15
module: build/versioning
type: fix
build: true
files:
  - package.json
  - docs/agents/versioning.md
  - docs/knowledge/06-adr.md
  - CHANGELOG.md
  - capacitor.config.ts
demo: npm run build ✓；node scripts/sync-android-version.mjs ✓（v1.27.1 → versionCode 127010）
---

# 修复 sync-capacitor-version 断链引用，统一为 sync-android-version

【问题】脚本早已从 `scripts/sync-capacitor-version.mjs` 更名为 `scripts/sync-android-version.mjs`（CI 两个 workflow 已用新名），但 4 处引用未同步，其中 `package.json` 两处是**运行时断链**：`npm run build:android` / `npm run sync:capacitor-version` 会因找不到文件直接失败。

【旧 → 新】
- `package.json`：`sync:capacitor-version` → `sync:android-version`；`build:android` 内路径 → `scripts/sync-android-version.mjs`
- `docs/agents/versioning.md` §3：脚本名更正；versionCode 公式去掉不存在的「通道序」（现脚本为 `major*100000+minor*1000+patch*10`，无通道）；写入目标补 `android/app/build.gradle`；独立命令名同步
- `docs/knowledge/06-adr.md` ADR-004：同上公式与脚本名更正
- `CHANGELOG.md` 文末「当前状态」：脚本名更正
- `capacitor.config.ts`：跑 `sync-android-version` 后从陈旧 `1.4.0/104000` 同步为 `1.27.1/127010`（原漂移修正）

【保留不改】`changelogs/2026-07-30.md` 两处为历史流水原貌，不回改。

【验证】`package.json` JSON 解析 ✓；`node scripts/sync-android-version.mjs` ✓；`npm run build` ✓；全仓 grep 仅剩历史流水 2 处旧名。
