---
date: 2026-09-16 21:30
module: ci/android
type: fix
build: 不涉及前端构建（仅 workflow）；yaml 解析校验通过
files: [.github/workflows/release-please.yml, .github/workflows/release-android.yml]
demo: none
---

# 2026-09-16 21:30 Android CI 修复 + 双 workflow 一致性补齐

## 症状（run 35065794865 / job 104695662731 日志实证）

Release Please workflow 的 `build-apk` 在 **35s** 失败，失败步 `Set up Android SDK`；后续 Gradle cache / install / build / sign / upload **全部 skipped** → tag 已建但 APK 缺失。

## 根因

`android-actions/setup-android@v4` 两处：
1. **`api-level` 已不是 v4 入参** —— 日志 `##[warning]Unexpected input(s) 'api-level', valid inputs are ['cmdline-tools-version','accept-android-sdk-licenses','log-accepted-android-sdk-licenses','packages']` → `compileSdk 34` 平台从未被安装（`action.yml` 与 `src/main.ts` 源码已核对）。
2. **v4 默认 `packages = tools platform-tools`，legacy `tools` 已被 Google 从 SDK 仓库下架** → `sdkmanager tools` → `Warning: Failed to find package 'tools'` → `Error: ... failed with exit code 1` → action throw。这才是「35s 极速失败」的来源：连 SDK 都没装完。

## 修法

两个 workflow 同一段（`release-please.yml`、`release-android.yml`）去掉 `api-level: 34`，改显式包列表：

```yaml
packages: 'platform-tools platforms;android-34 build-tools;34.0.0'
```

- 版本对齐 `android/variables.gradle` 的 `compileSdkVersion=34` + `android/build.gradle` 的 AGP 8.2.1（默认 build-tools 34.0.0）；`apksigner` 就在 build-tools 里，Sign APK 步骤依赖它。
- `packages` 入参在 action 内按**空格**切分（源码 `split(' ')` 后 trim + 过滤空串），故用空格分隔、`platforms;android-34` 作为单 token。

## 同步补齐的 3 个一致性缺口

`release-please.yml` 是注释里写明的「自动上传可靠通道」，但比 `release-android.yml` 少三处：

1. **缺 DLNA 投屏补丁** → `Add & sync Android platform` 步骤补 `./scripts/patch-android-dlna.ps1`（原该通道产出的 APK 缺 DLNA）。
2. **缺 JVM 堆参数** → `Build release APK` 由裸 `./gradlew assembleRelease` 改为带 `-Dorg.gradle.jvmargs="-Xmx3g -Xms1g -XX:MaxMetaspaceSize=1g"`（避免 R8/D8 OOM），并加注释「与 release-android.yml 保持完全一致，勿单侧修改」。
3. **Gradle cache key 恒失效** → 原 `hashFiles('package.json','android/gradle/wrapper/gradle-wrapper.properties')`：`android/` 被 `.gitignore:26` 忽略，`actions/cache` 执行时该目录**尚未由 `cap add android` 生成** → 这个 hash 恒为空，wrapper 换版本缓存不失效。改为显式常量 + lockfile：
   `key: ${{ runner.os }}-gradle-8.2.1-${{ hashFiles('package.json','pnpm-lock.yaml','capacitor.config.ts') }}`，restore-keys 保留 `-gradle-8.2.1-` 与 `-gradle-` 两级前缀（后者可复用旧 key 的部分缓存）。
   代价：首次运行缓存未命中，gradle dist + 依赖需重下（走腾讯云镜像）。

## 校验

- 用 `yaml` 解析两个 workflow：语法通过；`build-apk` 步骤数 12 / 13；`sdk.packages` 与 `build.run` 两文件完全一致；`api-level` 已无残留。
- 文件为 CRLF，编辑后无混用（实测 CRLF 计数正常、bare LF = 0）。
