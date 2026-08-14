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
    "src/pages/ProxySetup/**" = @("scripts/proxy-setup.spec.ts")
    "src/components/UniversalPlayer/**" = @("scripts/player.spec.ts", "scripts/iptv-player.spec.ts")
    "src/components/SearchBox/**" = @("scripts/browse.spec.ts")
    "src/components/RecordShell/**" = @("scripts/collections.spec.ts", "scripts/history.spec.ts")
    # 未在精粒度映射中的组件 → 跑受影响面最广的页面 spec（比静默不跑好）
    "src/components/**" = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/person.spec.ts")
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

    # ── HeroBanner（轮播/缩略图/分类切换过渡）──
    # grep 用 describe 段号（1.2 交互 + 1.3b 切换过渡）而非逐个编号：
    # 段内新增用例自动涵盖，映射无需随用例增减维护。
    # ⚠️ 段号是正则：1.2 的 "." 必须转义为 1\.2（否则 "1023px" 等含 1?2 的标题误命中）
    "src/components/HeroBanner/**" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.2|1\.3b"
    }

    # ── 首页组件 ──
    "src/components/CategoryQuickAccess/**" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.3"
    }

    # ── 全局壳（Layout/StickyHeader/SearchBox 影响所有页面首屏）──
    "src/components/Layout/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/player.spec.ts", "scripts/iptv.spec.ts", "scripts/settings.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/source-checker.spec.ts", "scripts/person.spec.ts", "scripts/cross-page.spec.ts", "scripts/regression-detail.spec.ts", "scripts/fix-2026-08.spec.ts", "scripts/ui-fixes.spec.ts")
        grep = "1\.1|1\.3b|1\.5|2\.1|3\.1|4\.1|5\.1|6\.1|7\.1|8\.1|9\.1|10\.1|13\.1|13\.12|3\.17|桌面端|移动端"
    }
    "src/components/StickyHeader/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/player.spec.ts", "scripts/iptv.spec.ts", "scripts/settings.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/source-checker.spec.ts", "scripts/person.spec.ts", "scripts/ui-fixes.spec.ts")
        grep = "1\.1|1\.5|2\.1|3\.1|4\.1|5\.1|6\.1|7\.1|8\.1|9\.1|10\.1|桌面端"
    }
    "src/components/SearchBox/**" = @{
        spec = @("scripts/browse.spec.ts", "scripts/settings.spec.ts", "scripts/iptv.spec.ts", "scripts/cross-page.spec.ts", "scripts/ui-fixes.spec.ts")
        grep = "2\.1|2\.2|6\.9|5\.9|13\.1|桌面端"
    }

    # ── 卡片模块 ──
    "src/components/VideoCard/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/person.spec.ts")
        grep = "1\.4|2\.2|2\.5|2\.6|3\.8|7\.2|7\.4|8\.2|8\.3|8\.4|8\.5|10\.4"
    }
    "src/components/LazyImage/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/detail.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/person.spec.ts", "scripts/iptv.spec.ts")
        grep = "1\.4|3\.2|7\.2|7\.4|8\.2|10\.4|5\.10"
    }

    # ── 收藏/历史共用 ──
    "src/components/RecordShell/**" = @{
        spec = @("scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/global-fixes.spec.ts")
        grep = "7\.1|7\.6|8\.1|8\.5|收藏页动画"
    }
    "src/components/StatusTabs/**" = @{
        spec = @("scripts/collections.spec.ts", "scripts/history.spec.ts")
        grep = "7\.1|8\.1"
    }

    # ── Detail ──
    "src/components/StillsLightbox/**" = @{
        spec = @("scripts/detail.spec.ts")
        grep = "3\.5|3\.6"
    }

    # ── IPTV ──
    "src/components/IPTVChannelCard/**" = @{
        spec = @("scripts/iptv.spec.ts", "scripts/global-fixes.spec.ts")
        grep = "5\.1|5\.2|5\.10|IPTV 卡片"
    }
    "src/components/EPGProgramList/**" = @{
        spec = @("scripts/iptv.spec.ts")
        grep = "5\.5|5\.9"
    }

    # ── 设置 ──
    "src/components/SourceManager/**" = @{
        spec = @("scripts/settings.spec.ts")
        grep = "6\.3|6\.4|6\.5"
    }
    "src/components/TokenRequired/**" = @{
        spec = @("scripts/settings.spec.ts")
        grep = "6\.2"
    }
    "src/components/ui/**" = @{
        spec = @("scripts/settings.spec.ts")
        grep = "6\.6"
    }
}

