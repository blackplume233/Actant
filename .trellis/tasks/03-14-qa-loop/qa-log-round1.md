## QA Loop Log

### [Step 1] Verify CLI build entry
**时间**: 2026-03-14T20:55:00

#### 输入
```bash
ls packages/cli/dist/bin/actant.js
```

#### 输出
```text
exit_code: 0

--- stdout ---
packages/cli/dist/bin/actant.js

--- stderr ---
(empty)
```

#### 判断: PASS
CLI 构建产物存在，可用于后续 QA 隔离环境测试。

### [Step 2] Start daemon in isolated QA environment
**时间**: 2026-03-14T20:56:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-qa-YbjKVy" ACTANT_SOCKET="/tmp/ac-qa-YbjKVy/actant.sock" node packages/cli/dist/bin/actant.js daemon start --foreground
```

#### 输出
```text
exit_code: background

--- stdout ---
(background task started: bo3mwu482)

--- stderr ---
(empty)
```

#### 判断: INFO
已按 QA Skill 要求在隔离环境中启动 daemon，等待读取真实输出后再判定 PASS/WARN/FAIL。

### [Step 3] Verify daemon reachability after foreground start
**时间**: 2026-03-14T20:57:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-qa-YbjKVy" ACTANT_SOCKET="/tmp/ac-qa-YbjKVy/actant.sock" node packages/cli/dist/bin/actant.js daemon status
```

#### 输出
```text
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
Daemon is not running.
Start with: actant daemon start
```

#### 判断: FAIL
后台输出显示 daemon 曾以前台模式启动并打印 PID，但随后同环境下 `daemon status` 无法连接，说明 daemon 启动后未在预期 socket 上保持可达。当前共享 AgentService、ACP、CLI、Dashboard 场景都被该运行时问题阻塞。

### [Step 4] Diagnose isolated daemon socket normalization on Windows
**时间**: 2026-03-14T20:59:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-qa-YbjKVy" ACTANT_SOCKET="/tmp/ac-qa-YbjKVy/actant.sock" node --input-type=module -e "import { getIpcPath, normalizeIpcPath } from './packages/shared/dist/index.js'; console.log('ipc', getIpcPath(process.env.ACTANT_HOME)); console.log('normalized', normalizeIpcPath(process.env.ACTANT_SOCKET, process.env.ACTANT_HOME));"
```

#### 输出
```text
exit_code: 0

--- stdout ---
ipc \.\pipectant-C__Users_black_AppData_Local_Temp_ac-qa-YbjKVy
normalized \.\pipectant-C__Users_black_AppData_Local_Temp_ac-qa-YbjKVy

--- stderr ---
(empty)
```

#### 判断: WARN
共享库会把 Windows 上的 `ACTANT_SOCKET=/tmp/.../actant.sock` 规范化成 named pipe 路径；daemon pid 文件也表明进程曾启动。但同环境下 `daemon status` 仍报告未运行，说明问题不在基础路径归一化本身，而更可能在 daemon 生命周期、socket 监听建立或 CLI 连接逻辑。

### [Step 5] Attempt shared AgentService creation
**时间**: 2026-03-14T21:00:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-qa-YbjKVy" ACTANT_SOCKET="/tmp/ac-qa-YbjKVy/actant.sock" node packages/cli/dist/bin/actant.js agent create shared-svc -t code-review-agent --archetype service
```

#### 输出
```text
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
Cannot connect to daemon.
Start with: actant daemon start
```

#### 判断: FAIL
共享 AgentService 创建被阻塞。不是模板参数错误，而是 CLI 无法连接已写入 pid 的 daemon。由此可推导 ACP、CLI、Dashboard 三种交互场景当前都无法进入真实运行态验证。

