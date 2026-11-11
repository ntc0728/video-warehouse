/**
 * 播放器能力矩阵（mode 相关能力的唯一点查处）
 *
 * ## why：为什么需要这一层
 *
 * `UniversalPlayer` 是点播/直播共用的唯一播放器实例，`mode` 是唯一分流依据。
 * 但「不同 mode 有哪些能力」此前散落成 10 处硬编码 `if (mode === …)`：
 * 加一个新 mode 要翻遍 1300 行组件改 10 个地方，且没有任何地方能一眼看全能力差异。
 *
 * 本文件把「能力」从「组件」里抽出来集中声明：
 * - 组件只回答「这个能力开不开」（读矩阵），不再回答「当前是什么 mode」（判 mode）；
 * - 新增 mode 相关行为 → 先加进本矩阵，再在组件里读 —— 禁止再写散落的 `if (mode === 'video')`。
 *
 * ## why：为什么能力要接收 ctx 而不是只看 mode
 *
 * 有两个能力天然不是「mode 的纯函数」：
 * - `canSeek` 受 `hasError` 影响（错误态下拖进度条会把已崩的管线拖得更死，现状即如此守卫）；
 * - `canSeek` / `hasTimeshift` 受**频道是否自带 catchup** 影响。
 * 所以签名收一个可选 `ctx`，而不是把这些判断继续留在组件里 —— 否则能力又被拆回两半。
 *
 * ## 能力 ↔ 组件消费点对照
 *
 * | # | 位置（UniversalPlayer.tsx） | 判断语义 | 消费的能力字段 | 等价性 |
 * |---|---|---|---|---|
 * | 1 | `showHeaderFullscreen` | `mode === 'iptv' && 非 TV && 非 native` | `hasHeaderFullscreenBtn`（+ 组件保留 platform/native 判断） | iptv→开、video→关；`'live'` 无写入点故等价 |
 * | 2 | `useEPGData({ mode })` / EPG 错误 toast | hook 内 `mode !== 'iptv'` 早退 | `hasEPG`（hook 改收 `enabled`） | 一致 |
 * | 3 | `currentChannel` 派生 | `mode !== 'iptv'` 直接 return | `hasChannelList` | 一致 |
 * | 4 | 移动端手势 `enabled` | `!isDesktopWeb && mode === 'video'` | `hasTouchGesture`（+ 组件保留 isDesktopWeb 判断） | video→开、其余→关；一致 |
 * | 5 | `canSeek` | `mode === 'video' && !hasError` | `canSeek` | 逐字等价 |
 * | 6 | `useIPTVTimeout({ mode })` | hook 内 `mode !== 'iptv'` 早退 | `hasTimeoutWatchdog`（hook 改收 `enabled`） | 一致 |
 * | 7 | 媒体会话标题 | `mode === 'iptv' ? 频道名 : 剧集名` | `hasChannelList`（真值取频道名）/ `hasEpisodeList` 语义 | 一致 |
 * | 8 | 源切换分支 | `mode === 'iptv'` 走切频道 | `handleSourceSwitch` 改收 `switchByChannel`（= `hasChannelList`） | 一致 |
 * | 9 | 代理注入 | `mode === 'iptv' && proxyUrl` | `hasProxyInjection`（+ 组件保留 proxyUrl/URL 判断） | 一致 |
 * | 10 | 续播提示 | `mode === 'video' && resumeAt != null` | `hasProgressPersist` | 一致 |
 *
 * > 注：组件里仍有若干 `mode === 'iptv'`（如播放核 url 选择、IPTVChannelList 渲染、OSD 选择、
 * > 缓冲延迟指标等）不在上表 10 项内，保持原实现，留待后续独立评估。
 *
 * ## ProgressBar 的拖拽口径：`capabilities.canSeek` 单一真源
 *
 * `ControlBar/ProgressBar.tsx` 读 `capabilities.canSeek` 决定能否拖拽
 * （video→可拖、`live`/无 catchup 的直播→禁拖），口径与矩阵一致，
 * 并为 catchup 频道开放进度条预留了入口。
 *
 * ## 口径区分：M3U `catchup` 属性 ≠ HLS DVR 时移探测
 *
 * 项目里存在两个**同名但不同义**的「时移」概念，必须明确分开，禁止合并为一个字段：
 *
 * 1. **M3U `catchup` 属性（本矩阵 `hasCatchup` / `hasTimeshift` 所指）**
 * - 来源：`IPTVChannel.catchup` / `catchupSource` / `catchupDays`（已解析进 `src/types/iptv.ts:36-44`）。
 * - 语义：电视台**在 M3U 清单里声明**自己支持回看，并给出回看 URL 模板。
 * - 玩法：用 `buildCatchupUrl()` 拼出「过去某时刻」的播放地址，整体重载播放器流
 * （本质是换一条流，而非在当前流内 seek）。UI 在 IPTVOSDBar 的 catchup 专属进度条。
 *
 * 2. **HLS DVR 时移探测（`hooks/useTimeshift.ts` 所指）**
 * - 来源：播放器运行时探测当前 HLS 流的 `seekable` 窗口是否 > 30s（`supportsTimeshift`）。
 * - 语义：流本身带 DVR 缓冲（如直播边缘往前 1 小时可拖），**与 M3U 声明无关**。
 * - 玩法：在当前流内 `seek` 到 `seekable` 区间任意点；UI 在 IPTVOSDBar 既有的 DVR timeshift 行。
 *
 * 两者独立开关：一个直播频道可以有 catchup 无 DVR、有 DVR 无 catchup、或两者皆有。
 * 矩阵里 `hasCatchup` 只描述**第 1 种**（M3U 属性）；`useTimeshift` 探测结果（第 2 种）走独立数据流，
 * 不在本矩阵里。IPTVOSDBar 用**两条独立 UI 行**分别渲染，互不干扰。
 */
