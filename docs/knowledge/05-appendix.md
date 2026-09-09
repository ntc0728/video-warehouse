# 附录

> 由 `docs/KNOWLEDGE.md` 拆分而来（2026-09-09 文档瘦身）。原文件已改为索引页，详情在此；修改时两处同步。

## 附录

### A. 常见问题

**Q: 开发服务器启动失败？**
A: 检查 Node.js 版本是否 >= 18，运行 `npm install` 重新安装依赖。

**Q: 视频无法播放？**
A: 检查是否配置了正确的代理地址，确认视频源 API 可用。

**Q: IPTV 频道无法加载？**
A: 检查 M3U8 代理是否部署成功，确认频道 URL 有效。

### B. 相关链接

- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Vite 文档](https://vitejs.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [Zustand 文档](https://docs.pmnd.rs/zustand/)
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)

### C. 更新日志

> **版本口径说明**：下方 `v1.0.0~v1.7.0` 为项目早期**内部功能里程碑**（2026-07-30 前手工标注，未打 git tag）；自 2026-07-30 起版本号由 release-please 接管（见 ADR-004），官方 tag 与 `CHANGELOG.md` 以 `package.json`/`.release-please-manifest.json` 为准（首次发布 `1.0.0`，当前 `1.1.0`）。此处保留里程碑记录仅作功能演进参考，**版本号口径以 release-please 为准**。

- **v1.0.0** - 初始版本，支持基本视频浏览和播放
- **v1.1.0** - 添加 IPTV 直播功能
- **v1.2.0** - 添加收藏和历史记录功能
- **v1.3.0** - 添加 TV 端适配
- **v1.4.0** - 优化播放器性能，支持多清晰度切换
- **v1.5.0** - 播放器 UI 优化（2026-07-10）：
  - 控制栏弹窗选中态高亮增强（显式白色 + 左侧指示条）
  - 更多设置弹窗左对齐、宽度优化
  - 播放按钮尺寸增大（3rem→6rem 流体缩放）
  - 截图功能错误提示完善（跨域、视频未就绪等）
  - 解码模式切换提示（硬解/软解）
  - 画中画比例修复（PiP 模式下移除自定义宽高比样式）
  - 播放页折叠面板文字加粗、选季面板移动端 3 列布局
  - Browse 页移除子元素冗余左右 padding
- **v1.6.0** - 移动端命令栏 (BrowseMobileBar) 样式细化（2026-07-30）：
  - 预设/推荐卡压缩（预设按钮 text-xs + space-xs padding；推荐卡 min-width 6rem、padding space-xs、gap space-xs）
  - 排序键移到模式切换右侧、筛选按钮新增漏斗 SVG 图标并加大右 padding（space-lg）
  - 删除「✨ 为你推荐」标题（bmb-rec-head）与 TMDB 趋势提示（bmb-cap）
  - 抽屉内 FilterBar 隐藏 footer（hideFooter）；面板底部与上方间距加大（margin-top space-xl、padding-top space-lg）
  - 移动端命令栏回归测试由 browse-mobile.spec.ts 并入 browse.spec.ts（BROWSE-070~074），原文件删除
- **v1.6.1** - 移动端整页卡片式包裹（2026-07-30）：
  - `isPhone`（含视口 < 768px）时 `.browse-page--mobile` 整页以卡片布局包裹：surface + 1px 边框 + radius-lg + shadow-sm + margin/padding space-sm
  - 内部 `.browse-card--results` 去壳，`.bmb` 底部加分隔线与结果区相连，与桌面端「双卡片相连」语义一致
  - 回归测试新增 BROWSE-075（断言整页卡片 radius/shadow/border 已加载）
