# 测量开发服务器启动时间（简单版）
$startTime = Get-Date
Write-Host "开始时间: $($startTime.ToString('HH:mm:ss.fff'))" -ForegroundColor Yellow

# 启动开发服务器
Write-Host "启动开发服务器..." -ForegroundColor Cyan
$job = Start-Job -ScriptBlock {
    Set-Location "D:\trae\5.13\video-warehouse"
    pnpm run dev
}

# 等待服务器启动
$port = 3001
$timeout = 30000
$elapsed = 0
$interval = 500

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
            
            # 测试页面加载
            Write-Host "`n测试页面加载..." -ForegroundColor Cyan
            $urls = @("http://127.0.0.1:$port", "http://127.0.0.1:$port/browse")
            foreach ($url in $urls) {
                $pageStart = Get-Date
                try {
                    $pageResponse = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
                    $pageEnd = Get-Date
                    $pageDuration = ($pageEnd - $pageStart).TotalMilliseconds
                    Write-Host "$url - 加载时间: $([math]::Round($pageDuration, 0)) ms" -ForegroundColor White
                } catch {
                    Write-Host "$url - 加载失败" -ForegroundColor Red
                }
            }
            
            # 停止服务器
            Write-Host "`n停止服务器..." -ForegroundColor Yellow
            Stop-Job -Job $job
            Remove-Job -Job $job -Force
            
            $endTime = Get-Date
            $totalDuration = ($endTime - $startTime).TotalSeconds
            Write-Host "总耗时: $([math]::Round($totalDuration, 2)) 秒" -ForegroundColor White
            exit 0
        }
    } catch {
        # 继续等待
    }
    
    if ($elapsed % 2000 -eq 0) {
        Write-Host "已等待 $([math]::Round($elapsed/1000, 1)) 秒..." -ForegroundColor DarkYellow
    }
}

Write-Host "服务器在 30 秒内未启动" -ForegroundColor Red
Stop-Job -Job $job -ErrorAction SilentlyContinue
Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
exit 1