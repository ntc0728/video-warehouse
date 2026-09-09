# 架构决策记录（ADR）

> 由 `docs/KNOWLEDGE.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

## 架构决策记录（ADR）

> 记录项目中有长远影响的架构选型与约定。新增决策请复制下方模板，编号顺延（`ADR-XXX`），并在「已记录决策」中补一条摘要。
> 何时写、写到哪、模板见 `CONTRIBUTING.md` 第 6 节。

### 模板

```markdown
### ADR-XXX: 标题

- 状态: 已采纳 / 候选 / 已废弃
- 日期: YYYY-MM-DD
- 提出人: xxx

**背景**
为什么需要这个决策？要解决什么问题？

**决策**
我们决定：……

**后果**
- 正面：……
- 负面 / 权衡：……

**替代方案**
- 方案 A：……（未采用原因）
- 方案 B：……（未采用原因）
```

### 已记录决策

- **ADR-001 卡片模块 UI 仅桌面端（≥1024px）生效**（2026-07-13）
  首页 HeroBanner / 分类 / 每行、侧边栏 / 顶栏、页面级 loading 的卡片化视觉（圆角 + surface 背景 + 1px border + shadow-sm）统一收进 `@media (width >= 1024px)`；移动端（<1024px，含平板 768–1023）保持原始全宽布局，不被卡片化波及。理由：卡片模块是桌面端视觉增强，小屏应保留信息密度。

- **ADR-002 Keep-Alive 路由模式**（早期）
  `AppLayout` 不卸载已访问页面，用 CSS `display` 切换可见性。理由：避免重复请求与状态丢失（如 IPTV 播放、表单输入）。后果：修改页面状态需考虑组件已挂载的「二次进入」场景（如搜索词从顶部导航带入 Browse）。

- **ADR-003 代理分层**（早期）
  CMS / EPG 请求走 Video Proxy（`/proxy?url=`）；IPTV 直播流走 IPTV Proxy（`/m3u8-proxy?url=`）；TS 分片走 TS Proxy（`/ts-proxy?url=`）；TMDB API 原生 CORS 直连。理由：不同源对重写 / 跨域的需求不同，分层后各自独立可维护。

- **ADR-004 版本号：SemVer + release-please 自动维护 + Capacitor 双端派生**（2026-07-30）
  版本号唯一可信源 = `package.json.version`；由 release-please 依据 Conventional Commits 自动算版并打 `vX.Y.Z` tag、维护 `CHANGELOG.md`。Capacitor Android 端 `android.versionCode` 由版本号派生（公式 `major*100000+minor*1000+patch*10+通道序`，release=3/rc=2/beta=1/alpha=0），在 `build:android` 时经 `scripts/sync-capacitor-version.mjs` 写入 `capacitor.config.ts`。理由：避免手工改版本导致 Web/Android 版本漂移、CHANGELOG 与 tag 不同步。后果：提交信息须遵循 Conventional Commits 才能正确算版；0.x 阶段破坏性变更升 MINOR，首个稳定版定为 `1.0.0`。

- **ADR-005 死代码与依赖收敛约定**（2026-07-31）
  全仓扫描发现大量零引用 hooks、未挂载组件、CSS 死类/重复 `@keyframes`、过时注释，长期累积增加维护负担与回归风险。
  我们决定：① 删除任何模块前先用 grep/子代理全仓核实引用（含动态 `import()`、barrel 导出、CSS class 拼接、测试脚本）；② 删除未挂载功能组件时，若其独占某 npm 依赖，一并 `npm uninstall` 并同步 lock 文件；③ 对「可能将来使用」的动画/工具类（如 `animate-*` 工具类、`spin`/`pulse` 同名重复 `@keyframes`）保留、不激进删除；④ 注释须与实际代码逐行对齐，删除死变量/死分支须同步清理引用与注释。
  后果：仓库更小、构建更干净；需防止将来误重新引入已删模块（见记忆库「死代码清理记录」）。

- **ADR-006 禁止源码硬编码像素尺寸，视觉尺寸一律走 Design Token（2026-07-31）**
  项目视觉尺寸曾散落大量「源码字面量像素」：下拉高度 `Math.min(…,448)`、OSD 宽度 `OSD_MIN_WIDTH=360`/`OSD_MAX_WIDTH=1600`、`Sidebar` 的 `isMobile ? 200 : 240`、图标 `<svg width="16">`、Tailwind 任意值 `text-[10px]`/`w-[28px]`/`px-[14px]` 等。这些字面量不随 `--text-*`/`--space-*`/`--layout-*` 的流体曲线缩放，在 2K/4K/TV 下比例失真，且 TV 端无法统一放大。
  我们决定：① 组件视觉尺寸一律走 Design Token——图标经 `Icon` 组件（`size` 为档名）或 `--icon-*`、布局/间距/字号经 `--space-*`/`--text-*`/`--layout-*`；② 去硬编码统一用 `scripts/css-px-to-token.mjs` 自动替换，再人工核对 token 语义边界（严禁把跨语义尺寸硬压进同一档，如把 32/36/40/48 全压 `icon-xl`）；③ 例外（允许保留字面量，因为它们是逻辑阈值而非视觉尺寸）：`useMediaQuery` 断点值、`IntersectionObserver` 的 `rootMargin`、`<img sizes>` 响应式提示、`BottomSheet` 的 `1px` sr-only hack、`window.innerWidth` 列数兜底。
  后果：所有视觉尺寸跟随同一条 vw 缩放曲线，任意视口比例恒定；TV 端改 `[data-device="tv"]` 覆盖 `--text-*` 后图标/布局自动跟随放大。权衡：需警惕「为 token 单独写独立 clamp/slope」会破坏与文字的比例锁定（图标 token 必须 `calc(var(--text-<档>) * 系数)` 派生，见记忆库「图标 token 派生自文字 token」）。

- **ADR-007 非 TV 零焦点框与交互元素视觉细节约定（2026-07-31）**
  今日在首页 / 侧边栏做了一批 UI 微调，部分属「坑」级约定，需固化以免回归：
  ① **非 TV 全局零焦点框**：在 `src/assets/styles/index.css` 新增 `:root:not([data-device="tv"]) :focus-visible { outline:none !important; box-shadow:none !important }`，覆盖桌面 / `mobile-web` / `app` 三种 `data-device`（TV 才设 `"tv"`），清掉浏览器默认 `:focus-visible` outline 与组件自带 box-shadow 焦点环；TV 焦点框由既有 `[data-device="tv"]` 规则独立提供，互不干扰。`.no-interaction-visual` 自身仍 `!important` 无框。
  ② **首页 TMDB 行箭头显隐**：桌面端默认 `opacity:0`，悬停 `.tmdb-movierow-wrapper` 或键盘 `:focus-within` 才 `opacity:1` 淡入（键盘可见性提示）；移动端箭头不渲染、TV 端 `display:none`。
  ③ **侧边栏留白与图标↔标题间距**：`.home-sidebar__item` 横向 `padding` 由 `--space-lg` 提到 `--space-xl`（元素不贴左），上下 `padding` + `gap` = `--space-lg`；**坑：`.home-sidebar__label` 是 `position:absolute`，不吃父级 flex `gap`，图标↔标题间距只能由其 `left: calc(--space-xl + --icon-md + --space-xl)` 控制**（改 item `gap` 对标题间距无效）。
  ④ **移动端分类快选间距**：`.category-quick-access__inner` 的 `gap` 由 `--space-2xl`（下限 24px，对 40px 圆形卡片偏松）改为 `--space-lg`（更紧凑协调）。
  后果：键盘导航下非 TV 设备视觉更干净、焦点可见性交由 hover/可见性承担；上述细节在 TV 下由各自规则独立处理、互不干扰。回归测试见 `scripts/home.spec.ts` 1.6 段（HOME-050~053）。

- **ADR-008 HeroBanner 缩略图覆盖式布局 + 滑动切换动画（2026-08-05 补录）**
  首页 Hero 横幅采用「左侧主背景图 + 右侧缩略图列（absolute 覆盖 banner 右缘）」布局；缩略图激活态 2px 主色边框 + 阴影，点击跳详情。**滑动切换**：activeIndex 切换统一走 slide-left/right（新图滑入），自动轮播（5s）也走 slide；滑动后 1000ms 冷却暂停轮播。桌面悬停缩略图显式清除 slideDir → 回退 crossfade。**关键坑**：slide 动画结束后不重置 slideDir（否则 `.is-active` 层回退默认 crossfade 规则因 animation-name 改变重播淡入 → "闪一下、短暂出现上一张图"）。**预加载**：轮播预加载下一张 w1280 + 缩略图窗口 ±2 张 w500。**bannerReady 仅 items 空→有时重置**，切换分类保持 true（否则缩略图「真实→骨架→真实」硬切换 = 闪一下）。无障碍：`prefers-reduced-motion` 禁用动画。详见 AGENTS.md「HeroBanner 组件」。

- **ADR-009 双卡片布局规范（Browse/IPTV/Person/Detail/Settings 统一）（2026-08-05 补录）**
  每个功能区块作为独立「卡片模块」：`--color-surface` 背景 + 1px `--color-border-light` 边框 + `--radius-lg` + `--shadow-sm`，模块间距 `--space-sm`，**所有设备启用**。应用：Browse 双卡片（搜索区 Card1 `flex-shrink:0` + 结果区 Card2 `flex:1`）、IPTV `.iptv-top-card`+`.iptv-grid-card`、Person `.person-hero`+`.person-grid-card`、Detail `.detail-hero`、Settings 桌面端单卡（section 去卡片化、border-top 分隔）。移动端 Browse 整页以「命令栏 Card1 + 结果区 Card2」gap:0 相连成一张大卡（镜像桌面端）。详见 AGENTS.md「卡片模块 (Card Module) UI 约定」。

- **ADR-010 RecordShell 桌面横向筛选栏 vs 移动 M6（2026-08-05 补录）**
  收藏页/历史页共用 RecordShell 外壳：**桌面（≥768px）**顶部横向 sticky 卡片（第 1 行 = 标题+影视/IPTV 分段+搜索框+批量工具栏，第 2 行 = 状态筛选芯片横向可换行），主区在下方；**移动（≤767px）**顶部 sticky 精简栏滚动时折叠筛选芯片行。实现：末尾追加 `@media (width >= 768px)` 覆盖块，原移动端规则逐字节未动（零影响）；桌面横向 flex 中 `width:100%` 元素须显式 `width:auto` 复位。详见 AGENTS.md「RecordShell」。

- **ADR-011 首页分类切换 deferredCategory 解耦 + 纯 opacity 过渡（2026-08-05 补录，2026-08-13 终版修订）**
  首页「类目切换」将 `activeCategory`（点击立即响应）与 `deferredCategory`（驱动数据/内容渲染）解耦，切换由「新分类数据就绪」事件触发：等待期旧内容保留 + `.home-cat-dim`（opacity 0.55）降暗 → 数据就绪**暗态下原位替换** `displayedCategory` → 移除 dim → opacity 0.24s 变亮恢复 1。**全程无透明帧（最低 0.55）**——历史 `.home-cat-fade`（opacity 0→1）/ `fadePhase` 三态状态机（淡出到 0）均已移除（曾产生「banner 下方内容短暂消失」空窗）。`.home-page__content` 必须保留 `animation-fill-mode: none`（解除 `page-transition-enter` 的 `both` fill 对 opacity 的锁定，否则降暗失效）。**关键约束：过渡只用 opacity、绝不含 transform**——HeroBanner 的 GPU 合成缩略图层遇 transform 会重绘闪烁（"闪一下"）。详见 AGENTS.md「首页类目切换过渡」。

- **ADR-012 侧边栏折叠重构：瞬切 + 图标绝对居中 + label 淡出（2026-08-04）**
  侧边栏折叠从「宽度动画（0.24s transition）」改为**瞬切**：spacer 与 sidebar 同帧到位、无宽度动画（避免折叠时主内容区逐帧重排 reflow 卡顿）；图标收起态**绝对定位居中**（`left` 固定像素、可过渡平滑位移），label 淡出。实现细节：图标 absolute 化后不占 flex 流，item 显式 min-height 恢复行高；按钮 300ms 防抖。回归测试 `scripts/regression-detail.spec.ts` REG-013/014。

- **ADR-013 设置敏感字段「内存明文 + 持久化层加密」（H1 修复，2026-08-05）**
  旧 `setTMDBToken` 异步 `encryptText` 完成后 setState 密文覆盖内存 → 同一会话所有 TMDB 请求 401（`tmdbService.getAccessToken()` 同步读内存当 Bearer）。我们决定：**内存 state 恒为明文，AES-GCM 加密收敛到 persist 自定义异步 storage**——setItem 写 localStorage 前加密，rehydrate 读入时解密。setter 退化为纯 set，`getAccessToken()` 无需改动。`applyBackup` 导入对明文直接 setState（不再双重加密）。配套：`useSettingsStore.test.ts` 4 用例防回归；`docs/KNOWN-ISSUES.md` #1 登记。

- **ADR-015 Toast 全局系统整改 + 播放器交互修复（2026-08-05）**
  统一 toast 体系与播放器交互的批量整改：
  ① **toast 位置**：sonner `<Toaster>` 改 `top-center`；普通页面顶部居中、导航栏下方（CSS `top: calc(--header-height + space-lg)`）；播放器页（`/play`、`/iptv/play`）经 `UniversalPlayer` 挂载时 `document.body.dataset.playerToast='active'` → CSS 重定位中间靠上（top 42%）。宽度 `min(22rem, 视口-2rem)`，文本居中。② **类型图标**：`toastBus` 新增 `success/warning/error`（lucide CheckCircle2/AlertTriangle/AlertCircle + `--color-success/-warning/-error`，`.ts` 文件用 `createElement` 构建，不写 JSX）；`toast.show` 支持 `{ type }`。③ **统一 3s**：`TOAST_DURATION=3000`，全仓调用点移除显式 duration（Settings/Detail/播放器/截图）。④ **提示补全**：进度恢复（useProgressRestore → replace「已自动跳转到上次观看的位置」）、集数切换（useEpisodeSwitcher → replace「已切换到N集」，覆盖 ToastTrigger 线路名误报）、IPTV 切线路（handleSourceSwitch 默认「已切换到线路 X/Y」，C1 传专用文案）；ToastTrigger 首帧 src 守卫（null→值不算切换）。PlayerToast 改为转发 sonner（保留 context API）。⑤ **P0③**：PlayButton `disabled={isBuffering && !isPlaying}`（缓冲中可暂停）。⑥ **P1④**：ProgressBar `beginDrag` 加 `buffering` 守卫（缓冲中禁拖进度条）。⑦ **P1⑤**：中间播放图标条件加 `!isPlayerLoading`（切源失败不闪现播放图标）。⑧ **P2⑥**：`DuoIcon` 组件（两套相似 lucide 图标层叠 + CSS opacity/transform 过渡）应用于底栏按钮（Play↔PlayCircle、Pause↔PauseCircle、Skip↔Step、Maximize↔Maximize2、Volume 相邻级、PiP↔PictureInPicture、RefreshCw↔RefreshCcw、Gauge↔GaugeCircle、Subtitles↔Captions、Monitor↔MonitorPlay、Repeat↔Repeat1、MoreVertical↔MoreHorizontal），`.iptv-osd-bar` 同享。测试用例见 TEST-CASES.md TOAST-001~006 / PLAYER-016~01B。注意：`toastBus.ts` 为 `.ts` 文件不可写 JSX，图标一律 `createElement`；`.up-player-toast` 样式废弃但保留（PlayerToast 不再自绘）。

- **ADR-016 播放器操作提示独立右上角 + TV 端 IPTV 交互（2026-08-05）**
  PlayerToast 恢复**独立右上角渲染**（撤销 ADR-015 中「转发 sonner」）：播放器**操作类**提示（播放/暂停、音量、切线路、切频道、频道号输入等）显示于右上角 `.up-player-toast`，与全局 sonner toast（中间靠上，错误/成功/警告）**双轨并存**。`show(msg, duration, type)` 支持 success/warning/error 语义色图标，统一 3s；新增命令式 `playerToast()`（PlayerToast.tsx 导出）供组件顶层 hooks（ToastTrigger/useTVInput/useIPTVNavigation/useKeyboardShortcuts 在 ToastProvider 外）调用。IPTV 切线路提示由 `useIPTVNavigation` 改走 playerToast（右上角）。IPTV 播放页：① 非 TV 端放大图标从 header 移到**右下角**（`.iptv-player-page .up-header-fullscreen-btn` CSS fixed）；② **TV 端进入默认请求全屏**（IPTVPlayer 挂载时 requestFullscreen，浏览器无手势拦截时静默）且 `PlayerHeader showFullscreenButton={mode==='iptv' && platform!=='tv'}` 隐藏图标；③ TV 遥控器音量 → `showVolumePopup` 弹音量柱 + 右上角「音量 xx%」；④ TV 换频道/频道号输入 → 右上角「已切换到{频道名}」。CSS 微调：进度条两端 padding（space-sm）、倍速 hover 文本随图标缩放（`.up-speed-label` transition+scale）、更多弹窗文本间距（gap space-md + 垂直 padding space-md）、`up-time-display` 亮色主题适配（rgba 白字在亮底消失 → `--color-text-secondary`）。测试用例：TEST-CASES.md TOAST-007/008 + IPTVP-030~034。

- **ADR-017 预加载①②（点播首分片预取 + 剧集连播预加载，2026-08-05）**
  ① `HLSAdapter` LEVEL_LOADED 非直播分支置 `config.startFragPrefetch=true`：manifest 解析后立即拉首分片（不等 play），缩短点播首帧延迟；直播保持 false（按 live edge 拉取）。② `useNextEpisodePreload`（Player 页）：当前集 `playing` 后 300ms 预拉**下一集** manifest + 首分片（落浏览器 HTTP 缓存，切集秒起播）。约束：**仅 Wi-Fi**（`navigator.connection` effectiveType/type 命中 cellular/2g~5g 跳过，桌面无 API 默认允许）、非末集、串行单任务（AbortController，新任务 abort 旧）、只拉 1 个分片、失败静默、master 清单只预拉清单不拉分片（`extractFirstSegmentUrl` 无 `#EXTINF` 返回 null）。预加载默认开（不进设置页，用户定）。测试：`useNextEpisodePreload.test.ts` 8 用例（isWifiConnection 4 + extractFirstSegmentUrl 4）。调研结论：hls.js `startFragPrefetch`/`autoStartLoad` 为关键开关；Shaka `PreloadManager` 分阶段（playing 后）+ 串行；ExoPlayer PreloadManager 列表预加载；大厂只预拉前 3~5s。

