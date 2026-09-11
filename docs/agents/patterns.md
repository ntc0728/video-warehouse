# 关键模式与约定

> 本文件由 AGENTS.md 拆分而来（2026-09-09 文档瘦身）。精简版 AGENTS.md 仅保留红线与索引表，详情在此；修改时两处需同步更新。

## 关键模式与约定

### RecordShell（收藏页/历史页共用外壳）

`src/components/RecordShell/` — 收藏页和历史页的共用布局组件：

- **桌面（≥768px）：顶部横向卡片筛选栏** — `.record-aside` 由竖向侧栏改为横向（`flex-flow: row wrap`、宽度 100%），顶部常驻 sticky 卡片：第 1 行 = 标题 + 影视/IPTV 分段 + 搜索框（弹性撑开）+ 批量/清除工具栏（靠右），第 2 行 = 状态筛选芯片（横向、可换行、独占整行）；主区 `.record-main` 在其下方
- **移动（≤767px）方案 M6**：顶部 sticky 精简栏，滚动时自动折叠状态芯片行，仅留分段+搜索+筛选按钮（**保持不变**）
- CSS 在 `RecordShell.css`，两页共享；实现方式为「末尾追加 `@media (width >= 768px)` 块覆盖默认竖向布局」，原移动端规则逐字节未动，确保移动端零影响；桌面侧栏 `width:100%` 的元素在移动横向 flex 行必须显式 `width:auto` 复位


### 卡片模块 (Card Module) UI 约定

项目级统一视觉风格：每个功能区块作为独立「卡片模块」：

- 背景 `var(--color-surface)` + `1px solid var(--color-border-light)` 边框 + `var(--radius-lg)` 圆角 + `var(--shadow-sm)` 阴影
- 模块（卡片）之间间距统一 `var(--space-sm)`
- **所有设备启用**（移动端/平板/桌面端），卡片样式直接写在组件样式中，无需媒体查询包裹

应用位置：

- 顶部导航 `StickyHeader` 承载全局导航；桌面 web / TV **已无左侧栏**（旧 `HomeSidebar` 于 2026-08-29 删除）：桌面经顶栏补充 IPTV + 设置入口（`StickyHeader` 的 `EXTRA_NAV_ITEMS` / `SETTINGS_NAV_ITEM` 在 `!isMobile` 时渲染），移动 web / app 经抽屉侧栏 / 底部 TabBar。`--sidebar-width*` token 仍保留供移动端 `Sidebar.tsx` 使用。
- 首页 `HeroBanner` / `CategoryQuickAccess` / 每个 `TMDBMovieRow` — `Home.css`（`.home-page` 作用域）
- 浏览页双卡片结构 — `Browse.css`：
  - Card 1（搜索区）：搜索 tabs + FilterBar（`hideFooter` 隐藏排序 footer），`flex-shrink: 0` 防挤压（SearchBox 已移至顶部导航，通过 `usePageSearchStore` 注册回调）
  - Card 2（结果区）：排序栏 + SourceStatusIndicator + 结果网格 + 懒加载哨兵，`flex: 1 1 0` 填充剩余空间
- IPTV 页 `.iptv-top-card`（筛选控制）+ `.iptv-grid-card`（频道网格）— `IPTV.css`
- 人物页 `.person-hero`（资料卡片）+ `.person-grid-card`（Tab+作品网格）— `Person.css`
- 详情页 `detail-hero` — 去掉负 margin，受 page-padding 约束（`Detail.css`）
- 设置页桌面端 `.settings-desktop-card` — TabBar + 内容区放入**同一张大卡片**，section 去卡片化、之间用留白（margin-top + padding-top）分隔，无分割线（`Settings.css`）；移动端子页布局不变

骨架占位扫光速度：全局变量 `var(--card-shimmer-duration)`（默认 `3s`，原 `1.5s`）定义在 `variables.css` 的 `:root`；`LazyImage` / `TMDBMovieRow` 行骨架 / `SkeletonCard` / `SkeletonIPTVCard` 统一引用，调快慢只需改这一处。


### HeroBanner 组件

`src/components/HeroBanner/` — 首页 Hero 横幅轮播：