import type { PlayerMode } from '@/types/player';

/**
 * 播放器能力矩阵。
 *
 * 字段取值严格按点播/直播/App 各 mode 的能力矩阵表填写；
 * 每个字段的注释标注它**原先散落在哪一行**，便于反查。
 */
export interface PlayerCapabilities {
  /**
 * 能否拖动进度条 / 横向滑动 seek。
 *
 * 原散落点：`UniversalPlayer.tsx:375`（`canSeek: mode === 'video' && !hasError`）。
 * 矩阵表：video ✅ / iptv ❌（时移开启后 ✅）。
 * 直播流没有可寻址的完整时间轴，只有点播（或自带 catchup 的直播频道）才开放。
 */
  canSeek: boolean;

  /**
 * 能否切换播放源。两种 mode 都能切，但**切的东西不同**：
 * 点播切「线路」（CMS 多源），直播切「频道/线路」。
 *
 * 原散落点：`UniversalPlayer.tsx:501`（`mode === 'iptv'` 走 `handleSourceSwitch` 切频道）。
 * 矩阵表：video ✅ 线路切换 / iptv ✅ 频道切换。
 *
 * 注：本字段在两种 mode 下恒真，当前无组件直接读它做分支（源切换的实际分支由
 * `handleSourceSwitch` 的 `switchByChannel` 参数承担，现读 `hasChannelList`），
 * 保留为矩阵完整性字段，未来按 mode 差异化关闭时可直接消费。
 */
  canSwitchSource: boolean;

  /**
 * 是否有剧集列表（上一集/下一集、选集侧栏）。
 *
 * 原散落点：侧栏分支 —— `ControlBar/ControlBar.tsx:115` `isVideoMode` 门控
 * 上一集/下一集按钮（`:161` / `:173`），选集面板在 Player 页而非播放器内。
 * 矩阵表：video ✅ / iptv ❌。
 */
  hasEpisodeList: boolean;

  /**
 * 是否有频道列表侧栏。
 *
 * 原散落点：`UniversalPlayer.tsx:1251`（`mode === 'iptv' && <IPTVChannelList>`）
 * 与 `:311`（`currentChannel` 派生仅 iptv）。组件目录 `IPTVChannelList/`。
 * 矩阵表：video ❌ / iptv ✅。
 */
  hasChannelList: boolean;

