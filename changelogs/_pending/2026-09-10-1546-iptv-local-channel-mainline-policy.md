---
date: 2026-09-10 15:46
module: IPTV 频道主干策略 / useIPTVStore + IPTV 页
type: fix
build: 通过（npm run build + vitest 383/383）
files:
  - src/stores/useIPTVStore.ts
  - src/pages/IPTV/index.tsx
---

## IPTV 本地频道主干显示策略调整

### 背景

原行为：iptv-org 失败时回退纯本地主干（本地频道直接进主干列表），且缓存加载不过滤本地频道。
用户要求：本地独有频道不进主干，只在「更多台」勾选对应源后出现；iptv-org 失败时 IPTV 页显示空数据状态，勾选本地源之后才显示本地源的频道。

### 旧 → 新对照

#### 1. refreshChannels：iptv-org 失败不再回退本地主干

- **旧**：`else if (localResult) { merged = localResult.channels; }` — iptv-org 失败时用本地频道全集填充主干
- **新**：移除该回退分支，iptv-org 失败时 `merged` 保持空数组；本地源频道仍存在于 `bySource`（「更多台」可勾选展示）
- **文件**：`src/stores/useIPTVStore.ts:258-263`

#### 2. refreshChannels：错误消息更新

- **旧**：`'iptv-org 主干加载失败，已回退本地源'`
- **新**：`'iptv-org 主干加载失败，请勾选本地源查看本地频道'`
- **文件**：`src/stores/useIPTVStore.ts:278`

#### 3. loadFromCache：缓存加载过滤本地独有频道

- **旧**：`cached.channels.map(...)` — 直接使用缓存中的 channels（可能含旧版回退写入的本地频道）
- **新**：从 `cached.bySource` 收集所有本地频道 id 集合 `localIds`，过滤主干中的本地频道；groups 改为 `groupChannels(channels)` 重新生成（而非用缓存旧 groups）
- **文件**：`src/stores/useIPTVStore.ts:468-485`

#### 4. IPTV 页空状态文案

- **旧**（桌面端）：`description={error || '请点击刷新按钮加载频道列表'}`
- **新**（桌面端）：`description={error || '请点击刷新按钮加载频道列表，或在左侧「更多台」勾选本地源'}`
- **文件**：`src/pages/IPTV/index.tsx:459`

### 验证

- `npm run build`：tsc -b + vite build 通过
- `npx vitest run`：383/383 全部通过
