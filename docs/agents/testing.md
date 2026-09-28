# 测试依赖映射 · 快速跑法 · 增量测试

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

## TMDB Mock 策略

测试通过 `scripts/fixtures/mock-tmdb.ts` 拦截 `api.tmdb.org` 请求，返回本地 mock 数据。

| 模式          | 命令                                              | Token 风险 |
| ----------- | ----------------------------------------------- | -------- |
| Mock 模式（默认） | `npx playwright test`                           | 无        |
| 真实 API 模式   | `TMDB_MOCK=false npx playwright test`           | 有        |
| 增量测试        | `.\scripts\run-tests.ps1`（mock）/ `-RealApi`（真实） | 按模式      |

Mock 覆盖：trending / search / discover / movie detail / tv detail / person / genres / images。

> **⚠️ 播放页沙箱 mock（2026-09-01）**：`scripts/player.spec.ts` 改从 `scripts/fixtures/cms-mock.ts` 引入  
> `test`（它内部 `extend` 自 `mock-tmdb`）。`cms-mock` 在 TMDB 拦截之外再叠加两条规则：
>
> 1. 拦截 CMS 搜索请求（`ac=videolist`，**注意经 CORS 代理包装后会被编码成 `ac%3Dvideolist`**，两者都要匹配）  
>    返回固定 `CMSListResponse`（`vod_play_url` 指向本地 `cms-mock.local` 的 HLS 流），使播放器可靠挂载 `.up-universal-player`。
> 2. 拦截 `cms-mock.local` 的 m3u8/ts，从 `scripts/fixtures/hls/stream/`（ffmpeg 生成的本地 HLS）直接 fulfill，hls.js 可完整初始化。  
>    这样播放页测试不再依赖沙箱不可达的 CORS 代理 / CMS 源，消除 M04/M09/M12/M15 等移动端 flake。


### IPTV 频道数据种子（`scripts/fixtures/iptv-seed.ts`）

播放页的「频道列表」断言需要 `channels` 非空才会渲染 `.up-channel-list-body`，
但 e2e 不应依赖真实 IPTV 源。该 fixture 用**注入缓存**喂数据（零网络请求）：

```ts
await page.goto('/', { waitUntil: 'domcontentloaded' });   // 必须先访问一次同源页
await page.waitForSelector('.app-shell');
await seedIptvChannels(page, ['CCTV-1 综合', 'CCTV-5 体育赛事高清']);
await page.goto('/iptv/play?url=test&id=ch-1&name=CCTV-1%20%E7%BB%BC%E5%90%88');
```

三个**不能错**的细节（详细根因写在 fixture 头注释里，改前先读）：
① 必须先访问一次同源页面 —— 否则 `indexedDB.open` 会开出一个没有任何 store 的空库，
应用随后按 v8 升级时 upgrade 已被跳过；
② localStorage `iptv-store` 必须 `version: 0`（zustand persist 版本号）且
`settings.aggregatorUrls` **非空**（为空时 `loadFromCache` 直接 return false）；
③ IndexedDB 记录的 `sourceUrls` 必须与 `aggregatorUrls` 逐元素、保持顺序相等
（`getCachedIPTVChannels` 刻意不做 sort 比较，源顺序决定频道 `sourceId`）；
另外频道不要带 `sourceId: 'source-N'` 前缀，`loadFromCache` 会把这类本地源频道过滤掉。

## TMDB 跨页漂移 mock（逻辑分页护栏）

真实 TMDB 按流行度排序，**相邻页请求之间序会漂移**（页 N 尾 = 页 N+1 头出现相同条目）。
`fixtures/mock-tmdb` 的静态 mock 复现不了——`useLogicalPage` 的跨缓冲区去重、切筛选空页等
bug 只在漂移数据下暴露。需要验证分页行为时，route 层把 discover 两路改成
`startId = base + pg * (PAGE_SIZE - 2)`（人为 2 条重叠）再断言：

- 每页卡片数恒 `cols × 5`（1440 → 35）、console 零 `same key` 警告；
- 切「电影/剧集/全部」后网格仍 35 张（合并页大小 M 随媒体类型变 20/40 的护栏）；
- 跳页输入 9999 → 落到 `ceil(500·M/P)` 钳制末页（不是接口报的 total_pages）。

## 分页器门控护栏（BROWSE-094/095）

`browse.spec.ts` 2.11 节固定「骨架 / 空态 / 分页器」三者互斥与「不足一页隐藏分页器」：

- **094**：mock `total_pages: 1` 的单条结果 → 断言 1 张卡 + 分页器 count 0 + 空态 count 0；
- **095**：搜索 mock 延迟 3s → 飞行中断言骨架可见且分页器/空态均 count 0，落地后分页器才出现。

⚠️ **搜索必须走顶部搜索框进入（PUSH 导航）**：`page.goto('/browse?q=xxx')` 是 **POP 导航**，
按设计忽略搜索词（防 `history.state` 残留），页面会停在 discover 默认数据上——
用这种姿势写搜索用例会得到「断言全绿但根本没搜」的假绿。正确姿势见
`browse.spec.ts` 的 `searchFromHeader()`：`goto('/browse')` → 填 `.sticky-header .search-box__input` → `press('Enter')`。

另：慢网类用例的 mock **必须按请求的 `page` 参数返回对应数据**（`id` 也随页偏移），
否则逻辑分页层会反复重取同一批条目，末态断言超时。

## 测试依赖映射（精准跑测试，不要全量跑）

> **本节不再有手抄的数字。** 下表由 `npm run test:count`（`scripts/test-count-report.mjs`）生成：
> 它读 `scripts/run-tests.ps1` 的三张映射表（`$uiTestMap` / `$uiPrecisionMap` / `$logicTestMap`）、
> `scripts/e2e-suite.mjs` 的两阶段名单、`package.json` 的按需档，再跑一次
> `npx playwright test --list` 取**真实**用例数，然后写回本文件的生成块。
> `npm run lint:test-map`（同一脚本的 `--check`）校验五项：① 映射引用的 spec 文件存在
> ② pattern 基路径存在 ③ grep 每个 `|` 片段都真的命中 ④ 档位恒等式成立 ⑤ 本文件生成块未过期。
> 已挂进 `npm run lint:all`（第 7 门）。**改映射 / 加删用例后跑 `npm run test:count -- --write`。**