  /**
 * 是否拉取并展示 EPG 节目单。
 *
 * 原散落点：`UniversalPlayer.tsx:241` `useEPGData({ mode, channels })`（仅 iptv 生效），
 * 以及 `:231` EPG 错误 toast、`:1231` 节目单浮层。
 * 矩阵表：video ❌ / iptv ✅。
 */
  hasEPG: boolean;

  /**
 * 是否持久化播放进度用于「续播」。
 *
 * 原散落点：`UniversalPlayer.tsx:1161`（`mode === 'video' && resumeAt != null` 才显示续播提示），
 * 落库在 `useUserStore`；直播侧记 `playHistory/lastPlayed`（`useIPTVStore`，列表卡片与播放页
 * 换台/换线均写入），不是续播语义（直播无进度）。矩阵表：video ✅ 续播 / iptv ❌ 只记播放记录。
 */
  hasProgressPersist: boolean;

  /**
 * 是否启用「加载超时看门狗」（超时未起播直接判错，触发切线路/切代理）。
 *
 * 原散落点：`UniversalPlayer.tsx:432` `useIPTVTimeout({ mode, currentUrl, onTimeout })`。
 * 矩阵表：video ❌ / iptv ✅ —— 点播卡住可以等，直播卡住等于挂了，必须快速失败。
 */
  hasTimeoutWatchdog: boolean;

  /**
 * 是否显示头部全屏按钮（IPTV 播放页非 TV 端、非原生 App 时渲染，CSS 移到右下角）。
 *
 * 原散落点：`UniversalPlayer.tsx:202`（`mode === 'iptv' && platform !== 'tv' && !isNativePlatform()`）。
 * 矩阵表：video ❌ / iptv ✅。
 *
 * 注意：platform / 原生 App 的判断**不是 mode 的纯函数**，因此只把 `mode` 部分（iptv/live）
 * 收进矩阵，组件侧仍保留 `platform !== 'tv' && !isNativePlatform()` 的与运算。
 */
  hasHeaderFullscreenBtn: boolean;

  /**
 * 是否启用移动端手势（横向滑动 seek + 半屏亮度/音量）。
 *
 * 原散落点：`UniversalPlayer.tsx:365` `useTouchGesture({ enabled: !isDesktopWeb && mode === 'video' })`。
 * 矩阵表：video ✅ / iptv ❌。
 *
 * 同 `hasHeaderFullscreenBtn`：`!isDesktopWeb`（平台/设备判断）不是 mode 的纯函数，
 * 故只收 `mode === 'video'` 部分进矩阵，组件侧保留 `!isDesktopWeb` 与运算。
 */
  hasTouchGesture: boolean;

  /**
 * 是否对直连失败自动注入代理（仅 IPTV 直播流）。
 *
 * 原散落点：`UniversalPlayer.tsx:547`（`mode === 'iptv' && proxyUrl && !currentUrl.includes('/m3u8-proxy') ...`）。
 * 矩阵表：video ❌ / iptv ✅。
 *
 * 代理可用性（proxyUrl 是否配置）与当前 URL 是否已是代理地址，同样不是 mode 的纯函数，
 * 故只收 `mode === 'iptv'` 部分进矩阵；代理 URL / 防双重代理判断仍留在组件侧。
 */
  hasProxyInjection: boolean;

  /**
 * 是否支持时移/回看（由 **M3U catchup 属性**驱动，与 HLS DVR 探测无关）。
 *
 * 原散落点：无（未实现）。矩阵表：video ❌ / iptv 按频道 `catchup` 有无动态决定。
 *
 * ⚠️ 口径区分：本字段说的是 **M3U `catchup` 属性**，
 * 不等于 `hooks/useTimeshift.ts` 探测的 **HLS DVR seekable 窗口**。
 * 两者是独立概念，见文件头「口径区分」一节，禁止合并。
 */
  hasTimeshift: boolean;
}

/**
 * 能力计算的运行期上下文。
 *
 * why 全部可选：调用方只需传它**实际掌握**的信息。目前调用方只有 `hasError`，
 * `hasCatchup` 为时移能力预留（缺省恒 `false` → 行为与无 catchup 完全一致）。
 */