- **HeroBili 宽屏分支（>1280 桌面专用，TV 不启用）**：`HeroBili.tsx` 左 banner 轮播（前 6 张池）+ 右栏 3×2 竖版卡（banner 池外条目）+「换一换」（只推进 shuffleOffset、与轮播解耦，0.6s 动画锁防抖）。右栏卡 `.hero-side-card` 带 `1px solid var(--color-border-light)` 边框（卡片模块规范）；封面 = `LazyImage`（骨架占位 + 失败走默认品牌兜底 MonitorPlay+kinoTV，与「继续观看」卡同链路），**勿改回裸 `<img>`**。
- **布局**：左侧主背景图（左右滑动切换）+ 右侧缩略图列（absolute 定位覆盖在 banner 边缘）
- **缩略图**：`position: absolute; z-index: 10`，`overflow: hidden` 不影响 banner 圆角；激活态使用 `2px solid var(--color-primary)` 边框 + `var(--color-primary-shadow)` 阴影；点击跳转 detail 页；标题仅激活态显示
- **滑动切换动画（所有客户端）**：`activeIndex` 切换统一走 `slide-left`（前进，新图从右滑入）/ `slide-right`（后退，新图从左滑入）；自动轮播（5s）也设置 `slideDir='left'` 走滑动切换；滑动后 1000ms 冷却期内暂停自动轮播。`.slide-*` 规则定义在 `HeroBanner.css` 全局作用域（非移动端媒体查询内），选择器特异性高于 `.is-active` crossfade。**桌面端悬停缩略图预览**由 `handleThumbEnter` 显式清除 `slideDir`（设 null）→ 回退为 crossfade（`heroBgFadeIn`）。**注意**：slide 动画结束后**不**重置 `slideDir`（保持方向类），否则 `.is-active` 层会回退匹配默认 crossfade 规则、因 `animation-name` 改变重新播放淡入，导致「闪一下、短暂出现上一张图片」。
- **高度**：`min-height: var(--layout-hero-banner-min-h)` + `max-height: min(70vh, var(--layout-hero-banner-max-h))`（vh + vw 双上限，防止超宽屏溢出）
- **预加载**：自动轮播时预加载下一张背景图（w1280）+ 缩略图窗口前后各 2 张（w500）
- **bannerReady**：仅 items 从空变为有时重置，**切换分类（items 已有数据再变化）时务必保持 `true`、绝不可重置为骨架**——否则缩略图会走「真实图→骨架→真实图」硬切换 = "闪一下"（这是历史回归点，已修复）。
- **缩略图列不重挂载（2026-08-13）**：缩略图列**绝不挂 `key={categoryId}`**（曾因分类切换强制整列重挂载 → 「骨架→图」跳变；已移除）。HeroThumb 按 `key={pos}` 复用，item 引用变化走「预加载完成再换图」；换图时旧图快照进 `--prev` 垫底层（DOM 先渲染在下层）、新图 `--switching`（opacity 0）→ onLoad 后类移除 → `transition: opacity 0.3s` 淡入 → 延时清理 effect 移除 prev 层；首帧挂载无切换类 → opacity 1 常显（原行为不变）。
- **主图分类切换过渡（2026-08-13）**：分类切换时主图**不得硬切**（旧图卸载 → 新图加载期间空白 → 蹦出）。实现 = 渲染期派生 + `switchReady` 状态机：
  - 切换帧（items 引用变化）由**渲染期派生**（`itemsChanged = prevItemsRef.current !== displayItems`，ref 在 useLayoutEffect 每 commit 后同步更新）：旧活跃图快照 → `--stale` 滞留层垫底（DOM 底层 opacity 1）+ **新层不渲染**。
  - `useLayoutEffect` 同帧 `setStaleSnapshot`（幂等同值，供过渡期继续垫底）+ `setSwitchReady(false)` + `new Image()` 预加载新首项图（`switchLoadRef` 防快速连点竞态）；就绪（onload/onerror fail-open）→ `switchReady=true` → 新层挂载即 is-active（图片已缓存 → heroBgFadeIn 0.8s 淡入完整播放）。
  - 清理 effect（switchReady 后 1.2s，不依赖动画事件，reduced-motion 同样清理）移除滞留层。
  - **⚠️ 过渡期判断 = `itemsChanged || !switchReady`**：渲染期派生只覆盖切换那一帧，后续过渡帧由 state 维持；**绝不可**用「effect setState 标记过渡」——img 挂载时闭包陈旧 + load 事件早发会永久卡在透明层（首版实现实测踩坑）。
  - **⚠️ 轮播回归教训（2026-08-13）**：主 `useLayoutEffect` 依赖**只允许 `[displayItems]`**——曾误加 `displayIndex`，导致轮播/悬停/拖拽（displayIndex 变化）每次都触发 `setActiveIndex(0)/setBgIndices([0])/setSlideDir(null)`，自动轮播被永久重置回第一张。`prevItemsRef/prevDisplayIdxRef` 的同步移入**独立无副作用** `useLayoutEffect([displayItems, displayIndex])`（只写 refs，声明在主页 effect 之后保证先读旧值）。
- **主图加载失败走公共品牌兜底（2026-09-10）**：Hero 主图这条链**全程手写 `<img>` + `new Image()` 预加载**，
  绕过了 `LazyImage`（原因是它自带 crossfade/track/滞留层状态机）。因此失败兜底必须自己接：
  `failedBackdrops: Set<string>` 登记失败的 backdrop URL（crossfade 层 / track 层 / 分类切换滞留层
  的 `onError` 都登记），当前显示项命中时渲染与 `LazyImage` 同构的节点
  `<div className="lazy-image-fallback lazy-image-fallback--brand">MonitorPlay + kinoTV</div>`
  外加 `.hero-banner__fallback` / `.hero-bili__banner-fallback` 负责 `position:absolute; inset:0; z-index:1`。
  ⚠️ 只写 `onError` 驱动内部状态机（`bannerReady` / `scheduleStaleClear`）**不算兜底**——
  失败时用户只会看到 `#0b0b0e` 深色底。护栏：`scripts/home.spec.ts` **HOME-089**（HeroBili + Classic 两条路径）。
  另注：缩略图 `HeroThumb` 的 `switching`（`opacity: 0` 淡入起始态）原先只能由 `onLoad` 清除，
  图失败时会永久不可见 → 必须补 `onError` 清 `switching` 并回退 `ready=false` 保留骨架。
- **移动端滑动性能（2026-09-10）**：三条已落地的约束，别改回去 ——
  ① `handleDragMove` **必须 rAF 合并**（只保留本帧最后一次坐标，每帧最多一次 `setState`）。
  移动端 `touchmove` 一帧可触发多次，每次 `setDragOffset` 都会重跑整个组件（文字 track ×3、缩略图窗口、内联 style 重建）；
  `handleDragEnd` 里要 `cancelAnimationFrame` 丢弃未执行的帧，否则松手后又补一次、回弹起点会抖。
  ② 主图候选尺寸表**移动端封顶 `w780`**（`MOBILE_BACKDROP_SIZES = ['w500','w780']`，`backdropSizes()` 统一出口）。
  原本 `src` 恒 w1280 + `sizes="100vw"`，DPR ≥ 2.75 的手机必选 w1280，而预加载 `bgPreloadSize()` 在 `<1024` 用 w780
  → 同一张图下载两次、解码两次。移动端封顶后两边口径一致、只下载一次。
  ③ `<768px` 标题阴影收成 `0 1px 6px`：`0 0 60px` 大半径模糊落在正在做 transform 的文字轨道内，每帧都要重新模糊整个文本层。
- **无障碍**：`prefers-reduced-motion: reduce` 时禁用所有动画

### Toast 系统

`src/components/ui/toastBus.ts` + `Toast.tsx`：

- `toast.show(opts)` — 入队，排队等待（前一个 toast 超时后才显示下一个）
- `toast.replace(opts)` — 清空队列立即显示新 toast（快速连续提示场景，如版本号连续点击）
- ToastProvider 只渲染 `items[0]`（队列首项），`ToastContainer` 因 `item.id` 变化触发 useEffect 重跑

**播放器内提示（`UniversalPlayer/PlayerToast.tsx`，另一套系统，勿与上面混）**：

- 三个入口：`show`（桌面右上角 / 移动端转居中）、`mobileSettingsToast` + `playerToastCenter`（恒居中）。
- **移动端居中提示的锚定规则（2026-09-10 定稿，两条必须区分）**：
  | 情形 | 行为 |
  | --- | --- |
  | 提示**触发时**播放器可见（`roomy`） | 锚到「播放器 ∩ 视口」的**可见交集**内（跟随播放器）；此后被滚走 → **隐藏** |
  | 提示**触发时**播放器已在视口外 | 退回视口定位显示，并记 `viewportAnchoredRef` → 此后**不随滚动隐藏** |
  为什么必须分两条：只按视口夹取会让播放器滚走后提示钉在视口顶部浮在播放器上方（用户反馈）；
  但一律「不可见就不渲染」又会吞掉设置弹窗自身的反馈——二级字幕设置弹窗打开时播放器已被滚到
  `top: -653`，`mobileSettingsToast` 是当次操作的直接反馈，不能吞。护栏：`scripts/player.spec.ts` **PLAYER-M01/M02**。
