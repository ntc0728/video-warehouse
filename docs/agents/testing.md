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

> 修改源文件后，只跑对应列的测试文件。共享组件变更才会影响多个测试文件。


### 页面代码 → 测试文件（1:1）

> test 数：playwright 用例为 `npx playwright test --list` 实际枚举数（**2026-09-18：163 条 / 20 个 spec**
> —— 新增 `scripts/skeleton.spec.ts` 18 条：色源唯一 2 / 列数三方同源 6（PAIRS 动态生成，逐断点）/
> 结构同构 + 视口填充 7 / 启动骨架 shape 3；**2026-09-15：145 条 / 19 个 spec**（+ `boot-splash.spec.ts` 13 条）；2026-09-14：132 条 / 18 个 spec；2026-09-10 晚为 127 条、同日晚些时候为 123 条、2026-09-09 晚为 118 条，此前二次激进合并后为 116 条 / 16 spec，306→253→116 仅合并不删断言。新增：`player-cms-error.spec.ts` PLAYER-095（CMS 业务错误码失败态）、`verify-grid.spec.ts`（网格重构验证）、`iptv-player.spec.ts` 11.4 的 IPTVP-020~024（播放页 chrome 尺寸契约 + 播放器强调色）、**走读反馈批次的 4 条硬断言护栏 IPTV-090 / DETAIL-090 / BROWSE-081+082 / HOME-089**、**BROWSE-090~093（逻辑分页）与 BROWSE-094/095（分页器渲染门控）**）。沙箱真实 CMS 源常加载不出、无法复现「真实播放」类问题，可用 ffmpeg 本地 HLS + Playwright `page.route` 冒充流（详见记忆库「本地 HLS 冒充流范式」）。「A + B」写法 = 静态 `test(` 数 + 动态生成用例数，合计等于 `--list` 总数。表中标注「(vitest 单元测试)」的行为 Vitest 单元测（`npm run test`），不计入 playwright 枚举数。
>
> ⚠️ **表中「test 数」列的数字多为 2026-09 之前的历史快照，与 `--list` 枚举数口径不一致**（例如 home 列 46、实际 13 个 `test()`）。**需要精确数字时以 `--list` 为准，别直接引用本列**：
> ```bash
> npx playwright test --list | grep -oE "› [a-z0-9-]+\.spec\.ts" | sort | uniq -c | sort -rn
> ```
> 全量跑建议加 `--workers=2`：默认并发下 `player.spec.ts` 4.11 首个用例常在挂载播放器时超时（多并发把真实 CMS 代理打满，spec 内有注释），且该 describe 是 `serial`，失败会连带 2 条不执行。`--workers=2` 全量 = 127 条中 `126 passed / 1 skipped`（约 3.2 分钟）。

