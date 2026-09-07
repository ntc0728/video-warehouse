# 测量开发服务器启动时间（使用 pnpm.cmd）
param(
    [int]$TimeoutSeconds = 30,
    [int]$Port = 3001
)

Write-Host "测量开发服务器启动时间..." -ForegroundColor Cyan

# 记录开始时间
$startTime = Get-Date
Write-Host "开始时间: $($startTime.ToString('HH:mm:ss.fff'))" -ForegroundColor Yellow

# 启动开发服务器（使用 pnpm.cmd）
$pnpmPath = "C:\Users\13438\AppData\Roaming\npm\pnpm.cmd"
$process = Start-Process -FilePath $pnpmPath -ArgumentList "run dev" -PassThru -NoNewWindow -WorkingDirectory "D:\trae\5.13\video-warehouse"
Write-Host "开发服务器进程已启动 (PID: $($process.Id))" -ForegroundColor Green

# 等待服务器启动
$serverReady = $false
$timeout = $TimeoutSeconds * 1000
$elapsed = 0
$interval = 500  # 每500ms检查一次

Write-Host "等待服务器启动..." -ForegroundColor Yellow

while ($elapsed -lt $timeout -and -not $serverReady) {
    Start-Sleep -Milliseconds $interval
    $elapsed += $interval
    
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            $readyTime = Get-Date
            $startupDuration = ($readyTime - $startTime).TotalSeconds
            Write-Host "服务器已启动! 响应时间: $($readyTime.ToString('HH:mm:ss.fff'))" -ForegroundColor Green
            Write-Host "启动耗时: $([math]::Round($startupDuration, 2)) 秒" -ForegroundColor Green
        }
    } catch {
        # 服务器还未启动，继续等待
    }
    
    # 显示进度
    if ($elapsed % 2000 -eq 0) {
        Write-Host "已等待 $([math]::Round($elapsed/1000, 1)) 秒..." -ForegroundColor DarkYellow
    }
}

if (-not $serverReady) {
    Write-Host "服务器在 $TimeoutSeconds 秒内未启动" -ForegroundColor Red
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# 测量首屏加载时间
Write-Host "`n测量首屏加载时间..." -ForegroundColor Cyan

# 使用 curl 测量页面加载时间
$urls = @(
    "http://127.0.0.1:$Port",
    "http://127.0.0.1:$Port/browse",
    "http://127.0.0.1:$Port/iptv"
)

foreach ($url in $urls) {
    $pageStart = Get-Date
    try {
        $pageResponse = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $pageEnd = Get-Date
        $pageDuration = ($pageEnd - $pageStart).TotalMilliseconds
        Write-Host "$url - 加载时间: $([math]::Round($pageDuration, 0)) ms" -ForegroundColor White
    } catch {
        Write-Host "$url - 加载失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 停止服务器
Write-Host "`n停止开发服务器..." -ForegroundColor Yellow
Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue

# 总结
$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalSeconds
Write-Host "`n=== 测量完成 ===" -ForegroundColor Cyan
Write-Host "总耗时: $([math]::Round($totalDuration, 2)) 秒" -ForegroundColor White
Write-Host "建议: 如果启动时间 > 10秒，需要优化 Vite 配置或减少依赖" -ForegroundColor DarkYellow