- **播放 / 暂停不再弹提示**（`ToastTrigger`）：这两个操作最高频，每次弹一次属噪声，用户 2026-09-10 明确要求去掉。
  相关的 `userPlayRequested` / `userPauseRequested` 标记与 `autoPlayToastShownRef` 闸门一并删除，勿再引入。
- 提示的 portal 目标见 `lib/overlayPortal.ts`：非全屏 → `document.body`，全屏 → 播放器容器。


### IPTV 频道台标（单一来源 + 失败记忆）

> ⚠️ **2026-09-10 更正**：本节原描述的是「三级回退链」（M3U tvg-logo → EPG `<icon>` → 在线台标库），
> 该链路**已于 2026-09-08 定稿下线**。当前实现与下文一致，勿再按三级链理解代码。
> 旧链路的两条测试（IPTV-080/081）保留为条件式用例，环境不触发时走「跳过」分支。

台标**只来自 iptv-org 的 logos.json**（经 `iptvOrgService.fetchIptvOrgChinaChannels` 按频道 id 精确匹配后
写入 `channel.logo`）；本地 IPTV 源的 `tvg-logo`、EPG XMLTV `<icon>`、在线台标库猜测**均已退出台标逻辑**。

核心实现 `src/services/channelLogo.ts`：

- `toSafeLogoUrl(url)`：**只放行 `http:` / `https:`**，协议相对 URL、`data:` 等一律丢弃；丢弃后候选链为空，
  `LazyImage` 直接进兜底态。
- `resolveChannelLogoCandidates(channel, _proxyUrl?)`：单候选（第 2 参已废弃，保留仅为兼容历史调用点）；
  命中 `failedLogoUrls` 时返回 `[]`。调用点：`IPTVChannelCard` / `UniversalPlayer`（OSD）/
  `IPTVChannelList`（侧栏）/ `History` 页卡片。
- **台标不走代理**（设计定稿）：`http` 台标原样直连，失败自然走兜底。因此 **https 部署下 http 台标会被
  混合内容拦截**、**无法直连托管域时整页卡片都没有台标**——见下条。

#### 两个必须知道的坑（2026-09-10 实测）

1. **台标图片实际托管在 `i.imgur.com`**（iptv-org logos.json 里就是 imgur 链接）。国内网络通常不可达
   （实测 `net::ERR_CONNECTION_RESET`）。叠加「台标不走代理」→ **整个 IPTV 页的卡片全部落到 Tv 兜底**。
   排查顺序应是「请求有没有发出 → 发出后成不成功 → 成功了是不是被 CSS 裁掉」，**不要一上来就怀疑 CSS**。
   是否让台标走 worker 代理是待用户拍板的产品取舍。
2. **失败记忆失败侧的 TTL 是短的**：`channelLogoCache` 整块 blob 的 TTL 是 30 天（成功记忆沿用），
   另加 `LOGO_FAIL_TTL = 6h` —— 恢复时只把「6 小时内的失败」放进 `failedLogoUrls`，
   否则一次网络抖动就被固化成「这张卡此后永远没台标」。

#### 卡片侧的三条渲染约定

- **收藏按钮不依赖台标加载结果**：`showFavorite = !batchMode && !hideFavorite`。
  严禁再写成 `&& (imageLoaded || !channel.logo)` —— 台标失败时 `onLoad` 永不触发，
  会让整颗红心不渲染（2026-09-10 实测 60 张卡只剩 3 颗）。护栏：`scripts/iptv.spec.ts` **IPTV-090**。
- **台标图用 `object-fit: contain`**（`.iptv-card-cover img` 与历史页 `.record-card__media--logo`）：
  封面比例是海报思维（3/2 · 16/10 · 16/9 四档），`cover` 会把 1:1 方图裁到只剩约 56% 高度可见。
- **红心需要触屏常显兜底**：`.iptv-card-favorite.hover-visible` 默认 `opacity: 0; pointer-events: none`，
  >767px 的触屏设备（iPad / 折叠屏 / 触屏本）永远没有 hover → 必须补
  `@media (hover: none) and (pointer: coarse)` 常显规则（`VideoCard.css` 是同类范例）。
  ≤767px / app 端仍是 `display: none`，该规则不含 `display`，不会把它们复活。

**EPG 预索引（性能关键，仍作用于节目单而非台标）**：`matchEPGChannel` 原实现每频道全量遍历数千 EPG 频道
（数百卡片 × 数千频道 = 百万次 `normalizeName`），EPG 就绪瞬间主线程卡顿。`epgService.ts` 的
`buildEPGChannelIndex(channels)` 一次性构建（tvg-id / 规范化名 / 原始名三张 Map），
`matchEPGChannelIndexed` 精确匹配 O(1)、模糊包含兜底线性（触发率低）；`matchAllChannels` 批量匹配复用索引
（`useEPGData` 消费，用于节目单）。新增台标相关测试：`scripts/iptv.spec.ts`（IPTV-090 硬断言 +
IPTV-080/081 条件式用例）。


### IPTV 频道列表加载（竞速窗口，防慢源拖尾）

`fetchAndParsePlaylist`（`src/services/iptvService.ts`）原实现 `Promise.allSettled` 等**全部源** settle：单源 15s 超时 × 1 次重试，任一失效源即可拖住整页最长 30s 处于 loading。现改为**竞速窗口** `settleWithWindow(promises, 1500, 20000)`：

- 并行拉取所有源，**首个成功源到达后最多再等 1.5s 收尾**即返回（正常 2~4s 出结果，多源聚合语义保留——其余快源结果一并合并）
- **零成功时等全部 settle 快速失败**（全部源立即报错时 ~1s 返回，不等待上限）；仅当部分源「慢但健康」时由**绝对上限 20s** 兜底
- **⚠️ 上限/单源超时不宜过紧**：曾用 8s 导致经代理响应慢（>8s）但健康的源全部被 abort → 「所有源加载失败/加载不出来」——现单源超时 20s + 不重试（M3U 列表对失效源重试收益极低），慢源不再误杀
- 窗口关闭时**放弃的源不计入 `sourceErrors`**（`PENDING_ABANDONED` 标记区分真实失败与放弃等待），避免「N 个源加载失败」误报

