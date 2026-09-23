param(
    [string[]]$Files,
    [string]$Group = "all",        # smoke, regression, all
    [string]$Grep = "",            # 按测试编号前缀/关键词精准回归（透传 --grep）
    [string]$Since = "",           # 自动侦测的比较基准（如 HEAD~1）；留空 = 只看「未提交改动」
    [int]$Retries = 0,             # 失败重试次数（默认 0 诊断档；回归档显式 -Retries 2）
    [int]$Workers = 2,             # 并行 worker 数
    [int]$Budget = 0,              # 单轮墙钟预算（秒）；0 = 按档位取默认（增量 180 / -Full 1200）
    [switch]$AutoDetect,           # 自动检测改动文件（精粒度：文件 → 相关测试编号）
    [switch]$Full,                 # 放开「单轮 spec 数上限 3」护栏（回归档显式声明）
    [switch]$RealApi               # 关闭 mock，使用真实 TMDB API（发版前回归）
)

# ── 子进程输出编码（2026-09-23）──────────────────────────────
# 本脚本把 node / playwright 的输出透传到自己的 stdout。Windows 默认控制台代码页是 GBK，
# PowerShell 会用它解码子进程的 UTF-8 字节 → 中文诊断全变乱码（实测「跑批开始」→「璺戞壒寮€濮�」）。
# 统一按 UTF-8 处理，否则跑批器打印的预算/收尾信息在日志里不可读。
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # 某些宿主不允许改编码：保持默认，不影响功能
}

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
# 生效条件（2026-09-23 明确）：**仅当该文件未命中 $uiPrecisionMap 任何条目时**才走本表。
# 也就是说「同一 pattern 在两处都出现」时，精粒度那条会覆盖本表 —— 本表真正在服务的是
# 精粒度未逐一列出的边角文件（如 `src/pages/Browse/useLogicalPage.ts`、`BrowseGrid.tsx`）。
$uiTestMap = @{
    "src/pages/Home/**" = @("scripts/home.spec.ts")
    "src/pages/Detail/**" = @("scripts/detail.spec.ts", "scripts/regression.spec.ts")
    "src/pages/Settings/**" = @("scripts/settings.spec.ts")
    "src/pages/Browse/**" = @("scripts/browse.spec.ts")
    "src/pages/Collections/**" = @("scripts/collections.spec.ts")
    "src/pages/History/**" = @("scripts/history.spec.ts")
    "src/pages/IPTV/**" = @("scripts/iptv.spec.ts", "scripts/iptv-player.spec.ts")
    "src/pages/Player/**" = @("scripts/player.spec.ts")
    "src/pages/SourceChecker/**" = @("scripts/source-checker.spec.ts")
    "src/pages/Person/**" = @("scripts/person.spec.ts")
    "src/pages/Chart/**" = @("scripts/chart.spec.ts")
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
    # ── 启动骨架（index.html 内联脚本） ──
    "index.html" = @{
        spec = @("scripts/boot-splash.spec.ts")
    }

    # ── Home 页面 ──
    # grep 用 describe 段号（1.3 子串覆盖 1.3b/c/d/e；首页激进合并后旧 HOME-0xx 前缀已死）
    "src/pages/Home/index.tsx" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.1|1\.2|1\.3|1\.4|1\.5|1\.7"
    }
    "src/pages/Home/Home.css" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.[1-7]"
    }

    # ── TMDBMovieRow ──
    "src/components/TMDBMovieRow/**" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.4"
    }

    # ── UniversalPlayer ──
    "src/components/UniversalPlayer/**" = @{
        spec = @("scripts/player.spec.ts", "scripts/iptv-player.spec.ts")
        grep = "PLAYER-|IPTVP-"
    }
    "src/components/UniversalPlayer/ControlBar/**" = @{
        spec = @("scripts/player.spec.ts")
        grep = "4\.1[^0-9]|4\.5|4\.8"
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
        # 2026-09-23 校准：原写 BROWSE-020|BROWSE-023|BROWSE-025|…，其中 023/025 已并入
        # BROWSE-020 的合并标题（`BROWSE-020/023/025: …`）→ 单独写成 BROWSE-023 永远不命中。
        # 保留的 020 已覆盖那两条。新增片段请先用 `npm run test:count` 验证命中数 > 0。
        grep = "BROWSE-020|BROWSE-030|BROWSE-060"
    }
    "src/pages/Browse/BrowseMobileBar.tsx" = @{
        spec = @("scripts/browse.spec.ts")
        # 2026-09-23 校准：原逐个列 BROWSE-070|071|072|074|077|078|079|080|081|082，
        # 但 spec 侧是合并标题（`BROWSE-070/071/072/074/078/080: …`）→ 只有段首编号能命中。
        # 改为「命中真实存在的 3 个段首」，语义等价、且段内新增用例自动涵盖（grep 用段号更稳）。
        grep = "BROWSE-070|BROWSE-077|BROWSE-081"
    }
    # FilterBar / SortBar（2026-09-23 校准）
    #   原 key 写作 `src/pages/Browse/FilterBar/**` 与 `src/pages/Browse/SortBar/**`，
    #   但这两个目录**早已不存在**（FilterBar 迁到 `src/components/FilterBar/`，排序 UI 是同目录
    #   `constants.ts` 的 SORT_OPTIONS，没有独立 SortBar）→ 映射永不命中 = 改筛选条时静默不跑测试。
    #   现在指向真实路径；SortBar 条目删除（其唯一活着的片段 BROWSE-030 已含在下面）。
    "src/components/FilterBar/**" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "BROWSE-020|BROWSE-030|BROWSE-060|BROWSE-070"
    }

    # ── 通用全屏抽屉（footer 插槽 / 层级 token）──
    # 注：uiPrecisionMap 的匹配是「全部命中即累积」而非首个命中即停，
    # 因此改 ui/Drawer* 也会连带命中下面的 "src/components/ui/**"（settings 6.6），属已知的
    # 轻微过度覆盖，换取不必为排除它而给匹配循环加特例。
    "src/components/ui/Drawer.tsx" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "2\.8|2\.9"
    }
    "src/components/ui/Drawer.css" = @{
        spec = @("scripts/browse.spec.ts")
        grep = "2\.8|2\.9"
    }

    # ── HeroBanner（轮播/缩略图/分类切换过渡 + 宽屏 HeroBili 卡）──
    # grep 用 describe 段号（1.2 交互 + 1.3b 切换过渡 + 1.3d HeroBili 卡）而非逐个编号：
    # 段内新增用例自动涵盖，映射无需随用例增减维护。
    # ⚠️ 段号是正则：1.2 的 "." 必须转义为 1\.2（否则 "1023px" 等含 1?2 的标题误命中）
    "src/components/HeroBanner/**" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.2|1\.3b|1\.3d|1\.3e"
    }

    # ── 首页组件 ──
    "src/components/CategoryQuickAccess/**" = @{
        spec = @("scripts/home.spec.ts")
        grep = "1\.3"
    }

    # ── 全局壳（Layout/StickyHeader/SearchBox 影响所有页面首屏）──
    "src/components/Layout/**" = @{
        # spec 列表：一个页面一个「首屏用例」所在的 spec（cross-tab 与 regression 各一条壳层断言）。
        # 2026-09-23 校准：原先 `scripts/regression.spec.ts` 被写了 3 遍（历史遗留：cross-page /
        # regression-detail / fix-2026-08 三个 spec 合并成 1 个后没收敛），HashSet 会去重所以行为
        # 无碍，但读起来像三份不同目标 → 收敛为 1 份。
        spec = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/player.spec.ts", "scripts/iptv.spec.ts", "scripts/settings.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/source-checker.spec.ts", "scripts/person.spec.ts", "scripts/cross-tab.spec.ts", "scripts/regression.spec.ts")
        # 2026-09-23 校准：删掉零命中的 `13\.1|13\.12|3\.17`（旧编号，随合并消失）。
        grep = "1\.1|1\.3b|1\.5|2\.1|3\.1|4\.1|5\.1|6\.1|7\.1|8\.1|9\.1|10\.1|桌面端|移动端"
    }
    "src/components/StickyHeader/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/player.spec.ts", "scripts/iptv.spec.ts", "scripts/settings.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/source-checker.spec.ts", "scripts/person.spec.ts", "scripts/regression.spec.ts")
        grep = "1\.1|1\.5|2\.1|3\.1|4\.1|5\.1|6\.1|7\.1|8\.1|9\.1|10\.1|桌面端"
    }
    "src/components/SearchBox/**" = @{
        spec = @("scripts/browse.spec.ts", "scripts/settings.spec.ts", "scripts/iptv.spec.ts", "scripts/cross-tab.spec.ts", "scripts/regression.spec.ts")
        # 2026-09-23 校准：删掉零命中的 `5\.9`（iptv.spec 无该段）。
        grep = "2\.1|2\.2|6\.9|跨页联动回归|桌面端"
    }

    # ── 卡片模块 ──
    "src/components/VideoCard/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/browse.spec.ts", "scripts/detail.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/person.spec.ts")
        # 2026-09-23 校准：删掉零命中的 `2\.5|2\.6`（browse.spec 无该段）。
        grep = "1\.4|2\.2|3\.8|7\.2|7\.4|8\.2|8\.3|8\.4|8\.5|10\.4"
    }
    "src/components/LazyImage/**" = @{
        spec = @("scripts/home.spec.ts", "scripts/detail.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/person.spec.ts", "scripts/iptv.spec.ts")
        grep = "1\.4|3\.2|7\.2|7\.4|8\.2|10\.4|5\.10"
    }

    # ── 收藏/历史共用 ──
    "src/components/RecordShell/**" = @{
        spec = @("scripts/collections.spec.ts", "scripts/history.spec.ts", "scripts/regression.spec.ts")
        # 2026-09-23 校准：删掉零命中的 `7\.6`（collections.spec 只有 7.1/7.2/7.4）与
        # `收藏页动画`（该 describe 名已不存在）。
        grep = "7\.1|8\.1|8\.5"
    }
    "src/components/StatusTabs/**" = @{
        spec = @("scripts/collections.spec.ts", "scripts/history.spec.ts")
        grep = "7\.1|8\.1"
    }

    # ── Detail ──
    "src/components/StillsLightbox/**" = @{
        spec = @("scripts/detail.spec.ts")
        grep = "3\.5|3\.6|3\.11"
    }

    # ── IPTV ──
    "src/components/IPTVChannelCard/**" = @{
        spec = @("scripts/iptv.spec.ts", "scripts/regression.spec.ts")
        # 2026-09-23 校准：删掉零命中的 `IPTV 卡片`（该 describe 名已不存在）。
        grep = "5\.1|5\.2|5\.10|5\.11"
    }
    "src/components/EPGProgramList/**" = @{
        spec = @("scripts/iptv.spec.ts")
        # 2026-09-23 校准：删掉零命中的 `5\.9`（iptv.spec 无该段）。
        # ⚠️ 已知缺口：EPG 的渲染用例主要在 `scripts/iptv-player.spec.ts` 的 `11.5 EPG 节目单`，
        #    本条目未包含它（旧文档曾声称包含）→ 需要时显式 `-Files` + `-Grep 11\.5` 补跑。
        grep = "5\.5"
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
        # 2026-09-23 校准：删掉零命中的 `5\.9`。
        # ⚠️ 已知缺口：`scripts/iptv-player.spec.ts` 的 `11.5 EPG 节目单`（渲染侧）未纳入
        #    （旧文档曾声称含 iptv-player）→ 需要时显式 `-Files` + `-Grep 11\.5` 补跑。
        grep = "5\.1|5\.5"
    }
    "src/services/channelLogo.ts" = @{
        spec = @("vitest", "scripts/iptv.spec.ts", "scripts/collections.spec.ts", "scripts/history.spec.ts")
        grep = "5\.10|5\.11|7\.2|8\.2"
    }
    "src/services/castService.ts" = @{
        spec = @("vitest", "scripts/player.spec.ts")
        grep = "4\.13"
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
        # 2026-09-23 校准：删掉零命中的 `4\.10`（4.10 段从未存在）。
        # 注：`4\.[1-9]` 是**子串**匹配，天然覆盖 4.10~4.19 的两位编号（"4.10" 含 "4.1"），
        #     所以 4.11/4.12/4.13/4.14 这些段其实已经被覆盖，无需再单独列。
        grep = "4\.[1-9]"
    }
    "src/stores/useSourceManagerStore.ts" = @{
        spec = @("vitest", "scripts/settings.spec.ts", "scripts/source-checker.spec.ts")
        grep = "6\.3|6\.4|9\.6"
    }
    # continue 行数据纯函数：单测 continueItems.test.ts，无独立 E2E 段
    "src/pages/Home/continueItems.ts" = @{
        spec = @("vitest")
        grep = ""
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
        "scripts/regression.spec.ts",
        "scripts/settings.spec.ts",
        "scripts/browse.spec.ts",
        "scripts/collections.spec.ts",
        "scripts/history.spec.ts",
        "scripts/iptv.spec.ts",
        "scripts/player.spec.ts",
        "scripts/source-checker.spec.ts",
        "scripts/iptv-player.spec.ts",
        "scripts/person.spec.ts",
        "scripts/cross-tab.spec.ts"
    )
}