- **v1.7.0** - 布局统一与工程清理（2026-07-31）：
  - 响应式卡片网格列数收敛为统一的 2/3/5（移动 / 平板 / 桌面及大屏），IPTV 骨架网格改为跟随 `--iptv-cols` 全局 token，不再走 `auto-fill`
  - TV 模式顶部导航栏新增 IPTV 直达入口（仅 `isTV` 时渲染，置于右侧导航项之前）
  - 工程清理：删除未挂载的 `PerformanceMonitor` 开发组件及其唯一依赖 `web-vitals`（npm uninstall 同步锁文件）；删除 9 个零引用自定义 hooks（`layout` / `useFetch` / `useFocusable` / `useGridLayout` / `useMinLoadingTime` / `usePointerType` / `usePreload` / `useThemeMode` / `useWebVitals`）并清理对应 barrel 死出口、CSS 死类/重复块与多处过时注释
  - 硬编码像素去化（Design Token 收口）：把散落在组件里的像素硬编码统一收口为 Design Token——`SearchBox`（下拉高度 `Math.min(…,448)` → 注入 `--dropdown-avail-h`、由 `--layout-dropdown-max-h` 驱动）、`Select`（下拉 `max-h-[320px]`/`px-[14px]` → `--layout-dropdown-max-h`/`--space-md`）、`IPTVOSDBar`（OSD 宽度 `OSD_MIN_WIDTH=360`/`OSD_MAX_WIDTH=1600` 的 JS 计算整段删除、纯 CSS `width: min(var(--layout-osd-max-width), 100%)`；TV 端 `--layout-osd-max-width` 由死值 `1600px` 改为标准 `clamp(100rem, 83.333vw, 200rem)`）、`Sidebar`（`isMobile ? 200 : 240` / 折叠 `:64` → `--sidebar-width-mobile`/`--sidebar-width`/`--sidebar-width-collapsed`）、`TabBar`（`text-[10px]` → `text-[var(--text-2xs)]`）、`ConfirmDialog`/`Modal`（内联 `<svg width="N">` 与 `w-[28px]` → `--icon-*`）；`variables.css` 的 `--layout-osd-max-width` 维持桌面原曲线 `clamp(320px, 20rem + 30vw, 1400px)`（旧 JS 的 360/1600 在最终 `min()` 中恒被 token 吞掉、对实际宽度零影响）；`UniversalPlayer` 移除仅为 OSD 宽度服务的 `containerWidth` state 与 `ResizeObserver`
- **v1.8.0** - 移动端设置页整改 + Browse 筛选区重设计（2026-08-10）：
  - 设置页移动端：入口菜单按 iOS 分组圆角卡组织（「通用」4 项 +「账户与信息」2 项，`.settings-menu-group*`，保留 `.settings-menu-item` 类名兼容 SET-090）；子页改用 `createPortal` 挂到 `document.body`（脱离 `.app-shell__scroll` 的 `contain:layout` 包含块），`position:fixed; inset:0` 覆盖全视口，顶栏（返回/居中标题/右占位）与全局导航栏同高（`--header-height-compact`）视觉替代导航栏；子页内 `.list-item` 双行卡卡片化（对齐桌面方案 F，卡片间距 `--space-lg`）；`.settings-page:has(.settings-subpage)` 移除 page-transition-enter 残留 transform；移动端子页 section 顶部 padding 为 0、左右 `--space-lg`
  - 个人设置 / 源管理（视频源/IPTV 源/EPG 源）在子页内恢复卡片化（`.settings-profile-card` / `.settings-personal-section .settings-card__body` / `.source-manager`），与桌面端一致
  - Browse 移动端筛选区（S3 定稿）：命令栏改两行布局——第一行 `智能检索/直链搜索` 模式段居中（`.bmb-mode-row`），第二行「筛选」小按钮（28px）+ 结果数两端对齐（`.bmb-bar-row` `space-between`）；**移除 `.bmb-presets` 预设横滚与面板内 `.bmb-rec` 推荐卡**（HTML 示例无此元素）；`.bmb-rail` 已选轨无左右 padding；移动端隐藏 `.browse-sort-bar`（排序入弹窗第 5 分组、结果数入命令栏）
  - 筛选面板改**完成制**：面板内 FilterBar 用 `draft` 草稿值（打开时从 `value` 快照），改条件零接口请求；点「完成」才 `onChange(draft)`；「重置」重置草稿；返回丢弃草稿。Drawer 新增 `fullscreen`/`onReset` prop（全屏覆盖 + 顶栏「返回/标题居中/重置」三栏，动画 `drawer-pg-in`）；FilterBar 不 hideFooter → 排序作为第 5 分组展示
  - SearchBox 全局修复：点击实时搜索建议不再直达详情页/人物页，改为填入关键词并跳转 `/browse?q=`（`handleSuggestionClick` 移到 `handleSearch` 之后解决 const 提升）
  - 弹窗按钮胶囊化：`Button` 组件若 className 含 `rounded-*` 则不附加默认 `rounded-md`（修复 ConfirmDialog/ProfileEditModal 胶囊被覆盖问题）；ConfirmDialog / ProfileEditModal 按钮高度降为 `min-h-[var(--comp-tab-height)]`（更修长），ProfileEditModal 按钮补横向宽度 `px-[var(--space-xl)]`
  - 新增测试：BROWSE-078/079/080（两行命令栏/全屏面板顶栏三栏+完成制/rail 无 padding）、SET-092/093（分组圆角卡/子页顶栏+双行卡）
  - `vite.config.ts` 新增 `server.warmup` 预热核心模块，缓解 dev 模式冷启动首次访问慢（首屏实测首次 ~400ms / 二次 ~176ms）