配套 `useIPTVStore.refreshChannels`：**已有频道数据时静默刷新**（`isLoading: channels.length === 0`），旧数据继续展示、不进入全屏 loading；仅首次无缓存时才显示加载态（快路径 ≤ 首成功 + 1.5s）。

**Keep-Alive 下离开页面的后台活动治理**（AppLayout 用 `display` 切换可见性、组件不卸载，unmount 清理永不执行）：

- IPTV 页可用性检测：`useEffect` 监听 `location.pathname`，**路由离开即 `abortAvailabilityCheck()`**（替代不可靠的 unmount 清理）
- `useIPTVAutoRefresh`：仅在 `location.pathname === '/iptv'` 时注册轮询 interval，离开即 clearInterval，回来重建（避免隐藏页后台拉 M3U）
- `/iptv/play` 是顶层独立路由（不走 AppLayout），离开即卸载、播放器实例正常销毁，无泄漏


### IPTV 直播播放独立逻辑

`UniversalPlayer`（`src/components/UniversalPlayer/`）在 `mode === 'iptv'`（`IPTVPlayer` 调用）下走**独立播放逻辑**，与点播（`mode === 'video'`）区分，**不要复用点播的播放/提示交互**：

- **自动播放**：`usePlayerCore.handleCanPlay` 在 `autoPlay=true` 且流可播放时直接 `video.play()`，加载即播；被浏览器拦截（多因带声音且无用户手势）时静音兜底重试一次，避免黑屏与中间播放按钮。
- **无中间播放按钮**：中间暂停遮罩 `.up-player-paused-overlay` 仅在 `mode !== 'iptv'` 时渲染，IPTV 直播不显示大播放按钮（点播保留，供用户点击开始）。
- **提示体系（双轨）**：① 全局 `toastBus`（sonner）——普通页面顶部居中（导航栏下方），播放器页面中间靠上（top 42%），`success/warning/error` 语义色图标，统一 3s，用于**错误/成功/警告**类。② 播放器**操作类**提示独立走 `PlayerToast`（`.up-player-toast`，播放器**右上角**）——播放/暂停、音量、切线路、切频道、频道号输入等；`show(msg, duration, type)` 统一 3s，命令式 `playerToast()` 供组件顶层 hooks 调用（ToastTrigger/useTVInput/useIPTVNavigation/useKeyboardShortcuts）。`ToastTrigger` 在 `mode === 'iptv'` 跳过点播类订阅；IPTV 切线路由 `handleSourceSwitch` 提示（右上角）。IPTV 播放页：非 TV 放大图标在**右下角**；**TV 端默认全屏**（挂载时 requestFullscreen，拦截静默）且不显示放大图标；TV 遥控器音量弹**音量柱** + 右上角提示，换频道/频道号输入右上角提示。
- **键盘快捷键跳过**：`useKeyboardShortcuts` 在 `mode === 'iptv'` 时移除空格键的播放/暂停（直播无暂停语义），仅保留音量/全屏/静音/Escape。
- **遥控器跳过**：`useTVInput` 在 `mode === 'iptv'` 时遥控器播放/暂停键不触发 `togglePlay`。
- **裸流降级识别（D1）**：`HLSAdapter` 对 `manifestParsingError`（拿到内容但解析失败）上报带 `code='BARE_STREAM'` 的错误，与 `manifestLoadError`（网络层失败，维持「频道源不可用」走 A3）区分。`UniversalPlayer` 在 `mode==='iptv'` 且未对当前 URL 降级过时，用 `degradedType` state 临时将播放器类型覆盖为 `flv`，重建 `MPEGTSAdapter` 重试**同一 URL**（每 URL 仅 1 次，URL 变化时复位）。worker `m3u8-proxy` 对非 `#EXTM3U` 内容（`isM3U8Content` 判断）直接透传源站二进制（不重写、不缓存），使 mpegts.js 能拉裸 TS/FLV 流——**零额外请求识别裸流**。

### IPTV 播放页 chrome（频道列表 / OSD 栏）尺寸契约

> 2026-09-10 落地（commit `450dd3d`）。提案与全部实测读数见
> `changelogs/demos/demo-iptv-channel-list-osd-2026-09-10.html`；
> 防回归断言在 `scripts/iptv-player.spec.ts` 的 11.4 段（IPTVP-020 ~ 023）。

**① 频道列表一/二级宽度 = 内容派生，不是面板 50%**

`.up-channel-groups` / `.up-channel-channels` 原为硬 50/50。但一级是 **10 条写死的固定分类**
（长度有上限），二级是**自由频道名**（无上限）—— 50/50 等于把一半宽度让给有上限的一侧，
1440 实测一级空转 109px（占 49%），二级名称只剩 122.2px、最长名截断 34.9px。

- `--layout-channel-group-w`（`variables.css`）= **132px 定值，不是 vw 曲线**。
  逐档实测「最长分类名 + 计数药丸 + 行内边距」只有 **109.8 / 114.0 / 113.7 / 113.5 / 113.3 / 116.5px**
  （480 / 768 / 1024 / 1280 / 1440 / 1920）——行内边距随档变大、字号 768 后反而变小，两者相抵 →
  **与视口宽度没有强相关**，故用内容派生的定值而非比例。
- `.up-channel-groups` = `flex: 0 0 auto; width: var(--layout-channel-group-w); max-width: 44%`（兜底）；
  `.up-channel-channels` = `flex: 1 1 auto; min-width: 0`。**`min-width: 0` 必需** ——
  否则二级栏内 marquee 的 max-content 会把它撑开、挤回一级栏。
- **≤479 窄屏档**：`--layout-channel-group-w: 116px` + 组项字号降 `--text-sm`、
  行内边距降 `--space-sm`（需要宽度随之降到 99.5px）+ **隐藏质量徽章**
  （`.up-channel-item-quality`，含 `html[data-device="app"]` 副本）。
- 落地实测：一级栏占面板 50% → **41.4%（375）/ 29.7%（1440）/ 27.5%（2560）**，全程仍正向空转；
  二级名称可用 1440 → 229.2px（+88%）、375 → 140px（+157%）。

**② OSD 栏宽度 = 单条比例曲线**

