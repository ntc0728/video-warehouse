---
date: 2026-09-21
module: layout-tokens/e2e
type: refactor
build: npm run build 通过（tsc -b && vite build，2287 模块）；默认 e2e 两阶段 exit 0，墙钟 143.4s
files:
  - src/assets/styles/layout-tokens.css（新建：6 布局 token 唯一真源）
  - vite.config.ts（inject-layout-tokens 插件：构建期注入 index.html <head>）
  - index.html（骨架读 var()；删内联媒体阶梯 + colCount JS 手抄表；写 data-device）
  - src/assets/styles/variables.css / index.css / Home.css（删各自 token 阶梯，收敛单真源）
  - scripts/boot-splash-iso.spec.ts（新增：七视口同构取证）
  - scripts/proxy-setup.spec.ts（新增：从 regression.spec 抽出设置页子页用例）
  - scripts/verify-grid.spec.ts（删除：无断言手工脚本死件）
  - scripts/regression.spec.ts（细节修复B 兜底等待 10s→26s；代理配置块抽出）
  - scripts/iptv-player.spec.ts（TV-001/002 改读单个 .marquee-text）
  - scripts/browse.spec.ts（BROWSE-095 mock 延迟 3000→1500）
  - scripts/e2e-suite.mjs / e2e-skeleton.mjs / package.json / docs/agents/testing.md（E2E 结构整改，见下）
---

# 布局 token 单真源收敛 + E2E 结构整改（最终态合并记录）

## 一、布局 token 单真源
启动骨架列数原有「内联媒体阶梯 + `colCount(kind)` JS 手抄断点表」两处第二真源，与真实网格必然
漂移。新建 `layout-tokens.css` 作 6 token 唯一源，双路消费：vite 插件注入 index.html + variables.css
`@import`。骨架与真实页从此共读同一 token。`boot-splash-iso.spec` 把「任意视口骨架 == 真实页」
变成机器可断言 + 截图取证，**不依赖接口数据**。设备档由骨架脚本写 `<html data-device>`（与 AppLayout 同值）。

## 二、E2E 结构整改（指令与功能地图以 docs/agents/testing.md 为准，此处不重复）
- 默认套两阶段：A dev 行为全套 + B preview 播放器系。移出默认套、改按需（**保留覆盖，非删除**）：
  骨架三兄弟 → `test:e2e:skeleton`；设置页子页 source-checker/proxy-setup → `test:e2e:subpages`；截图 → `test:e2e:shots`。
- 别名收敛：删 `test:e2e:raw` / `test:e2e:preview`（僵尸源/脚枪）；新增 `--only` 单跑 + 上述按需入口。
- chart / person 是顶级业务路由 → **保留**默认套；只移子页，不移顶级路由。

## 三、关键不可逆结论（勿反复试探）
- 行为套整体改投 preview：**证伪**（home 面板稳定性 / cross-tab 依赖 dev；preview 单轮 245s 且红）。
- 两阶段并行分片 + merge-reports：本机 8 chromium 抢 CPU → Stage B 播放器/骨架成片 16 failed → **默认串行**；仅强 CPU 机 `E2E_PARALLEL=1`。
- dev 冷启 ~21.7s 非冷缓存（vite deps 已缓存 + warmup 已调优），是模块图重爬 + 少量真需 dev 的用例 → 不可省。
- 全量墙钟演进：216.6 → 203.6 → 188.4 → 142.0 → **143.4s**（累计 −73s；末两步是纠正 chart/person 误移 + 只移子页，几乎不再降）。

## 四、测试修复（均不砍断言，对齐真实行为）
- `TV-001/002`：`.up-channel-item-name` 溢出时含 MarqueeText 无缝滚动克隆的第二份 → 改读单个 `.marquee-text`。
- `细节修复B`：LazyImage S4 有界重试把挂起→兜底收敛拉到 ≈21.6s → 等待 10s→26s 覆盖该计时链。
- flaky 已知：`player.spec` 挂载窗 M01/M13 首挂重过；`cross-tab` run-to-run 抖动。既存、非本改动引入。