<!-- test-counts:begin ⚙️ 由 scripts/test-count-report.mjs --write 生成，勿手改数字 -->
#### ① 档位汇总

| 档位 | 命令 | 用例数 | spec 数 |
| --- | --- | --- | --- |
| 全仓枚举 | `npx playwright test --list` | **246** | 22 |
| 默认套 | `npm run test:e2e` | **132** | 16 |
| ├ Stage A（dev 行为套） | `e2e-suite.mjs` 阶段 A | 108 | 12 |
| └ Stage B（preview 播放器系） | `e2e-suite.mjs` 阶段 B | 24 | 4 |
| 发版回归组 | `npm run test:regression` | **121** | 13 |
| 冒烟组（与改动侦测取交集） | `npm run test:smoke` | 37 | 3 |
| 按需 | `npm run test:e2e:shots` | 29 | 1 |
| 按需 | `npm run test:e2e:skeleton` | 39 | 2 |
| 按需 | `npm run test:e2e:boot-iso` | 42 | 1 |
| 按需 | `npm run test:e2e:subpages` | 4 | 2 |

恒等式（脚本校验）：Stage A + Stage B = 默认套；默认套 + 按需档 = 全仓枚举数。

#### ② 每个 spec 的用例数（`--list` 实际枚举）

| spec | 用例数 | 归属档位 |
| --- | --- | --- |
| `scripts/boot-splash-iso.spec.ts` | 42 | 按需 `test:e2e:boot-iso` |
| `scripts/regression.spec.ts` | 30 | 默认套 A（dev 行为套） |
| `scripts/boot-splash-shots.spec.ts` | 29 | 按需 `test:e2e:shots` |
| `scripts/boot-splash.spec.ts` | 21 | 按需 `test:e2e:skeleton` |
| `scripts/skeleton.spec.ts` | 18 | 按需 `test:e2e:skeleton` |
| `scripts/browse.spec.ts` | 13 | 默认套 A（dev 行为套） |
| `scripts/home.spec.ts` | 13 | 默认套 A（dev 行为套） |
| `scripts/iptv-player.spec.ts` | 11 | 默认套 B（preview 播放器系） |
| `scripts/player.spec.ts` | 11 | 默认套 B（preview 播放器系） |
| `scripts/settings.spec.ts` | 10 | 默认套 A（dev 行为套） |
| `scripts/detail.spec.ts` | 8 | 默认套 A（dev 行为套） |
| `scripts/history.spec.ts` | 6 | 默认套 A（dev 行为套） |
| `scripts/iptv.spec.ts` | 6 | 默认套 A（dev 行为套） |
| `scripts/smoke-player-fs-mobile.spec.ts` | 6 | 默认套 A（dev 行为套） |
| `scripts/chart.spec.ts` | 5 | 默认套 A（dev 行为套） |
| `scripts/cross-tab.spec.ts` | 4 | 默认套 A（dev 行为套） |
| `scripts/person.spec.ts` | 4 | 默认套 A（dev 行为套） |
| `scripts/collections.spec.ts` | 3 | 默认套 A（dev 行为套） |
| `scripts/proxy-setup.spec.ts` | 2 | 按需 `test:e2e:subpages` |
| `scripts/source-checker.spec.ts` | 2 | 按需 `test:e2e:subpages` |
| `scripts/player-cms-error.spec.ts` | 1 | 默认套 B（preview 播放器系） |
| `scripts/player-failover.spec.ts` | 1 | 默认套 B（preview 播放器系） |

#### ③ 源文件 → 跑的 spec（`scripts/run-tests.ps1` 映射事实表）

「全量」= 该 spec 的 `--list` 总数；「grep 命中」= 把该条目的 grep 正则套在本 spec 集合标题上的命中数。
实际单轮跑多少条 = **所有命中条目 grep 的并集**（多条目同时命中会累积），以运行时输出为准。

