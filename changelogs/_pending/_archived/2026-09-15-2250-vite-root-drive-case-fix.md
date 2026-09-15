---
date: 2026-09-15 22:50
module: build
type: fix
build: 小写 cwd 复现验证 + Bash 直跑 built in 22.49s
---

# 2026-09-15 22:50 修复 Bash 环境下 vite build 确定性失败（盘符大小写）

## 现象

WorkBuddy Bash 工具下 `vite build` 确定性报
`[vite:html-inline-proxy] No matching HTML proxy module found from
F:/video-warehouse/index.html?html-proxy&inline-css&index=0.css`，
HEAD 同样复现（与代码改动无关）；产物路径出现 `dist/f:/video-warehouse/...`
的绝对路径命名。

## 根因

Bash shim 会把工作目录设为**小写盘符** `f:\video-warehouse`
（PowerShell 下是 `F:\`，`realpathSync.native` 可证磁盘真实大小写为大写）。
Vite/Rollup 内部路径比较对 Windows 盘符大小写敏感（normalizePath 不归一
大小写）：模块 id 一边由 cwd 派生（小写 f:），另一边由 realpath / esbuild
解析派生（大写 F:）→ html-proxy 注册表查不到对应 id → 构建失败；
`startsWith(root)` 类大小写敏感匹配失败也让产物命名回退成绝对路径。

## 修复（vite.config.ts）

- 新增 `projectRoot = fs.realpathSync.native(__dirname)`：把 root 钉到
  磁盘真实大小写，`defineConfig({ root: projectRoot })`；
- `resolve.alias['@']` 同步从 projectRoot 派生（小写 cwd 下 `__dirname`
  也是小写，alias 派生的模块 id 会残留大小写不一致）。

任何 shell / 任何 cwd 大小写下，全部模块 id 一致，不再依赖
「先 cd 大写盘符」的手工规避。

## 验证

- 复现验证：spawnSync 强制 `cwd: 'f:\video-warehouse'`（真小写）+ 新配置
  → 原先 transform 一结束（~13s）必炸的 html-proxy 错误不再出现，
  干净进入渲染阶段；
- 回归验证：Bash 下直接 `vite build` → `built in 22.49s`，EXIT=0；
- 备注：本沙箱会 SIGTERM 掉 node spawnSync/detached 出来的长构建子进程
  （pipe 与 fd stdio 均复现），但 bash 直连子进程不受影响 —— 长构建请在
  Bash 工具里直接前台跑，不要经 node spawnSync 中转。
