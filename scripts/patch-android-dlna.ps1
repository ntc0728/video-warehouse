# Android DLNA 投屏补丁脚本（幂等，可重复执行）
# 用法: .\scripts\patch-android-dlna.ps1 [-ProjectRoot <path>]
#
# 将 scripts/android-dlna-patch/ 下的原生代码复制进 android/（该目录被 gitignore，
# CI 靠 cap add + cap sync 重建，因此统一以本目录为唯一源），并合并 AndroidManifest 权限。
# 位置：build-android.ps1（cap sync 之后、gradle 之前）与 release-android.yml 中调用。

param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$PatchDir = Join-Path $PSScriptRoot "android-dlna-patch"
$AndroidDir = Join-Path $ProjectRoot "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Host "[patch-android-dlna] android/ 目录不存在，先运行 cap add android" -ForegroundColor Yellow
    exit 0
}

# 1. 复制 Java 源码（MainActivity + cast 包）
$JavaSrc = Join-Path $PatchDir "java"
$JavaDest = Join-Path $AndroidDir "app\src\main\java"
if (Test-Path $JavaSrc) {
    # 逐个复制顶层子项（如 com/），避免 Copy-Item 通配符在 PS5.1 下
    # 展开目录内容、拍平父层级（java\com\videowarehouse -> java\videowarehouse）的问题
    Get-ChildItem -LiteralPath $JavaSrc -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $JavaDest -Recurse -Force
    }
    Write-Host "[patch-android-dlna] Java 源码已复制: $JavaSrc -> $JavaDest" -ForegroundColor Cyan
} else {
    Write-Host "[patch-android-dlna] 未找到 $JavaSrc，跳过" -ForegroundColor Yellow
}

# 2. 合并 AndroidManifest.xml（追加 DLNA 所需权限 + usesCleartextTraffic）
$ManifestPath = Join-Path $AndroidDir "app\src\main\AndroidManifest.xml"
if (-not (Test-Path $ManifestPath)) {
    Write-Host "[patch-android-dlna] 未找到 AndroidManifest.xml，跳过" -ForegroundColor Yellow
    exit 0
}

$manifest = [System.IO.File]::ReadAllText($ManifestPath)

$permissions = @(
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_WIFI_STATE',
    'android.permission.CHANGE_WIFI_MULTICAST_STATE',
    'android.permission.NEARBY_WIFI_DEVICES'
)
$changed = $false
foreach ($perm in $permissions) {
    # $perm 已含 android.permission. 前缀，直接以全名匹配，避免前缀重复
    if ($manifest -notmatch [regex]::Escape($perm)) {
        $manifest = $manifest -replace '(?s)(</manifest>)',
            "    <uses-permission android:name=`"$perm`" />`r`n</manifest>"
        $changed = $true
    }
}

# usesCleartextTraffic：DLNA 设备发现/控制走 http（LAN 明文），需在 application 上允许
if ($manifest -notmatch 'usesCleartextTraffic') {
    $manifest = $manifest -replace '(?s)(<application\b[^>]*?)>',
        '$1 android:usesCleartextTraffic="true">'
    $changed = $true
}

if ($changed) {
    [System.IO.File]::WriteAllText($ManifestPath, $manifest)
    Write-Host "[patch-android-dlna] AndroidManifest.xml 已合并权限 + usesCleartextTraffic" -ForegroundColor Cyan
} else {
    Write-Host "[patch-android-dlna] AndroidManifest.xml 无需变更（已包含）" -ForegroundColor DarkGray
}

Write-Host "[patch-android-dlna] 完成" -ForegroundColor Green
