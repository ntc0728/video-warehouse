---
date: 2026-09-16 21:00
module: Player/IPTV/Person/History/SourceChecker/services
type: fix
build: tsc -b 通过 / vitest 33 文件 389 用例全过 / ESLint 0 error 3 warning（均既有）/ vite build ✓
files: [src/pages/Player/hooks/useCMSSourceManager.ts, src/lib/concurrency.ts, src/services/videoService.ts, src/pages/SourceChecker/index.tsx, src/pages/Person/index.tsx, src/hooks/useBackdropLoader.ts, src/services/iptvService.ts, src/components/UniversalPlayer/UniversalPlayer.tsx, src/stores/useUserStore.ts, src/pages/Collections/index.tsx, src/pages/History/index.tsx]
demo: none
---

# 2026-09-16 21:00 接口审查清单剩余 7 项清零（批 4）

## P0-4 切源复用旧源 vod_id

- **问题**：CMS 视频（`id` 非 `tmdb-`）走到末尾「电影/单季剧集」分支时**无条件** `fetchVideoDetail(sourceIdx, id)`；切源后 `sourceIdx` 是新源而 `id` 是**旧源的 vod_id**（vod_id 源内主键、跨源不通用，见 `useCMSSourceManager.ts:249-255` 自注）→ 拉到同 id 的别的片子 / 空白。
- **新逻辑**：放行条件（任一）① 非「显式指定源」（`isSwitching=false`）；② `videoCache` 证明该 id 在目标源取过详情（`cachedEntry.sourceIndex === sourceIdx`，Collections/History 二次进入最常见）；③ 历史记录证明 vod_id 属于目标源（`histRecord.cmsSourceId/cmsSourceName` 比对 `allSrc[sourceIdx]`）。都不成立改走 `searchVideoFromSingleSource(标题+年份)`；连标题都没有时宁可不发请求也不写错数据。
- **关键语义坑**：`isSwitching`（= `targetSourceIndex !== undefined`）**不等于「切源」**——`Player` 主 effect 会 `fetchCMSSources(routeSourceIndex)`，而 Collections 跳播传的 `state.sourceIndex` 是**匹配结果所属源**，未必是 id 的来源。故不能把「首次进入带 routeSourceIndex」当跨源，必须靠 ②/③ 这类「id 归属证明」区分。TV 分支本来就按标题搜季，不涉及。

## 新增通用工具 `src/lib/concurrency.ts`

`mapWithConcurrency(items, limit, mapper)`：结果顺序 = 输入顺序（调用方常依赖顺序，如按搜索结果序写 Map 决定「第一季是谁」）；快速失败；limit 规整到 [1, n]。**全仓此前无任何并发控制工具**（`asyncPool` 是 `useBackdropLoader` 内私有实现）。

## P1 TV 季集串行 N×M（`services/videoService.ts`）

- **问题**：`searchVideoSeasonsFromSingleSource` 对 `data.list` 每个「第X季」条目 `for + await resolvePlaySources`；缺 `vod_play_url` 时还要再打一次详情 → N 季 = N 次串行 RTT。
- **新逻辑**：拆「阶段 1 同步筛选（按季号去重 + 挑第 1 季回退候选，零请求）→ 阶段 2 `mapWithConcurrency(tasks, 4)`」，再按任务序写回 Map。语义逐字等价（首个同名季号胜出、回退条目空结果不占位、写入顺序不变）；`signal.aborted` 检查保留。注：`searchVideoFromMultipleSources` 本来就是 `Promise.allSettled` 并行，非瓶颈。

## P1 SourceChecker 串行全量探测 + 口径不一致