| 修改的源文件                                               | 跑这个测试                                                  | test 数 |
| ---------------------------------------------------- | ------------------------------------------------------ | ------ |
| `src/pages/Home/`                                    | `scripts/home.spec.ts`                                 | 46     |
| `src/pages/Browse/`（含 `useLogicalPage.ts` 逻辑分页） | `scripts/browse.spec.ts`                               | 22     |
| `src/pages/Chart/`                                   | `scripts/chart.spec.ts`                                | 6      |
| `src/pages/Detail/`                                  | `scripts/detail.spec.ts`                               | 20     |
| `src/pages/Player/`                                  | `scripts/player.spec.ts` + `scripts/player-failover.spec.ts` + `scripts/player-cms-error.spec.ts` | 26 + 1 + 1 |
| `src/components/UniversalPlayer/`（全屏整改/移动端 toast 专项） | `scripts/smoke-player-fs-mobile.spec.ts`               | 7      |
| `src/pages/IPTV/`                                    | `scripts/iptv.spec.ts` + `scripts/iptv-player.spec.ts` | 10 + 11 |
| `src/components/UniversalPlayer/IPTVOSDBar/`、`…/IPTVChannelList/`（chrome 尺寸契约 / 强调色） | `scripts/iptv-player.spec.ts`（`-g "IPTVP-02"`） | 5 |
| `src/pages/Settings/`                                | `scripts/settings.spec.ts`                             | 25     |
| `src/pages/Collections/`                             | `scripts/collections.spec.ts`                          | 5      |
| 跨页签 IDB 一致性（收藏收敛 `col-{videoId}` 主键）              | `scripts/collection-cross-tab.spec.ts`                 | 1      |
| 跨页签实时同步（BroadcastChannel 广播 → 另一页签内存快照静默刷新）    | `scripts/user-cross-tab.spec.ts`                       | 1      |
| IPTV 收藏/播放历史跨页签同步（storage 事件 → rehydrate + isFavorite 重派生） | `scripts/iptv-cross-tab.spec.ts`              | 1      |
| 设置静态配置跨页签同步（storage 事件白名单合并，theme/skin 真实 DOM 翻转）    | `scripts/settings-cross-tab.spec.ts`          | 1      |
| `src/pages/History/`                                 | `scripts/history.spec.ts`                              | 11     |
| `src/pages/SourceChecker/`                           | `scripts/source-checker.spec.ts`                       | 5      |
| `src/pages/Person/`                                  | `scripts/person.spec.ts`                               | 7      |
| 跨页联动回归                                               | `scripts/cross-page.spec.ts`                           | 17     |
| 详情页回归（原 DETAIL 段）                                    | `scripts/regression-detail.spec.ts`                    | 17     |
| 9.1 自测问题修复（app 端适配/冷启动/免责声明）                         | `scripts/fix-2026-08.spec.ts`                          | 6      |
| UI 整改专项（移动端头像/抽屉/触摸越界/browse 刷新/设置动画/modal 宽度）       | `scripts/ui-fixes.spec.ts`                             | 7      |
| 全局问题专项（字体自托管/IPTV 台标兜底/跟随系统/空数据不挂载）                  | `scripts/global-fixes.spec.ts`                         | 5      |
| 代理配置页专项                                               | `scripts/proxy-setup.spec.ts`                          | 3      |
| `index.html`（启动骨架：路由感知 + 视口填充）                  | `scripts/boot-splash.spec.ts`                          | 13     |
| 骨架体系契约（色源唯一 / 列数三方同源 / 结构同构 + 视口填充 / 启动骨架 shape） | `scripts/skeleton.spec.ts`（跑批走 `scripts/e2e-skeleton.mjs`） | 18 |

> 注：`+N` 为 9.1 修复专项 `fix-2026-08.spec.ts` 中涉及该页的用例数（冷启动/汉堡/横屏/IPTV 全屏/免责声明 各页共通的修复验证；原封面兜底/TabBar 间距两条像素快照已删）。


### 共享组件 → 测试文件（1:N）

| 修改的源文件                                        | 影响的测试文件                                                                        | 合计 test 数     |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ------------- |
| `src/components/UniversalPlayer/`             | player + iptv + iptv-player + smoke-player-fs-mobile                           | 62            |
| `src/components/VideoCard/`                   | home + browse + detail + collections + history + person                        | 110           |
| `src/components/SearchBox/`                   | browse + cross-page                                                            | 40            |
| `src/components/RecordShell/`                 | collections + history                                                          | 17            |
| `src/components/RecordFilterPanel/`           | collections + history                                                          | 17            |
| `src/components/StatusTabs/`                  | collections + history                                                          | 17            |
| `src/components/FilterBar/`                   | browse                                                                         | 24            |
| `src/components/HeroBanner/`                  | home + cross-page（主图失败兜底 HOME-089 / 移动端滑动性能）                                | 57            |
| `src/components/StillsLightbox/`              | detail（缩放控件位置契约 DETAIL-090）                                                 | 8             |
| `src/components/ui/Drawer.tsx` / `Drawer.css` | browse（footer 插槽真固定 BROWSE-081/082；另会连带命中 `ui/**` 的 settings 6.6，属已知轻微过度覆盖）     | 8 + 10        |
| `src/components/Layout/`                      | 全部页面加载测试（home/browse/detail/...各首屏用例）                                          | 逐个 spec 首屏用例  |
| `src/components/StickyHeader/`                | 全部页面加载测试                                                                       | 逐个 spec 首屏用例  |
| `src/components/ui/Toast.tsx` / `toastBus.ts` | settings (版本号点击)                                                               | 24            |
| `src/services/tmdbService.ts`                 | home + browse + detail + person                                                | 93            |
| `src/services/videoService.ts`                | browse + player + source-checker                                               | 36            |
| `src/services/iptvService.ts`                 | iptv + iptv-player                                                             | 19            |
| `src/services/channelLogo.ts`                 | iptv（收藏按钮渲染护栏 IPTV-090 + 台标候选链 IPTV-080/081）+ iptv-player + collections + history | 33            |
| `src/services/epgService.ts`                  | iptv + iptv-player + collections + history（EPG 匹配/缓存读取）                        | 各 spec EPG 用例 |
| `src/components/LazyImage/`                   | home + browse + detail + collections + history + person + iptv（台标/海报图片加载用例）    | 各 spec 图片用例   |
| `src/stores/useTMDBStore.ts`                  | home + browse + detail                                                         | 85            |
| `src/stores/useSettingsStore.ts`              | settings + source-checker                                                      | 29            |
| `src/stores/useUserStore.ts`                  | collections + history                                                          | 12            |
| `src/components/ui/PullToRefresh/`            | (vitest 单元测试) `src/components/ui/PullToRefresh/PullToRefresh.test.tsx`         | 4             |
| `src/components/UniversalPlayer/lib/utils.ts`（清晰度档位标签/过滤） | (vitest 单元测试) `src/components/UniversalPlayer/lib/utils.test.ts`（护栏：`height=0` 不得产出「0P」、`getSelectableLevels` 必须保留 adapter 原始索引） | 6             |