- **ADR-018 播放链路接口兜底排查 + EPG 请求合并（2026-08-05）**
  排查"接口报错无限调用"：播放流链路均**有上限**——hls.js `errorCount<3` 重试、A3/C1/D1 每 URL 仅 1 次（`buildProxyUrl` 幂等：先 `unwrapProxy` 再包，重复调用 URL 不变）、CMS `fetchInitiatedRef`+AbortController 防重；真正的"无限调用"集中在 **EPG**——`handleOpenProgramGuide` 每次点击都阻塞 `await fetchAndParseEPG()`（缓存过期时全量拉取 20s），弹窗迟迟不弹、用户重复点击堆积并发请求。修复：① `fetchAndParseEPG` 加**请求合并**（模块级 `Map<customUrl, Promise>`，在途共享一次网络拉取，完成后清空）；② 节目单改为**缓存优先 + 非阻塞**（先 `setShowProgramGuide(true)` 弹窗，`getCachedEPGData` 缓存渲染，网络 `fetchAndParseEPG` 后台刷新，失败静默保留缓存）。另有：仅含音频（C1）/裸流（D1）分支主动 `setPlayerLoading(false)`，修复**中间 loading 动画一直转**（原 `isPlayerLoading` 仅 `canplay` 清除，纯音频可播但无视频帧 / 解码失败时 canplay 不触发 → spinner 永转）。

