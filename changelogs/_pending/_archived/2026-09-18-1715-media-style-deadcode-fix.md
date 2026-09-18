---
date: 2026-09-18 17:15
module: android-dlna
type: fix
build: 待 CI 验证（发版 merge 触发 build-apk）
files:
  - scripts/android-dlna-patch/java/com/videowarehouse/app/media/MediaService.java
  - scripts/patch-android-dlna.ps1
---

# fix(android): 移除 MediaService 中类型不兼容的 MediaStyle 死代码

## 背景

上一轮修复（`49eb39c`）将 MediaService 改用 framework `MediaSession` 后，CI 在
L286 报 `incompatible types: MediaSession cannot be converted to Builder`：
`androidx.media.app.NotificationCompat.MediaStyle` 构造器要 compat 版
`MediaSessionCompat`，与 framework `MediaSession` 类型不兼容。

## 根因

`buildNotification` 里 `new MediaStyle(mediaSession).setShowActionsInCompactView(0,1,2)`
是**死代码**——创建后从未 `builder.setStyle(...)` 应用到通知，删除后运行时行为零变化。
锁屏媒体卡片由 framework `MediaSession`（`setActive` + `PlaybackState`）系统级提供，
不依赖通知 style。

## 改动

- `MediaService.java`：删除未用 import `androidx.media.app.NotificationCompat.MediaStyle`；
  删除 L286 死语句，替换为说明注释；更新 javadoc。
- `patch-android-dlna.ps1`：移除第 3 步 `androidx.media:media:1.7.0` 依赖注入段
  （androidx.media 在补丁内已无消费者），保留注释说明历史。

## 旧 ↔ 新

- 旧：`new MediaStyle(mediaSession).setShowActionsInCompactView(0,1,2);`（编译错误 + 死代码）
- 新：删除该语句，注释说明锁屏控制由 MediaSession 提供；如需通知紧凑媒体按钮属新 feature（需 MediaSessionCompat），另行决策。

## 验证

- grep 全文件无 `MediaStyle`/`androidx.media` 代码引用残留（仅注释提及）。
- 本地无 Android SDK 无法编译，待下次 release-please 发版 merge 触发 `build-apk` 验证。
- 教训：同文件多处 Edit 禁止并行（又现「报成功但未持久化」，本次 3 并行仅 1 落盘，已串行重做并逐一 grep 验证）。