> 注：`search-features.spec.ts`、`mobile-web-sidebar.spec.ts` 等旧测试已彻底删除（原归档目录 `scripts/backup-specs/` 于 2026-08-29 连同 8 个一次性 `.mjs` 工具脚本一并清理，已备份至 `backups/scripts-untracked-20260829/`），映射表中不再引用。`playwright.config.ts` 的 `testIgnore` 规则已随之移除。

### 快速跑法

```bash
# 单个页面（最常见）
pnpm exec playwright test scripts/player.spec.ts

# 共享组件（如 VideoCard）
pnpm exec playwright test scripts/home.spec.ts scripts/browse.spec.ts scripts/detail.spec.ts scripts/collections.spec.ts scripts/history.spec.ts

# 全量（仅 CI 或发版前）
pnpm exec playwright test
```


> **无 `.env.local` 时的既有失败基线**（2026-09-15 实测，worktree @ c114c867 对照同条件）：
本机无 `.env.local`（global-setup 写入占位 TMDB token / 占位代理地址）且无外网，
下列用例**环境性必败**，非代码回归：`BROWSE-010/012/013/014`、`BROWSE-081/082`、`DETAIL-060/062`、
`IPTVP-023`、`HIS-050/051`（基线单车复跑 3/3 全败），以及 `smoke-player-fs-mobile` 全 7 条（依赖真实流）。
另有 2 条**并发 flaky**（全量 `--workers=2` 时挂、单跑即过）：`BROWSE-094`、`BROWSE-095`。
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

- **全量预算 ≤5 分钟（2026-09-20 用户硬性规定，不可协商）**：默认入口 `npm run test:e2e`
  = `scripts/e2e-suite.mjs`（阶段 A dev 行为全套 + 阶段 B preview 骨架契约 B，串行，
  300s 看门狗到点击杀并判失败）。超预算的合规解法按此优先级取舍：
  ① 取证/截图类脚本不进默认套（`test:e2e:shots` 按需）；② 同构断言合并为参数化循环；
  ③ 缩短 mock 侧不必要的人为延迟；④ 复核 `waitForTimeout` 固定睡眠改条件等待。
  **禁止**用「删断言 / 降断言精度 / 加 skip」凑时间。新增用例先本地跑 `npm run test:e2e` 确认总时长仍在预算内。