- **v1.9.0** - 全格式播放器缓冲优化 + IPTV 纯前端整改（2026-09-02）：
  - **HLS 缓冲 90MB 折中方案**：移除过度 300MB/3000s 配置与暂停轮询预加载 hack；`maxBufferSize` 改为 90MB（比默认 60MB 高 50%），`maxBufferLength`/`maxMaxBufferLength`/`backBufferLength` 走 hls.js 默认值；`abrEwmaDefaultEstimate=1.5Mbps` 改善初始选档。2Mbps 视频缓冲约 6 分钟、4Mbps 约 3 分钟，填满后停下载不再抢带宽。
  - **HLS 直播低延迟**：`LEVEL_LOADED` 直播分支经 `this.hls.config` 写入 `liveSyncDurationCount=3` / `liveMaxLatencyDurationCount=6` / `liveDurationInfinity=true`（延迟 5-10s）+ 缓冲收敛（60/120/20s）。修正了直接赋值 getter（`this.hls.maxBufferLength`）不生效的坑。
  - **Dash 缓冲提升**：`bufferTimeDefault=30s` / `bufferTimeAtTopQuality=45s` / `bufferTimeAtTopQualityLongForm=60s`，高码率 DASH 更抗波动。
  - **MPEGTS 点播 + 重连**：`isLive` 改为动态（`options.isLive ?? true`）；点播分支启用 stash 缓冲 + `seek()` 支持；`ERROR` 监听断流重连（2s × 最多 5 次），重连期间 toast，LOAD 成功重置计数。
  - **vodParser**：`detectSourceType` 新增 `.flv/.ts/.m2ts` → `'flv'`（走 mpegts.js）；`vodParser.test.ts` 补用例。
  - **UniversalPlayer 点播降级**：`type` 计算去 `mode==='iptv'` 限制，点播也走 `degradedType ?? currentType ?? type`；点播 `BARE_STREAM` 错误也降级到 mpegts；`adapterRegistry` 传 `isLive`，`usePlayerCore` 据 `mode==='iptv'` 传入。
  - **IPTV 可用性预检测**：频道列表加载后后台静默检测前 50 个（`checkChannelsAvailability`），结果写 `useIPTVStore.channelAvailability`；路由离开（Keep-Alive）abort 避免隐藏页空跑。
  - **IPTV 角标下移**：卡片 `availability-badge` 移到 `record-card__live-badge`（LIVE）下方（`flex column` + `gap space-2xs`），容器去红底。
  - **历史/收藏 CMS 源拦截**：直链收藏/历史记录点击跳转前，若所选 CMS 源未在设置勾选启用 → 不跳转，弹居中 modal（`CmsSourceBlockedModal` + `useCmsSourceGuard`，基于 `settings.videoSourceIds`）。`CollectionRecord` 扩展 `cmsSourceId/cmsSourceName`，`VideoCard` 收藏时经 `getVideoSources()` 异步解析写入。
  - **清理**：删除 IPTV 代理调试 `[IPTV 代理调试]` `console.debug` 打印代码。
  - 实施细节见 `docs/player-buffer-optimization.md` 与 `docs/player-iptv-frontend-refactor.md`；测试：`npm run build` + Vitest 383 通过 + 播放器/IPTV/历史/收藏 E2E 全绿。