export interface PlayerCapabilityContext {
  /**
 * 当前频道是否自带 catchup 回看（M3U 的 `catchup` / `catchupSource` / `catchupDays`，
 * 已解析进 `IPTVChannel`，见 `src/types/iptv.ts:36-44`）。
 *
 * 时移场景才会真正传值；未传 → 默认 `false`。
 */
  hasCatchup: boolean;

  /**
 * 播放器当前是否处于错误态（`UniversalPlayer.tsx:177` 的 `hasError`）。
 *
 * 错误态下管线已崩，任何 seek 只会让它更死 —— 故 `canSeek` 在此永为假。
 */
  hasError: boolean;
}

/**
 * 计算指定 mode 的能力集合。
 *
 * why 纯函数 + 无副作用：能力必须可在 render 期直接调用、可单测、可被 `useMemo` 缓存，
 * 不能依赖 store/DOM，否则又变成一个新的隐式耦合点。
 *
 * @param mode 播放器模式。`'live'` 与 `'iptv'` **取值完全相同**（见下方 isLiveLike 注释）。
 * @param ctx 运行期上下文，缺省等价于 `{ hasCatchup: false, hasError: false }`。
 */
export function getCapabilities(
  mode: PlayerMode,
  ctx?: Partial<PlayerCapabilityContext>
): PlayerCapabilities {
  const hasCatchup = ctx?.hasCatchup ?? false;
  const hasError = ctx?.hasError ?? false;

  /**
 * why `'live'` 与 `'iptv'` 同值（经 grep 核实后确定）：
 * 全仓**未发现任何把 `mode` 设为 `'live'` 的写入点**——
 * `setMode` 仅由 `UniversalPlayer` 的 `useEffect` 从 `mode` prop 同步（`UniversalPlayer.tsx:447`）；
 * 无任何 `<UniversalPlayer mode="live">` 调用方，store 里也无 `'live'` 字面量。
 * 因此 `'live'` 当前是**死分支**（仅 `LiveIndicator` / 旧 ProgressBar 的 `mode === 'live'`
 * 会命中，但都无可达路径）。把它当 `'iptv'` 处理是安全等价的暂定口径，非遗漏。
 * 若将来 `'live'`（纯直播流，无频道列表/EPG）要与 `'iptv'`（带频道单的 IPTV）分家，
 * 在此处拆分支即可，组件侧无需改动。
 */
  const isLiveLike = mode === 'iptv' || mode === 'live';
  const isVod = mode === 'video';

  return {
    /**
 * 等价性保证：
 * 调用方不传 `hasCatchup` 时 `hasCatchup === false`，表达式退化为
 * `(isVod || false) && !hasError` === `mode === 'video' && !hasError`
 * 与迁移前 `UniversalPlayer.tsx:375` 的原式逐字等价。
 * P5 传入 `hasCatchup: true` 后才会为自带回看的直播频道额外放开（见 §3.4）。
 */
    canSeek: (isVod || hasCatchup) && !hasError,
    // 两种 mode 都可切源，只是切的对象不同（线路 vs 频道），故恒真。
    canSwitchSource: isVod || isLiveLike,
    hasEpisodeList: isVod,
    hasChannelList: isLiveLike,
    hasEPG: isLiveLike,
    hasProgressPersist: isVod,
    hasTimeoutWatchdog: isLiveLike,
    // 头部全屏按钮：仅直播类（iptv/live）需要；platform/原生判定留在组件侧。
    hasHeaderFullscreenBtn: isLiveLike,
    // 移动端手势：仅点播需要；isDesktopWeb 判定留在组件侧。
    hasTouchGesture: isVod,
    // 代理注入：仅直播类（iptv/live）需要；代理 URL / 防双代理判定留在组件侧。
    hasProxyInjection: isLiveLike,
    // 点播本身就能 seek，不存在「时移」概念；直播看频道有没有 catchup（M3U 属性）。
    hasTimeshift: isLiveLike && hasCatchup,
  };
}