| 修改的源文件（pattern） | 跑的 spec（全量数） | 全量合计 | 精粒度 grep | grep 命中 |
| --- | --- | --- | --- | --- |
| `index.html` | `scripts/boot-splash.spec.ts`（21） | 21 | — | — |
| `src/pages/Home/index.tsx` | `scripts/home.spec.ts`（13） | 13 | `1\.1|1\.2|1\.3|1\.4|1\.5|1\.7` | 13 |
| `src/pages/Home/Home.css` | `scripts/home.spec.ts`（13） | 13 | `1\.[1-7]` | 13 |
| `src/components/TMDBMovieRow/**` | `scripts/home.spec.ts`（13） | 13 | `1\.4` | 1 |
| `src/components/UniversalPlayer/**` | `scripts/player.spec.ts`（11） + `scripts/iptv-player.spec.ts`（11） | 22 | `PLAYER-|IPTVP-` | 16 |
| `src/components/UniversalPlayer/ControlBar/**` | `scripts/player.spec.ts`（11） | 11 | `4\.1[^0-9]|4\.5|4\.8` | 3 |
| `src/components/UniversalPlayer/ToastTrigger.tsx` | `scripts/player.spec.ts`（11） + `scripts/iptv-player.spec.ts`（11） | 22 | `PLAYER-|IPTVP-` | 16 |
| `src/components/UniversalPlayer/hooks/usePlayerCore.ts` | `scripts/player.spec.ts`（11） + `scripts/iptv-player.spec.ts`（11） | 22 | `PLAYER-|IPTVP-` | 16 |
| `src/pages/Browse/index.tsx` | `scripts/browse.spec.ts`（13） | 13 | `BROWSE-` | 13 |
| `src/pages/Browse/useBrowseData.ts` | `scripts/browse.spec.ts`（13） | 13 | `BROWSE-020|BROWSE-030|BROWSE-060` | 3 |
| `src/pages/Browse/BrowseMobileBar.tsx` | `scripts/browse.spec.ts`（13） | 13 | `BROWSE-070|BROWSE-077|BROWSE-081` | 3 |
| `src/components/FilterBar/**` | `scripts/browse.spec.ts`（13） | 13 | `BROWSE-020|BROWSE-030|BROWSE-060|BROWSE-070` | 4 |
| `src/components/ui/Drawer.tsx` | `scripts/browse.spec.ts`（13） | 13 | `2\.8|2\.9` | 3 |
| `src/components/ui/Drawer.css` | `scripts/browse.spec.ts`（13） | 13 | `2\.8|2\.9` | 3 |
| `src/components/HeroBanner/**` | `scripts/home.spec.ts`（13） | 13 | `1\.2|1\.3b|1\.3d|1\.3e` | 4 |
| `src/components/CategoryQuickAccess/**` | `scripts/home.spec.ts`（13） | 13 | `1\.3` | 7 |
| `src/components/Layout/**` | `scripts/home.spec.ts`（13） + `scripts/browse.spec.ts`（13） + `scripts/detail.spec.ts`（8） + `scripts/player.spec.ts`（11） + `scripts/iptv.spec.ts`（6） + `scripts/settings.spec.ts`（10） + `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + `scripts/source-checker.spec.ts`（2） + `scripts/person.spec.ts`（4） + `scripts/cross-tab.spec.ts`（4） + `scripts/regression.spec.ts`（30） | 110 | `1\.1|1\.3b|1\.5|2\.1|3\.1|4\.1|5\.1|6\.1|7\.1|8\.1|9\.1|10\.1|桌面端|移动端` | 40 |
| `src/components/StickyHeader/**` | `scripts/home.spec.ts`（13） + `scripts/browse.spec.ts`（13） + `scripts/detail.spec.ts`（8） + `scripts/player.spec.ts`（11） + `scripts/iptv.spec.ts`（6） + `scripts/settings.spec.ts`（10） + `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + `scripts/source-checker.spec.ts`（2） + `scripts/person.spec.ts`（4） + `scripts/regression.spec.ts`（30） | 106 | `1\.1|1\.5|2\.1|3\.1|4\.1|5\.1|6\.1|7\.1|8\.1|9\.1|10\.1|桌面端` | 34 |
| `src/components/SearchBox/**` | `scripts/browse.spec.ts`（13） + `scripts/settings.spec.ts`（10） + `scripts/iptv.spec.ts`（6） + `scripts/cross-tab.spec.ts`（4） + `scripts/regression.spec.ts`（30） | 63 | `2\.1|2\.2|6\.9|跨页联动回归|桌面端` | 18 |
| `src/components/VideoCard/**` | `scripts/home.spec.ts`（13） + `scripts/browse.spec.ts`（13） + `scripts/detail.spec.ts`（8） + `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + `scripts/person.spec.ts`（4） | 47 | `1\.4|2\.2|3\.8|7\.2|7\.4|8\.2|8\.3|8\.4|8\.5|10\.4` | 9 |
| `src/components/LazyImage/**` | `scripts/home.spec.ts`（13） + `scripts/detail.spec.ts`（8） + `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + `scripts/person.spec.ts`（4） + `scripts/iptv.spec.ts`（6） | 40 | `1\.4|3\.2|7\.2|7\.4|8\.2|10\.4|5\.10` | 7 |
| `src/components/RecordShell/**` | `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + `scripts/regression.spec.ts`（30） | 39 | `7\.1|8\.1|8\.5` | 3 |
| `src/components/StatusTabs/**` | `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） | 9 | `7\.1|8\.1` | 2 |
| `src/components/StillsLightbox/**` | `scripts/detail.spec.ts`（8） | 8 | `3\.5|3\.6|3\.11` | 3 |
| `src/components/IPTVChannelCard/**` | `scripts/iptv.spec.ts`（6） + `scripts/regression.spec.ts`（30） | 36 | `5\.1|5\.2|5\.10|5\.11` | 4 |
| `src/components/EPGProgramList/**` | `scripts/iptv.spec.ts`（6） | 6 | `5\.5` | 1 |
| `src/components/SourceManager/**` | `scripts/settings.spec.ts`（10） | 10 | `6\.3|6\.4|6\.5` | 3 |
| `src/components/TokenRequired/**` | `scripts/settings.spec.ts`（10） | 10 | `6\.2` | 1 |
| `src/components/ui/**` | `scripts/settings.spec.ts`（10） | 10 | `6\.6` | 1 |
| `src/services/tmdbService.ts` | `scripts/home.spec.ts`（13） + `scripts/browse.spec.ts`（13） + `scripts/detail.spec.ts`（8） + `scripts/person.spec.ts`（4） + vitest 单测 | 38 | `1\.1|2\.1|2\.2|3\.1|10\.1` | 11 |
| `src/services/videoService.ts` | `scripts/browse.spec.ts`（13） + `scripts/player.spec.ts`（11） + `scripts/source-checker.spec.ts`（2） + vitest 单测 | 26 | `2\.4|4\.5|9\.1` | 3 |
| `src/services/iptvService.ts` | `scripts/iptv.spec.ts`（6） + `scripts/iptv-player.spec.ts`（11） + vitest 单测 | 17 | `5\.1|5\.2|5\.5|11\.1` | 6 |
| `src/services/epgService.ts` | `scripts/iptv.spec.ts`（6） + vitest 单测 | 6 | `5\.1|5\.5` | 4 |
| `src/services/channelLogo.ts` | `scripts/iptv.spec.ts`（6） + `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + vitest 单测 | 15 | `5\.10|5\.11|7\.2|8\.2` | 4 |
| `src/services/castService.ts` | `scripts/player.spec.ts`（11） + vitest 单测 | 11 | `4\.13` | 2 |
| `src/services/sourceService.ts` | `scripts/settings.spec.ts`（10） + `scripts/source-checker.spec.ts`（2） + vitest 单测 | 12 | `6\.3|9\.1|9\.6` | 3 |
| `src/services/vodParser.ts` | `scripts/player.spec.ts`（11） + vitest 单测 | 11 | `4\.5` | 1 |
| `src/services/httpClient.ts` | vitest 单测 | 0 | — | — |
| `src/stores/useSettingsStore.ts` | `scripts/settings.spec.ts`（10） + `scripts/source-checker.spec.ts`（2） + vitest 单测 | 12 | `6\.[1-9]|9\.1|9\.6` | 12 |
| `src/stores/useUserStore.ts` | `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + vitest 单测 | 9 | `7\.[1-6]|8\.[1-5]` | 6 |
| `src/stores/useTMDBStore.ts` | `scripts/home.spec.ts`（13） + `scripts/browse.spec.ts`（13） + `scripts/detail.spec.ts`（8） + vitest 单测 | 34 | `1\.1|2\.1|2\.2|3\.1` | 10 |
| `src/stores/useIPTVStore.ts` | `scripts/iptv.spec.ts`（6） + `scripts/iptv-player.spec.ts`（11） + vitest 单测 | 17 | `5\.[1-9]|11\.[1-3]` | 9 |
| `src/stores/usePlayerStore.ts` | `scripts/player.spec.ts`（11） + vitest 单测 | 11 | `4\.[1-9]` | 11 |
| `src/stores/useSourceManagerStore.ts` | `scripts/settings.spec.ts`（10） + `scripts/source-checker.spec.ts`（2） + vitest 单测 | 12 | `6\.3|6\.4|9\.6` | 3 |
| `src/pages/Home/continueItems.ts` | vitest 单测 | 0 | — | — |
| `src/pages/Home/**`（兜底） | `scripts/home.spec.ts`（13） | 13 | — | — |
| `src/pages/Detail/**`（兜底） | `scripts/detail.spec.ts`（8） + `scripts/regression.spec.ts`（30） | 38 | — | — |
| `src/pages/Settings/**`（兜底） | `scripts/settings.spec.ts`（10） | 10 | — | — |
| `src/pages/Browse/**`（兜底） | `scripts/browse.spec.ts`（13） | 13 | — | — |
| `src/pages/Collections/**`（兜底） | `scripts/collections.spec.ts`（3） | 3 | — | — |
| `src/pages/History/**`（兜底） | `scripts/history.spec.ts`（6） | 6 | — | — |
| `src/pages/IPTV/**`（兜底） | `scripts/iptv.spec.ts`（6） + `scripts/iptv-player.spec.ts`（11） | 17 | — | — |
| `src/pages/Player/**`（兜底） | `scripts/player.spec.ts`（11） | 11 | — | — |
| `src/pages/SourceChecker/**`（兜底） | `scripts/source-checker.spec.ts`（2） | 2 | — | — |
| `src/pages/Person/**`（兜底） | `scripts/person.spec.ts`（4） | 4 | — | — |
| `src/pages/Chart/**`（兜底） | `scripts/chart.spec.ts`（5） | 5 | — | — |
| `src/pages/ProxySetup/**`（兜底） | `scripts/proxy-setup.spec.ts`（2） | 2 | — | — |
| `src/components/UniversalPlayer/**`（兜底） | `scripts/player.spec.ts`（11） + `scripts/iptv-player.spec.ts`（11） | 22 | — | — |
| `src/components/SearchBox/**`（兜底） | `scripts/browse.spec.ts`（13） | 13 | — | — |
| `src/components/RecordShell/**`（兜底） | `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） | 9 | — | — |
| `src/components/**`（兜底） | `scripts/home.spec.ts`（13） + `scripts/browse.spec.ts`（13） + `scripts/detail.spec.ts`（8） + `scripts/collections.spec.ts`（3） + `scripts/history.spec.ts`（6） + `scripts/person.spec.ts`（4） | 47 | — | — |

> 「兜底」行 = `$uiTestMap` 的粗粒度条目：只在文件**未命中任何精粒度条目**时才生效（见下方口径 1）。
<!-- test-counts:end -->

### 读表与使用口径（手写，改映射前先读）

1. **精粒度优先于兜底**：某文件命中 `$uiPrecisionMap` 任一条目时，`$uiTestMap` 的粗粒度条目**不再叠加**
   （`run-tests.ps1` 的 `if (-not $precisionMatched)`）。所以同一 pattern 出现在两处时以精粒度为准；
   兜底表实际服务的是精粒度没逐条列出的边角文件（`BrowseGrid.tsx`、`useLogicalPage.ts`、`Browse.css` …）。
2. **一条 grep 里的 `|` 是「或」**，且多条目同时命中会**累积**（spec 走 HashSet 去重、grep 取并集）
   → 实际单轮跑多少条以后者为准，上表「grep 命中」列是**单条目**口径。
3. **改映射后必须跑 `npm run test:count`**：它拿「真标题」逐片段验证 grep 是否还能命中。已知教训——
   spec 侧把编号合并成 `BROWSE-020/023/025: …` 之后，映射里单独写的 `BROWSE-023` **永远不命中**
   （`--grep` 是子串正则），而 `run-tests.ps1` 自带的运行时检测只在「整条 grep 零命中」时才报警，
   于是静默失效很久（2026-09-23 一次性清掉 **21 个死片段 + 2 个失效 pattern**）。
   **新增片段先验证命中数 > 0 再落盘**（看 ③ 表最右列，为 0 会被 `--check` 拦下）。
4. **未入映射的共享组件**：落 `src/components/**` 兜底 = home + browse + detail + collections + history
   + person 六个 spec 的**全量**（不去 grep）。范围大，但不是静默跳过。当前属此类且值得注意的：
   `src/components/RecordFilterPanel/**`、`src/pages/Browse/useLogicalPage.ts`、`BrowseGrid.tsx`。
5. **已知缺口（要补先与用户确认，别自行收窄/扩面）**：
   - `src/components/UniversalPlayer/**` 的全屏 / 移动端 toast 专项（`scripts/smoke-player-fs-mobile.spec.ts`，
     6 条）只在默认套里跑，**不在增量映射内**（2026-09-23 核对；旧文档曾声称已映射）；
   - `EPGProgramList` / `epgService` 只挂 `scripts/iptv.spec.ts`，`iptv-player.spec.ts` 的
     `11.5 EPG 节目单`（渲染侧）未纳入。
6. **vitest 行**：映射中 `spec` 含 `"vitest"` 标记的条目会额外触发 `npm run test`；
   ③ 表标注「+ vitest 单测」的行即此，**不计入** playwright 用例数。
7. **历史演化（只作追溯，勿当现数）**：`306 条/27 spec → 253/24 →（2026-09-09 二次激进合并，只合并、
   不删断言）116/16 →（骨架三兄弟与设置页子页移出默认套）→（2026-09-23 实测）全仓 246 / 22 spec、
   默认套 132 / 16 spec`。旧文档里的 `116 条 / 16 spec`、`163 条 / 20 spec`、`home 列 46` 等都只是
   **当时**的口径，别引用；要数字就看上面的生成块。
8. **已彻底删除的历史 spec** 不再出现在任何映射：`search-features` / `mobile-web-sidebar` / `page-search` /
   `playback-entry-flows` / `loading-screenshots` / `diag-flash` / `verify-grid` / `smoke-player-mobile-lab`；
   `scripts/backup-specs/` 归档目录已于 2026-08-29 清理（备份在 `backups/scripts-untracked-20260829/`），
   `playwright.config.ts` 的 `testIgnore` 规则同步移除。
   > 另：旧文档/旧指引里「新增用例后同步 `AGENTS.md` 测试计数表」的说法**已失效**——`AGENTS.md` 早无该表
   > （`grep 计数表 AGENTS.md` 零命中）。计数现在只有一个出口：本文件的生成块（`npm run test:count -- --write`）。
9. **两个「合并产物」spec 的构成**（读 ③ 表时对照）：
   - `scripts/cross-tab.spec.ts`（4 条）= 2026-09-09 由 4 个单例合并：COL-CROSS-001（IDB 主键幂等去重）
     / USER-CROSS-001（BroadcastChannel 内存快照静默刷新 + 自过滤 + 脏进度保护）
     / IPTV-CROSS-001（storage 事件 + `isFavorite` 重派生 + clearCache 归零）
     / SETTINGS-CROSS-001（白名单 storage 同步 + theme/skin 真实 DOM 翻转 + tvMode 排除）。
   - `scripts/regression.spec.ts`（30 条）= 2026-09-09 由 6 个历史专项 spec 合并：跨页联动回归 9 /
     详情页回归 10 / 9.1 修复 4 / UI 整改 3 / 全局问题 4（原「代理配置」2 条 2026-09-21 移出为
     `scripts/proxy-setup.spec.ts`，按需档跑）。
10. **沙箱里「真实播放」类问题**：真实 CMS 源常加载不出，可用 ffmpeg 本地 HLS + Playwright `page.route`
    冒充流（范式见记忆库「本地 HLS 冒充流范式」与 `scripts/fixtures/cms-mock.ts`）。
11. **映射维护约定**见下节「增量测试」——grep 优先用 describe 段号（段内新增用例自动涵盖），
    段号里的 `.` 必须转义为 `\.`。

### E2E 指令（本地基准 — 认准这几种，别裸跑）

| 命令 | 覆盖内容 | 说明 |
| --- | --- | --- |
| `npm run test:e2e` | 默认全量两阶段（串行，≤300s 预算） | **唯一默认入口** = e2e-suite（A dev 行为 + B preview 播放器） |
| `npm run test:e2e:skeleton` | 骨架契约（skeleton / boot-splash） | preview、按需；验证骨架↔真实页同构（实测 65s） |
| `npm run test:e2e:boot-iso` | 七视口启动骨架同构（boot-splash-iso，42 条） | preview、按需（实测 59s） |
| `npm run test:e2e:subpages` | 设置页子页（source-checker / proxy-setup） | preview、按需 |
| `npm run test:e2e:shots` | 启动骨架截图取证 | dev、人工核查用（不进默认套） |
| `npm run test:e2e:report` | 打开上次 HTML 报告 | — |
| `npm run test:count` | 用例计数/映射一致性报告（**不跑浏览器**，1–2s） | 读映射表 + `--list` 枚举；`-- --write` 同步 `testing.md` 生成块；`-- --check` 只校验 |
| `npm run lint:test-map` | `test:count -- --check`，`lint:all` 第 7 门 | 死 spec 引用 / 死 pattern / 死 grep 片段 / 档位恒等式 / 文档过期 |
| `node scripts/e2e-suite.mjs --only <spec> [-g 子串] [--dev]` | 调试**单个** spec | 默认 preview（需最新 dist），`--dev` 走源码态；自带清场+健康轮询 |

> 底层跑批器：`node scripts/e2e-skeleton.mjs [spec… | -g 过滤]`（preview 默认，`--dev`/`--all` 可切）。
> **禁止**裸 `pnpm exec playwright test`（无清场/健康轮询 → 僵尸 dev server 会把每条 goto 耗满超时）。
> 旧 `test:e2e:raw` / `test:e2e:preview` 已删除（2026-09-21）。
> **报告**：两阶段各只写 blob（`.pw-blob`），跑完由 `merge-reports` 汇总成**一份**含 A+B 全量的
> `playwright-report/`（html + list）。2026-09-22 前是两阶段各写同一 html outputFolder → Stage B
> 覆盖 Stage A，默认套最终只剩 24 条 player 系用例、Stage A 那 108 条明细全丢。


> **无 `.env.local` 时的既有失败基线**（2026-09-15 实测，worktree @ c114c867 对照同条件；
> 条数按 2026-09-23 现状校正）：
本机无 `.env.local`（global-setup 写入占位 TMDB token / 占位代理地址）且无外网，
下列用例**环境性必败**，非代码回归：`BROWSE-010/012/013/014`、`BROWSE-081/082`、`DETAIL-060/062`、
`IPTVP-023`、`HIS-050/051`（基线单车复跑 3/3 全败），以及 `smoke-player-fs-mobile` 全 **6 条**（依赖真实流）。
另有 2 条**并发 flaky**：`BROWSE-094`、`BROWSE-095`（2026-09-15 在 `--workers=2` 下挂、单跑即过；
现默认套并发由套件固定为 Stage A `--workers=3` / Stage B `--workers=5`，别再手加 `--workers`）。
判定回归的正确姿势：`worktree` 拉改动前 commit + 同端口/同 GOOGLE chrome 通道复跑对照，别只看单端失败数。

**跑不动时先看这条**（2026-09-15）：若报 `page.goto: Page crashed`（默认跑 `chrome-headless-shell`，
> 部分环境加载本应用会以 0xC0000409 整体崩出）——**别去改 GPU 参数**，直接
> `PW_BROWSER_CHANNEL=chromium npx playwright test` 切到完整 chromium 的 headless=new。
> 详情与「`chromium.launch()` 不继承 `use.channel`」的坑见 `runtime-conventions.md` §7。

**「跑起来卡死 / 十几分钟没日志」先看这条**（2026-09-18）：这是**僵尸 dev server**，不是用例慢。
3001 上的 Vite 会进入「TCP 仍 LISTENING、HTTP 永不响应」状态，`webServer.reuseExistingServer`
既判不出可复用、又起不来新的（端口被占 / 受限环境 npm shim 失效），于是 `baseURL` 指向死端口 →
**每条 `page.goto` 都把单测 45s 超时耗干**；`globalSetup` 的首次 goto 就挂住 ⇒ reporter 一个字都不吐。
18 条用例 ≈ 13.5 分钟。别重试，直接：

```bash
node scripts/e2e-skeleton.mjs          # 清场 + vite preview(dist) + HTTP 健康轮询 + 双超时封顶 + 收尾
node scripts/e2e-skeleton.mjs --dev    # 改了 src 还没 build 时退回 dev server
node scripts/e2e-skeleton.mjs -g SKEL-011
```

该脚本默认跑 **`vite preview`（构建产物）**：页面加载由「秒级模块图」降到百毫秒，且生产包把
全部页面 CSS 打进同一 bundle —— **注入探针型断言不再依赖路由 chunk 是否加载**，比 dev 更稳。
代价是要求 `dist` 是最新构建（脚本会拿 src 最新 mtime 比 dist/index.html 并告警）。
`playwright.config.ts` 的 `webServer.command` 同时由 `npm run dev` 改为
`"${process.execPath}" node_modules/vite/bin/vite.js`（绕开 npm shim，避免静默换端口）。

- **分级门禁（2026-09-21 用户定稿）**：按改动类型决定 E2E 验证档位——
  **删除/文档/纯脚本类**改动：`npm run build` + `npm run lint:all` + **受影响 spec（ad-hoc 档）** 即可；
  **行为类**改动（src 业务代码、播放链、布局/动画）才需要全量。
  **全量 E2E（`test:e2e` / `e2e-suite.mjs` / `e2e-skeleton.mjs --all` 及任何等效方式）未经用户明确允许不得运行**；
  需要全量时向用户申请，由用户放行。新增/改动用例的时长核算也走 ad-hoc 档，不借全量验证。
- **全量预算 ≤5 分钟（2026-09-20 用户硬性规定，不可协商；仅在用户放行全量时适用）**：默认入口 `npm run test:e2e`
  = `scripts/e2e-suite.mjs`（阶段 A dev 行为全套 + 阶段 B preview 播放器系，串行，
  300s 看门狗到点击杀并判失败）。超预算的合规解法按此优先级取舍：
  ① 取证/截图类脚本不进默认套（`test:e2e:shots` 按需）；② 同构断言合并为参数化循环；
  ③ 缩短 mock 侧不必要的人为延迟；④ 复核 `waitForTimeout` 固定睡眠改条件等待。
  **禁止**用「删断言 / 降断言精度 / 加 skip」凑时间。
- **取舍必须对功能地图，不对脚本秒数**（2026-09-20 用户纠偏）：默认套覆盖 = 13 业务路由全部有
  spec（首页/浏览/榜/详情/播放双路由/IPTV 列表+播放/设置/收藏/历史/源检测/人物/代理入口）+
  横切能力（跨页签同步、主题皮肤字体、app 端 UA、台标回退链、播放故障转移/错误码）。
  （注 2026-09-21 用户拍板：骨架类——启动骨架行为 boot-splash / 骨架契约 A/B/C skeleton /
  七视口同构 boot-splash-iso——整体移出默认套，改按需 `npm run test:e2e:skeleton`（preview
  三者皆绿）。**2026-09-23 拆档**：三者合跑 110–128s 卡在 120s 看门狗边界（09-22 被击杀过 1 次），
  按实测拆成 `test:e2e:skeleton`（skeleton+boot-splash，65s）+ `test:e2e:boot-iso`（boot-splash-iso，59s）；
  单 spec 实测值：skeleton 25s / boot-splash 55s / boot-splash-iso 59s。骨架类不是业务路由覆盖，
  故 13 路由默认覆盖不受影响；仅默认套不再守护骨架同构。）
  不进默认套的判据：① 纯像素取证（boot-splash-shots → `test:e2e:shots`）；② 无断言手工脚本
  （verify-grid 曾属此类，已于 2026-09-21 删除）；③ 调试 demo 路由（player-lab 等三个已于 2026-09-21 整体删除）；
  ④⑤ 设置页**子页**专属用例（source-checker 源检测 CHK-* / proxy-setup 代理配置 PROXY-*），
  2026-09-21 移出默认套→按需 `npm run test:e2e:subpages`。其中 /source-checker 路由仍由默认套内
  settings SET-073 守护（连点版本 3 次→进入+页面可见），/proxy-setup 代理入口子页则默认不再守护。
  设置页本体 settings + 顶级路由 chart/person 均保留默认套（用户明确：只移子页，不移顶级路由）。
  **mock 数据形态必须支撑功能断言**：hermetic mock 若让条件断言用例如 5.10 台标链、G-05 封面回退
  恒走 skip 分支，等于砍掉覆盖——org 主干 mock 已按真实 cn.m3u 形态补 tvg-logo/tvg-id
  （含一条无 logo 频道支撑 EPG icon 二级回退）。加/改 mock 数据后必须 grep「跳过」日志确认可疑空转。
- **临时/调试跑批硬规矩（2026-09-21；2026-09-23 按新跑批器校正）**：带 spec 文件位置参数或 `-g` 过滤
  即 ad-hoc 档——单轮预算 **120s**（`e2e-skeleton.mjs` 自建看门狗到点 **按进程树** `taskkill /T` 击杀、
  **退码 2**；原写法是 `spawnSync(timeout)`，Windows 上只杀 CLI、worker/浏览器留孤儿，已废弃）、
  `retries=0`；只有裸 `--all` 才是 **300s** 全量档（`e2e-suite.mjs` 用它跑 A/B 两阶段）。
  `run-tests.ps1` 增量档另有一套预算：默认 **180s / `-Full` 1200s**（`-Budget` 可显式覆盖）。
  诊断循环烧时间的主因是「全量档 + 重试翻倍」，改代码前先想清楚用哪档。
- **单步等待/超时 ≤10s（2026-09-21 用户定稿，不可协商）**：spec 内任何单步等待
  （`waitForSelector` / `toBeVisible` / `expect.poll` / `waitFor({timeout})` / `waitForTimeout`）
  上限一律 10000ms（存量 ~300 处 12s~45s 已全量清扫）。hermetic mock 下正常步骤 1~3s 成立，
  10s 上限只让真失败更快暴露。**封顶机制除外**（用例级 `testTimeout` 45s/30s、`test.setTimeout`、
  整轮 `globalTimeout`、webServer 就绪 60s、跑批看门狗 120s/300s——它们是防挂死的 kill-switch，
  压到 10s 会让脚本无法继续执行）。若某步必须 >10s 才能过：**立即停止、向用户说明原因**，禁止自行放宽。
- **端口与进程边界（2026-09-20 用户定稿，二次强化）**：E2E 端口由 **OS 动态分配**（不固定占任何端口；
  `E2E_PORT` 仅供显式指定，如对着自己 dev server 测：`E2E_PORT=3001`，也只是连接复用）。
  **绝不按端口占用者杀进程**：测试自建 server 由 `scripts/e2e-vite-server.cjs` wrapper 拉起（命令行即标记），
  收尾只杀「带该标记且 HTTP 探活无响应」的僵尸；浏览器只杀带 ms-playwright 路径 / 临时 `--user-data-dir`
  特征的。禁止 `taskkill /IM chrome.exe`——那会连带杀死用户日常浏览器（已犯过事故，见 changelog 09-20）。
- **卡死根治（2026-09-20，永久化）**：上述防卡死机制已从「仅骨架」扩展到全量——
- `npm run test:e2e` = `e2e-suite.mjs` **两阶段串行**：**Stage A**（dev 源码态，行为全套，`--workers=3`）
  + **Stage B**（preview 走 dist，播放器系 4 spec，`--workers=5`）；两阶段各写 blob、跑完 merge 成一份报告
  （避免后跑的整份覆盖前者）。每阶段都经 `e2e-skeleton.mjs`（清场 + 健康轮询 + 封顶 + 进程树收尾）。
  单 spec 调试：`node scripts/e2e-suite.mjs --only <spec> [-g 子串] [--dev]`；旧 `test:e2e:preview` /
  `test:e2e:raw` 已删除（2026-09-21）。
- `globalSetup` 前置 HTTP 探针：死端口 8s 内 fail-fast 并指向 skeleton，不再整轮零输出。
- config `globalTimeout`（CI 40min / 本地 30min）+ 本地 `workers=2`。
- **网络守卫**（fixtures/mock-tmdb）：mock 模式下任何未命中专用拦截、且不属于
  本地/测试桩域/`.env.local` 配置代理主机的公网请求**立即 abort**；TMDB mock 未命中
  返回 404 不再逃逸；注入源与 iptv-org 主干由 `scripts/fixtures/test-env.ts` 提供
  确定性 mock（源下标单一事实源）。断网环境跑 E2E 从此与有网同速同结果。
  逃生门仍是 `TMDB_MOCK=false`（真实网络回归）。

### 耗时基线口径（冷跑 vs 稳态 — 2026-09-23 定，引用耗时时必守）

**同一命令「首次跑」比「复跑」慢 2–3 倍**（Windows Defender 实时扫描 + 文件系统冷缓存），
与代码变慢无关。**任何耗时结论必须标明冷/热**；要当基线的数字一律取**同一会话第二次起的稳态值**。

| 指令 | 冷跑（首次） | 稳态（复跑） |
| --- | --- | --- |
| `lint`（eslint） | 33.6s | **15.8s** |
| `npm run build` | 60.2s | **40.8s** |
| `build:fast` | 34.8s | — |
| `lint:all`（2026-09-23 起 6 门） | 46.3s | — |
| `test`（vitest） | 54.6s | 29.5s |
| `sync:android-version` | 3.4s | — |
| `dev` 首启（vite） | 12.9s（依赖预打包坏缓存放大） | **5.2–6.5s** |

⚠️ 2026-09-22 记录的 `lint 62.2s` / `build 60.5s` 是**冷跑**值，别当常态引用。
`dev` 首启的冷值只在「`node_modules/.vite` 未预打包」时出现——`postinstall`（`scripts/optimize-deps.mjs`）
负责把它前移到安装阶段；沙箱内该步骤曾因批量删除护栏静默失败（2026-09-23 修）。

### 增量测试（推荐日常使用）

`scripts/run-tests.ps1` 支持**文件级精粒度映射**（`$uiPrecisionMap`：改哪个文件只跑其相关 describe 段，而非整个 spec）：

```powershell
# 自动侦测「未提交改动」（工作树 + 暂存 + 未跟踪）并匹配映射（默认行为，= npm run test:changed）
.\scripts\run-tests.ps1

# 相对某个 ref 的改动（旧行为语义）：显式 -Since
.\scripts\run-tests.ps1 -Since HEAD~1
.\scripts\run-tests.ps1 -Since origin/master

# 手动指定改动文件，验证匹配效果
.\scripts\run-tests.ps1 -Files @("src/components/HeroBanner/HeroBanner.tsx")

# 手动按 describe 段号/测试编号精准过滤（Grep 透传 playwright --grep）
.\scripts\run-tests.ps1 -Grep "1\.2"
.\scripts\run-tests.ps1 -Grep "1\.4|1\.5"

# 放行「单轮 spec 数上限 3」护栏 / 发版前真实 API 回归
.\scripts\run-tests.ps1 -Full -Retries 2 -Group regression -RealApi
```

**2026-09-23 行为变更（四处，改前必读）**：

1. **侦测语义从 `git diff --name-only HEAD~1` 改为「未提交改动」**。旧写法比的是
   「上一个提交 ↔ 工作树」，HEAD 本身含 src 改动（或刚 pull 完）时**工作树干净也会命中一大批文件**；
   叠加全局壳映射（`Layout/**`、`StickyHeader/**` 各挂 11–13 个 spec）→ 无感受地退化成全量回归
   （2026-09-22 实测单轮 828s，曾被误判为「挂死」）。要旧语义请显式 `-Since HEAD~1`。
2. **新增 spec 数护栏**：自动侦测命中 **>3 个 spec** 且未加 `-Full` 时，打印命中清单并 **`exit 2`（未执行任何测试）**
   —— 不静默假绿、不静默跑 14 分钟。显式 `-Files` / `-Grep` 属使用者意图，不受护栏限制。
3. **`-Retries` 默认 2 → 0**（与「调试档 `retries=0`」既定口径一致）；发版回归档显式 `-Retries 2`
   （`npm run test:regression`）。原 `test:smart` 入口已删除（与 `test:changed` 语义重复）。
4. **playwright 调用改走单轮自建跑批器**（`node scripts/e2e-skeleton.mjs --dev …`）。原路径把 playwright
   交给 config 的 `webServer`（`command` 是**字符串** → Windows 下经 shell 启动）：收尾只杀到 shell、
   vite 成孤儿继续占端口，playwright 等不到 webServer 关闭 —— 实测「用例与 teardown 早已跑完、进程
   **632s 不返回**」并残留 `node scripts/e2e-vite-server.cjs --port <n>`（只剩 `globalTimeout` 30min 兜底）。
   现由跑批器统一负责**动态端口 + HTTP 200 探活 + 预算封顶 + 进程树收尾**（`e2e-suite.mjs` 各阶段同源）：
   - 新增 `-Budget <秒>`：默认**增量档 180s / `-Full` 回归档 1200s**；到点按进程树击杀并 **退码 2**
     （原为无封顶）。`-Full` 同时按套件口径传 `--test-timeout 45000 --global-timeout 1200000`。
   - playwright 侧因 `E2E_PORT` 指向已探活的自建 server，`reuseExistingServer` 直接命中 → **不再起第二个 server**。
   - `e2e-skeleton` 的默认 spec 仍是骨架，但它已是**全仓唯一跑 playwright 的入口**（`test:e2e:*`、套件、增量档共用）；
     凡要跑 playwright 都走它，别裸调 `playwright test`。
   - 顺带修 `.ps1` 侧子进程中文输出乱码（`[Console]::OutputEncoding` 按 UTF-8）。
5. **`-Group <组名>` 变成「显式分组档」：不侦测改动，直接跑该组固定 spec 集合**（触发条件：`-Group`
   非 `all` 且未显式 `-AutoDetect` / `-Grep` / `-Files`）。此前 `-Group regression` 会先走改动侦测，
   工作树无 `src/*` 改动就 `No changed files detected.` + `exit 0` —— **发版回归档静默什么都不跑**
   （旧版靠 `HEAD~1` 的错误侦测"歪打正着"才有东西可跑）。现 `npm run test:regression` 稳定加载
   13 个 spec / 121 条用例；`test:smoke` 仍带 `-AutoDetect`，保持「侦测 ∩ smoke」语义不变。
   实测：**rc=0 / 墙钟 221s（playwright 218s）/ 121 passed / 0 failed / 0 flaky / 0 retries，
   预算 1200s 只用 18%**。

**映射维护约定**（改动代码后同步维护）：

- 新增/修改组件或页面文件时，检查 `scripts/run-tests.ps1` 的 `$uiPrecisionMap` 是否有对应条目；没有则补充（`spec` = 受影响的 spec 文件，`grep` = 相关 describe 段号或测试编号）
- **grep 优先用 describe 段号**（如 `1\.2` 覆盖整个 HeroBanner 段）：段内新增用例自动涵盖，映射无需随用例增减维护
- ⚠️ **段号是正则**：`.` 必须转义（`1.2` 的 `.` 会通配任意字符，误命中含 `1023px` 等 1?2 序列的其他段标题），写 `1\.2`
- ⚠️ **编号也可能是子串陷阱**：spec 里把编号合并成 `BROWSE-020/023/025: …` 时，映射写 `BROWSE-023` **永远不命中**（`--grep` 是子串正则，标题里没有 `BROWSE-023` 这串）；要写就写段首那一个（`BROWSE-020`）或用段号
- **改完映射必须跑 `npm run test:count`（可加 `-- --write` 同步文档）**：它逐片段验证命中数。
  `npm run lint:test-map`（同一脚本 `--check`）已挂进 `lint:all` 第 7 门，会拦下
  「引用不存在的 spec / pattern 基路径不存在 / 死 grep 片段 / 档位恒等式不成立 / 本文档生成块过期」
- **映射覆盖范围（本表由脚本生成，别手抄）**：`$uiPrecisionMap` 覆盖共享组件（HeroBanner/CategoryQuickAccess/Layout/StickyHeader/SearchBox/VideoCard/LazyImage/RecordShell/StatusTabs/StillsLightbox/IPTVChannelCard/EPGProgramList/SourceManager/TokenRequired/ui/UniversalPlayer/FilterBar）+ 高频页面文件；`$logicTestMap` 统一 `{spec, grep}` 结构，`spec` 含 `"vitest"` 标记触发单测，关键服务/Store 文件联动对应页面 E2E 段；未命中精粒度的文件落 `$uiTestMap` 粗粒度兜底（见上方 ③ 表「（兜底）」行）
- **映射失效检测（两道，互补）**：① `run-tests.ps1` 运行时自检——剥离 `/* */` 与 `//` 注释后匹配，**整条 grep**
  在某个 spec 上全零命中才报警（口径宽松，抓不到个别失效片段）；② `npm run test:count -- --check`——
  **逐 `|` 片段**按真实标题验证（2026-09-23 就是靠它一次清掉 21 个沉默已久的死片段 + 2 个失效 pattern）
- 未匹配到映射的变更文件会输出黄色警告并**不跑对应测试**——提示补映射或用 `-Grep` 手动指定

**判断规则**：

```
IF 只改了 src/pages/Xxx/ 目录下的文件
THEN 跑对应 spec（优先查 $uiPrecisionMap 是否有该文件的精确条目）

IF 改了 src/components/ 下的共享组件
THEN 优先用 -AutoDetect / 查 $uiPrecisionMap；无映射时按上表跑所有受影响 spec

IF 改了 src/services/ 或 src/stores/ 下的文件
THEN 按上表跑所有受影响的 spec 文件（逻辑层自动加跑 vitest）

IF 改了多个目录
THEN 取所有受影响测试的并集（去重）
```


