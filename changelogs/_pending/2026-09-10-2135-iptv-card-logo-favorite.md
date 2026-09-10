---
date: 2026-09-10 21:35
module: iptv
type: fix
build: npx tsc -b 通过
files:
  - src/components/IPTVChannelCard/IPTVChannelCard.tsx
  - src/components/IPTVChannelCard/IPTVChannelCard.css
  - src/components/RecordCard/RecordCard.css
  - src/services/channelLogo.ts
  - src/services/channelLogoCache.ts
demo: 无（Playwright 实测 60 张卡收藏按钮 3 → 60）
---

## 走读反馈 · IPTV 频道卡片（台标 + 收藏按钮）

### 1. 收藏按钮被台标加载态门控，多数卡片整颗不渲染

- **实测**：Playwright 打开 `/iptv`（390×844）→ 60 个 `.iptv-channel-card-wrap`，
  `.iptv-card-favorite` 只有 **3** 个。
- **旧**：`showFavorite = !batchMode && !hideFavorite && (imageLoaded || !channel.logo)`。
  台标 404 / 被网络或广告拦截插件拦掉 / 命中失败记忆（此时
  `resolveChannelLogoCandidates` 直接返回空数组，LazyImage 连 `<img>` 都不渲染），
  这三种情况下 `onLoad` 永不触发 → `imageLoaded` 恒 false 且 `channel.logo` 非空
  → `showFavorite` 恒 false。
- **新**：`showFavorite = !batchMode && !hideFavorite`，连带删除 `imageLoaded` state
  与 `isImageLoaded` 导入。复测 **60 / 60** 张卡都有红心。

### 2. 宽屏触屏设备上红心永远不可见

- **旧**：`.iptv-card-favorite.hover-visible { opacity: 0; pointer-events: none }`，
  只在 `:hover` / `:focus-within` 显形。视频卡 `VideoCard.css:307-315` 有
  `@media (hover: none) and (pointer: coarse)` 常显兜底，IPTV 卡漏了这条。
- **新**：补同款常显规则（不含 `display`，不影响 ≤767px / app 端原有的 `display:none`）。

### 3. 封面台标被 `object-fit: cover` 裁切

- **旧**：`.iptv-card-cover img { object-fit: cover }`，而封面比例四档（3/2 · 16/10 · 16/9 · 16/9）
  是「海报思维」。1:1 方图台标放进 16:9 只剩约 56% 高度可见，宽图则左右各裁近半。
- **新**：改 `object-fit: contain` + `padding: var(--space-2xs)`，完整装下台标，留白交给
  已有的 `--color-surface-hover` 封面底色。
  历史页 `.history-page .record-card__media--logo` 是同一缺陷的复制，一并改为 contain
  （`.lazy-image-fallback` 是矢量 Tv 图标节点，保持 cover）。

### 4. 台标失败记忆 30 天不复试，一次偶发失败被固化

- **旧**：`channelLogoCache` 的 30 天 TTL 只校验整块 blob，`entry.ts` 注释写着「用于 TTL 过期校验」
  但从未被读；`preloadLogoCache` 把所有 `ok:false` 无条件塞进 `failedLogoUrls`。
  一次网络抖动 / DNS 波动 / 广告拦截 → 该 URL 30 天内不再请求 → 那张卡「永远没台标」。
- **新**：新增 `LOGO_FAIL_TTL = 6h`，恢复失败记忆时只把「6 小时内的失败」放进黑名单；
  过期的当场释放、本轮重新试一次，成功即回写 ok 记忆（成功记忆仍保持 30 天）。

### 待用户决策（本次未改）

iptv-org 的台标 URL 实际全部托管在 `i.imgur.com`，本机实测该域名连接被重置
（`net::ERR_CONNECTION_RESET`，6 个台标全挂）。`channelLogo.ts` 的设计是
「台标不走代理」，因此在国内网络下整页卡片都会落到 Tv 兜底。
是否让台标走 worker 代理属于产品取舍（代理请求消耗 vs 台标可见性），未擅自动手。
