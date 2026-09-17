---
date: 2026-09-17
module: android/build + dlna-patch
type: fix
build: apk
files:
  - android/variables.gradle
  - android/app/build.gradle
  - scripts/android-dlna-patch/java/com/videowarehouse/app/media/MediaService.java
demo: 无（构建配置修复）
---

## 旧 ↔ 新对照

### 现象
CI Run #133（release-please.yml → build-apk job）失败，根因：`MediaService.java` 编译错误 10 条。
- `package android.support.v4.media does not exist`（L16/17/18）：文件引用已废弃的旧 Support Library 包。
- `package androidx.media.app.NotificationCompat does not exist`（L23）：`androidx.media:media` 依赖未声明。
- 连锁：`cannot find symbol` / `method does not override...`（L54/98-102）。

### 改动
1. `android/variables.gradle`：ext 新增 `androidxMediaVersion = '1.7.0'`。
2. `android/app/build.gradle`：dependencies 新增 `implementation "androidx.media:media:$androidxMediaVersion"`。
3. `scripts/android-dlna-patch/java/.../MediaService.java`：3 行 import 由
   `android.support.v4.media.MediaMetadataCompat` /
   `android.support.v4.media.session.MediaSessionCompat` /
   `android.support.v4.media.session.PlaybackStateCompat`
   改为对应 `androidx.media.*` / `androidx.media.session.*`（L23 的 `androidx.media.app.NotificationCompat.MediaStyle` 已正确，不动）。

### 验证
- 全仓 grep `android.support.v4.media` 已无残留。
- 本地 Android 构建（gradle assembleRelease）需 Android SDK + 联网拉取 androidx.media，本沙箱未配置；交由下一次 CI（推送触发 release-please.yml build-apk）或本地 `cd android && ./gradlew assembleRelease` 验证。
