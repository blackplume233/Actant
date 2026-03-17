## QA Incremental Log

**Task**: cli-hub-bootstrap  
**Round**: 3  
**Started**: 2026-03-17T12:00:00+08:00

### [Step 1] Global actant version
**Time**: 2026-03-17T12:00:05+08:00

#### Input
```powershell
actant --version
```

#### Output
```text
exit_code: 0

--- stdout ---
0.3.0

--- stderr ---
(empty)
```

#### Judgment: PASS
Global install chain exposes `actant` correctly.

### [Step 2] Global acthub version
**Time**: 2026-03-17T12:00:06+08:00

#### Input
```powershell
acthub --version
```

#### Output
```text
exit_code: 0

--- stdout ---
0.3.0

--- stderr ---
(empty)
```

#### Judgment: PASS
Alias binary is installed and resolves to the same released CLI version.

### [Step 3] First hub bootstrap
**Time**: 2026-03-17T12:00:12+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
actant hub status
```

#### Output
```text
exit_code: 0

--- stdout ---
Host Profile: bootstrap
Runtime:      inactive
Project:      Actant
Root:         G:\Workspace\AgentWorkSpace\AgentCraft
Config:       G:\Workspace\AgentWorkSpace\AgentCraft\actant.project.json
Workspace:    /hub/workspace

--- stderr ---
(empty)
```

#### Judgment: PASS
First `hub` invocation auto-started a bootstrap host and mounted the current project without enabling runtime side effects.

### [Step 4] hub status JSON contract
**Time**: 2026-03-17T12:00:14+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
actant hub status --format json
```

#### Output
```text
exit_code: 0

--- stdout ---
{
  "daemonStarted": false,
  "active": true,
  "hostProfile": "bootstrap",
  "runtimeState": "inactive",
  "projectRoot": "G:\\Workspace\\AgentWorkSpace\\AgentCraft",
  "projectName": "Actant",
  "configPath": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\actant.project.json",
  "configsDir": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs",
  "sourceWarnings": [],
  "components": {
    "skills": 3,
    "prompts": 1,
    "mcpServers": 1,
    "workflows": 1,
    "templates": 1
  },
  "mounts": {
    "project": "/hub/project",
    "workspace": "/hub/workspace",
    "config": "/hub/config",
    "skills": "/hub/skills",
    "prompts": "/hub/prompts",
    "mcp": "/hub/mcp",
    "workflows": "/hub/workflows",
    "templates": "/hub/templates"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
`hub.status` returns the expected bootstrap profile, inactive runtime, and `/hub/...` mount layout.

### [Step 5] daemon status JSON contract
**Time**: 2026-03-17T12:00:15+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
actant daemon status --format json
```

#### Output
```text
exit_code: 0

--- stdout ---
{
  "running": true,
  "version": "0.3.0",
  "uptime": 30,
  "agents": 0,
  "hostProfile": "bootstrap",
  "runtimeState": "inactive",
  "capabilities": [
    "hub",
    "vfs",
    "domain"
  ],
  "hubProject": {
    "projectRoot": "G:\\Workspace\\AgentWorkSpace\\AgentCraft",
    "projectName": "Actant",
    "configPath": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\actant.project.json"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
`daemon.ping` now exposes `hostProfile`, `runtimeState`, `capabilities`, and `hubProject` as intended.

### [Step 6] acthub alias behavior
**Time**: 2026-03-17T12:00:16+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
acthub status --format json
```

#### Output
```text
exit_code: 0

--- stdout ---
{
  "daemonStarted": false,
  "active": true,
  "hostProfile": "bootstrap",
  "runtimeState": "inactive",
  "projectRoot": "G:\\Workspace\\AgentWorkSpace\\AgentCraft",
  "projectName": "Actant",
  "configPath": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\actant.project.json",
  "configsDir": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs",
  "sourceWarnings": [],
  "components": {
    "skills": 3,
    "prompts": 1,
    "mcpServers": 1,
    "workflows": 1,
    "templates": 1
  },
  "mounts": {
    "project": "/hub/project",
    "workspace": "/hub/workspace",
    "config": "/hub/config",
    "skills": "/hub/skills",
    "prompts": "/hub/prompts",
    "mcp": "/hub/mcp",
    "workflows": "/hub/workflows",
    "templates": "/hub/templates"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
`acthub` is alias-only. It reused the existing host (`daemonStarted: false`) and showed identical semantics.

### [Step 7] Hub path alias mapping
**Time**: 2026-03-17T12:00:18+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
acthub read /project/context.json
```

#### Output
```text
exit_code: 0

--- stdout ---
{
  "mode": "project-context",
  "projectRoot": "G:\\Workspace\\AgentWorkSpace\\AgentCraft",
  "projectName": "Actant",
  "description": "Actant self-bootstrap project context",
  "configPath": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\actant.project.json",
  "configsDir": "G:\\Workspace\\AgentWorkSpace\\AgentCraft\\configs",
  "sources": [],
  "sourceWarnings": [],
  "components": {
    "skills": 3,
    "prompts": 1,
    "mcpServers": 1,
    "workflows": 1,
    "templates": 1
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
Logical root `/project` resolves correctly onto Hub-backed project context content.

### [Step 8] Hub list alias mapping
**Time**: 2026-03-17T12:00:19+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
acthub list /project --json
```