- **ADR-014 D1 裸流降级识别（fail-and-retry，2026-08-05）**
  裸流（无扩展名 / 裸 TS / FLV，`detectVideoSourceType` 误判为 m3u8）识别采用**「失败降级重试」而非「预先 Content-Type 嗅探」**：HLSAdapter 拆分 `manifestParsingError`（拿到内容但解析失败 → 上报 `code='BARE_STREAM'`）与 `manifestLoadError`（网络层失败 → 维持「频道源不可用」走 A3）。UniversalPlayer 收到 BARE_STREAM 后在 IPTV 模式用 `degradedType` state 临时覆盖播放器类型为 `flv`（URL 变化复位），重建 `MPEGTSAdapter` 重试**同一 URL**（每 URL 仅 1 次）。worker `m3u8-proxy` 对非 `#EXTM3U` 内容（`isM3U8Content`，兼容 UTF-8 BOM）直接透传源站二进制（不重写、不缓存）——代理 URL 无需改写即可被 mpegts.js 拉流。**零额外请求**（复用必然失败的 manifest 请求）。对比预先嗅探省掉 Range/abort/CORS 三个坑；缺点为首帧多一次解析失败延迟。测试：`HLSAdapter.test.ts` 2 用例（错误拆分）、`m3u8Proxy.test.ts` isM3U8Content 4 用例；配套 `worker/m3u8-proxy.d.ts` 同步 `isM3U8Content` 声明。