### [Step 6] Attempt ACP proxy interaction with shared AgentService
**时间**: 2026-03-14T21:01:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-qa-YbjKVy" ACTANT_SOCKET="/tmp/ac-qa-YbjKVy/actant.sock" node packages/cli/dist/bin/actant.js proxy shared-svc
```

#### 输出
```text
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
Daemon is not running. Start it with: actant daemon start
```

#### 判断: FAIL
ACP proxy 路径无法建立，因为 daemon 不可达。该结果与共享 AgentService 创建失败一致，说明 ACP 交互场景当前被同一个底层运行时问题阻塞。

### [Step 7] Attempt CLI interaction with shared AgentService
**时间**: 2026-03-14T21:01:30

#### 输入
```bash
ACTANT_HOME="/tmp/ac-qa-YbjKVy" ACTANT_SOCKET="/tmp/ac-qa-YbjKVy/actant.sock" node packages/cli/dist/bin/actant.js agent run shared-svc --prompt "ping"
```

#### 输出
```text
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
Cannot connect to daemon.
Start with: actant daemon start
```

#### 判断: FAIL
CLI 与共享 AgentService 的交互同样被 daemon 连接失败阻塞，当前无法进入 prompt/session 行为验证。

### [Step 8] Assess Dashboard interaction preconditions
**时间**: 2026-03-14T21:02:00

#### 输入
```bash
ls packages/dashboard && ls packages/dashboard/client
```

#### 输出
```text
exit_code: 0

--- stdout ---
client
dist
node_modules
package.json
src
tsconfig.json
tsconfig.tsbuildinfo
tsup.config.ts
components.json
index.html
public
src
tsconfig.json
vite.config.ts

--- stderr ---
(empty)
```

#### 判断: WARN
Dashboard 前端代码与构建产物存在，但由于 daemon 和共享 AgentService 运行态未建立，无法继续验证 Dashboard 对 AgentService 的真实交互。当前只能确认 surface 存在，不能确认运行态链路正常。

### [Step 9] Verify daemon connectivity fix
**时间**: 2026-03-14T21:11:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js daemon status -f json
```

#### 输出
```text
exit_code: 0

--- stdout ---
{
  "running": true,
  "version": "0.2.3",
  "uptime": 8,
  "agents": 0
}

--- stderr ---
(empty)
```

#### 判断: PASS
daemon connectivity 问题已修复，CLI 现在可以正确连接到 Windows named pipe 对应的 daemon。

### [Step 10] Load code-review template after fix
**时间**: 2026-03-14T21:12:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js template load configs/templates/code-review-agent.json
```

#### 输出
```text
exit_code: 0

--- stdout ---
Loaded code-review-agent@1.0.0

--- stderr ---
(empty)
```

#### 判断: PASS
修正后的模板已成功重新加载。

### [Step 11] Observe intermediate initializer failure
**时间**: 2026-03-14T21:13:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js agent create shared-svc -t code-review-agent --archetype service
```

#### 输出
```text
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
[RPC -32005] Failed to initialize workspace at "C:\Users\black\AppData\Local\Temp\ac-cli-regress2\instances\shared-svc"
  Context: {
  "workspacePath": "C:\Users\black\AppData\Local\Temp\ac-cli-regress2\instances\shared-svc",
  "cause": "paths is not iterable"
}
  Code: WORKSPACE_INIT_ERROR
```

#### 判断: FAIL
第一次模板修正仍存在 mkdir step 配置结构错误；问题已从 daemon/connectivity 进一步收敛到模板 initializer 配置层。

### [Step 12] Create shared AgentService successfully after template contract fix
**时间**: 2026-03-14T21:15:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js agent create shared-svc -t code-review-agent --archetype service
```

#### 输出
```text
exit_code: 0

--- stdout ---
Agent created successfully.

Agent:     shared-svc
ID:        482b623d-c913-4697-ba2a-75d95bec382a
Template:  code-review-agent@1.0.0
Archetype: service
AutoStart: yes
Status:    created
Launch:    acp-service
PID:       —
Created:   2026-03-14T13:18:17.156Z
Updated:   2026-03-14T13:18:17.156Z