- **v1.10.0** - 全站卡片间距统一 + 大屏列数梯度 + 状态角标单源化 + HeroBanner 文本间距与标题位 logo 时序（2026-09-03）：
  - **全站卡片 gap 统一 `--space-lg`**：TMDBMovieRow 横滚行（gap + 卡宽公式两处）、首页 continue 行、VideoCard 网格 + 骨架、Home 骨架行、Detail/Person/Player 相似网格、IPTV 频道网格（`index.css .iptv-channel-grid`）+ SkeletonIPTVCard、RecordFilterPanel chips 由 `--space-xs` 放宽至 `--space-sm`——消除「真实行/骨架行/跨页网格间距不一致」。
  - **卡片列数大屏梯度（Card Columns v6，`variables.css` + `index.css`）**：`--card-cols`/`--row-cols` <768=3 / ≥768=5 / ≥1024=6 / ≥1280=8 / ≥2560=9 / ≥3840=10（TV 恒 8）；`--continue-cols` <768=2 / ≥768=3 / ≥1280=6 / ≥2560=7 / ≥3840=8（TV 恒 6）；`--iptv-cols` <768=2 / 768=3 / 1024–1279=4 / 1280–1439=5 / 1440–2559=6 / ≥2560=7 / ≥3840=8（TV 恒 5）。改档须三处同步：源码注释块 + TV 覆盖 + Skeleton 注释（记忆库有案例）。
  - **竖版卡标题跑马灯（VideoCard）**：JS 测首段文本溢出 → 写 `--marquee-distance`（首段文本宽 + `--space-lg` 段距）；CSS 两段同构 `translateX` 无缝滚 + `mask-image` 渐变遮罩；桌面 `:hover`/`:focus-within` 才播，`≤767px` 与 `html[data-device="app"]` 自动播。
  - **⚠️ spacing token 曲线 bug 定位（桌面恒卡 MIN，用户拍板不修）**：`variables.css:166-177` 11 条 `--space-*` 的 vw 系数漏乘 100（`0.0407vw` 裸值，应 `4.07vw`）→ ≥768px 桌面恒取 MIN（`--space-lg` 桌面=12px 而非契约 28px）。修复会导致全站观感整体放大，已被用户否决回退。**勿再修曲线**；大屏间距需求走「网格单独补 gap 放大档」。登记 `docs/KNOWN-ISSUES.md` #13（待办）。
  - **频道可用性角标单源化**：删除 `availability-badge`（可用/不可用 + CheckCircle/XCircle 双图标独立表达），并入 `record-card__live-badge` 单徽标（`availability===false` → 红「无法观看」`.is-unavailable`；true/undefined → 绿 LIVE）。IPTVChannelCard 移除 `imageError` state 与 availability-badge 渲染；历史页 iptv 记录卡修复 `available` 漏传（此前恒显 LIVE，`History/index.tsx` 补 `available: channelAvailability[ch.id]`）+ live 角标补 `position:absolute`（曾因漏 position 声明被 `overflow:hidden` 裁掉 → 历史页 iptv 角标一直不可见）+ 移至左上角（与频道卡一致）+ 批量模式 `!batchMode` 隐藏避免与勾选框重叠。E2E：IPTV-041 断言从 `.availability-badge` 改 `.record-card__live-badge`。
  - **HeroBanner 移动端文本距图左/下双收**：`≤767px` + app 副本内 slide padding `--space-xl→--space-md`、text margin `--space-lg/md→--space-sm/xs`，距左 28→≈14px、距下 24→≈11px；桌面/平板不动。demo：`changelogs/demos/demo-hero-text-slide-padding-2026-09-03.html`。
  - **HeroBanner 标题位 logo 加载时序重构（窗口预取 + 像素预热 + 空闲缓慢递进）**：根因=旧逻辑首屏串行前 6 + activeKey（滑动结束才变）按需补拉 → `/images` 落在滑动瞬间 + logo 像素文件从不预加载（`<img>` 挂载现下载解码）→ 闪变 + 卡顿。改为与背景图 preloadRange 同节奏：① 焦点 ±3 窗口并发预取（滑入前决策已落地，滑动期零请求零 setState）；② 空闲补齐**缓慢递进**（`focusIndex` 每次变化重建 effect → 静默 1.2s 后、固定 2s 间隔每步补一项，滑动活跃期天然零请求；`requestIdleCallback` 密集推进版因空闲帧近乎无间隔连续 step 撞轮播被弃）；③ `fetchHeroLogo` 拿 file_path 即 `preloadImage` 同 w342 URL（挂载即命中缓存）；④ 删 `heroLogoFailed` state 改 `dropLogo`（缓存记 null + 一次 setState 回落）。demo：`changelogs/demos/demo-hero-logo-prefetch-2026-09-03.html`。
  - 历史页记录卡整改终稿（桌面 grid 每档 +1 列至 8、<480 横版、进度字号 text-xs、IPTV 可看角标）于本日早些提交（8f1115a/0b7adaf/fcb2839）。
  - 完整改动明细与踩坑见 `changelogs/2026-09-03.md`；观感对比见 `changelogs/demos/`（README 索引）；构建与测试全绿（tsc/vite 双绿、home 42 条 + 相关 spec 冒烟通过）。

---