- **ADR-019 三源统一管理 + IPTV 检测按组隔离 + 构建告警收敛（2026-08-07）**
  1) **源管理收敛**：`useSourceManagerStore` 成为视频/IP/EPG 三源**单一来源**，`bootstrap()` 仅在持久化列表为空时注入默认源（保证设置页启用状态回显，避免每次覆盖用户配置）；`syncConsumers(scene)` 统一回写各 consumer（IPTV 的 `aggregatorUrls`/`sourceNames`、各 indices），删除页面侧重复的 aggregatorUrls 同步 effect；`setEnabled` 对 IPTV/EPG 加「**至少一个源**」兜底（停用最后一个被拒绝；`setAllEnabled` 已于 2026-08-12 删除，见 ADR-020）；缓存校验从 `sort()` 改为**严格顺序比较**（`JSON.stringify(sourceUrls)`），保证「顺序 = 启用顺序」。入口：`main.tsx` 启动时 `useSourceManagerStore.getState().bootstrap()`。
  2) **IPTV 检测按组隔离**：`channel.isAvailable`（全局共享，跨 tab 残留）改为 `useIPTVStore.availabilityResults: Record<groupId, Record<channelId, boolean>>`（key = `selectedGroup ?? '__all__'`），`checkAvailability`/`abortAvailabilityCheck` 只读写当前组，卡片显示改用 `availability` prop。`channel.isAvailable` 类型字段已删除。
  3) **按钮按压机制对齐**：全局按压走 CSS `scale` 属性（非 transform）+ `:has(> *)`，排除 `.settings-page *`/`.no-press`；proxy-setup 不在 settings-page 内故需手动对齐 `.settings-row`（框 `scale:none` + 内部内容 `scale:0.96`），避免图标/文本位移。ConfirmDialog 确认/取消按钮胶囊化（`rounded-full`）。删除确认框按钮与设置页导出按钮按压效果统一。
  4) **构建告警收敛**：4 个 non-functional warning 只处理 2 个——① `SourceChecker` 改直接导入 `useIPTVStore`（消除 reexport 循环）、④ `chunkSizeWarningLimit 800→900`（dash-vendor 804KB，lazy 加载不阻塞首屏）；② `state-vendor→react-vendor` 循环、③ `epgService` 动态/静态混用**刻意不动**（非 bug，改动手动 chunks 需全站回归、收益仅整洁）。完整分析见 `docs/warning-review.md`。
  5) **GroupPicker 折叠修复**：折叠测量原用 `child.offsetTop` 依赖 offsetParent（`.grouppicker__hot-tags` 未设 position → offsetTop 混入页面绝对位置 → twoRowHeight 巨大、折叠失效露出第 3 行）。改用 `getBoundingClientRect()` 相对容器顶部计算行位置与折叠高度，精确「超 2 行折叠成完整 2 行 + 展开按钮」。