`--layout-osd-max-width` 原为「以 1080p 为锚点」的两段式 clamp（`:root` 一段 +
`@media (width >= 768px)` 块内 ≥1024 一段覆盖）。该曲线在**约 420–1158px 视口区间
恒大于「视口 − 2×--space-md」**，被 `.iptv-osd-bar` 的 `max-width` 兜底规则吃掉 →
这一段 OSD 实际是**贴边**的、宽度 token 完全不起作用（1024 占 98.0%、768 占 97.5%），
呈现「视口越窄、OSD 占比越高」的反直觉曲线。

现为单条 `clamp(320px, 78vw, 1400px)`，**段2 里的 ≥1024 覆盖已删除** —— 留着会造成
「token 生效区间分裂」，正是要修的问题。兜底留白 `--space-md` → `--space-lg`。
TV 档 `clamp(1600px, 83.333vw, 3200px)` 是独立 2× 契约，不受影响。

**③ OSD 内部：左右翼等宽 → 中列与控件行真正居中**

左翼固定 `--layout-channel-num-w`（120→180）恒大于右翼 `--layout-quality-badge-min-w`（84→120）
→ 中列中心 ≠ OSD 中心 → 位于中列的控件行整体右偏（1440 实测 **+27.9px**）。
修法：`@media (width >= 1024px)` 下 `.iptv-osd-left, .iptv-osd-right { flex: 0 0 var(--layout-channel-num-w) }`
→ 偏移归 0（1024/1280/1440/1920/2560 实测均为 0）。
**<1024 刻意不生效**：给右翼 120–163px 会把中列节目名挤到不可用，那一档保留「中列优先」的
不等宽布局，代价是控件仍有 18–24px 偏移（已知取舍）。

右翼三行并两行（`.iptv-osd-meta-row` 包住「网络速度 + 线路」）。分隔点**必须**做成
`.iptv-osd-source-text::before { content: '·' }`，而不是夹在中间的独立元素 ——
≤639 隐藏 `source-text` 时连分隔点一起消失，否则会留下「- KB/S ·」这种悬空分隔符。

**④ 控件行：nowrap + 窄屏图标化 + 间距档**

`.iptv-osd-controls-row` 由 `flex-wrap: wrap` 改 `nowrap`（一旦换行 OSD 高度跳变 ≈18px）。
间距：组间 `--space-2xs` → `--space-sm`、组内 `--space-3xs` → `--space-xs`。
≤639 去掉按钮文字（`span { display: none }`）并把图标放大到 `--icon-md` ——
4 个带文字按钮共需 ~200px，而 375 下中列只有 ~163px；去文字后仅需 ~157px。

> ⚠️ **`nowrap` 的安全网**：控件行 `scrollWidth − clientWidth = 0` 且必须**窄于中列**
> （7 个视口实测 −6 ~ −27px）。以后往这行加按钮必须重跑 IPTVP-021/022，否则会被裁切。

**⑤ 「音轨」恒显示**

去掉 `audioTracks.length > 1` 条件 —— 该条件会让控件行在 3/4 个按钮之间跳动、分组宽度不稳定。
点击行为仍是「切到下一条音轨」，上游 `handleAudioTrackSelect` 在 `tracks.length <= 1` 时
直接 return（安全空操作）；条数写进 `title`（`切换音轨（共 N 条）`）便于判断。

**⑥ 播放器强调色：作用域内覆写 primary 家族**

播放器 chrome 恒深色底，而 `--color-primary` 是**主题相关**的（浅色 `#000` / 暗色 `#fff`）——
两种情况都会让「用 primary 做强调」的规则与面板同色。修前浅色主题实测：
一级活跃左竖条 `rgb(0,0,0)`、二级活跃左边框 `3px rgb(0,0,0)`、二级活跃序号
`color(srgb 0 0 0/.65)`、一级活跃计数药丸 `color-mix(primary 12%)`（比未选中的白 6% **更暗**）、
TV 焦点描边、手势指示条填充、时移滑块 `accent-color`、时移按钮描边与文字。
另有一类「primary 作填充 + `color:#fff`」的消费点在**暗色主题**同样坏（白底白字）：
`.up-error-actions-btn-primary`、`.up-settings-preset.is-active`、
`.up-fs-drawer .up-ms-chip--on`、`.up-cast-core`。

修法：在 `.up-universal-player` 上覆写 primary 家族为亮色蓝
`#3b82f6` / hover `#60a5fa` / `--color-primary-rgb: 59,130,246`（+ light/bg/shadow）。
`--color-primary-rgb` 此前**全仓从未定义**，而 IPTVOSDBar 的时移按钮写作
`rgba(var(--color-primary-rgb, 22, 119, 255), …)` —— 一直在走 #1677ff 兜底，补齐后同源。

⚠️ **不按主题分叉**是刻意的：分叉会让暗色主题下白底白字那四类继续坏。代价是暗色主题下
播放器强调色由白转蓝（已记录在 `docs/KNOWN-ISSUES.md` 第 14 条）。
⚠️ **作用域用 `.up-universal-player` 而非 `body:has(…)`** —— 后者会漏到 AppLayout 外壳
（`/play/:id` 的播放器是覆盖在应用之上的一层而非独立路由）。
新增 primary 消费点前请确认它在本子树内（portaled 到 body 的元素**不会**继承），
`/iptv` 浏览页与 `GroupPicker` 是正确的 `#000`，勿动。

**⚠️ 量测口径（两个坑）**

1. 分类「需要宽度」必须按**活跃态 `font-weight: 600` 的自然宽度**量 ——
   最长的「央视 CCTV」随时可能成为活跃项。
2. **不能**用 `.up-channel-group-text` 的**渲染宽度**当需要宽度 —— 它带 `text-overflow: ellipsis`，
   栏一窄渲染宽就被裁到可用宽，等于自证「刚好放得下」。
   正确量法：把 `.up-channel-groups` 临时放开成 `width: max-content / max-width: none`，
   取最长一行的渲染宽度。

### Browse 懒加载

> ⚠️ 2026-09-12 起本节大部分已被「逻辑分页」取代，见下节；CMS 直链搜索仍走本节的
> 懒加载哨兵（append 式 `useCMSSearch.loadMore`，smart 模式哨兵 hasMore 恒 false 闲置）。

