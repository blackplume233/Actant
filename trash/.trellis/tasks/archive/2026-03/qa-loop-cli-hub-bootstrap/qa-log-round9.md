## QA Incremental Log

**Task**: cli-hub-bootstrap  
**Round**: 9  
**Started**: 2026-03-17T15:20:00+08:00

### [Step 1] Targeted regression suite
**Time**: 2026-03-17T15:30:46+08:00

#### Input
```powershell
pnpm -r run type-check
pnpm exec vitest run `
  packages/api/src/services/__tests__/package-version.test.ts `
  packages/api/src/services/__tests__/bootstrap-profile.test.ts `
  packages/api/src/services/__tests__/hub-context.test.ts `
  packages/api/src/daemon/__tests__/socket-server.test.ts `
  packages/cli/src/commands/daemon/__tests__/runtime-mode.test.ts `
  packages/cli/src/__tests__/package-version.test.ts `
  packages/cli/src/bin/__tests__/entry-alias.test.ts `
  packages/cli/src/commands/__tests__/commands.test.ts `
  packages/cli/src/__tests__/e2e-cli.test.ts `
  packages/mcp-server/src/context-backend.test.ts
```

#### Output
```text
exit_code: 0

--- stdout ---
type-check: all workspace packages passed
vitest: 10 files passed, 54 tests passed

--- stderr ---
(empty)
```

#### Judgment: PASS
The CLI-first hub flow, standalone daemon mode helper, package-version fallbacks, and MCP bridge regressions are covered and green.

### [Step 2] Rebuild standalone bundle from workspace source
**Time**: 2026-03-17T15:35:00+08:00

#### Input
```powershell
node scripts/build-standalone.mjs
```

#### Output
```text
exit_code: 0

--- stdout ---
=== Actant Standalone Build ===
[1/4] Bundling with esbuild...
Bundle: 4838 KB -> G:\Workspace\AgentWorkSpace\AgentCraft\dist-standalone\actant-bundle.cjs
[2/4] Generating SEA blob...
[3/4] Copying Node.js binary...
[4/4] Injecting SEA blob into binary...
Built: G:\Workspace\AgentWorkSpace\AgentCraft\dist-standalone\actant.exe
Size: 86.1 MB

--- stderr ---
warning: The signature seems corrupted!
```

#### Judgment: PASS
Standalone build succeeded after switching `build-standalone` to resolve `@actant/*` workspace imports from `src/` instead of stale package `dist/`.

### [Step 3] Formal standalone install chain
**Time**: 2026-03-17T15:36:00+08:00

#### Input
```powershell
node scripts/install-local.mjs --standalone --skip-build --force --install-dir .trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9
G:\Workspace\AgentWorkSpace\AgentCraft\dist-standalone\actant.exe --version
```

#### Output
```text
exit_code: 0

--- stdout ---
Done! actant 0.3.0 installed. (standalone binary)
Location : G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\actant.exe
Alias    : G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\acthub.exe
0.3.0

--- stderr ---
(empty)
```

#### Judgment: PASS
The formal standalone install path produces released `actant` and `acthub` binaries from the freshly rebuilt SEA artifact.

### [Step 4] Fresh bootstrap host auto-start via standalone `acthub`
**Time**: 2026-03-17T15:38:00+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round11'
$env:ACTANT_SOCKET='\\.\pipe\actant-standalone-r11'
G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\acthub.exe status --format json
G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\actant.exe daemon status --format json
```

#### Output
```text
exit_code: 0 / 0

--- stdout ---
(first acthub invocation returned exit 0 in the harness; stdout was not captured on that first cold-start call)

{
  "running": true,
  "version": "0.3.0",
  "uptime": 42,
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
Fresh `acthub.exe status` auto-started a standalone bootstrap host on an isolated pipe. Follow-up `daemon status` proves the daemon is running with the correct profile, inactive runtime, mounted project, and `version: 0.3.0`.

### [Step 5] Host reuse and cleanup
**Time**: 2026-03-17T15:39:00+08:00

#### Input
```powershell
$env:ACTANT_HOME='G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\home-round11'
$env:ACTANT_SOCKET='\\.\pipe\actant-standalone-r11'
G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\acthub.exe status --format json
G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\actant.exe daemon stop
G:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-loop-cli-hub-bootstrap\standalone-round9\actant.exe daemon status --format json
```

#### Output
```text
exit_code: 0 / 0 / 1

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

Daemon stopping...

{
  "running": false
}

--- stderr ---
(empty)
```

#### Judgment: PASS
Second `acthub` invocation reused the same bootstrap host, and cleanup shut the isolated daemon down successfully.
