$env:ACTANT_HOME = "C:\Users\black\AppData\Local\Temp\ac-qa-websearch-1207304577"
$env:ACTANT_SOCKET = "\\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qa-websearch-1207304577"
$actant = "node packages/cli/dist/bin/actant.js"

$prompts = @(
    'Search the web for: 2026 FIFA World Cup qualifiers latest results. Give a 2-3 sentence summary.'
    'Search the web for: global stock market trends February 2026. Give a 2-3 sentence summary.'
    'Search the web for: mRNA vaccine developments beyond COVID 2026. Give a 2-3 sentence summary.'
    'Search the web for: carbon capture technology breakthroughs 2026. Give a 2-3 sentence summary.'
    'Search the web for: James Webb Space Telescope latest discoveries 2026. Give a 2-3 sentence summary.'
    'Search the web for: . Give a 2-3 sentence summary.'
    '搜索网络: 2026年中国人工智能产业发展趋势。用2-3句话总结。'
    'Search the web for: What are the latest developments in artificial general intelligence research including new architectures beyond transformers novel training paradigms emergent capabilities scaling laws and safety alignment techniques being developed by major AI labs in 2026. Give a 2-3 sentence summary.'
    'Search the web for: humanoid robot progress Tesla Optimus Figure 2026. Give a 2-3 sentence summary.'
    'Search the web for: solid state battery commercialization timeline Toyota Samsung 2026. Give a 2-3 sentence summary.'
    'Search the web for: rocket launches 2026 moon missions. Give a 2-3 sentence summary.'
    'Search the web for: brain computer interface consumer products Neuralink 2026. Give a 2-3 sentence summary.'
)

$labels = @(
    'R01-sports-fifa'
    'R02-finance-stocks'
    'R03-medical-mrna'
    'R04-environment-carbon'
    'R05-space-jwst'
    'R06-boundary-empty'
    'R07-boundary-chinese'
    'R08-boundary-long'
    'R09-robotics-humanoid'
    'R10-energy-battery'
    'R11-boundary-emoji'
    'R12-bci-neuralink'
)

$results = @()
$passCount = 0
$warnCount = 0
$failCount = 0

for ($i = 0; $i -lt $prompts.Count; $i++) {
    $label = $labels[$i]
    $prompt = $prompts[$i]
    $roundNum = $i + 1

    $startTime = Get-Date
    Write-Output "=== [$label] Round $roundNum/12 start: $($startTime.ToString('HH:mm:ss')) ==="

    $maxTurns = 5
    $timeout = 120000
    if ($label -match 'boundary-empty') { $maxTurns = 3; $timeout = 60000 }

    $output = & node packages/cli/dist/bin/actant.js agent run qa-web-searcher --prompt $prompt --max-turns $maxTurns --timeout $timeout 2>&1
    $exitCode = $LASTEXITCODE
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    $outputStr = $output -join "`n"
    $isSuccess = $outputStr -match '"subtype":"success"'
    $isMaxTurns = $outputStr -match '"subtype":"error_max_turns"'
    $isTimeout = $outputStr -match '"subtype":"error_timeout"'
    $hasDenials = $outputStr -match '"permission_denials":\[{' 

    if ($isSuccess) {
        $verdict = "PASS"
        $passCount++
    } elseif ($isMaxTurns) {
        $verdict = "WARN"
        $warnCount++
    } elseif ($isTimeout) {
        $verdict = "WARN"
        $warnCount++
    } else {
        $verdict = "FAIL"
        $failCount++
    }

    if ($hasDenials) {
        $verdict = "WARN"
    }

    $costMatch = [regex]::Match($outputStr, '"total_cost_usd":([0-9.]+)')
    $cost = if ($costMatch.Success) { $costMatch.Groups[1].Value } else { "unknown" }

    $results += [PSCustomObject]@{
        Round = $roundNum
        Label = $label
        Verdict = $verdict
        Duration = [math]::Round($duration, 1)
        Cost = $cost
        Exit = $exitCode
    }

    Write-Output "  [$label] $verdict | ${duration}s | cost=$cost | exit=$exitCode"

    if ($roundNum -lt $prompts.Count) {
        Write-Output "  Waiting 60s..."
        Start-Sleep -Seconds 60
    }
}

Write-Output ""
Write-Output "=== LONG LOOP SUMMARY ==="
Write-Output "PASS: $passCount  WARN: $warnCount  FAIL: $failCount  Total: $($prompts.Count)"
Write-Output ""
$results | Format-Table -AutoSize
