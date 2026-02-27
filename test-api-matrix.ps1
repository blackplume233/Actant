$baseUrl = "http://localhost:3200"
$allResults = @()

function Invoke-ApiTest {
    param([string]$Method, [string]$Uri, [hashtable]$Body = $null)
    $fullUri = "$baseUrl$Uri"
    try {
        $params = @{ Uri = $fullUri; Method = $Method; UseBasicParsing = $true; ErrorAction = 'Stop' }
        if ($Body) { $params['ContentType'] = 'application/json'; $params['Body'] = ($Body | ConvertTo-Json) }
        $response = Invoke-WebRequest @params
        return @{ Status = $response.StatusCode; Body = $response.Content }
    } catch {
        $status = $null; $body = ""
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd(); $reader.Close()
        }
        return @{ Status = $status; Body = $body }
    }
}

$agents = @("mx-cc-tool-a1","mx-cc-employee-a1","mx-cc-service-a1","mx-cursor-tool-a1","mx-pi-tool-a1","mx-pi-employee-a1","mx-pi-service-a1")
Write-Host "=== 1. Basic Info Endpoints ===" -ForegroundColor Cyan
foreach ($a in $agents) {
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/logs"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/logs"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/logs -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/events"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/events"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/events -> $($r.Status)"
}
Write-Host "`n=== 2. TOOL Agents (start/stop/sessions) ===" -ForegroundColor Cyan
foreach ($a in @("mx-cc-tool-a1","mx-cursor-tool-a1","mx-pi-tool-a1")) {
    $r = Invoke-ApiTest -Method POST -Uri "/v1/agents/$a/start"
    $allResults += [PSCustomObject]@{Test="POST /v1/agents/$a/start"; Status=$r.Status; Pass=($r.Status -in 200,400,409)}
    Write-Host "POST /v1/agents/$a/start -> $($r.Status)"
    $r = Invoke-ApiTest -Method POST -Uri "/v1/agents/$a/stop"
    $allResults += [PSCustomObject]@{Test="POST /v1/agents/$a/stop"; Status=$r.Status; Pass=($r.Status -in 200,400,409)}
    Write-Host "POST /v1/agents/$a/stop -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/sessions"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/sessions"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/sessions -> $($r.Status)"
}
Write-Host "`n=== 2b. EMPLOYEE Agents (tasks/schedule/dispatch/sessions) ===" -ForegroundColor Cyan
foreach ($a in @("mx-cc-employee-a1","mx-pi-employee-a1")) {
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/tasks"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/tasks"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/tasks -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/schedule"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/schedule"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/schedule -> $($r.Status)"
    $r = Invoke-ApiTest -Method POST -Uri "/v1/agents/$a/dispatch" -Body @{prompt="test task"}
    $allResults += [PSCustomObject]@{Test="POST /v1/agents/$a/dispatch"; Status=$r.Status; Pass=($r.Status -in 200,201)}
    Write-Host "POST /v1/agents/$a/dispatch -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/sessions"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/sessions"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/sessions -> $($r.Status)"
}
Write-Host "`n=== 2c. SERVICE Agents (sessions/tasks/schedule) ===" -ForegroundColor Cyan
foreach ($a in @("mx-cc-service-a1","mx-pi-service-a1")) {
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/sessions"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/sessions"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/sessions -> $($r.Status)"
    $r = Invoke-ApiTest -Method POST -Uri "/v1/agents/$a/sessions" -Body @{name="test-session"}
    $allResults += [PSCustomObject]@{Test="POST /v1/agents/$a/sessions"; Status=$r.Status; Pass=($r.Status -in 200,201)}
    Write-Host "POST /v1/agents/$a/sessions -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/tasks"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/tasks"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/tasks -> $($r.Status)"
    $r = Invoke-ApiTest -Method GET -Uri "/v1/agents/$a/schedule"
    $allResults += [PSCustomObject]@{Test="GET /v1/agents/$a/schedule"; Status=$r.Status; Pass=($r.Status -eq 200)}
    Write-Host "GET /v1/agents/$a/schedule -> $($r.Status)"
}
Write-Host "`n=== 3. Cross-Archetype Boundary ===" -ForegroundColor Cyan
$r = Invoke-ApiTest -Method GET -Uri "/v1/agents/mx-cc-tool-a1/tasks"
$allResults += [PSCustomObject]@{Test="GET tasks on tool agent"; Status=$r.Status; Pass="boundary"}
Write-Host "GET mx-cc-tool-a1/tasks (tool) -> $($r.Status)"
$r = Invoke-ApiTest -Method POST -Uri "/v1/agents/mx-cc-service-a1/start"
$allResults += [PSCustomObject]@{Test="POST start on service agent"; Status=$r.Status; Pass="boundary"}
Write-Host "POST mx-cc-service-a1/start (service) -> $($r.Status)"
$r = Invoke-ApiTest -Method POST -Uri "/v1/agents/mx-cursor-tool-a1/start"
$allResults += [PSCustomObject]@{Test="POST start cursor (not running)"; Status=$r.Status; Pass="cursor"}
Write-Host "POST mx-cursor-tool-a1/start -> $($r.Status)"
Write-Host "`n=== 4. Lifecycle (mx-pi-tool-a1) ===" -ForegroundColor Cyan
$r = Invoke-ApiTest -Method POST -Uri "/v1/agents/mx-pi-tool-a1/stop"
$allResults += [PSCustomObject]@{Test="POST mx-pi-tool-a1/stop"; Status=$r.Status; Pass=($r.Status -eq 200)}
Write-Host "POST stop -> $($r.Status)"
Start-Sleep -Seconds 2
$r = Invoke-ApiTest -Method GET -Uri "/v1/agents/mx-pi-tool-a1"
$allResults += [PSCustomObject]@{Test="GET after stop"; Status=$r.Status; Pass=($r.Status -eq 200 -and $r.Body -match "stopped")}
Write-Host "GET after stop -> $($r.Status) body contains stopped: $($r.Body -match 'stopped')"
$r = Invoke-ApiTest -Method POST -Uri "/v1/agents/mx-pi-tool-a1/start"
$allResults += [PSCustomObject]@{Test="POST mx-pi-tool-a1/start"; Status=$r.Status; Pass=($r.Status -eq 200)}
Write-Host "POST start -> $($r.Status)"
Start-Sleep -Seconds 2
$r = Invoke-ApiTest -Method GET -Uri "/v1/agents/mx-pi-tool-a1"
$allResults += [PSCustomObject]@{Test="GET after start"; Status=$r.Status; Pass=($r.Status -eq 200 -and $r.Body -match "running")}
Write-Host "GET after start -> $($r.Status) body contains running: $($r.Body -match 'running')"
Write-Host "`n=== 5. Edge Cases ===" -ForegroundColor Cyan
$r = Invoke-ApiTest -Method GET -Uri "/v1/agents/nonexistent-agent"
$allResults += [PSCustomObject]@{Test="GET nonexistent-agent"; Status=$r.Status; Pass=($r.Status -eq 404)}
Write-Host "GET nonexistent-agent -> $($r.Status)"
$r = Invoke-ApiTest -Method POST -Uri "/v1/agents/mx-cc-tool-a1/start"
$allResults += [PSCustomObject]@{Test="POST start already-running"; Status=$r.Status; Pass=($r.Status -in 200,400,409)}
Write-Host "POST start already-running -> $($r.Status)"
$r = Invoke-ApiTest -Method DELETE -Uri "/v1/agents/mx-cc-tool-a1"
$allResults += [PSCustomObject]@{Test="DELETE running agent"; Status=$r.Status; Pass=($r.Status -in 400,405,409)}
Write-Host "DELETE running agent -> $($r.Status)"
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$allResults | Format-Table -AutoSize
