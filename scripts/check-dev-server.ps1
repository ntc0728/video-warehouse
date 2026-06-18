# Dev Server Status Check Script
param([int]$DefaultPort = 3001)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Dev Server Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ports = @(3000, 3001, 4000, 5000, 5173, 5174, 8000, 8080, 8888, 9000)
$found = $false

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        $procName = if ($proc) { $proc.ProcessName } else { "unknown" }
        $procId = if ($proc) { $proc.Id } else { $conn.OwningProcess }

        $marker = if ($port -eq $DefaultPort) { "  [Primary]" } else { "  " }
        Write-Host "$marker [Running] " -NoNewline -ForegroundColor Green
        Write-Host "http://localhost:$port" -NoNewline -ForegroundColor White
        Write-Host " ($procName, PID: $procId)" -ForegroundColor Gray
        $found = $true
    }
}

if (-not $found) {
    Write-Host "  [No dev server running]" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