#### Output
```text
exit_code: 0

--- stdout ---
[
  {
    "name": "context.json",
    "path": "context.json",
    "type": "file"
  },
  {
    "name": "actant.project.json",
    "path": "actant.project.json",
    "type": "file"
  },
  {
    "name": "sources.json",
    "path": "sources.json",
    "type": "file"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
Hub VFS listing through logical roots is working and exposes the expected project context files.

### [Step 9] MCP connected mode
**Time**: 2026-03-17T12:00:25+08:00

#### Input
```text
SDK Client -> packages/mcp-server/dist/index.js
env.ACTANT_HOME = .../home-round3
env.ACTANT_SOCKET = \\.\pipe\actant-qa-bootstrap-r3
tools:
  1. vfs_read(path=/project/context.json)
  2. actant(method=hub.status)
```

#### Output
```text
exit_code: 0

--- stdout ---
{
  "readResult": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"mode\": \"project-context\",\n  \"projectRoot\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\",\n  \"projectName\": \"Actant\",\n  \"description\": \"Actant self-bootstrap project context\",\n  \"configPath\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\\\\actant.project.json\",\n  \"configsDir\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\\\\configs\",\n  \"sources\": [],\n  \"sourceWarnings\": [],\n  \"components\": {\n    \"skills\": 3,\n    \"prompts\": 1,\n    \"mcpServers\": 1,\n    \"workflows\": 1,\n    \"templates\": 1\n  }\n}"
      }
    ]
  },
  "rpcResult": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"active\": true,\n  \"hostProfile\": \"bootstrap\",\n  \"runtimeState\": \"inactive\",\n  \"projectRoot\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\",\n  \"projectName\": \"Actant\",\n  \"configPath\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\\\\actant.project.json\",\n  \"configsDir\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\\\\configs\",\n  \"sourceWarnings\": [],\n  \"components\": {\n    \"skills\": 3,\n    \"prompts\": 1,\n    \"mcpServers\": 1,\n    \"workflows\": 1,\n    \"templates\": 1\n  },\n  \"mounts\": {\n    \"project\": \"/hub/project\",\n    \"workspace\": \"/hub/workspace\",\n    \"config\": \"/hub/config\",\n    \"skills\": \"/hub/skills\",\n    \"prompts\": \"/hub/prompts\",\n    \"mcp\": \"/hub/mcp\",\n    \"workflows\": \"/hub/workflows\",\n    \"templates\": \"/hub/templates\"\n  }\n}"
      }
    ]
  }
}

--- stderr ---
[actant] Actant MCP connected to daemon at \\.\pipe\actant-qa-bootstrap-r3 (profile=bootstrap, runtime=inactive, project=G:\Workspace\AgentWorkSpace\AgentCraft)
```

#### Judgment: PASS
Connected MCP correctly reused the host, exposed project context via VFS, and proxied `hub.status` through the `actant` tool.

### [Step 10] MCP detached-readonly mode
**Time**: 2026-03-17T12:00:28+08:00

#### Input
```text
SDK Client -> packages/mcp-server/dist/index.js
env.ACTANT_HOME = .../detached-home-round3
env.ACTANT_SOCKET = \\.\pipe\actant-qa-bootstrap-detached-r3-missing
tools:
  1. vfs_read(path=/project/context.json)
  2. actant(method=hub.status)
```

#### Output
```text
exit_code: 0

--- stdout ---
{
  "readResult": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"mode\": \"project-context\",\n  \"projectRoot\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\",\n  \"projectName\": \"Actant\",\n  \"description\": \"Actant self-bootstrap project context\",\n  \"configPath\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\\\\actant.project.json\",\n  \"configsDir\": \"G:\\\\Workspace\\\\AgentWorkSpace\\\\AgentCraft\\\\configs\",\n  \"sources\": [],\n  \"sourceWarnings\": [],\n  \"components\": {\n    \"skills\": 3,\n    \"prompts\": 1,\n    \"mcpServers\": 1,\n    \"workflows\": 1,\n    \"templates\": 1\n  }\n}"
      }
    ]
  },
  "rpcResult": {
    "content": [
      {
        "type": "text",
        "text": "RPC hub.status failed: RPC hub.status unavailable in standalone mode. Use \"actant hub status\" to start the host when runtime operations are needed."
      }
    ],
    "isError": true
  }
}

--- stderr ---
[actant] Actant MCP running in standalone project-context mode for G:\Workspace\AgentWorkSpace\AgentCraft
```

#### Judgment: PASS
Detached MCP keeps readonly project context access but correctly rejects runtime RPC and points users back to `actant hub status`.

### [Step 11] Host cleanup
**Time**: 2026-03-17T12:00:31+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round3'
$env:ACTANT_SOCKET='\\.\pipe\actant-qa-bootstrap-r3'
actant daemon stop
actant daemon status --format json
```

#### Output
```text
exit_code: 0 / 1

--- stdout ---
Daemon stopping...

{
  "running": false
}

--- stderr ---
(empty)
```

#### Judgment: PASS
Bootstrap host shut down cleanly and no daemon remained bound to the isolated QA socket.
