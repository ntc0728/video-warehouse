# 测量 Vite 首次 optimizeDeps 时间
$ErrorActionPreference = "Stop"

# 清除 Vite 缓存
$viteCache = "D:\trae\5.13\video-warehouse\node_modules\.vite"
if (Test-Path $viteCache) {
    Write-Host "清除 Vite 缓存..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $viteCache
    Write-Host "缓存已清除" -ForegroundColor Green
}

# 记录开始时间
$startTime = Get-Date
Write-Host "开始时间: $($startTime.ToString('HH:mm:ss.fff'))" -ForegroundColor Cyan

# 启动开发服务器并测量时间
Write-Host "启动开发服务器 (首次 optimizeDeps)..." -ForegroundColor Cyan

# 使用 Start-Process 启动 pnpm，并捕获输出
$process = Start-Process -FilePath "pnpm" -ArgumentList "run dev" -PassThru -NoNewWindow -RedirectStandardOutput "D:\trae\5.13\video-warehouse\dev-output.log" -RedirectStandardError "D:\trae\5.13\video-warehouse\dev-error.log" -WorkingDirectory "D:\trae\5.13\video-warehouse"

Write-Host "进程 PID: $($process.Id)" -ForegroundColor Green

# 等待服务器启动
$port = 3001
$timeout = 120000  # 2分钟超时
$elapsed = 0
$interval = 1000

Write-Host "等待服务器启动 (端口: $port)..." -ForegroundColor Yellow

while ($elapsed -lt $timeout) {
    Start-Sleep -Milliseconds $interval
    $elapsed += $interval
    
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $readyTime = Get-Date
            $startupDuration = ($readyTime - $startTime).TotalSeconds
            Write-Host "服务器已启动! 响应时间: $($readyTime.ToString('HH:mm:ss.fff'))" -ForegroundColor Green
            Write-Host "启动耗时: $([math]::Round($startupDuration, 2)) 秒" -ForegroundColor Green
            
            # 读取日志查看 optimizeDeps 信息
            Write-Host "`n=== 开发服务器日志 ===" -ForegroundColor Cyan
            if (Test-Path "D:\trae\5.13\video-warehouse\dev-output.log") {
                $logs = Get-Content "D:\trae\5.13\video-warehouse\dev-output.log" -Tail 50
                Write-Host $logs -ForegroundColor Gray
            }
            
            # 停止服务器
            Write-Host "`n停止服务器..." -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            
            # 总结
            $endTime = Get-Date
            $totalDuration = ($endTime - $startTime).TotalSeconds
            Write-Host "`n=== 测量完成 ===" -ForegroundColor Cyan
            Write-Host "总耗时: $([math]::Round($totalDuration, 2)) 秒" -ForegroundColor White
            
            if ($startupDuration -gt 30) {
                Write-Host "警告: 首次启动超过30秒，optimizeDeps 预打包是主要瓶颈" -ForegroundColor Red
            }
            
            exit 0
        }
    } catch {
        # 继续等待
    }
    
    if ($elapsed % 5000 -eq 0) {
        Write-Host "已等待 $([math]::Round($elapsed/1000, 1)) 秒..." -ForegroundColor DarkYellow
    }
}

Write-Host "服务器在 120 秒内未启动" -ForegroundColor Red
Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
exit 1