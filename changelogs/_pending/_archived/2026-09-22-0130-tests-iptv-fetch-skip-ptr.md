---
date: 2026-09-22
module: tests / iptv / player / pull-to-refresh
type: test
build: npx tsc -b 通过；eslint 改动文件 0 error；npx vite build 通过；vitest run 全量 37 files / 435 passed（原 385，+50）
files:
  - src/services/iptvFetchPipeline.test.ts（新增，16 条）
  - src/stores/useIPTVStore.refreshChannels.test.ts（新增，6 条）
  - src/hooks/useIPTVAutoRefresh.test.tsx（新增，7 条）
  - src/components/UniversalPlayer/hooks/useSkipLogic.test.ts（新增，11 条）
  - src/components/ui/PullToRefresh/PullToRefresh.test.tsx（4 → 10 条）
---

# 单测补齐 50 条：IPTV 取流管线 / 静默刷新 / 自动刷新 / 跳过片头 / 下拉刷新守卫

零 src 改动、零共享 mock 改动、零 E2E —— 全部经既有公开 API 或已导出符号观测。

## 覆盖矩阵（旧 → 新）

| 域 | 旧 | 新 |
| --- | --- | --- |
| `iptvService` 取流管线 | `iptvService.test.ts` 仅纯 URL 函数（`detectSourceType`/`shouldProxy`/`buildProxyUrl`/`unwrapProxy`/`parseM3U8Content`/`buildCatchupUrl`/`buildChannelPlayUrl`） | 新增 `iptvFetchPipeline.test.ts`：代理列表归一与轮换循环；`/m3u8-proxy` 拼接与解嵌套；**多代理逐个兜底顺序**（主挂切备用）与全败取**最后一个**错误；`getText` 口径 `{timeout:6000, retries:0}`；**竞速窗口（1500ms 收尾 / 8000ms 兜底 / 全 settle 不空等）**；**「被放弃 ≠ 真实失败」不进 `sourceErrors`**；跨源 `id` 前缀去重与 `bySource` 分组。经已导出的 `fetchAndParsePlaylist` 观测，未改任何 export |
| IPTV 频道刷新 | `useIPTVStore.test.ts` 仅到 `toggleFavorite`/`setChannels`/`recordPlay`/`clear*` | 新增 `refreshChannels.test.ts`：**静默刷新契约**（已有频道时全程 `isLoading===false`，patterns.md 点名、此前零覆盖）；首载才 loading；**单飞锁**（连点只打一次上游、落地即释放）；双败错误透传；org × 本地「勾选才用本地流」（顺带覆盖私有 `mergeOrgWithLocal`） |
| IPTV 自动刷新 | `useIPTVAutoRefresh.ts` 无测试 | 新增：挂载即刷；5min 检查节流累计满 interval 才刷；非 `/iptv` 零触发；开关关零触发；`intervalHours<=0` 零触发；`isLoading` 在飞不打扰；卸载清定时器 |
| 跳过片头（播放侧） | 仅 `settings.spec.ts` SET-040 测设置页开关 UI | 新增 `useSkipLogic.test.ts`：片头 `ct>0.5` 与阈值边界；幂等（只跳一次）；`reset()`；阈值 0 不 seek；片尾区间与边界；开关独立 |
| 下拉刷新守卫 | 4 条（armed 阈值 / refreshing→success→idle / 未过阈值回 idle / variant 热切换） | 6 → 10 条：补 `enabled:false`、`scrollTop>0`、`dy<=6`、`buttons=0`、鼠标非左键 五条接管守卫；armed 后向上回移归零且不触发刷新 |

## 关键结论（沉淀）

1. **不需要为可测性改 src**：`useSkipLogic`/`advanceIptvProxy`/`fetchAndParsePlaylist` 均**已导出**；`iptvService` 对外只有 `getText` 一个可 mock 出口（`vi.mock('./httpClient')` 即可控全部取流分支）。原方案拟加的 `export settleWithWindow`/`fetchWithProxyFallback` 与抽 `resolveSkipIntroTarget` 纯函数**均为多余**。
2. **测试文件参与 `tsc -b`**（`tsconfig.json` `include:["src"]` + `noUnusedLocals`）→ 新增测试文件必须过 `tsc -b`，否则 CI 挂。
3. **不做的两类**：`page.clock` 验 IPTV 自动刷新（install 会同时 fake `requestAnimationFrame` → 揭示动画冻结 → 「无骨架闪烁」变假绿；该契约本质是 store 状态 `isLoading`，单测更精确）；失焦自愈 E2E（`resume()`/`reviveFrozenVideo` 在 headless 无栅格化，零可观测）。

## 顺带查实（未改代码）

- `buildSourceProxyUrlWith` 对「已由本代理包装过的 URL」会**二次包装**（`unwrapProxy` 刻意保留本代理包装，拼接侧无自包装检测）；用户手填裸 URL 的正常路径不触发，属潜在边界。
- `iptvService.ts` 注释写「绝对上限 20s」，实参是 `8000` —— 注释与实参矛盾（文档 bug，未修）。
