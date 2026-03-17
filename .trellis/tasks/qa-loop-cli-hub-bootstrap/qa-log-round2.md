## QA Incremental Log

**Task**: cli-hub-bootstrap
**Round**: 2
**Started**: 2026-03-17T04:20:01.866Z

### [Step 1] Global actant version
**Time**: 2026-03-17T04:20:02.905Z

#### Input
```
actant --version
```

#### Output
```
exit_code: 0

--- stdout ---
0.3.0


--- stderr ---
(empty)
```

#### Judgment: PASS
PASS: global install exposes actant 0.3.0 correctly.

### [Step 2] Global acthub version
**Time**: 2026-03-17T04:20:03.847Z

#### Input
```
acthub --version
```

#### Output
```
exit_code: 0

--- stdout ---
0.3.0


--- stderr ---
(empty)
```

#### Judgment: PASS
PASS: global install exposes acthub alias correctly.

### [Step 3] hub status auto-starts bootstrap host
**Time**: 2026-03-17T04:40:37.984Z

#### Input
```
actant hub status --format json
```

#### Output
```
exit_code: 0

--- stdout ---
Started bootstrap host.
{
  "daemonStarted": true,
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

#### Judgment: FAIL
Unexpected token 'S', "Started bo"... is not valid JSON

### [Step 4] daemon status reflects bootstrap host and hub project
**Time**: 2026-03-17T04:40:38.959Z

#### Input
```
actant daemon status --format json
```

#### Output
```
exit_code: 1

--- stdout ---
{
  "running": false
}


--- stderr ---
(empty)
```

#### Judgment: FAIL
actant daemon status --format json should succeed

