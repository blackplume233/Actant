## QA Incremental Log

**Task**: cli-hub-bootstrap
**Round**: 1
**Started**: 2026-03-17T04:17:38.289Z

### [Step 1] Global actant version
**Time**: 2026-03-17T04:17:38.294Z

#### Input
```
actant.cmd --version
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
actant --version ??? exit 0

### [Step 2] Global acthub version
**Time**: 2026-03-17T04:17:38.295Z

#### Input
```
acthub.cmd --version
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
acthub --version ??? exit 0

### [Step 3] hub status auto-starts bootstrap host
**Time**: 2026-03-17T04:17:38.295Z

#### Input
```
actant.cmd hub status --format json
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
actant hub status --format json ???

### [Step 4] daemon status reflects bootstrap host and hub project
**Time**: 2026-03-17T04:17:38.296Z

#### Input
```
actant.cmd daemon status --format json
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
actant daemon status --format json ???

### [Step 5] acthub alias reuses same host
**Time**: 2026-03-17T04:17:38.296Z

#### Input
```
acthub.cmd status --format json
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
acthub status --format json ???

### [Step 6] hub read exposes project context through alias path
**Time**: 2026-03-17T04:17:38.296Z

#### Input
```
acthub.cmd read /project/context.json
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
acthub read /project/context.json ???

### [Step 7] hub list exposes project files through alias path
**Time**: 2026-03-17T04:17:38.297Z

#### Input
```
acthub.cmd list /project --json
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
acthub list /project --json ???

### [Step 8] MCP connected mode delegates through hub activation
**Time**: 2026-03-17T04:17:39.314Z

#### Input
```
SDK Client -> packages/mcp-server/dist/index.js (connected mode) -> vfs_read(/project/context.json) + actant(hub.status)
```

#### Output
```
exit_code: 1

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
(empty)
```

#### ??: FAIL
connected actant tool ??? hub.status

### [Step 9] MCP detached-readonly mode keeps VFS but rejects runtime RPC
**Time**: 2026-03-17T04:17:40.303Z

#### Input
```
SDK Client -> packages/mcp-server/dist/index.js (detached-readonly) -> vfs_read(/project/context.json) + actant(hub.status)
```

#### Output
```
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
(empty)
```

#### ??: PASS
PASS: MCP detached-readonly ?????? context?????? runtime RPC?

### [Step 10] daemon stop cleans up bootstrap host
**Time**: 2026-03-17T04:17:40.304Z

#### Input
```
actant.cmd daemon stop
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
actant daemon stop ???

### [Step 11] daemon status confirms host stopped
**Time**: 2026-03-17T04:17:40.304Z

#### Input
```
actant.cmd daemon status --format json
```

#### Output
```
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
(empty)
```

#### ??: FAIL
Unexpected end of JSON input

