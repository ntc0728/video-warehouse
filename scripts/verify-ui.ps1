$env:AGENT_BROWSER_SOCKET_DIR = "d:\trae\5.13\video-warehouse\.agent-browser-sockets"
Write-Host "=== Open Settings Page ==="
& agent-browser open http://localhost:3000/settings
Start-Sleep -Seconds 3
& agent-browser screenshot verify-settings.png
Write-Host ""

Write-Host "=== Take annotated screenshot ==="
& agent-browser screenshot --annotate
Write-Host ""

Write-Host "=== Done ==="