# ── 逻辑层：vitest 单测 + 关键服务文件联动 E2E ─────────────
# spec 含 "vitest" 标记时触发 vitest run；其余为 playwright spec。
# 服务层全局目录不在此列——匹配循环末尾对 services/stores/hooks/lib 做通用 vitest 兜底，
# 此处只放「需联动 E2E」的关键文件精确条目（顺序无关，因为无 glob 吞并）。
$logicTestMap = @{
    "src/services/tmdbService.ts" = @{
        spec = @("vitest", "scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/person.spec.ts")
        grep = "1\.1|2\.1|2\.2|3\.1|10\.1"
    }
    "src/services/videoService.ts" = @{
        spec = @("vitest", "scripts/browse.spec.ts", "scripts/player.spec.ts", "scripts/source-checker.spec.ts")
        grep = "2\.4|4\.5|9\.1"
    }
    "src/services/iptvService.ts" = @{
        spec = @("vitest", "scripts/iptv.spec.ts", "scripts/iptv-player.spec.ts")
        grep = "5\.1|5\.2|5\.5|11\.1"
    }
    "src/services/epgService.ts" = @{
        spec = @("vitest", "scripts/iptv.spec.ts")
        grep = "5\.1|5\.5|5\.9"
    }
    "src/services/channelLogo.ts" = @{
        spec = @("vitest", "scripts/iptv.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts")
        grep = "5\.10|7\.2|8\.2"
    }
    "src/services/sourceService.ts" = @{
        spec = @("vitest", "scripts/settings.spec.ts", "scripts/source-checker.spec.ts")
        grep = "6\.3|9\.1|9\.6"
    }
    "src/services/vodParser.ts" = @{
        spec = @("vitest", "scripts/player.spec.ts")
        grep = "4\.5"
    }
    "src/services/httpClient.ts" = @{
        spec = @("vitest")
        grep = ""
    }
    "src/stores/useSettingsStore.ts" = @{
        spec = @("vitest", "scripts/settings.spec.ts", "scripts/source-checker.spec.ts")
        grep = "6\.[1-9]|9\.1|9\.6"
    }
    "src/stores/useUserStore.ts" = @{
        spec = @("vitest", "scripts/collections.spec.ts", "scripts/history.spec.ts")
        grep = "7\.[1-6]|8\.[1-5]"
    }
    "src/stores/useTMDBStore.ts" = @{
        spec = @("vitest", "scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts")
        grep = "1\.1|2\.1|2\.2|3\.1"
    }
    "src/stores/useIPTVStore.ts" = @{
        spec = @("vitest", "scripts/iptv.spec.ts", "scripts/iptv-player.spec.ts")
        grep = "5\.[1-9]|11\.[1-3]"
    }
    "src/stores/usePlayerStore.ts" = @{
        spec = @("vitest", "scripts/player.spec.ts")
        grep = "4\.[1-9]|4\.10"
    }
    "src/stores/useSourceManagerStore.ts" = @{
        spec = @("vitest", "scripts/settings.spec.ts", "scripts/source-checker.spec.ts")
        grep = "6\.3|6\.4|9\.6"
    }
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
$grepPairs = @()   # @(@{spec=...; grep=...})，供段号失效检测按文件验证
$unmatchedFiles = @()
$runVitest = $false

foreach ($file in $Files) {
    $normalizedFile = $file.Replace('\', '/')
    $fileMatched = $false

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
            foreach ($t in $uiPrecisionMap[$pattern].spec) {
                $grepPairs += @{ spec = $t; grep = $uiPrecisionMap[$pattern].grep }
            }
        }
    }
    if ($precisionMatched) {
        $fileMatched = $true
        Write-Host "  [精粒度] $file → grep: $($fileGrepList -join ' | ')"
    }

    # 2) 粗粒度兜底：未命中精粒度映射的文件，按文件级匹配整个 spec
    if (-not $precisionMatched) {
        foreach ($pattern in $uiTestMap.Keys) {
            $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
            if ($normalizedFile -match $regexPattern) {
                $fileMatched = $true
                foreach ($test in $uiTestMap[$pattern]) {
                    [void]$matchedPlaywrightTests.Add($test)
                }
            }
        }
    }

    # 3) 逻辑层（统一 {spec, grep} 结构；spec 含 "vitest" 标记触发单测）
    foreach ($pattern in $logicTestMap.Keys) {
        $regexPattern = "^" + ($pattern -replace '\*', '.*') + "$"
        if ($normalizedFile -match $regexPattern) {
            $fileMatched = $true
            foreach ($test in $logicTestMap[$pattern].spec) {
                if ($test -eq "vitest") {
                    $runVitest = $true
                } else {
                    [void]$matchedPlaywrightTests.Add($test)
                }
            }
            $logicGrep = $logicTestMap[$pattern].grep
            if ($logicGrep) {
                [void]$grepPatterns.Add($logicGrep)
                foreach ($t in $logicTestMap[$pattern].spec) {
                    if ($t -ne "vitest") {
                        $grepPairs += @{ spec = $t; grep = $logicGrep }
                    }
                }
            }
        }
    }

    # 3.5) 逻辑层通用兜底：services/stores/hooks/lib 任意文件 → vitest
    if ($normalizedFile -like "src/services/*" -or $normalizedFile -like "src/stores/*" -or $normalizedFile -like "src/hooks/*" -or $normalizedFile -like "src/lib/*") {
        $runVitest = $true
    }

    # 4) 未命中任何映射 → 收集警告（防止改文件却静默不跑测试）
    if (-not $fileMatched) {
        $unmatchedFiles += $normalizedFile
    }
}