- 哨兵节点 `<div ref={sentinelRef}>` **无条件渲染**（不用 searchMode 条件包裹），跨状态持久
- 整页 loading 仅在首屏无数据时显示：`initialLoading = isLoading && results.length === 0`，与 `loading` 布尔区分
- 避免加载更多时卸载网格导致滚动跳顶
- **双卡片结构**：Card 1（搜索区：搜索 tabs + FilterBar，`hideFooter` 隐藏排序 footer）+ Card 2（结果区：排序栏 + SourceStatusIndicator + 结果网格 + 分页器/懒加载哨兵）
- **筛选切换清空搜索词**：切换 FilterBar 筛选/排序时清空 `query`，让 discover 接管（`useBrowseData` 的 `filterSig` effect 在有 `urlQ` 时跳过 fetch）
- **TMDB search reset**：`search()` 和 `fetchDiscover()` 在 `forceReset=true` 时立即清空旧结果，UI 才能显示 loading 而非停留在旧数据上
- **合并结果排序**：`mediaType=all` 合并 movie + tv 后按用户选择的 `sortBy`/`sortOrder` 重排（评分相同时按投票数降序兜底）

### Browse 逻辑分页（2026-09-12 定稿，替换智能检索的懒加载）

`src/pages/Browse/useLogicalPage.ts` —— 用户拍板「每页恒定 cols×5 行、行行完整、页数按每页条数折算」。

- **为什么不是「按列数传参取数」**：TMDB/MacCMS 均不支持自定义每页条数（TMDB 恒 20/页，
  movie+tv 合并 40）。逻辑页 L 覆盖全局条目 `[(L-1)·P, L·P)`，P = cols×5（15~40）；
  按算术定位所需 TMDB 合并页（`tStart = floor(start/M)+1` + offset），P ≤ M → 每页至多 2 请求。
- **合并页大小 M 必须与真实拉取条数一致**：all=40（电影 20+剧集 20）、单媒体类型/搜索=20。
  曾写死 40：切「电影」分类后偏移算术错位 → 切筛选后空页（只剩分页组件）。
- **跨页漂移去重**：真实 TMDB 按流行度排序，相邻页请求之间序会漂移（页 N 尾 = 页 N+1 头
  出现相同条目；mock 静态数据测不出！）→ 组装消费必须逐条按 id 去重（seen Set）。
- **取页三段等待**（`fetchTmdbPage`）：① 等 filterSig 防抖把新筛选写入 store
  （对比 `toStoreFilter(filterValue)` 与 store `filterOptions`）——否则带旧筛选参数拉上一轮数据；
  ② 等 store 既有 discover 请求落地（`goToPage` 的 loading.discover 守卫会静默 no-op）；
  ③ 落地页号 ≠ 请求页号（其它触发器的响应被 store seq 丢弃）时等对方落地后重试一次。
- **TMDB 页缓存按 (contextKey, t)**：翻回上一页零请求；上下文（模式+关键词+筛选）变化清缓存回页 1。
- **总页数 = ceil(钉定总数/P) 并钳到 ceil(500·M/P)**：TMDB discover/search 硬顶 500 页
  （total_pages 会报 2124 但 >500 页返回空 results——「点最后一页显示无结果」的根源）。
- **总数钉定**：TMDB `total_results` 是逐页波动的估计值；同一上下文内以第一次落地非零值为准
  （pinnedTotal），换词/换筛选/切模式重钉；新搜索落位前计数位显示「搜索中…⟳」（转圈在右侧）。
- **跳页**：BrowsePagination 数字形态带「页码输入 + 跳转」，输入钳制 [1, totalPages]（输 9999 跳末页）。

### 全屏抽屉（Drawer）底部操作区

`src/components/ui/Drawer.tsx` 的 `footer?: React.ReactNode` 插槽 —— **固定在面板底部、不参与滚动的操作区
只能走这个插槽**，不能当 `children` 传。

- 走 children 会落进 `.drawer-body`（`overflow-y: auto` 的滚动容器）。此时 `position: sticky; bottom: 0`
  只是「粘」而非「固定」：**内容不足一屏时完全没有可粘空间**（按钮停在最后一组 chip 后面、面板下半截空白），
  **滚到底又会被 `.drawer-body` 自身的 `padding-bottom` 顶开**。
- `.drawer-body` 必须显式 `min-height: 0`：flex 项默认 `min-height: auto` 会被内容撑开，
  滚动容器就不是「剩余高度」，footer 会被挤出视口。
- `.drawer-footer` 负责 `padding-bottom: env(safe-area-inset-bottom)`（移动端 Home 指示条避让）。
- **层级走全局 token `var(--z-modal-overlay)` / `var(--z-modal)`（1000 / 1001），不要硬编码 60/61**。
  曾经的 60/61 低于「返回顶部」玻璃圆钮的 `z-index: 90`，而该圆钮 `position: fixed` 且 portal 到 body →
  画在面板之上、坐标正好压住「完成」按钮并抢走点击。
- 面板打开期间用 `body:has(.drawer-content) .back-to-top-button { display: none }` 关掉那个
  `backdrop-filter: blur(8px)` 玻璃钮：它固定不随面板滚动，每帧都要对背后变化的内容重新做模糊采样
  （移动端 GPU 上最贵的常见项之一），而此刻它完全被不透明面板盖住。
- 护栏：`scripts/browse.spec.ts` **BROWSE-081/082**（结构 + 滚动前后几何不变 + 贴住面板底边 + 层级 + 圆钮不绘制）。

### 播放器进度条与控制栏（2026-09-10 定稿）

- **已缓冲灰条（`.up-progress-buffered`）不能只依赖 video 的 `progress` 事件**：暂停 / 加载中没有新的下载推进，
  该事件不触发 → seek 之后灰条停在旧位置。`usePlayerCore` 的 `syncBufferedProgress()` 在
  **`seek()` 即时 / `seeked` / `timeupdate`** 三处都要补同步；`ProgressBar` 渲染时
  `bufferedPercent = min(100, max(raw, progress))`，灰条不短于已播放位置（否则圆点跑到灰条之外）。
- **暂停 / 加载中 seek 必须真的落位**：元数据未就绪（`readyState < HAVE_METADATA`）时直接写 `currentTime`
  可能被浏览器丢弃或在 `load()` 时清零 → 暂存到 `loadedmetadata` 后补做；
  暂停且目标不在已缓冲区间内时调用 `adapter.resume()` 唤醒加载引擎（没有播放推进就没有取数驱动）；
  **全程不调 `play()`**，跳转后保持暂停。
- **上一集 / 下一集按钮的显示条件是 `episodes.length > 1`**，不是 `> 0`。
  `ControlBar` 只要 `hasPrevEpisode !== undefined` 就渲染按钮、`false` 仅置灰；
  单集 / 电影 / 仅一条线路时旧写法传入 `false` → 多出两颗灰按钮，应改传 `undefined` 即完全不渲染。
