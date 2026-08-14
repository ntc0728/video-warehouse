param(
    [string[]]$Files,
    [string]$Group = "all",        # smoke, regression, all
    [string]$Grep = "",            # 按测试编号前缀/关键词精准回归（透传 --grep）
    [int]$Retries = 2,             # 失败重试次数
    [int]$Workers = 2,             # 并行 worker 数
    [switch]$AutoDetect,           # 自动检测 git diff（精粒度：文件 → 相关测试编号）
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

# ── UI 层：文件 → 测试文件（粗粒度，兜底） ──────────────────
$uiTestMap = @{
    "src/pages/Home/**" = @("scripts/home.spec.ts")
    "src/pages/Detail/**" = @("scripts/detail.spec.ts", "scripts/regression-detail.spec.ts")
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

# ── UI 层：文件 → 测试编号前缀（精粒度，4 个高频改动区） ──────
# 改文件时只跑相关 describe 的测试，而非整个 spec 文件。
# grep 是正则，匹配「describe 名 + 测试标题」拼接串，用编号前缀段最精准。
# 待整改：后续扩展为「文件级 → 多层映射」（每个文件精确到测试编号）。
$uiPrecisionMap = @{
    # ── Home 页面 ──
    "src/pages/Home/index.tsx" = @{
        spec = @("scripts/home.spec.ts")
        grep = "HOME-001|HOME-002|HOME-003|HOME-004|HOME-005|HOME-010|HOME-011|HOME-012|HOME-020|HOME-021|HOME-023|HOME-024|HOME-025|HOME-026|HOME-030|HOME-031|HOME-032|HOME-035|HOME-040|HOME-041|HOME-044|HOME-045|HOME-046|HOME-050|HOME-051|HOME-052|HOME-053|HOME-054|HOME-055|HOME-056|HOME-057|HOME-058"
    }
    "src/pages/Home/Home.css" = @{
        spec = @("scripts/home.spec.ts")
        grep = "HOME-030|HOME-031|HOME-032|HOME-035|HOME-050|HOME-052|HOME-053|HOME-054|HOME-057|HOME-058"
    }
    "src/pages/Home/continueItems.ts" = @{
        spec = @("scripts/home.spec.ts")
        grep = "HOME-057|HOME-058"
    }

    # ── TMDBMovieRow ──
    "src/components/TMDBMovieRow/**" = @{
        spec = @("scripts/home.spec.ts")
        grep = "HOME-030|HOME-031|HOME-032|HOME-035|HOME-050|HOME-054|HOME-057|HOME-058"
    }

    # ── UniversalPlayer ──
    "src/components/UniversalPlayer/**" = @{
        spec = @("scripts/player.spec.ts", "scripts/iptv-player.spec.ts")
        grep = "PLAYER-|IPTVP-"
    }
    "src/components/UniversalPlayer/ControlBar/**" = @{
        spec = @("scripts/player.spec.ts")
        grep = "PLAYER-040|PLAYER-045|PLAYER-070|PLAYER-071|PLAYER-090|PLAYER-002|PLAYER-003"
    }
    "src/components/UniversalPlayer/ToastTrigger.tsx" = @{
        spec = @("scripts/player.spec.ts", "scripts/iptv-player.spec.ts")
        grep = "PLAYER-|IPTVP-"
    }
    "src/components/UniversalPlayer/hooks/usePlayerCore.ts" = @{
        spec = @("scripts/player.spec.ts", "scripts/iptv-player.spec.ts")
        grep = "PLAYER-|IPTVP-"
    }

    # ── Browse 页面 ──
    "src/pages/Browse/index.tsx" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "BROWSE-"
    }
    "src/pages/Browse/useBrowseData.ts" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "BROWSE-020|BROWSE-023|BROWSE-025|BROWSE-030|BROWSE-043|BROWSE-053|BROWSE-060"
    }
    "src/pages/Browse/BrowseMobileBar.tsx" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "BROWSE-070|BROWSE-071|BROWSE-072|BROWSE-073|BROWSE-074|BROWSE-075|BROWSE-076|BROWSE-077"
    }
    "src/pages/Browse/FilterBar/**" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "BROWSE-020|BROWSE-030|BROWSE-043|BROWSE-053|BROWSE-060|BROWSE-070|BROWSE-071"
    }
    "src/pages/Browse/SortBar/**" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "BROWSE-025|BROWSE-030|BROWSE-043|BROWSE-053|BROWSE-060"
    }
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
        "scripts/regression-detail.spec.ts",
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
# （手动 -Grep 指定编号时无需检测：直接跑分组文件 + grep 过滤）
if (-not $Grep -and ($AutoDetect -or $Files.Count -eq 0)) {
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
$grepPatterns = [System.Collections.Generic.HashSet[string]]::new()
$runVitest = $false

foreach ($file in $Files) {
    $normalizedFile = $file.Replace('\', '/')

    # 1) 精粒度匹配：文件 → 测试编号前缀（优先，只跑相关测试）
    $precisionMatched = $false
    $fileGrepList = @()
    foreach ($pattern in $uiPrecisionMap.Keys) {
        $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
        if ($normalizedFile -match $regexPattern) {
            $precisionMatched = $true
            foreach ($test in $uiPrecisionMap[$pattern].spec) {
                [void]$matchedPlaywrightTests.Add($test)
            }
            [void]$grepPatterns.Add($uiPrecisionMap[$pattern].grep)
            $fileGrepList += $uiPrecisionMap[$pattern].grep
        }
    }
    if ($precisionMatched) {
        Write-Host "  [精粒度] $file → grep: $($fileGrepList -join ' | ')"
    }

    # 2) 粗粒度兜底：未命中精粒度映射的文件，按文件级匹配整个 spec
    if (-not $precisionMatched) {
        foreach ($pattern in $uiTestMap.Keys) {
            $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
            if ($normalizedFile -match $regexPattern) {
                foreach ($test in $uiTestMap[$pattern]) {
                    [void]$matchedPlaywrightTests.Add($test)
                }
            }
        }
    }

    # 3) 逻辑层
    foreach ($pattern in $logicTestMap.Keys) {
        $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
        if ($normalizedFile -match $regexPattern) {
            $runVitest = $true
        }
    }
}

# 手动 -Grep 优先：显式覆盖（只跑指定编号/关键词）
if ($Grep) {
    Write-Host "`nManual grep: '$Grep'"
    # 手动 grep 时需要补全测试文件——若未通过 AutoDetect 匹配到文件，则跑全部分组文件
    if ($matchedPlaywrightTests.Count -eq 0) {
        $matchedPlaywrightTests = $testGroups["regression"]
    }
    $grepPatterns = [System.Collections.Generic.HashSet[string]]::new()
    [void]$grepPatterns.Add($Grep)
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
    & pnpm exec vitest run
}

# 运行 playwright（如果有 UI 层文件变更）
if ($matchedPlaywrightTests.Count -gt 0) {
    Write-Host "`nRunning playwright tests (UI layer) with retries=${Retries}, workers=${Workers}:"
    $matchedPlaywrightTests | ForEach-Object { Write-Host "  - $_" }

    $testArgs = @()
    $testArgs += "--retries=$Retries"
    $testArgs += "--workers=$Workers"
    $testArgs += $matchedPlaywrightTests

    # 附加 --grep 精准过滤
    if ($grepPatterns.Count -gt 0) {
        $grepJoined = $grepPatterns -join "|"
        $testArgs += "--grep=$grepJoined"
        Write-Host "  grep filter: '$grepJoined'"
    }

    & pnpm exec playwright test @testArgs
}

if (-not $runVitest -and $matchedPlaywrightTests.Count -eq 0) {
    Write-Host "`nNo matching tests found for the modified files."
}