- **ADR-020 IPTV 代理收敛 + 源管理拖拽 + 卡片占位/动画 + Android CI（2026-08-12）**
  1) **IPTV 源接口无条件走 IPTV 代理**：新增 `buildSourceProxyUrl(url, proxyUrl)`——源 M3U 拉取强制走 `/m3u8-proxy` 端点，**不经过 `shouldProxy` 的直连白名单/proxyPattern 判断**（与频道播放链接不同：播放链接才走代理规则逻辑）。`fetchAndParsePlaylist` 移除 `corsProxy` 参数、源拉取改用 `settings.proxyUrl`（`useIPTVStore` 调用处同步不再传 `useSettingsStore.getState().corsProxy` 并删除该 import）。`buildCorsProxyUrl`（iptvService）保留给其余视频/EPG 文本拉取场景。
  2) **台标不再走 file-proxy**：`channelLogo.ts` 的 `toSafeLogoUrl` 从「http 台标经 `{proxy}/file-proxy?url=` 转 https，无代理丢弃」改为「http/https 一律原样直连」——避免 IPTV 页数百张卡片每次刷新批量打 worker 消耗请求额度。`resolveChannelLogoCandidates` 的 `proxyUrl` 参数保留（`_proxyUrl`）仅为兼容历史调用点，已不再用于代理改写。http 台标在 https 部署若被混合内容拦截则自然失败进入下一候选/字母占位。
  3) **源管理删除「全部启用/停用」+ 拖拽排序**：`SourceManager` 工具栏删除「全部停用/全部启用」按钮与 `onSetAllEnabled` prop；`useSourceManagerStore` 删除 `setAllEnabled`，新增 `reorder(scene, fromIndex, toIndex)`（更新 order + 同步 consumer）。`source-manager__item` 改 `draggable`，左侧新增 `.source-manager__item-drag` 拖拽柄（GripVertical），拖拽中用 `.is-dragging`（半透明+虚线边框）/`.is-drop-target`（主色边框+顶部高亮线）指示。**注意**：原生 HTML5 DnD 在触摸设备不友好，移动端拖拽体验依赖浏览器支持；如需完整移动端拖拽后续可换 pointer 事件/DnD 库。`VideoTab`/`IptvTab` 同步删除 `setAllEnabled`/`onSetAllEnabled` 绑定。E2E `SET-052` 改为逐个停用验证「至少保留一个源」兜底。
  4) **LazyImage 失败占位两处修复**：① `fallbackSrc` 为空字符串（如 IPTV 卡传 `fallbackSrc=""` 强制不渲染品牌图）时，失败态**不再渲染 fallback img**——避免 `<img src="" alt={台名}>` 被浏览器显示 alt 文本（台名）+ 破损图标；此时由调用方独立的占位元素（如 `.iptv-card-cover__glyph` 的 Tv 图标）兜底。② 超时挂起路径（`setTimeout` 候选链用尽 `setError(true)`）**补调 `onError`**（与 `handleError` 一致），否则 IPTV 卡片等依赖 `onError` 切换占位（Tv 图标）的调用方在「请求挂起超时」时不会更新占位。
  5) **IPTV 卡片出场动画对齐收藏页视频 tab**：`animations.css` 新增 `.animate-fade-in-up`（`fadeInUp 0.4s --ease-out-expo`，淡入+上移 12px）；`IPTVChannelCard` 卡片 className 从弱弱的 `animate-card-enter`（cardFadeIn：opacity 0.4→1，0.18s）改为 `animate-fade-in-up`（明显淡入+上移）。`IPTV/index.tsx` 的 `.iptv-channel-grid` 加 `key`（`selectedGroup+selectedSource+debouncedKeyword`）+ `animate-fade-in`：切换分组/源/搜索时网格重挂载，容器淡入 + 卡片 fadeInUp 过场（与收藏页视频 tab 一致）；收藏/历史页 IPTV tab 本就靠 `key={activeTab}` 重挂载触发同款卡片动画。IPTV 卡片封面加载失败时（`imageError`）隐藏左上角 availability-badge，保证占位图干净。
  6) **Android CI 修复 APK 缺失**：`release-android.yml` 缺 Android SDK 安装——仅 `setup-java@v4` 装 JDK，`ANDROID_HOME` 为空导致 gradle 编译失败、`apksigner` 找不到、整个 workflow 失败 → Release assets 无 APK。修复：`setup-java` 后新增 `android-actions/setup-android@v3`（`api-level: 34`，匹配 `compileSdk=34`），安装 platform 34 + build-tools（含 apksigner）+ platform-tools 并设 `ANDROID_HOME`。`dist-bak-*` 备份目录加入 `.gitignore`。