- 根因 A：`checkIPTVSources`/`checkVideoSources` 均 `for + await`，最坏（全不可达）IPTV 源 ×8s ≈ 80s，页面像卡死 → 改 `mapWithConcurrency(sources, 4)`；进度用完成计数，结果用「到达序」数组渐进展示，返回值仍是输入序。
- 根因 B（**口径**）：探测用 `getText(source.url)` **直连**，而真实拉频道走 `fetchAndParsePlaylist` → `buildSourceProxyUrl(url, proxyUrl)`。配了代理时能播的源被判「不可用」（假红）→ 探测复用 `buildSourceProxyUrl`，与真实取流同口径。

## P1 Person 页零缓存

- 加**会话级 LRU 缓存**（TTL 30min，上限 20，Map 插入序当 LRU，命中 delete+set 移末尾；仅内存不落库）→ 命中即同步回显，零请求零骨架。
- 顺带重构：3 请求从 `useLayoutEffect` 内 IIFE 抽成 `loadPerson(personId, {force})` useCallback → ① 下拉刷新拿到**真 Promise**（原只 bump nonce → 浮层立即判成功、失败不可见、不等结束）；② `personReqSeqRef` + `AbortController` 双保险；③ force 刷新保留旧内容静默替换。
- 坑：`loadPerson` 失败会 re-throw，挂载处必须 `.catch(() => {})`。另把 `sortByYearDesc` 提到模块作用域。

## P1 History 背景图 N+1（`hooks/useBackdropLoader.ts`）

- 现状已有去重 + `asyncPool(3)` + 批量提交，「N+1」真实缺口是：① **未按 videoId 去重再取前 20 名额** → 一部 10 集的剧吃掉 10 个名额（实际只补到 2~3 部片）；② `processedRef` 是 **per-mount** 的 → 回一次历史页重发一轮，负结果还会无限重试。
- 新逻辑：筛选时按 videoId 去重；新增跨挂载 `backdropCache`（TTL 6h，**负结果同样缓存**，网络错误不缓存以便重试）。

## P1 多代理只生效第一项

- **问题**：代理支持 `;` 分隔多个（`getIptvProxyList`），但 `shouldProxy` / `buildProxyUrl` / `buildSourceProxyUrl` **全取 `getPrimaryIptvProxy`（第一个）** → 第 2 个起是死配置，主代理挂 = IPTV 全站不可播。
- 数据侧：新增「活跃代理」——`_activeProxyOffset` + `getActiveIptvProxy()` + `advanceIptvProxy()`（模块级状态，因 `buildChannelPlayUrl` 有 7+ 调用点，逐个透传会污染所有签名，而「代理可用性」本就是全局事实）。三处 URL 构造改用活跃代理；新增 `buildSourceProxyUrlWith(url, proxy)` + `fetchWithProxyFallback(rawUrl, proxyConfig)`（按配置顺序依次尝试），接入 `fetchAndParsePlaylist` 与 `fetchSingleSourceChannels`；`getPrimaryIptvProxy` 标 `@deprecated`。
- 播放侧：`UniversalPlayer.handleAdapterError` 在「直连失败→走代理」之后新增 A3+ 分支——已走代理仍失败 → `advanceIptvProxy` 换下一个代理重建 URL 重试。上限靠 `proxyRotationTriedRef`（**URL 集合**，与 `bareStreamRetriedRef` 同策略）：轮换前把 `currentUrl` 记入集合，候选命中即停 → 天然等于「最多试完所有代理」。**注意 `UniversalPlayer:1015` 那个 effect 会在每次 currentUrl 变化时复位 `proxyRetriedRef`，轮换记录不能放那儿**。

## P2 Collections/History 读库失败与「真的没数据」不可区分

- store：`UserState` 新增 `loadError`；`_loadFromDB` 与 `reload` 的 catch 都写原因，成功路径清 null；`reload` 仍向上抛。
- 页面：Collections 在「无数据 + loadError」渲染 `<Empty status="error" onRetry={reload}>`；History 同构。**有数据时读失败不切错误态**（保留旧数据），反馈交给下拉刷新 toast。
- 坑：`reload` 会 throw，`onRetry` 里 `void reload()` 必须跟 `.catch()`。