- **端口与进程边界（2026-09-20 用户定稿，二次强化）**：E2E 端口由 **OS 动态分配**（不固定占任何端口；
  `E2E_PORT` 仅供显式指定，如对着自己 dev server 测：`E2E_PORT=3001`，也只是连接复用）。
  **绝不按端口占用者杀进程**：测试自建 server 由 `scripts/e2e-vite-server.cjs` wrapper 拉起（命令行即标记），
  收尾只杀「带该标记且 HTTP 探活无响应」的僵尸；浏览器只杀带 ms-playwright 路径 / 临时 `--user-data-dir`
  特征的。禁止 `taskkill /IM chrome.exe`——那会连带杀死用户日常浏览器（已犯过事故，见 changelog 09-20）。
- **卡死根治（2026-09-20，永久化）**：上述防卡死机制已从「仅骨架」扩展到全量——
- `npm run test:e2e` = `e2e-skeleton.mjs --all --dev`（清场 + 健康轮询 + 封顶 + 收尾）；
  `test:e2e:preview` 走 dist（更快，但 boot-splash 静态骨架与 1.3c 面板用例存在双
  `.cqa-heat-row` 同屏冲突，属已知不兼容，待修）；`test:e2e:raw` 保留裸跑入口。
- `globalSetup` 前置 HTTP 探针：死端口 8s 内 fail-fast 并指向 skeleton，不再整轮零输出。
- config `globalTimeout`（CI 40min / 本地 30min）+ 本地 `workers=2`。
- **网络守卫**（fixtures/mock-tmdb）：mock 模式下任何未命中专用拦截、且不属于
  本地/测试桩域/`.env.local` 配置代理主机的公网请求**立即 abort**；TMDB mock 未命中
  返回 404 不再逃逸；注入源与 iptv-org 主干由 `scripts/fixtures/test-env.ts` 提供
  确定性 mock（源下标单一事实源）。断网环境跑 E2E 从此与有网同速同结果。
  逃生门仍是 `TMDB_MOCK=false`（真实网络回归）。

### 增量测试（推荐日常使用）

`scripts/run-tests.ps1` 支持**文件级精粒度映射**（`$uiPrecisionMap`：改哪个文件只跑其相关 describe 段，而非整个 spec）：

```powershell
# 自动检测 git 改动并匹配映射（推荐）
.\scripts\run-tests.ps1 -AutoDetect

# 手动指定改动文件，验证匹配效果（不实际跑时可加 -Files）
.\scripts\run-tests.ps1 -Files @("src/components/HeroBanner/HeroBanner.tsx")

# 手动按 describe 段号/测试编号精准过滤（Grep 透传 playwright --grep）
.\scripts\run-tests.ps1 -Grep "1\.2"
.\scripts\run-tests.ps1 -Grep "HOME-010|HOME-011|HOME-012"

# 发版前真实 API 回归
.\scripts\run-tests.ps1 -Group regression -RealApi
```

**映射维护约定**（改动代码后同步维护）：

- 新增/修改组件或页面文件时，检查 `scripts/run-tests.ps1` 的 `$uiPrecisionMap` 是否有对应条目；没有则补充（`spec` = 受影响的 spec 文件，`grep` = 相关 describe 段号或测试编号）
- **grep 优先用 describe 段号**（如 `1\.2` 覆盖整个 HeroBanner 段）：段内新增用例自动涵盖，映射无需随用例增减维护
- ⚠️ **段号是正则**：`.` 必须转义（`1.2` 的 `.` 会通配任意字符，误命中含 `1023px` 等 1?2 序列的其他段标题），写 `1\.2`
- **映射覆盖范围**：`$uiPrecisionMap` 已覆盖所有共享组件（HeroBanner/CategoryQuickAccess/Layout/StickyHeader/SearchBox/VideoCard/LazyImage/RecordShell/StatusTabs/StillsLightbox/IPTVChannelCard/EPGProgramList/SourceManager/TokenRequired/ui/UniversalPlayer）+ 各页面文件；`$logicTestMap` 统一 `{spec, grep}` 结构，`spec` 含 `"vitest"` 标记触发单测，关键服务/Store 文件联动对应页面 E2E 段；未覆盖的组件落 `$uiTestMap` 粗粒度兜底
- **映射失效检测（自动）**：每次运行时校验 grep 段号在对应 spec 中是否仍存在——describe 段被删除/重命名导致零命中时输出黄色警告「映射可能过时，请更新映射」，防止改代码后旧映射静默失效
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