- **ADR-021 播放器/详情页前端实现模式与踩坑（2026-09-01）**
  本轮 8 项 UI 整改 + 播放器父级不脱标 + pipController 错误文案，固化以下约定：
  ① **跨页共享 CSS 类必须全局化**：Vite 懒加载页 CSS 仅在该页 chunk 下载时生效，Detail.css 由 Detail 页懒加载 → Play 页 / Home banner 复用 `.detail-hero-logo/.detail-hero-rating/.detail-hero-meta-item` 时未访问 Detail 页就丢样式。跨页共享类上提 `src/assets/styles/shared-hero.css`（由 `index.css` `@import` 同步加载）；主题色用 CSS 变量（`--hero-meta-color/--hero-meta-type-bg`）做暗/亮适配。
  ② **骨架与真实面板同构防抖动**：骨架直接复用 `.player-panel/__header/__body`，外层 `display:contents` 让面板成父级 flex 子项、继承变体比例（tv 2:4:4 / movie 3:7），骨架→真实零高度跳变 + 盒模型逐像素对齐零横向跳；勿造 `.player-skeleton-panel` 私有类（必漂移）；加载分支传 `seasons.length>1?'tv':'movie'` 同步变体。
  ③ **min-height 撑不开写死 height 的父级**：父级须 `height:auto; min-height:calc(100dvh - var(--header-height))`，外层 overflow-y:auto 滚动；两侧 flex 子项同步 `height:auto + min-height` 让 align-items:stretch 同高（百分比 height 在父高度 auto 下解析为 auto，无需显式 height:100%）。
  ④ **`aspect-ratio` + `min-height` 共存即可，勿加 `aspect-ratio:auto`**：auto 会释放 min-height 让 hero 塌成纯内容高；CSS min 优先于计算值，派生高度 = max(min, min(W*9/16, 65vh))。
  ⑤ **详情/播页 meta 与 Detail 页同源**：评分 `{vote>0 && …}` 守卫（否则留孤 ★）、year 仅取 TMDB 日期（移除 CMS 回退）、meta 项全带显式条件。
  ⑥ **pipController 错误文案可读**：内部 timeout label 改短英文、外层 catch 翻中文；`togglePip` 入口短路（NETWORK_NO_SOURCE→「视频源加载失败，请切换其他源」/ paused+readyState=0→「视频尚未加载，请先开始播放」），元数据超时 1.5s→3s、request 3s→4s。
  ⑦ **首页 banner 标题位用 TMDB logo 代替文字**：HeroBanner 按 mediaType+tmdbId 拉 /images 端点取 logo（zh/en 优先），命中渲染 `.detail-hero-logo` 否则回落文字；模块级缓存 + 进行中去重 + 串行请求，fetch 失败记 null 本会话不重试；`<img onError>` 永久回落文字。
   ⑧ **播放页 E2E 沙箱 mock（2026-09-01）**：`scripts/player.spec.ts` 改从 `scripts/fixtures/cms-mock.ts` 引入 `test`（extend 自 `mock-tmdb`）。`cms-mock` 拦截 CMS 搜索请求（`ac=videolist`，**经 CORS 代理后编码成 `ac%3Dvideolist`，二者都要匹配**）返回固定 `CMSListResponse`（`vod_play_url` 指向本地 `cms-mock.local` HLS 流），并拦截 `cms-mock.local` 的 m3u8/ts 从 `scripts/fixtures/hls/stream/`（ffmpeg 本地生成）fulfill。这样播放器可靠挂载 `.up-universal-player`、hls.js 完整初始化，消除沙箱代理不可达导致的 M04/M09/M12/M15 等移动端 flake。根因：沙箱 `corsProxy` 有值 → `useProxy:true` 把请求包装成 `<proxy>/proxy?url=<encoded>`，裸 `ac=videolist` 正则匹配不到。

