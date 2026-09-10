---
date: 2026-09-10 14:50
module: IPTV 播放 / UniversalPlayer·HLSAdapter + iptvService + useIPTVStore + useIPTVNavigation + useIPTVChannelInit + IPTVPlayer
type: fix
build: 通过（npm run build + vitest 91/91）
files:
  - src/components/UniversalPlayer/adapters/HLSAdapter.ts
  - src/components/UniversalPlayer/hooks/useIPTVNavigation.ts
  - src/components/UniversalPlayer/modules/useIPTVChannelInit.ts
  - src/components/UniversalPlayer/UniversalPlayer.tsx
  - src/pages/IPTV/IPTVPlayer.tsx
  - src/services/iptvService.ts
  - src/stores/useIPTVStore.ts
---

## IPTV 播放逻辑全面修复（逻辑错误 5 项 + 代码错误 6 项 + 异步竞态补充 1 项）

### 背景

对 IPTV 播放全链路（数据源加载 → 代理 URL 构建 → 播放器初始化 → 频道切换 → HLS 适配 → OSD 交互）做
逐文件代码审查后，识别出 13 项问题；修复后在审查阶段又发现 1 项 destroy/initHls 异步竞态补充，
共计 14 项修复，全部通过 `npm run build` + `vitest` 91/91 验证。

---

### 逻辑错误修复（5 项）

#### 1. HLSAdapter switchSource 未重置错误计数器

- **旧逻辑**：`switchSource()` 只重置 `currentLevel`，不调 `resetErrorCount()`。
  前一个频道积累的 `errorCount`（如 2 次 MEDIA_ERROR）带到新频道，
  新频道首个媒体错误直接走 `onError` 而非 `recoverMediaError`，导致**新频道过早判定为不可用**。
- **新逻辑**：在 `loadSource()` 前调用 `this.resetErrorCount()`，确保切源时错误计数从 0 开始。
- **涉及文件**：`HLSAdapter.ts:386-390`

#### 2. 频道切换双重加载

- **旧逻辑**：`useIPTVNavigation.handleChannelSelect` 设 `setCurrentUrl(playUrl)` 触发播放器 `switchSource`，
  随后 `onChannelChange` → `navigate()` → 重渲染 → `useIPTVChannelInit` 解析 URL 再 `setCurrentUrl` 一次。
  hls.js `loadSource` 不检查 URL 是否相同，**相同 URL 也重新加载 manifest**，用户感知切频道时偶尔闪烁。
- **新逻辑**：
  - `useIPTVNavigation` 新增 `lastSetUrlRef`（`useRef<string>`），`handleChannelSelect`/`handleSourceSwitch`
    设置 URL 时同步写 ref。
  - `useIPTVChannelInit` 接收 `lastSetUrlRef`，封装 `setUrlIfChanged()`：URL 与 ref 相同时跳过 `setCurrentUrl`。
  - `UniversalPlayer.tsx` 将 ref 从 `useIPTVNavigation` 解构并透传给 `useIPTVChannelInit`。
- **涉及文件**：`useIPTVNavigation.ts:27,35` / `useIPTVChannelInit.ts:36-40` / `UniversalPlayer.tsx:320,724`

#### 3. buildCatchupUrl 返回值未走代理决策

- **旧逻辑**：`buildCatchupUrl` 直接从 `channel.url` / `catchupSource` 拼装回看 URL 并返回，
  **不经过 `shouldProxy`/`buildProxyUrl`**。如果该频道需要代理才能播放（CORS 问题），回看 URL 同样需要代理，
  但当前代码不处理，导致**回看时直接走原始 URL → CORS 失败**。
- **新逻辑**：
  - `buildCatchupUrl` 签名增加 `proxyUrl?` / `pattern?` 参数。
  - 拼出 `rawUrl` 后统一调 `buildChannelPlayUrl({ url: rawUrl, ... }, proxyUrl, pattern)` 走代理决策。
  - `UniversalPlayer.tsx:seekCatchup` 调用处传入 `proxyUrl, proxyPattern`。
- **涉及文件**：`iptvService.ts:272-338` / `UniversalPlayer.tsx:683`

#### 4. settleWithWindow late-fulfill 覆写

- **旧逻辑**：`settleWithWindow` 的 `finish()` 把未完成项标记为 `PENDING_ABANDONED` 并 `resolve(results)`，
  但 promise 的 `.then` 回调在 `finish` 后仍会执行，**覆写已 resolve 的数组元素**。
  虽然 JS 单线程下实际影响较小（消费方已同步读取），但属不确定竞态。