# 自动检测改动文件
# （手动 -Grep 指定编号时无需检测：直接跑分组文件 + grep 过滤）
#
# 语义（2026-09-23 改）：**留空 $Since = 「未提交改动」**（工作树 + 暂存区 + 未跟踪）。
#   旧版用 `git diff --name-only HEAD~1`，比的是「上一个提交 ↔ 工作树」——
#   HEAD 本身含 src 改动（或刚 pull 完）时**工作树干净也会命中一大批文件**，
#   叠加全局壳映射（Layout/StickyHeader 各挂 11–13 个 spec）→ 无感受地跑全量回归（实测单轮 828s）。
#   需要「相对某 ref 的改动」时显式传 -Since（如 -Since HEAD~1 / -Since origin/master）。
$autoDetected = $false
# 显式分组档（-Group <name>，且未显式 -AutoDetect / -Grep / -Files）**不侦测改动**：
# 它是「按组跑固定 spec 集合」的语义（test:regression），与「改了什么就跑什么」相反。
# 2026-09-23 修补：此前 -Group regression 无参时会落入下面的侦测分支，工作树无 src 改动就直接
# `exit 0` → 发版回归档静默什么都不跑（旧版靠 HEAD~1 的错误侦测"歪打正着"才有东西可跑）。
if (-not $AutoDetect -and $Group -ne "all" -and $Files.Count -eq 0 -and -not $Grep) {
    Write-Host "`nExplicit group '$Group' → 跳过改动侦测，直接跑该组 spec"
} elseif (-not $Grep -and ($AutoDetect -or $Files.Count -eq 0)) {
    $autoDetected = $true
    if ($Since) {
        Write-Host "`nAuto-detecting changed files via: git diff --name-only $Since"
        $gitDiff = @(git diff --name-only $Since 2>$null)
    } else {
        Write-Host "`nAuto-detecting changed files (未提交改动：工作树 + 暂存 + 未跟踪)..."
        $gitDiff = @()
        $gitDiff += @(git diff --name-only 2>$null)
        $gitDiff += @(git diff --name-only --cached 2>$null)
        $gitDiff += @(git ls-files --others --exclude-standard 2>$null)
        $gitDiff = @($gitDiff | Where-Object { $_ } | Sort-Object -Unique)
    }
    $Files = @($gitDiff | Where-Object { $_ -like "src/*" })

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

# ── 显式分组档：直接加载该组 spec（不做改动映射）────────────────────────────
# 触发条件：-Group <已知组名> + 未显式 -AutoDetect / -Grep / -Files（即上面的分支已跳过侦测）。
# 后续 478 行的组过滤对同一集合求交 → 结果不变，语义保持一致。
if ($Group -ne "all" -and $testGroups.ContainsKey($Group) -and $matchedPlaywrightTests.Count -eq 0 -and -not $Grep -and -not $AutoDetect -and $Files.Count -eq 0) {
    $testGroups[$Group] | ForEach-Object { [void]$matchedPlaywrightTests.Add($_) }
    Write-Host "  specs ($($matchedPlaywrightTests.Count)):"
    $matchedPlaywrightTests | Sort-Object | ForEach-Object { Write-Host "    - $_" }
}

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
#
# ⚠️ 本检测是「整条 grep 在某个 spec 上全零命中才报」的**宽松**口径（见下方 $anyMatch）：
#    它抓不到「一条 grep 里只有个别 `|` 片段失效」的情况——例如
#    `grep = "BROWSE-020|BROWSE-023|BROWSE-025"` 里 023/025 早已随合并标题失效，
#    但只要 020 还能命中，这里就不报警（2026-09-23 实测确实发生过，且静默了很久）。
#    **逐片段**的死 grep 检测由 `npm run test:count`（scripts/test-count-report.mjs --check）
#    负责，并已挂进 `npm run lint:all` 第 7 门；改映射后请跑它。两处互补，别只依赖这里。
if ($grepPairs.Count -gt 0 -and -not $Grep) {
    $staleFound = $false
    foreach ($pair in $grepPairs) {
        if (-not (Test-Path $pair.spec)) { continue }
        if ([string]::IsNullOrWhiteSpace($pair.grep)) { continue }
        $specContent = Get-Content $pair.spec -Raw -Encoding UTF8
        # 剥离块注释与行注释后再匹配：旧编号常残留在头注释/行内注释里造成假阳性
        # （如 home.spec 头注释 "HOME-001~005" 曾让已死的 HOME-001 映射误判为有效）
        $specContent = [regex]::Replace($specContent, '(?s)/\*.*?\*/', '')
        $specContent = [regex]::Replace($specContent, '(?m)//.*$', '')
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

# ── 护栏：自动侦测命中过多 spec 时停手，不静默跑全量回归（2026-09-23）──
# 全局壳映射（Layout/StickyHeader 各挂 11–13 个 spec）会让「只改一行壳层」退化成全量回归，
# 叠加重试即单轮 828s（2026-09-22 实测）。这里在**真正调 playwright 之前**拦下。
# 仅约束「自动侦测」路径；显式 -Files / -Grep 是使用者自己的意图，不受限。
$SpecCap = 3
if ($autoDetected -and -not $Full -and $matchedPlaywrightTests.Count -gt $SpecCap) {
    Write-Host ""
    Write-Host "⚠️  自动侦测命中 $($matchedPlaywrightTests.Count) 个 spec（上限 $SpecCap）→ 已停手，未执行任何测试。" -ForegroundColor Yellow
    $matchedPlaywrightTests | Sort-Object | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "  要跑全量回归：加 -Full（或 npm run test:regression）" -ForegroundColor Yellow
    Write-Host "  要跑精粒度：-Files <path> / -Grep <段号>（改壳层文件时建议按段号收窄）" -ForegroundColor Yellow
    exit 2
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

    # ── 自建 server + 封顶 + 收尾（2026-09-23）─────────────────────────────
    # 不再把 playwright 直接交给 config 的 webServer：其 command 是**字符串**，Windows 下由
    # shell 启动 → 收尾只杀到 shell、vite 成孤儿继续占端口，playwright 等不到 webServer 关闭。
    # 2026-09-23 实测症状：用例与 globalTeardown 早已跑完，进程 632s 不返回，残留
    # `node scripts/e2e-vite-server.cjs --port <n>`（只剩 globalTimeout 30min 兜底）。
    # 改委派给 scripts/e2e-skeleton.mjs —— 本仓唯一已实现「动态端口 + HTTP 200 探活 +
    # 预算封顶 + 进程树收尾」的单轮跑批器（e2e-suite.mjs 也走它，行为已验证）：
    #   · --dev：增量档测源码态（不要求 dist 是最新构建；与旧路径同为 dev server）
    #   · 到点 SIGKILL 整轮、退码 2 → 彻底消除「无限期挂住」
    #   · 收尾 taskkill /T（整棵进程树）+ 只杀带测试标记的浏览器，绝不按端口乱杀
    #   · 因 E2E_PORT 指向已探活的自建 server，config 的 reuseExistingServer 直接命中
    #     → playwright **不会**再起第二个 server（这才是孤儿消失的根因）
    $budgetSec = if ($Budget -gt 0) { $Budget } elseif ($Full) { 1200 } else { 180 }
    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeExe) {
        Write-Host "✗ PATH 中找不到 node，无法启动 E2E 跑批器" -ForegroundColor Red
        exit 1
    }

    $runnerArgs = @(
        "scripts/e2e-skeleton.mjs", "--dev",
        "--workers", "$Workers", "--retries", "$Retries",
        "--budget", "$budgetSec"
    )
    # -Full（回归档）用套件级超时口径：单测 45s / 整轮 20min
    if ($Full) { $runnerArgs += @("--test-timeout", "45000", "--global-timeout", "1200000") }
    $runnerArgs += @($matchedPlaywrightTests)
    # 附加 --grep 精准过滤（透传给 playwright，写法同 -g）
    if ($grepPatterns.Count -gt 0) {
        $grepJoined = $grepPatterns -join "|"
        $runnerArgs += @("-g", $grepJoined)
        Write-Host "  grep filter: '$grepJoined'"
    }
    Write-Host "  预算 ${budgetSec}s（到点强制击杀并退码 2；可用 -Budget <秒> 覆盖）"

    # 绕过沙箱 delete-shim：清空注入的 NODE_OPTIONS（否则清理 outputDir 时 trash 失败假崩）
    $env:NODE_OPTIONS = ""
    & $nodeExe @runnerArgs
    # 透传退出码：否则失败用例仍 exit 0，调用方无法感知（2026-09-22 修复）
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($runVitest) {
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $runVitest -and $matchedPlaywrightTests.Count -eq 0) {
    Write-Host "`nNo matching tests found for the modified files."
}