- **ADR-022 三段式流体 token + 大屏冻结与缩放（2026-09-04）**
  旧体系 8 种 regime 并存：R1（375→768，漏写 100 倍恒取 MIN）、R2（46 个 PREF=MIN 无契约）、R3（5 个真独立契约不动）、R4（TV 2× 独立）、R5（@media 阶梯 + `--grid-gap` 1919→1920 +96.7% 跳变）、R6（大屏兜底）、R7（组件级硬编码 clamp）、R8（常量 + `--icon-*` 派生）。我们决定：**三段式**——移动 375→768 流体 / 桌面 768→1920 缓流体（交接点 A=MIN+(MAX-MIN)×2/3，R=2/3 全局唯一可调）/ ≥1920 冻结 + `--ui-scale`；PREF 一律 px 字面（消 rem16/rem14 偏差）；`--text-base` 段1恒14（移动 rem 零回归）、段2 14→16；R3 五个（`--layout-sidebar-width`/`--layout-logo-size(-sm/-lg)`/`--header-height`）不动；`--layout-content-max-width` 豁免单契约 320→2200（锚点 375→3847，不乘 scale）；TV 漏斗（:root 流体但 TV 未覆盖者）在 TV 块补钉恒 MIN（零回归）；`--ui-scale` 默认 1.0（等效关闭，阶段 D 真机校准后再定幅，预判 1.0~1.15）；手动档 `AppSettings.uiScale`（0=自动）经 AppLayout 内联覆盖 + index.html 阻塞脚本预写防首帧闪；卡片封顶 `--card-size: 290px×scale` + ≥1280 `auto-fill`（必须非 auto-fit）+ 内容区 2200；横向行保留数值仅重算（≥2560/≥3840 统一 6 列，`--iptv-cols` 同步）。后果：桌面间距/控件一次性恢复设计值（观感剧变，独立 commit 可 revert）；R7 clamp 内 rem→px（+14.3% 恢复设计基准，配 stylelint 豁免注释）；TV 四视口零漂移。详见 `changelogs/design-docs/2026-09-04-大屏与流体体系整合整改方案.md`。

