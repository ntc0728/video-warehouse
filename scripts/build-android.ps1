# Android 一键构建脚本
# 用法: .\scripts\build-android.ps1 [-Release] [-SkipInstall]

param(
    [switch]$Release,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  影视大全 - Android 构建脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 安装依赖（可跳过）
if (-not $SkipInstall) {
    Write-Host "[1/5] 安装 npm 依赖..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm install 失败" -ForegroundColor Red
        exit 1
    }
    Pop-Location
} else {
    Write-Host "[1/5] 跳过 npm install" -ForegroundColor Yellow
}

# 2. 构建 Web 资源（CAPACITOR=true）
Write-Host "[2/5] 构建 Web 资源 (CAPACITOR=true)..." -ForegroundColor Yellow
Push-Location $ProjectRoot
$env:CAPACITOR = "true"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Web 构建失败" -ForegroundColor Red
    exit 1
}
Pop-Location

# 3. 同步到 Android 项目
Write-Host "[3/5] 同步 Capacitor 资源到 Android..." -ForegroundColor Yellow
Push-Location $ProjectRoot
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "Capacitor sync 失败" -ForegroundColor Red
    exit 1
}
Pop-Location

# 4. 构建 APK
Write-Host "[4/5] 构建 APK..." -ForegroundColor Yellow
$AndroidDir = Join-Path $ProjectRoot "android"
Push-Location $AndroidDir

if ($Release) {
    Write-Host "  构建 Release APK..." -ForegroundColor Green
    .\gradlew.bat assembleRelease
} else {
    Write-Host "  构建 Debug APK..." -ForegroundColor Green
    .\gradlew.bat assembleDebug
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Gradle 构建失败" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# 5. 输出结果
Write-Host "[5/5] 构建完成!" -ForegroundColor Green
Write-Host ""

$ApkDir = if ($Release) {
    Join-Path $AndroidDir "app\build\outputs\apk\release"
} else {
    Join-Path $AndroidDir "app\build\outputs\apk\debug"
}

if (Test-Path $ApkDir) {
    $apkFiles = Get-ChildItem -Path $ApkDir -Filter "*.apk"
    foreach ($apk in $apkFiles) {
        $sizeMB = [math]::Round($apk.Length / 1MB, 2)
        Write-Host "  APK: $($apk.FullName)" -ForegroundColor Cyan
        Write-Host "  大小: ${sizeMB} MB" -ForegroundColor Cyan
    }
} else {
    Write-Host "  APK 输出目录不存在: $ApkDir" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  构建完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
