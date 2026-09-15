# check-environment probe script (Windows PowerShell) — shared/portable version
# Outputs a JSON snapshot of the current environment.
# Safe: read-only, no installs, no mutations. ~1s runtime.
#
# Portable: reads optional overrides from $HOME\.config\check-environment\config.json
# (written by setup.mjs). No hard-coded user paths. Walks up from cwd to find the
# project root (package.json + lockfile). Run from ANY directory.
$ErrorActionPreference = 'SilentlyContinue'

# Capture original encodings before we force UTF-8 for output.
$origOut = [Console]::OutputEncoding.CodePage
$origIn  = [Console]::InputEncoding.CodePage

# Force UTF-8 on output so the JSON (with any non-ASCII paths) survives capture.
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ---- optional local config overrides (from setup.mjs) ----
$cfgPath = Join-Path $HOME '.config\check-environment\config.json'
$cfg = @{}
if (Test-Path $cfgPath) {
    try { $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $cfg = @{} }
}

function Get-ToolVersion([string]$name, [string[]]$argsList) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    $v = (& $name @argsList 2>$null | Select-Object -First 1)
    if ($v -is [string] -and $v.Length -gt 120) { $v = $v.Substring(0, 120) }
    return [string]$v
}

# nodePath override from config (allows a version-managed node not on PATH).
$nodePath = $null
if ($cfg.nodePath) {
    $p = [Environment]::ExpandEnvironmentVariables($cfg.nodePath)
    if (Test-Path $p) {
        $nodePath = $p
        $env:PATH = "$(Split-Path $p);$env:PATH"
    }
}

$toolNames = @('node','npm','npx','pnpm','yarn','bun','git','rg','fd','python','py','python3','pwsh')
$tools = @{}
foreach ($t in $toolNames) {
    $cmd = Get-Command $t -ErrorAction SilentlyContinue
    $tools[$t] = @{
        found   = [bool]$cmd
        path    = if ($cmd) { $cmd.Source } else { $null }
        version = if ($cmd) { Get-ToolVersion $t @('--version') } else { $null }
    }
}
if ($nodePath) { $tools['node'].path = $nodePath }

# Python 3 without launcher quirk: 'py --version' writes to stderr in some setups.
if ($tools['python'].found -and -not $tools['python'].version) {
    $tools['python'].version = Get-ToolVersion 'python' @('-V')
}
if ($tools['py'].found -and -not $tools['py'].version) {
    $tools['py'].version = Get-ToolVersion 'py' @('-3','--version')
}

$shellKind = 'unknown'
if ($PSVersionTable.PSEdition -eq 'Desktop') { $shellKind = 'powershell5.1' }
elseif ($PSVersionTable.PSEdition -eq 'Core') { $shellKind = 'powershell7' }
else { $shellKind = "ps-$($PSVersionTable.PSVersion.ToString())" }

# npm registry (config may be per-user or per-project). Honor config override.
$npmRegistry = $null
if ($cfg.npmRegistry) {
    $npmRegistry = $cfg.npmRegistry
} else {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) { $npmRegistry = (& npm config get registry 2>$null | Select-Object -First 1) }
}

# git-bash availability (for cross-shell command choice).
$gitBash = $null
foreach ($p in @('C:\Program Files\Git\bin\bash.exe','C:\Program Files (x86)\Git\bin\bash.exe')) {
    if (Test-Path $p) { $gitBash = $p; break }
}
$bashOrSh = $null
if (Test-Path '/usr/bin/bash') { $bashOrSh = '/usr/bin/bash' }
elseif (Test-Path '/bin/sh') { $bashOrSh = '/bin/sh' }
elseif ($gitBash) { $bashOrSh = $gitBash }

# Project signals: which lockfile pins the package manager.
# Walk UP from cwd until we find a package.json (the project root).
$probeCwd = (Get-Location).Path
$lockfile = $null
$packageJson = $false
$candidates = @('pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lockb','bun.lock')
$dir = $probeCwd
for ($depth = 0; $depth -lt 6; $depth++) {
    if (Test-Path (Join-Path $dir 'package.json')) {
        $packageJson = $true
        $probeCwd = $dir
        foreach ($lf in $candidates) {
            if (Test-Path (Join-Path $dir $lf)) { $lockfile = $lf; break }
        }
        break
    }
    $parent = Split-Path $dir -Parent
    if (-not $parent -or $parent -eq $dir) { break }
    $dir = $parent
}

$snapshot = @{
    timestamp   = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    os          = 'win32'
    platform    = [System.Environment]::OSVersion.Platform.ToString()
    shell       = $shellKind
    psVersion   = $PSVersionTable.PSVersion.ToString()
    encoding    = @{
        originalOutputCodePage = $origOut
        originalInputCodePage  = $origIn
        forcedUtf8             = $true
        locale                 = (Get-Culture).Name
    }
    tools       = $tools
    npmRegistry = $npmRegistry
    gitBash     = $gitBash
    bashOrSh    = $bashOrSh
    config      = @{
        file   = $cfgPath
        loaded = [bool](Test-Path $cfgPath)
    }
    project     = @{
        cwd        = $probeCwd
        hasPackage = $packageJson
        lockfile   = $lockfile
    }
}

$snapshot | ConvertTo-Json -Depth 6