- **清晰度菜单必须过滤 `height <= 0` 的档位**（`getSelectableLevels()`，`ResolutionSwitch` 与
  `SettingsContent` 共用）：manifest 未标 RESOLUTION / 纯音频轨的 level 高度为 0，
  `HLSAdapter.getQualityLabel` 会给出空串，不过滤就会显示成「0P」这种非法档位。
  过滤后**必须携带 adapter 原始索引**——hls.js 的 `currentLevel` 就是原始下标，不能重新编号。
  护栏：`src/components/UniversalPlayer/lib/utils.test.ts`。

### 搜索词传递（Keep-Alive 兼容）

- 顶部导航 SearchBox: `navigate('/browse', { state: { q } })`
- Browse 页: `useState` 初始化读 `location.state.q` + `useEffect` 监听 `location.state.q` 变化同步 query（Keep-Alive 二次进入）
- **POP 导航清空**：刷新/直接访问/后退时（`navigationType === 'POP'`）不读 `location.state.q`、不触发搜索 — `createBrowserRouter` 下 `window.history.state` 在刷新后被浏览器保留，会导致顶部 SearchBox 残留上次搜索词
- SearchBox: `lastSearchedRef` 在 `location.pathname` 变化时重置（解除相同搜索词的导航阻止）

### 工具类与 Tokens

- **`.no-interaction-visual`**：移除 hover/active/focus 视觉反馈的工具类，用于 logo、品牌名等不需要交互反馈的元素（`index.css`）
- **Logo tokens**：流式尺寸变量（`variables.css`）—— `--layout-logo-size`（48→64px）、`--layout-logo-size-sm`（40→52px）、`--layout-logo-size-lg`（56→72px）；`--layout-brand-font-size`（20→24px）、`--layout-brand-font-size-sm`（16→20px）、`--layout-brand-font-size-lg`（24→28px）。Sidebar 和 StickyHeader 的 logo 统一使用这些 token


### 页面进入过渡统一约定

- **共享工具类 `.page-transition-enter`**：定义在 `src/assets/styles/animations.css` 的 `@keyframes page-enter-fade`（淡入 + `translateY(8px)→0`，`0.28s var(--ease-out-expo) both`），已含 `prefers-reduced-motion: reduce` 守卫。**所有缺少进入动画的页面根容器都应加该类**：Detail / Person / SourceChecker / RecordShell（收藏·历史）。Browse（`.browse-page`）、IPTV（`.iptv-content`）、Settings（`.settings-page`）已有各自进入动画，勿重复加。**特例 — 首页**：`.home-page` 内嵌的 HeroBanner 自带 background crossfade + 缩略图揭示，且其缩略图/背景层是 `will-change`/`z-index` 的 **GPU 合成层**；若祖先（`.home-page` 根）带 `page-enter-fade` 的 `transform` 动画，会触发这些合成层重绘**闪烁（"闪一下"）**。因此首页的 `.page-transition-enter` **刻意落在仅包裹非 Hero 内容的 `.home-page__content` 包装层**（HeroBanner 作为其兄弟节点，祖先不再有 transform 动画），既保留进入淡入上移动画，又消除缩略图闪烁；HeroBanner 在二次进入时保持静止（首页被刻意排除在 VT 交叉淡入与重进抑制之外，顺带规避其"上一张图闪现"的已知问题）。
- **方案 B（无 Keep-Alive）下的页面进入过渡（2026-08 修订）**：当前 AppLayout 每次路由切换重新挂载页面（见上文「路由渲染器」）。若页面根容器每次都从 `page-transition-enter` 的 `opacity:0` 起播，二次进入会「先空白再出现数据」、快速连点尤为晃眼。**治理方式（方案 A — data-revisit 门控）**：AppLayout 用模块级 `visitedRoutes` 记录已访问路由，给 `.page-transition` 打 `data-revisit="true"`（仅对再次进入的路由）；`animations.css` 据此把 `.page-transition-enter` / `--stagger` 及其子元素置 `animation:none`，已挂载页面直接 `opacity:1` 呈现、不再从透明起播 → 无空白帧、无抖动。首页 `.home-page__content` 在上述 CSS 规则中被 `:not()` 排除，保持专属过渡、不参与抑制。**View Transitions（document.startViewTransition 交叉淡入）曾在此启用，但实测在方案 B 下反而有害**：(1) 首次进入因 flushSync 提交引发布局抖动；(2) 二次进入时缓存命中本应瞬间可见的页面在 VT 交叉淡入期间被拍成空白快照，把白色间隙时长拉长。故已彻底移除 VT，`useCustomNavigate` 现只走 react-router 原生 navigate（见「导航 API 强约束」）。
- **首页分类入口（2026-08-29 修订：页面内类目切换已彻底移除）**：首页**不再有页面内类目切换**——旧 `HomeSidebar` 与 `Home/index.tsx` 的 `CategoryView` 已删除，分类切换统一走路由：点击 `CategoryQuickAccess` 卡片 → `navigate('/browse?category=...')`（各端一致）。**以下历史机制均已不存在，勿再引用**：`displayedCategory` / `catSwitching` / `.home-cat-dim` / `home-cat-fade-*` / `fadePhase` / `useHomeCategoryStore` / `pages/Home/categoryConfig.ts` / `pages/Home/preloadRowCovers.ts` / `CategoryQuickAccess` 的 `activeCategory` prop 与 `--active` 样式。**仍保留的约束**：(1) `animation-fill-mode: none` 保留在 `.home-page__content` 上（防 `page-transition-enter` 的 `both` fill 永久锁定 opacity）；(2) 不要给 `.home-page` 或任何 HeroBanner 祖先加 `transform` 类动画（GPU 合成缩略图层会重绘闪烁，即「闪一下」）。

**导航 API 强约束**：所有业务导航一律使用 `src/lib/navigation.ts` 的 `useCustomNavigate()`，禁止直接 `import { useNavigate } from 'react-router-dom'`（已由 ESLint `no-restricted-imports` 封死，仅 `src/lib/navigation.ts` 豁免）。`useCustomNavigate` 现只走 react-router 原生 navigate（不启用 View Transitions——见「页面进入过渡统一约定」：VT 在方案 B 下会引入抖动与白色间隙回归）。二次进入的「先空白再出现数据」闪烁由 AppLayout 的 `data-revisit` 门控消除，与导航方式无关（无论经 `useCustomNavigate` 还是侧栏 `<Link>` 改走的 `useCustomNavigate` onClick，重进门控都生效）。

