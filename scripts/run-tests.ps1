param(
    [string[]]$Files,
    [string]$Group = "all",        # smoke, regression, all
    [int]$Retries = 2,             # 失败重试次数
    [int]$Workers = 2,             # 并行 worker 数
    [switch]$AutoDetect,           # 自动检测 git diff
    [switch]$RealApi               # 关闭 mock，使用真实 TMDB API（发版前回归）
)

# ── TMDB Mock 策略 ──────────────────────────────────────────
# 日常开发：启用 mock（默认），保护 Token 不被封禁
# 发版回归：-RealApi 开关，验证真实 API 兼容性
if ($RealApi) {
    $env:TMDB_MOCK = "false"
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ⚠️  真实 API 模式（TMDB Mock 已关闭）" -ForegroundColor Yellow
    Write-Host "  Token 将被真实调用，请确认网络正常" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
} else {
    $env:TMDB_MOCK = ""
    Write-Host "✓ TMDB Mock 已启用（默认，保护 Token）" -ForegroundColor Green
}

# UI 层：使用 playwright 测试（粗粒度）
$uiTestMap = @{
    "src/pages/Home/**" = @("scripts/home.spec.ts")
    "src/pages/Detail/**" = @("scripts/detail.spec.ts")
    "src/pages/Settings/**" = @("scripts/settings.spec.ts")
    "src/pages/Browse/**" = @("scripts/browse.spec.ts")
    "src/pages/Collections/**" = @("scripts/collections.spec.ts")
    "src/pages/History/**" = @("scripts/history.spec.ts")
    "src/pages/IPTV/**" = @("scripts/iptv.spec.ts", "scripts/iptv-player.spec.ts")
    "src/pages/Player/**" = @("scripts/player.spec.ts")
    "src/pages/SourceChecker/**" = @("scripts/source-checker.spec.ts")
    "src/pages/Person/**" = @("scripts/person.spec.ts")
    "src/components/UniversalPlayer/**" = @("scripts/player.spec.ts", "scripts/iptv-player.spec.ts")
    "src/components/SearchBox/**" = @("scripts/browse.spec.ts")
    "src/components/RecordShell/**" = @("scripts/collections.spec.ts", "scripts/history.spec.ts")
}

# 逻辑层：使用 vitest 单元测试
$logicTestMap = @{
    "src/stores/**" = @("vitest")
    "src/hooks/**" = @("vitest")
}

# 测试分组定义
$testGroups = @{
    "smoke" = @(
        "scripts/home.spec.ts",
        "scripts/browse.spec.ts",
        "scripts/player.spec.ts"
    )
    "regression" = @(
        "scripts/home.spec.ts",
        "scripts/detail.spec.ts",
        "scripts/settings.spec.ts",
        "scripts/browse.spec.ts",
        "scripts/collections.spec.ts",
        "scripts/history.spec.ts",
        "scripts/iptv.spec.ts",
        "scripts/player.spec.ts",
        "scripts/source-checker.spec.ts",
        "scripts/iptv-player.spec.ts",
        "scripts/person.spec.ts",
        "scripts/cross-page.spec.ts"
    )
}

# 自动检测 git diff 变更文件
if ($AutoDetect -or $Files.Count -eq 0) {
    Write-Host "`nAuto-detecting changed files via git diff..."
    $gitDiff = git diff --name-only HEAD~1 2>$null
    if (-not $gitDiff) {
        $gitDiff = git diff --name-only 2>$null
    }
    if (-not $gitDiff) {
        $gitDiff = git status --porcelain | ForEach-Object { $_.Substring(3) }
    }
    $Files = $gitDiff | Where-Object { $_ -like "src/*" }

    if ($Files.Count -eq 0) {
        Write-Host "No changed files detected."
        exit 0
    }
    Write-Host "Changed files:"
    $Files | ForEach-Object { Write-Host "  - $_" }
}

$matchedPlaywrightTests = [System.Collections.Generic.HashSet[string]]::new()
$runVitest = $false

foreach ($file in $Files) {
    $normalizedFile = $file.Replace('\', '/')

    # 匹配 UI 层
    foreach ($pattern in $uiTestMap.Keys) {
        $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
        if ($normalizedFile -match $regexPattern) {
            foreach ($test in $uiTestMap[$pattern]) {
                [void]$matchedPlaywrightTests.Add($test)
            }
        }
    }

    # 匹配逻辑层
    foreach ($pattern in $logicTestMap.Keys) {
        $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
        if ($normalizedFile -match $regexPattern) {
            $runVitest = $true
        }
    }
}

# 应用测试分组过滤
if ($Group -ne "all" -and $testGroups.ContainsKey($Group)) {
    $groupTests = $testGroups[$Group]
    $filteredTests = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($test in $matchedPlaywrightTests) {
        if ($test -in $groupTests) {
            [void]$filteredTests.Add($test)
        }
    }
    $matchedPlaywrightTests = $filteredTests
    Write-Host "Applied '$Group' group filter."
}

# 运行 vitest（如果有逻辑层文件变更）
if ($runVitest) {
    Write-Host "`nRunning vitest (logic layer)..."
    & npx vitest run
}

# 运行 playwright（如果有 UI 层文件变更）
if ($matchedPlaywrightTests.Count -gt 0) {
    Write-Host "`nRunning playwright tests (UI layer) with retries=${Retries}, workers=${Workers}:"
    $matchedPlaywrightTests | ForEach-Object { Write-Host "  - $_" }

    $testArgs = @()
    $testArgs += "--retries=$Retries"
    $testArgs += "--workers=$Workers"
    $testArgs += $matchedPlaywrightTests

    & npx playwright test @testArgs
}

if (-not $runVitest -and $matchedPlaywrightTests.Count -eq 0) {
    Write-Host "`nNo matching tests found for the modified files."
}