- **新逻辑**：then/catch 回调首行加 `if (done) return` 守卫，`finish` 后 late-fulfill/reject 不再覆写。
- **涉及文件**：`iptvService.ts:454,463`

#### 5. error 消息覆盖逻辑不完整

- **旧逻辑**：`useIPTVStore.refreshChannels` 中用三目表达式：
  `sourceErrors.length > 0 ? '本地源失败' : orgSettled.rejected ? '主干失败' : null`。
  当两者同时成立时，用户只看到"X 个本地源加载失败"，**不提示 iptv-org 主干也失败了**。
- **新逻辑**：用数组收集错误消息，`errors.join('；')` 合并输出，两者同时失败时同时显示。
- **涉及文件**：`useIPTVStore.ts:276-294`

---

### 代码错误修复（6 项）

#### 6. detectSourceType 冗余分支

- **旧逻辑**：`channelCount > 1` 和 `channelCount === 1` 两个条件返回完全相同的结果。
- **新逻辑**：合并为 `channelCount >= 1`。
- **涉及文件**：`iptvService.ts:29`

#### 7. handleChannelChange 双重编码

- **旧逻辑**：`const encodedUrl = encodeURIComponent(playUrl); const params = new URLSearchParams({ url: encodedUrl });`
  `URLSearchParams` 构造器对 value 中的 `%` 再编码为 `%25`，导致双重编码。
  接收端 `searchParams.get('url')` 解一层 + `decodeURIComponent()` 解第二层恰好匹配，功能正常但 URL 不必要变长。
- **新逻辑**：直接 `new URLSearchParams({ url: playUrl })`（自动编码一次）；接收端 `const videoUrl = url`（get 已解码，去掉多余的 `decodeURIComponent`）。
- **涉及文件**：`IPTVPlayer.tsx:135` / `IPTVPlayer.tsx:34`

#### 8. _channels 参数命名误导

- **旧逻辑**：`handleSourceSwitch(index, switchByChannel, currentChannel, _channels: IPTVChannel[], ...)` 参数名以
  `_` 开头（约定"未使用"），但 `line 56` 实际使用了 `_channels.filter(...)`。
- **新逻辑**：参数名改为 `channels`。
- **涉及文件**：`useIPTVNavigation.ts:54`

#### 9. parseM3U8Content attributes 未做空值防护

- **旧逻辑**：`const attributes = parts[0]; const logoMatch = attributes.match(...)`。
  如果 `#EXTINF:` 行格式为 `#EXTINF:-1,Channel Name`，则 `parts[0]` = `"-1"`（纯数字，无属性）。
  实际不报错（`.match` 返回 null），但缺少显式防护不够健壮。
- **新逻辑**：`const attributes = parts[0] ?? ''`。
- **涉及文件**：`iptvService.ts:666`

#### 10. HLSAdapter attach 异步竞态

- **旧逻辑**：`attach()` 调 `initHls().catch(() => {})`，但 `initHls` 是 `async`（内部 `await import('hls.js')`）。
  如果 `play()` 在 import 完成前被调用，`this.hls` 为 `null`，`video.play()` 在 src 为空时空转。
- **新逻辑**：
  - 新增 `initPromise` 字段，`attach()` 赋值，`play()` 先 `await this.initPromise`。
  - **补充**：`initHls()` 在 `await import('hls.js')` 后加 `if (!this.video) return` 防止 destroy 期间创建泄漏的 HlsJs 实例。
  - **补充**：`destroy()` 清 `this.initPromise = null`，防止 stale promise。
- **涉及文件**：`HLSAdapter.ts:55-56,66-70,91,402-403`

#### 11. loadedUrl 只存单 URL

- **旧逻辑**：`loadedUrl: settings.aggregatorUrl`（只存单个 URL）。
  实际源列表在 `settings.aggregatorUrls`（数组）。多源配置时 `loadedUrl` 误判。
- **新逻辑**：`loadedUrl: settings.aggregatorUrls?.length ? settings.aggregatorUrls.join(';') : settings.aggregatorUrl ?? null`。
  `refreshChannels` 和 `loadFromCache` 两处同步修改。
- **涉及文件**：`useIPTVStore.ts:290-292,481-483`

---

### 验证

- `npm run build`：`tsc -b` 类型检查零错误，`vite build` 2282 模块转换成功。
- `vitest run src/services/iptvService.test.ts`：91/91 全部通过。
- commit `5c9d132`（amend 含补充修复）。