--- stderr ---
(empty)
```

#### 判断: PASS
共享 AgentService 已成功创建，说明模板依赖缺失和 initializer step 契约漂移都已修通到可创建状态。

### [Step 13] Start shared AgentService and inspect status
**时间**: 2026-03-14T21:16:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js agent start shared-svc
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js agent status shared-svc -f json
```

#### 输出
```text
exit_code: 0

--- stdout ---
Started shared-svc
{
  "id": "482b623d-c913-4697-ba2a-75d95bec382a",
  "name": "shared-svc",
  "templateName": "code-review-agent",
  "templateVersion": "1.0.0",
  "backendType": "claude-code",
  "backendConfig": {
    "model": "claude-sonnet-4-20250514"
  },
  "interactionModes": [
    "start",
    "proxy"
  ],
  "providerConfig": {
    "type": "anthropic",
    "protocol": "anthropic",
    "config": {
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    }
  },
  "status": "running",
  "launchMode": "acp-service",
  "workspacePolicy": "persistent",
  "processOwnership": "managed",
  "createdAt": "2026-03-14T13:18:17.156Z",
  "updatedAt": "2026-03-14T13:18:44.436Z",
  "archetype": "service",
  "autoStart": true,
  "effectivePermissions": {
    "allow": ["*"],
    "deny": [],
    "ask": [],
    "defaultMode": "bypassPermissions"
  },
  "pid": 10000,
  "startedAt": "2026-03-14T13:18:44.435Z",
  "workspaceDir": "C:\Users\black\AppData\Local\Temp\ac-cli-regress2\instances\shared-svc"
}

--- stderr ---
(empty)
```

#### 判断: PASS
共享 AgentService 已成功进入 running 状态，且 archetype/service、launchMode/acp-service、interactionModes/start+proxy 与当前产品定位一致。

### [Step 14] Validate CLI run path against shared AgentService
**时间**: 2026-03-14T21:17:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js agent run shared-svc --prompt "ping"
```

#### 输出
```text
exit_code: 1

--- stdout ---
(empty)

--- stderr ---
[RPC -32603] Agent "shared-svc" (claude-code) does not support "run" mode. Supported modes: start, proxy
```

#### 判断: WARN
CLI 通道已可达，但 `service + claude-code` 当前明确不支持 `run` mode。若产品预期是“共享 AgentService 可直接 agent run”，这是能力边界与预期不一致；若预期是仅支持 proxy，则该行为符合当前实现边界。

### [Step 15] Validate ACP proxy path against shared AgentService
**时间**: 2026-03-14T21:18:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js proxy shared-svc
```

#### 输出
```text
exit_code: 1

--- stdout ---
Instance "shared-svc" occupied → created ephemeral "shared-svc-proxy-1773494346072"
Error: spawn EINVAL

--- stderr ---
(empty)
```

#### 判断: FAIL
ACP 交互路径已进入正确的 occupied→ephemeral fallback 逻辑，但在后续 spawn 临时 proxy instance 时失败。当前这是阻塞 ACP 场景打通的主故障点。

### [Step 16] Validate Dashboard surface availability
**时间**: 2026-03-14T21:19:00

#### 输入
```bash
ACTANT_HOME="/tmp/ac-cli-regress2" ACTANT_SOCKET=".sock" LOG_LEVEL="silent" node packages/cli/dist/bin/actant.js dashboard --help
curl -s http://127.0.0.1:3320/ | head -n 5
```

#### 输出
```text
exit_code: 0

--- stdout ---
Usage: actant dashboard [options]

Open the web dashboard for monitoring agents

Options:
  -p, --port <port>  Port to run the dashboard server on (default: "3200")
  --no-open          Do not automatically open the browser
  -h, --help         display help for command
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/actant.svg" />

--- stderr ---
(empty)
```

#### 判断: PASS
Dashboard 命令和 HTTP 页面服务可用，说明 Dashboard surface 已成功启动并可访问。当前剩余未验证的是浏览器内对 shared-svc 的更深交互，而不是 dashboard 服务本身。