- **ADR-023 断点宪法终版 + UI 缩放连续化 + 历史页独立分档（2026-09-07）**
  取代 ADR-022 的「≥1280 冻结梯度」与 v1.10.0 的「Card Columns v6（≥1280=8/≥2560=9/≥3840=10）」。本轮把大屏断点起点从 1280 右移到 **1440**，并定稿全站列数/留白梯度：
  - **主网格 `--card-cols` 终版**：<768=3 / ≥768=4 / ≥1024=5 / ≥1280=6 / ≥1440=7 / ≥1920=8 / ≥2200=8（2200 内容区封顶，此后列数冻结）；`--page-pad-x` 16(<1440)→60(1440)→100(1920)→140(2560)（2026-09-08 1387 由 32/48 上调，梯度单调递增）；`--iptv-cols` 2(≤767)→3(768-1023)→4(1024-1439)→5(≥1440)。
  - **UI 缩放连续化**（取代 ADR-022 的离散 `--ui-scale:1`/`1.08` 硬跳）：`variables.css` 合并为单条 `@media(width≥1920 and resolution<1.5dppx)` → `--ui-scale: clamp(1, calc(0.76 + 0.000125 * tan(atan2(100vw,1px))), 1.08)`（1920→2560 线性 1.00→1.08，≥2560 由 clamp 上限冻结）。上一行保留 `--ui-scale:1` 作不支持 `tan()/atan2()` 浏览器的解析期回退（行为与改动前逐像素一致）。
  - **历史页独立分档**：横版记录卡比竖版宽，不与主网格同步 → `.history-grid` 走独立梯度 <480=1 / 480-767=2 / 768-1023=3 / 1024-1279=4 / **1280-1919=5** / **≥1920=6**（app 1440→5/1920→6、TV 恒 5）。
  - **vite optimizeDeps**：播放器依赖（hls.js/dashjs/mpegts.js，各 ~1MB 且仅 /play 使用）从 `include` 移入 `exclude`，避免拖慢首屏 optimize 预打包（~3.3MB）；访问播放页时按需预打包（触发一次 reload）。首屏/核心依赖（axios/idb/radix/zustand/lucide 等）仍 `include`。
  - **红线**：① `--card-cols` 增列必须发生在内容区停止变宽那一刻（2200 封顶），否则「视口变宽卡片反而缩小」；② 新增 `@media` 尺寸/网格规则不影响 TV 须加 `html:not([data-device="tv"])` 前缀；③ 改/删断点档位必须 grep 全仓注释（variables.css 体系说明块 + 组件 CSS 规则头 + Skeleton 注释）同步；④ 3840 档与 2200 同值，仅作 4K 占位。
  - 实测梯度与根因（1920 段 ui-scale 死规则、2560 列数跳变）见 `changelogs/2026-09-07.md`「大屏断点两处修正」节；≥2560 超宽适配（G1 content-shell / G2-A / G3 边框提档 / P-A 播放器 / BR-C）见同文件。

