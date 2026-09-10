---
date: 2026-09-10 16:16
module: IPTV 频道主干策略 / useIPTVStore + IPTV 页 + UniversalPlayer + iptvService + iptvOrgService
type: fix
build: 通过（npm run build + vitest 383/383）
files:
  - src/stores/useIPTVStore.ts
  - src/pages/IPTV/index.tsx
  - src/components/UniversalPlayer/UniversalPlayer.tsx
  - src/services/iptvService.ts
  - src/services/iptvOrgService.ts
---

## IPTV 频道显示/代理拼接 4 项修复

### 背景

用户反馈 4 个问题：①修改后 IPTV 页仍显示缓存中的本地频道；②勾选/取消勾选「更多台」源时频道数量和 card 不变化；③IP 数字域名（如 101.35.240.114）仍拼接代理；④iptv-org 主干频道播放链接仍拼接代理。

### 旧 → 新对照

#### 1. loadFromCache 缓存过滤失效（sourceId 方案替代 id 集合）

- **旧**：从 `cached.bySource` 收集本地频道 id 集合 `localIds`，用 `!localIds.has(ch.id)` 过滤——旧版缓存 `bySource` 可能为 undefined 导致 `localIds` 为空集，过滤失效
- **新**：改用 `sourceId` 前缀过滤——本地频道 sourceId 为 `source-${index}`，iptv-org 主干 sourceId 不带 `source-` 前缀（`iptvorg` 或 undefined）；`!ch.sourceId?.startsWith('source-')` 更可靠
- **文件**：`src/stores/useIPTVStore.ts:468-473`

#### 2. 「更多台」勾选不更新频道数量和 card

- **旧**：`mainChannels` 只含 `channels`（store 主干），`catCounts` 基于 `channels` 计数，勾选源的频道只在 sections 中单独追加「更多台 · 源名」分节——不影响主干数量和分类计数
- **新**：`mainChannels` 合并 `extraSourceIds` 对应的 `sourceChannels` 频道（`[...channels, ...extra]`），`catCounts` 改为基于 `mainChannels` 计数，sections 移除独立追加分节（已并入主干参与分类渲染）
- **效果**：勾选/取消勾选本地源后，上方「全部频道」数量、分类计数、右侧 card 全部实时更新
- **文件**：`src/pages/IPTV/index.tsx:174-189`（mainChannels）、`src/pages/IPTV/index.tsx:219-227`（catCounts）、`src/pages/IPTV/index.tsx:250-253`（sections）

#### 3. IP 型数字域名仍拼接代理（自动切代理路径绕过 shouldProxy）

- **旧**：`UniversalPlayer.tsx:580` 直连失败自动切代理时直接调 `buildProxyUrl(currentUrl, proxyUrl)`，未先检查 `shouldProxy`，导致 IP 型域名也被拼接代理
- **新**：自动切代理前增加 `shouldProxy(currentUrl, proxyUrl, proxyPattern)` 检查，返回 false（IP 型域名/白名单命中）时不拼接，直接 return 走后续错误处理
- **文件**：`src/components/UniversalPlayer/UniversalPlayer.tsx:580-581`、`src/components/UniversalPlayer/UniversalPlayer.tsx:606`（依赖数组加 proxyPattern）

#### 4. iptv-org 主干频道播放链接仍拼接代理

- **旧**：`buildChannelPlayUrl` 只靠 `shouldProxy` 判断，iptv-org 频道的 URL（cn.m3u 原始流）不在直连白名单中 → 全部拼接代理
- **新**：`toIPTVChannelFromApi` 设 `sourceId: 'iptvorg'`；`buildChannelPlayUrl` 新增判断 `channel.sourceId === 'iptvorg'` 时直接返回原始 URL 不拼代理；`buildCatchupUrl` 参数类型同步扩展 `sourceId` 并透传
- **注意**：命中本地源同名频道的 org 频道（mergeOrgWithLocal 替换 url+sourceId 为本地源）仍走正常代理规则，只有未替换的纯 iptv-org 频道直连
- **文件**：`src/services/iptvOrgService.ts:203-204`、`src/services/iptvService.ts:235-241`、`src/services/iptvService.ts:276`、`src/services/iptvService.ts:341`

### 验证

- `npm run build`：tsc -b + vite build 通过
- `npx vitest run`：383/383 全部通过
