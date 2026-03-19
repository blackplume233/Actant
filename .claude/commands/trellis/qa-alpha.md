# QA Alpha - Persistent QA Environment

Read `.agents/skills/qa-engineer/SKILL.md` first, then use this command to run QA inside a long-lived environment.

This command keeps one reusable daemon and one reusable QA home under `.trellis/qa-alpha/`.

Unlike one-shot QA, this command is for:

- iterative exploration
- cross-session state validation
- repeated regression runs in the same environment

Current rule:

- follow the active `ContextFS` baseline
- do not seed the environment with old `DomainContext`-based or template-centric product models
- if current implementation still contains legacy structures, treat that as implementation debt, not as active documentation truth

---

## Command Format

`/qa-alpha <mode> [args]`

| Mode | Example | Behavior |
|------|---------|----------|
| `run` | `/qa-alpha run basic-lifecycle` | run a named scenario in the persistent environment |
| `explore` | `/qa-alpha explore "create 5 agents concurrently"` | do ad hoc exploration in the persistent environment |
| `status` | `/qa-alpha status` | check whether the environment is alive |
| `restart` | `/qa-alpha restart` | rebuild and restart the persistent environment |
| `stop` | `/qa-alpha stop` | stop the environment without deleting files |
| `create` | `/qa-alpha create "agent runtime smoke"` | create a scenario file and execute it |
| `list` | `/qa-alpha list` | list available scenarios |

If the mode is omitted, treat it as `explore`.

---

## Environment Layout

```text
.trellis/qa-alpha/
|- env-state.json
|- seed-state.json
|- home/
|- logs/
```

Recommended `env-state.json` fields:

```json
{
  "status": "running",
  "daemonPid": 12345,
  "socketPath": "<platform-specific>",
  "homePath": "<absolute path>",
  "buildHash": "<git commit hash>",
  "buildTimestamp": "<ISO datetime>",
  "startedAt": "<ISO datetime>",
  "roundCounter": 3,
  "platform": "win32"
}
```

Use `seed-state.json` to record the QA seed resources loaded into the environment.

---

## Execution Flow

### Phase 0: Restore or Validate Environment

Run this phase every time.

#### Step 0.1: Read environment state

```powershell
Get-Content .trellis/qa-alpha/env-state.json
```

- if the file does not exist, continue to Phase 1
- if it exists, continue to Step 0.2

#### Step 0.2: Verify daemon liveness

```powershell
$env:ACTANT_HOME="<homePath>"
$env:ACTANT_SOCKET="<socketPath>"
node packages/cli/dist/bin/actant.js daemon status -f json
```

- if `running: true`, continue to test execution
- otherwise restart the daemon

#### Step 0.3: Check whether rebuild is required

```bash
git rev-parse HEAD
```

Compare the result with `buildHash` in `env-state.json`.

- if equal, continue
- if different, run `pnpm build`, update `buildHash` and `buildTimestamp`, then restart the daemon

---

### Phase 1: First Initialization

#### Step 1.1: Create directories

```powershell
New-Item -ItemType Directory -Force .trellis/qa-alpha/home
New-Item -ItemType Directory -Force .trellis/qa-alpha/logs
```

#### Step 1.2: Build the project if needed

```powershell
Test-Path packages/cli/dist/bin/actant.js
pnpm build
```

If the CLI is already built, skip the build.

#### Step 1.3: Decide the socket path

```text
Windows: \\.\pipe\actant-qa-alpha
Unix: .trellis/qa-alpha/home/actant.sock
```

#### Step 1.4: Start the daemon

```powershell
$env:ACTANT_HOME=".trellis/qa-alpha/home"
$env:ACTANT_SOCKET="\\.\pipe\actant-qa-alpha"
Start-Process -NoNewWindow node -ArgumentList "packages/cli/dist/bin/actant.js","daemon","start","--foreground"
```

Record the daemon PID and poll `daemon status` until it is ready.

#### Step 1.5: Seed QA resources using the current baseline

If the scenario needs initial resources, seed them from the active docs:

1. read `.trellis/spec/config-spec.md`
2. create a minimal `ProjectManifest`
3. mount only the built-in sources needed for the scenario
4. record the seed artifacts in `.trellis/qa-alpha/seed-state.json`

Seeding rules:

- prefer `ProjectManifest`, `Project`, and built-in `Source` concepts
- use only the current V1 paths such as `/skills`, `/mcp/configs`, `/mcp/runtime`, `/agents`, and `/_project.json`
- do not write `domainContext` as if it were current truth
- do not describe QA setup as the old template aggregation model

#### Step 1.6: Write `env-state.json`

Initialize the environment state and set `roundCounter` to `0`.

---

### Phase 2: Execute QA

All CLI commands in this environment should use the persistent variables:

```powershell
$env:ACTANT_HOME="<homePath>"
$env:ACTANT_SOCKET="<socketPath>"
node packages/cli/dist/bin/actant.js <command>
```

Logging rules:

- increment `roundCounter`
- append `.trellis/qa-alpha/logs/qa-log-roundN.md`
- append `.trellis/qa-alpha/logs/qa-report-roundN.md`

Scenario execution rules:

- black-box first
- white-box only as needed
- classify outcomes as `PASS`, `WARN`, or `FAIL`
- create or update issues for real defects

If a scenario requires a clean state:

1. list current agents
2. destroy the ones that would pollute the scenario
3. reset the QA seed resources only if needed

Do not reintroduce old product terms just because the test data is old.

---

### Phase 3: Restart After Code Changes

When the user runs `/qa-alpha restart`, or Phase 0 detects a new `HEAD`:

1. stop active agents if needed
2. stop the daemon
3. kill the recorded daemon process if still alive
4. run `pnpm build`
5. restart the daemon
6. reload the QA seed resources from Step 1.5
7. update `env-state.json`

Do not delete `.trellis/qa-alpha/home` or the QA logs during restart.

---

### Phase 4: Stop the Environment

When the user runs `/qa-alpha stop`:

1. stop active agents if needed
2. stop the daemon
3. kill the recorded daemon process if needed
4. set `status` to `stopped` in `env-state.json`

Do not delete the environment files.

---

## Comparison With Standard QA

| Dimension | `/qa` | `/qa-alpha` |
|-----------|-------|-------------|
| Environment | temporary | persistent under `.trellis/qa-alpha/` |
| Daemon | recreated each run | long-lived and reused |
| Agent state | usually clean each run | can persist across sessions |
| Seed data | temporary setup | reloaded only when required |
| Best for | CI-style regression | debugging and persistent-state exploration |

---

## Notes

1. This command intentionally preserves environment state between runs.
2. If code changes, rebuild before trusting old results.
3. Windows should use the fixed named pipe `\\.\pipe\actant-qa-alpha`.
4. If a full reset is required, remove `.trellis/qa-alpha/` manually and reinitialize.
