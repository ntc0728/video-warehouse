---
date: 2026-10-11 18:55
module: deps / patches / pnpm-lock
type: fix
build: pass
files:
  - patches/vite@6.4.2.patch
  - pnpm-lock.yaml
demo: 无
---

# 2026-10-11 18:55 — 修复 Cloudflare 部署 frozen install 失败（vite patch 非法 + lock 未同步）

## 现象
Cloudflare Workers 构建 `pnpm install`（CI 默认 frozen）报
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH: "patchedDependencies" configuration doesn't match the lockfile`。

## 根因（e5a1e20 遗留的双重缺陷，本地链路无法暴露）
1. **lock 未同步**：e5a1e20 往 package.json 加了 `pnpm.patchedDependencies` + 手写 patch，但没跑
   `pnpm install` 更新 pnpm-lock.yaml（lock 无 patchedDependencies 记录）→ frozen 校验直接挂。
2. **patch 本身非法**：手写 diff 的 hunk header 计数/上下文不完整，`ERR_PNPM_INVALID_PATCH:
   hunk header integrity check failed`——就算修好 lock，下一步 apply 也会挂。
3. **为何本地没发现**：本地日常 `npm run build/dev`——npm 完全不读 pnpm-lock.yaml、也从不 apply
   pnpm patch；e5a1e20 当时的「验证通过」是**手改 node_modules/vite 现场文件**的副作用，
   patch 从未通过合法 apply 验证。CI（frozen pnpm）是链路第一个严格校验点，首次部署即爆。

## 修复
- 用 pnpm 官方流程在隔离临时目录重生成合法 patch：`pnpm patch vite@6.4.2` → 按原修复意图
  （先 `listen(port)` bind 端口、`initServer(true)` 并行，语义同 e5a1e20）编辑 → `pnpm patch-commit`。
  patch 内容新旧一致，仅格式合法化（index hash + 完整 hunk 计数与上下文）。
- `pnpm install --lockfile-only` 同步 lock：`settings.patchedDependencies` 记录 + vite 及其
  依赖方全部带 `patch_hash` 后缀，无版本漂移（+20/−15 行）。

## 验证
- CI 等效（临时目录复制 package.json/lock/.npmrc/patches 全量 `pnpm install --frozen-lockfile
  --ignore-scripts`）：EXIT=0，且安装的 `node_modules/vite/.../dep-Dq2t6Dq0.js` 含
  `listenPromise` 修改行 → patch 真实生效。
- `npm run build` ✓（lock/patch 改动不影响 npm 路径）。
- ⚠️ 遗留观察：本地 npm 环境下该 patch 本来就不生效（npm 不认 pnpm patch），
  vite listen-order 修复实际只在 pnpm/CI 安装路径存在；若要本地 dev 也吃到需改用 pnpm 或把
  逻辑挪进 vite.config.ts 插件——本次未扩面，待拍板。
