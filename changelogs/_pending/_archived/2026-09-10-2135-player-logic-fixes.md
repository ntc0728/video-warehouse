---
date: 2026-09-10 21:35
module: player
type: fix
build: npx tsc -b 通过
files:
  - src/components/UniversalPlayer/lib/utils.ts
  - src/components/UniversalPlayer/adapters/HLSAdapter.ts
  - src/components/UniversalPlayer/ControlBar/ResolutionSwitch.tsx
  - src/components/UniversalPlayer/MobileUI/SettingsContent.tsx
  - src/components/UniversalPlayer/ControlBar/ProgressBar.tsx
  - src/components/UniversalPlayer/hooks/usePlayerCore.ts
  - src/components/UniversalPlayer/ToastTrigger.tsx
  - src/components/UniversalPlayer/PlayerToast.tsx
  - src/pages/Player/index.tsx
demo: 无（逻辑修复，播放器/`/play` 页可直接复现）
---

## 走读反馈 · 播放页（Play）批量修复

### 1. 清晰度菜单出现非法档位「0P」

- **旧**：`HLSAdapter.getQualityLabel` 在 `height = 0`（manifest 未标 `RESOLUTION` / 纯音频轨）时回落 `` `${h}P` `` → 生成 `0P`；
  `ResolutionSwitch` 与 `SettingsContent` 直接 `levels.map()` 全量渲染，菜单里出现「自动 + 0P」。
- **新**：`getQualityLabel` 高度缺失时返回空串；新增 `getSelectableLevels()` 过滤 `height <= 0` 的档位，
  两个菜单共用；过滤后仍携带 adapter 原始索引（`hls.currentLevel` 是原始下标，不能重编号）。
  全部档位无分辨率时菜单只剩「自动」。`getCurrentLabel` 对无效档位也退回「自动」。

### 2. 进度条灰色缓冲条不跟随最新播放位置

- **旧**：`bufferedProgress` 只在 video 的 `progress` 事件写入。暂停 / 加载中没有新的下载推进 →
  事件不触发 → seek 之后灰条停在旧位置；且向前 seek 后蓝点会跑到灰条之外。
- **新**：
  - 抽出 `syncBufferedProgress()`，在 `seek()` 即时、`seeked`、`timeupdate` 三处补同步；
  - `ProgressBar` 渲染时 `bufferedPercent = min(100, max(raw, progress))`，灰条不再短于已播放位置。

### 3. 暂停 / 加载中点击进度条不跳转

- **旧**：`seek()` 只写 `video.currentTime`；元数据未就绪（加载中 / 刚切源）时该写入可能被浏览器丢弃；
  暂停且目标未缓冲时没有播放推进驱动取数。
- **新**：
  - `readyState < HAVE_METADATA` 时把目标暂存到 `loadedmetadata` 后落位（保证加载中也真的跳过去）；
  - 暂停且目标不在已缓冲区间内时调用 `adapter.resume()` 唤醒加载引擎继续请求该进度；
  - 全程不调用 `play()`，跳转后保持暂停。

### 4. 单集时控制栏仍显示上一集 / 下一集

- **旧**：`hasPrevEpisode={episodes.length > 0 ? !isFirstEpisode : undefined}` —— 单集时传入 `false`，
  按钮照样渲染（只是置灰）。
- **新**：条件改为 `episodes.length > 1`，选集 / 线路面板只有一条数据时两个按钮完全不渲染。

### 5. 播放 / 暂停提示音扰

- **旧**：`ToastTrigger` 在 `isPlaying` 变化时 `show('播放')` / `show('暂停')`，
  含首帧自动播放、`userPlayRequested` / `userPauseRequested` 两套标记与 `autoPlayToastShownRef` 一次性闸门。
- **新**：整段删除（含三个 ref）。播放 / 暂停是最高频操作，每次点击弹提示属噪声。

### 6. 移动端居中提示跟随播放器，而非浏览器顶部

- **旧**：`measureCenterPos()` 把 y 夹取到**视口** `[48, innerHeight-48]`。移动端下滑后播放器 `rect.top` 变负 →
  y 被夹到 48px → 提示钉在视口顶部；又因 portal 到 body + `z-index:1500`，
  反而浮在已滚走的播放器上方。
- **新**：改为夹取到「播放器 ∩ 视口」的可见交集；可见高度 < 96px 时直接不渲染提示
  （新增 `centerVisible` 状态）。播放器滚出视口后不再有悬浮提示。
