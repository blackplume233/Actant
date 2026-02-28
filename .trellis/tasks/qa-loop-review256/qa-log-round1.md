## QA Loop Round 1 Log

**Scenario**: review-256 regression loop
**Time**: 2026-02-28T15:00:00.7511746+08:00
**ACTANT_HOME**: C:\Users\black\AppData\Local\Temp\actant-qa-1330bad4

### [S1] Core type-check should pass
**Time**: 2026-02-28T15:00:01.9496126+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: PASS
Core type-check exit code=0

### [S2] Core tests should pass
**Time**: 2026-02-28T15:00:02.5778335+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: FAIL
Core tests exit code=1

### [S3] Start daemon in isolated env
**Time**: 2026-02-28T15:00:05.8470557+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: PASS
Daemon job started.

### [S4] Daemon status should be running
**Time**: 2026-02-28T15:00:06.1779182+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: FAIL
Expected output contains running with exit 0.

### [S5] Start REST API with API key
**Time**: 2026-02-28T15:00:09.3822156+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: PASS
REST API job started.

### [S6] SSE without token should be 401
**Time**: 2026-02-28T15:00:11.4579909+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: FAIL
Expected unauthorized SSE.

### [S7] SSE with token should be accepted (200)
**Time**: 2026-02-28T15:00:13.5054166+08:00

#### Input
`powershell

`"
  Add-Content -Path .trellis\tasks\qa-loop-review256\qa-log-round1.md -Value 
#### Judgment: FAIL
Expected HTTP 200 headers.

