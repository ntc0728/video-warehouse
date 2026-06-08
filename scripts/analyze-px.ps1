$bytes = [System.IO.File]::ReadAllBytes('output/lint-stylelint-current.log')
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$lines = $text -split "`r?`n"
$nonPx = @{}
foreach ($line in $lines) {
    # 找包含 × 标记的行
    if ($line -match '×\s+(.+)$') {
        $msg = $matches[1]
        if ($msg -notmatch '"px" for property') {
            # 提取最后的 rule 名称
            if ($msg -match '\s(\S+)\s*$') {
                $rule = $matches[1]
                if (-not $nonPx.ContainsKey($rule)) { $nonPx[$rule] = 0 }
                $nonPx[$rule]++
            }
        }
    }
}
Write-Output "=== Non-px errors by rule ==="
$nonPx.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { Write-Output ("{0,4}  {1}" -f $_.Value, $_.Key) }