- **Suspense 兜底**：`AppLayout` 的 `LoadingFallback` 也已加 `.page-transition-enter`，冷加载时不再生硬弹出。


### 共享加载态约定（小电视 TvMascot）

- **唯一加载角色 `TvMascot`**：B 站同款「小电视」SVG 角色（TV 身 + 双天线耳朵 + 笑脸 + 电波），定义在 `src/components/ui/TvMascot/`（与 `PullToRefresh`、`UniversalPlayer` 加载态共用同一份 SVG + 配色，严禁再内联重复定义）。**所有环形/转圈加载图标（lucide `Loader` / `Tv`、`.up-loading-spinner` / `.up-iptv-buffering-spinner` / `.up-cast-spinner` 等）已全部移除**，新加载态一律用 `TvMascot`。
- **统一 props**：`armed`（耳朵直立 + 头顶电波）、`blink`（眨眼，用于 refreshing/success）、`earProgress`（0→1 耳朵竖起进度，随下拉进度）、`is-shaking`（刷新时摇摆）、`className`（可挂 `ptr-tv--on-dark` 适配黑色舞台）。`PullIndicator` 已封装「图标为主、文本为辅」的 B 站情绪化三段式文案（再拉就刷新 / 够啦松开人家嘛 / 更新中… / 更新啦）。
- **PullToRefresh 两变体**：`default`=顶部导航栏下方居中（靠 SVG filter 光晕 `#ptr-halo` 把小电视托起与图片分离，文字走深色填充 + 白色描边 `paint-order: stroke fill`）；`settings`=页面正中间圆形刷新按钮（自带 `--color-surface` 圆钮 + 阴影）。**陷阱**：`settings` 变体文本胶囊自带浅色背景，**必须走 `color: var(--color-text-secondary)`（主题文字色），不能继承 base 的 `--color-on-image`（白字）——否则浅色主题下白字压白底不可见**（2026-08-30 修复 `2e0ca40`）。
- **播放器加载/缓冲**：`UniversalPlayer` 缓冲浮层用 `<TvMascot className="ptr-tv--on-dark" blink is-shaking />`；首帧准备（非缓冲）时也需显示「加载中…」文本，避免出现「只有小电视、无文案」的裸电视态（2026-08-30 修复 `bfdaacf`）。播放页进入时右侧 `PlayerSidebarSkeleton`（CMS/季/集三栏 shimmer）必须每次渲染，不再用全屏 `AppLoading` 覆盖播放器（2026-08 `ecc197c`）。

### .gitignore 策略

- `docs/*` + `!docs/KNOWLEDGE.md` + `!docs/TEST-CASES.md` + `!docs/KNOWN-ISSUES.md` + `!docs/PRODUCTION-REVIEW-*.md` — 仅提交知识库 / 测试案例 / 已知问题 / 生产级对标报告文档，docs/ 其余（含 `docs/page-diagrams/` 原理图）忽略
- `scripts/*.ts` + `!scripts/*.spec.ts` + `!scripts/global-setup.ts` — 仅保留 E2E 测试脚本与全局初始化
- `scripts/*.mjs` + `!scripts/fetch-diagram-data.mjs` — 仅保留数据获取脚本，工具脚本不提交
- `scripts/fixtures/` — 本地测试夹具，忽略（不参与 E2E，见「测试基建修复」）
- AI 工具本地配置（.workbuddy/ .claude/ .opencode/ .codegraph/ 等）全部忽略
- AGENTS.md / CLAUDE.md / .cursorrules / .github/copilot-instructions.md — **提交**（团队共享）



### 页面骨架占位（2026-09-12 定稿）

**红线：每个页面骨架各不相同，禁止跨页复用整套骨架。** 早前整改被误做成「全站统一 AppLoading
菊花」，2026-09-12 已恢复各页专属骨架：

- 共享原语只有 `components/common/Skeleton`（单块 shimmer），页面骨架由各页自行组合：
  Browse（类型/排序行+竖版卡网格）/ Collections（影视+IPTV 分区）/ Person（hero+作品网格）/
  IPTV（rail/移动两套）/ Detail（≥1024 两栏 1.4fr/1fr + 窄屏堆叠）/ Home（视口两套分支）。
- **骨架与真实元素尺寸一致是硬约束**：列数直接消费真实网格同源 token
  （`--card-cols` / `--iptv-cols`），结构复用真实布局类名，杜绝第二套几何真源。
  实测基线：Detail 1440 骨架 765×431/547×431 与真实一致；Browse/Collections 逐像素相同。
- **loading 宿主的居中样式会整块继承给骨架**：`.detail-page--loading` 的
  `justify-content:center`（旧菊花时代）曾把骨架垂直顶到容器中部、与顶栏空出 ~166px——
  骨架化后此类宿主要改顶对齐。
- 首页左栏趋势榜骨架：trending **空态恒渲染骨架**（失败/无数据不返回 null——快速失败时
  整列空白比骨架更糟），数据由 I1 失败冷却自动重试补齐。
- e2e 断言骨架时**别用宽松的 `[class*="xxx"]` 选择器**：骨架类名（如
  `.iptv-skeleton__channel-grid`）会命中 `[class*="channel"]`，让「等真实网格」的用例在骨架态
  提前放行（IPTV-062 曾因此挂）。

### Radix Dialog 非 passive 监听规避（modal={false} 模式）

Radix 模态链上 `react-remove-scroll` 会在打开期间往 `document` 挂非 passive
wheel/touchmove/touchstart（每帧触摸滚动都得过主线程）；Radix 写死传参无 props 出路。
规避模式（Drawer 已落地，BottomSheet/Modal/ConfirmDialog 可同法跟进）：

1. `Dialog.Root modal={false}` → RemoveScroll 整个不挂载（DialogOverlay 非模态恒 null）；
2. 遮罩自绘：`<div class="drawer-overlay" data-state={open?'open':'closed'}>`——Portal 给每个
   子节点单独包 Presence，`[data-state='closed']` 退出动画播完才卸载，时序与原 Overlay 一致；
3. 滚动锁自理（零监听）：打开期间 `html/body overflow:hidden`（useEffect 恢复）+
   面板容器 `overscroll-behavior: contain`；
4. 代价：焦点不再 trap、背景不再 aria-hidden——移动全屏面板可接受，桌面弹窗迁移前需评估读屏。