# 输出未匹配映射的变更文件（提示补充 $uiPrecisionMap）
if ($unmatchedFiles.Count -gt 0 -and -not $Grep) {
    Write-Host ""
    Write-Host "⚠️  以下变更文件未匹配到任何测试映射（本次不会跑对应测试）：" -ForegroundColor Yellow
    $unmatchedFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "  处理：补充脚本上方 $uiPrecisionMap 精粒度条目（grep 用 describe 段号），或手动 -Grep 指定段号/编号。" -ForegroundColor Yellow
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

# ── 映射失效检测：grep 段号在对应 spec 中已不存在 → 警告（映射过时，需更新）──
# 代码改动导致 describe 段被删除/重命名时，旧段号 grep 会零命中，此处提前暴露。
if ($grepPairs.Count -gt 0 -and -not $Grep) {
    $staleFound = $false
    foreach ($pair in $grepPairs) {
        if (-not (Test-Path $pair.spec)) { continue }
        $specContent = Get-Content $pair.spec -Raw -Encoding UTF8
        # 该 grep 对某 spec 可能只有部分子模式适用（如 VideoCard 在 detail 只命中 3.8）——
        # 任一子模式存在即视为该映射对该 spec 有效；全部零命中才报失效
        $anyMatch = $false
        foreach ($sub in ($pair.grep -split '\|')) {
            if ([string]::IsNullOrWhiteSpace($sub)) { continue }
            if ($specContent -match $sub) { $anyMatch = $true; break }
        }
        if (-not $anyMatch) {
            if (-not $staleFound) {
                Write-Host ""
                Write-Host "⚠️  映射失效检测：以下 grep 在对应 spec 中零命中（describe 段被删除/重命名？）：" -ForegroundColor Yellow
                $staleFound = $true
            }
            Write-Host "  $($pair.spec) → '$($pair.grep)' 零命中，映射可能过时，请更新 $uiPrecisionMap / $logicTestMap" -ForegroundColor Yellow
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
