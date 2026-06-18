# App 图标和启动页生成脚本
# 用法: .\scripts\generate-icons.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  生成 App 图标和启动页" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 ImageMagick 是否安装
$magick = Get-Command magick -ErrorAction SilentlyContinue
if (-not $magick) {
    Write-Host "请先安装 ImageMagick: https://imagemagick.org/script/download.php" -ForegroundColor Red
    Write-Host "或使用在线工具生成图标" -ForegroundColor Yellow
    exit 1
}

# 图标尺寸
$iconSizes = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}

# 启动页尺寸
$splashSizes = @{
    "mdpi" = "320x480"
    "hdpi" = "480x720"
    "xhdpi" = "640x960"
    "xxhdpi" = "960x1440"
    "xxxhdpi" = "1280x1920"
}

# 源图标路径（需要用户提供或创建）
$sourceIcon = Join-Path $ProjectRoot "public\icon-source.png"

if (-not (Test-Path $sourceIcon)) {
    Write-Host "未找到源图标: $sourceIcon" -ForegroundColor Yellow
    Write-Host "请将 1024x1024 的 PNG 图标放到 public\icon-source.png" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "正在创建临时图标..." -ForegroundColor Yellow
    
    # 创建临时源图标（蓝色背景 + 白色文字）
    $tempIcon = Join-Path $env:TEMP "icon-source.png"
    & magick -size 1024x1024 xc:"#1890ff" -gravity center -pointsize 200 -fill white -annotate 0 "影视" $tempIcon
    $sourceIcon = $tempIcon
}

# 生成 Android 图标
Write-Host "生成 Android 图标..." -ForegroundColor Yellow
foreach ($size in $iconSizes.GetEnumerator()) {
    $outputDir = Join-Path $ProjectRoot "android\app\src\main\res\mipm-$($size.Key)"
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    
    $outputFile = Join-Path $outputDir "ic_launcher.png"
    & magick $sourceIcon -resize "$($size.Value)x$($size.Value)" $outputFile
    Write-Host "  $($size.Key): $($size.Value)x$($size.Value)" -ForegroundColor Green
}

# 生成圆形图标
Write-Host "生成圆形图标..." -ForegroundColor Yellow
foreach ($size in $iconSizes.GetEnumerator()) {
    $outputDir = Join-Path $ProjectRoot "android\app\src\main\res\mipm-$($size.Key)"
    $outputFile = Join-Path $outputDir "ic_launcher_round.png"
    
    # 创建圆形遮罩
    $mask = Join-Path $env:TEMP "mask-$($size.Key).png"
    & magick -size "$($size.Value)x$($size.Value)" xc:none -fill white -draw "circle $($size.Value/2),$($size.Value/2) $($size.Value/2),0" $mask
    
    & magick $sourceIcon -resize "$($size.Value)x$($size.Value)" $mask -compose CopyOpacity -composite $outputFile
    Write-Host "  round: $($size.Key)" -ForegroundColor Green
}

# 生成启动页
Write-Host "生成启动页..." -ForegroundColor Yellow
foreach ($size in $splashSizes.GetEnumerator()) {
    $outputDir = Join-Path $ProjectRoot "android\app\src\main\res\drawable-$($size.Key)"
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    
    $outputFile = Join-Path $outputDir "splash.png"
    $dimensions = $size.Value -split 'x'
    
    # 创建启动页（蓝色背景 + 居中图标）
    & magick -size $size.Value xc:"#1890ff" `
        \( $sourceIcon -resize "$([math]::Min($dimensions[0]*0.4, 200))x$([math]::Min($dimensions[0]*0.4, 200))" \) `
        -gravity center -composite $outputFile
    Write-Host "  $($size.Key): $($size.Value)" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  图标生成完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
