# QA Loop Round 1 - 增量日志

**开始时间**: 2026-03-05T20:09:00+08:00
**范围**: 基本质量验证 (单元测试 + 核心黑盒场景)
**环境**: mock (Windows 10, Node 22.17.1)

---

## 场景组 0: 单元测试套件

### [Step 0] pnpm test - 完整单元测试

#### 输入
```
pnpm test
```

#### 输出
```
exit_code: 0

--- stdout ---
Test Files  84 passed (84)
     Tests  1084 passed (1084)
  Duration  17.62s (transform 57.55s, setup 0ms, import 135.27s, tests 22.04s, environment 9ms)

--- stderr ---
(empty)
```

#### 判断: PASS
全部 84 个测试文件、1084 个测试用例通过。无失败、无警告。

---

## 场景组 1: Daemon 连通性 (daemon-connectivity)

### [Step 1] daemon status (无 Daemon 运行)

#### 输入
```
node packages/cli/dist/bin/actant.js daemon status
```

#### 输出
```
exit_code: 1

--- stdout ---
Daemon is not running. Start with: actant daemon start

--- stderr ---
(empty)
```

#### 判断: PASS
Daemon 未运行时返回 exit 1 并给出启动提示，符合预期。

---

### [Step 2] agent list (无 Daemon 运行)

#### 输入
```
node packages/cli/dist/bin/actant.js agent list
```

#### 输出
```
exit_code: 1

--- stdout ---
Cannot connect to daemon. Start with: actant daemon start

--- stderr ---
(empty)
```

#### 判断: PASS
无 Daemon 时 agent 命令正确返回连接错误并给出提示。

---

### [Step 3] daemon start --foreground

#### 输入
```
Start-Process node "packages/cli/dist/bin/actant.js daemon start --foreground" -NoNewWindow -PassThru
```

#### 输出
```
Daemon PID: 74616
Daemon started (foreground). PID: 74616
Press Ctrl+C to stop.
```

#### 判断: PASS
Daemon 成功以前台模式启动。

---

### [Step 4] daemon status -f json

#### 输入
```
node packages/cli/dist/bin/actant.js daemon status -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "running": true, "version": "0.2.3", "uptime": 2, "agents": 0 }

--- stderr ---
(empty)
```

#### 判断: PASS
Daemon 正在运行，返回 JSON 格式状态信息，包含 running=true、version、uptime、agents 字段。

---

### [Step 5] --version

#### 输入
```
node packages/cli/dist/bin/actant.js --version
```

#### 输出
```
exit_code: 0

--- stdout ---
0.2.3

--- stderr ---
(empty)
```

#### 判断: PASS
版本号正确输出。

---

### [Step 6] --help

#### 输入
```
node packages/cli/dist/bin/actant.js --help
```

#### 输出
```
exit_code: 0

--- stdout ---
Usage: actant [options] [command]
Actant — Build, manage, and compose AI agents
(包含 template, agent, skill, prompt, mcp, workflow, plugin, source, preset, schedule, daemon, proxy, help, self-update, setup, dashboard, api, internal, vfs 子命令)

--- stderr ---
(empty)
```

#### 判断: PASS
帮助信息完整，包含所有核心子命令。

---

### [Step 7] agent list -f json (via daemon)

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### 判断: PASS
通过 Daemon 连接成功返回空数组。

---

## 场景组 2: 基本生命周期 (basic-lifecycle)

### [Step 8] template load lifecycle-tpl

#### 输入
```
node packages/cli/dist/bin/actant.js template load $ACTANT_HOME/lifecycle-tpl.json
```

#### 输出
```
exit_code: 0

--- stdout ---
Loaded lifecycle-tpl@1.0.0

--- stderr ---
(empty)
```

#### 判断: PASS
模板成功加载。

---

### [Step 9] agent list -f json (创建前)

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### 判断: PASS
创建前无 Agent，空数组。

---

### [Step 10] agent create test-agent -t lifecycle-tpl -f json

#### 输入
```
node packages/cli/dist/bin/actant.js agent create test-agent -t lifecycle-tpl -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
Agent created successfully.
{ "id": "fe1a1e70-...", "name": "test-agent", "templateName": "lifecycle-tpl", "templateVersion": "1.0.0",
  "backendType": "cursor", "status": "created", ... }

--- stderr ---
(empty)
```

#### 判断: PASS
Agent 创建成功，name、templateName、status 均符合预期。

---

### [Step 11] agent list -f json (创建后)

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[{ "name": "test-agent", "status": "created", "templateName": "lifecycle-tpl", ... }]

--- stderr ---
(empty)
```

#### 判断: PASS
Agent 出现在列表中，状态为 created。

---

### [Step 12] agent status test-agent -f json

#### 输入
```
node packages/cli/dist/bin/actant.js agent status test-agent -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "name": "test-agent", "status": "created", "templateName": "lifecycle-tpl", ... }

--- stderr ---
(empty)
```

#### 判断: PASS
状态查询返回 created，符合预期。

---

### [Step 13] agent resolve test-agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent resolve test-agent
```

#### 输出
```
exit_code: 0

--- stdout ---
Instance:  test-agent
Backend:   cursor
Workspace: C:\...\instances\test-agent
Command:   cursor.cmd
Args:      C:\...\instances\test-agent

--- stderr ---
(empty)
```

#### 判断: PASS
Resolve 成功，输出 workspace 路径和启动命令。

---

### [Step 14] agent status test-agent (resolve 后)

#### 输入
```
node packages/cli/dist/bin/actant.js agent status test-agent -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "name": "test-agent", "status": "created", ... }

--- stderr ---
(empty)
```

#### 判断: PASS
Resolve 后状态仍为 created（cursor 后端 resolve 不改变状态），符合预期。

---

### [Step 15] agent stop test-agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent stop test-agent
```

#### 输出
```
exit_code: 0

--- stdout ---
Stopped test-agent

--- stderr ---
(empty)
```

#### 判断: PASS
成功停止，退出码 0。

---

### [Step 16] agent status test-agent (stop 后)

#### 输入
```
node packages/cli/dist/bin/actant.js agent status test-agent -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "name": "test-agent", "status": "stopped", ... }

--- stderr ---
(empty)
```

#### 判断: PASS
状态正确转为 stopped。

---

### [Step 17] agent destroy test-agent (无 --force)

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy test-agent
```

#### 输出
```
exit_code: 1

--- stdout ---
Destroying agent "test-agent" will remove its entire workspace. Use --force to skip this warning.

--- stderr ---
(empty)
```

#### 判断: PASS
无 --force 时正确拒绝并提示，exit 1。

---

### [Step 18] agent destroy test-agent --force

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy test-agent --force
```

#### 输出
```
exit_code: 0

--- stdout ---
Destroyed test-agent

--- stderr ---
(empty)
```

#### 判断: PASS
带 --force 成功销毁。

---

### [Step 19] agent list -f json (销毁后)

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### 判断: PASS
Agent 已从列表移除，空数组。

---

## 场景组 3: 模板管理 (template-management)

### [Step 20] template list -f json (初始)

#### 输入
```
node packages/cli/dist/bin/actant.js template list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[{ "name": "lifecycle-tpl", "version": "1.0.0", ... }]

--- stderr ---
(empty)
```

#### 判断: PASS
包含之前加载的 lifecycle-tpl，不包含即将测试的 qa-test-tpl。

---

### [Step 21] template validate (合法模板)

#### 输入
```
node packages/cli/dist/bin/actant.js template validate $ACTANT_HOME/qa-test-tpl.json
```

#### 输出
```
exit_code: 0

--- stdout ---
Valid ✓ qa-test-tpl@1.0.0

--- stderr ---
(empty)
```

#### 判断: PASS
验证通过，输出模板名称和版本。

---

### [Step 22] template load

#### 输入
```
node packages/cli/dist/bin/actant.js template load $ACTANT_HOME/qa-test-tpl.json
```

#### 输出
```
exit_code: 0

--- stdout ---
Loaded qa-test-tpl@1.0.0

--- stderr ---
(empty)
```

#### 判断: PASS
成功加载。

---

### [Step 23] template list -f quiet (加载后)

#### 输入
```
node packages/cli/dist/bin/actant.js template list -f quiet
```

#### 输出
```
exit_code: 0

--- stdout ---
lifecycle-tpl
qa-test-tpl

--- stderr ---
(empty)
```

#### 判断: PASS
qa-test-tpl 出现在列表中。

---

### [Step 24] template show qa-test-tpl -f json

#### 输入
```
node packages/cli/dist/bin/actant.js template show qa-test-tpl -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "name": "qa-test-tpl", "version": "1.0.0", "backend": { "type": "cursor" }, ... }

--- stderr ---
(empty)
```

#### 判断: PASS
模板详情完整，字段值正确。

---

### [Step 25] template show nonexistent-tpl

#### 输入
```
node packages/cli/dist/bin/actant.js template show nonexistent-tpl
```

#### 输出
```
exit_code: 1

--- stdout ---
[RPC -32001] Template "nonexistent-tpl" not found in registry
  Context: {"templateName":"nonexistent-tpl"}

--- stderr ---
(empty)
```

#### 判断: PASS
不存在的模板返回 exit 1 和 not found 错误信息。

---

### [Step 26] template validate (非法模板，缺少 backend)

#### 输入
```
node packages/cli/dist/bin/actant.js template validate $ACTANT_HOME/bad-tpl.json
```

#### 输出
```
exit_code: 1

--- stdout ---
Invalid template
  - backend: Invalid input: expected object, received undefined
  - domainContext: Invalid input: expected object, received undefined

--- stderr ---
(empty)
```

#### 判断: PASS
正确检测出缺少必填字段并列出具体错误。

---

### [Step 27] agent create tpl-test-agent -t qa-test-tpl

#### 输入
```
node packages/cli/dist/bin/actant.js agent create tpl-test-agent -t qa-test-tpl -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
Agent created successfully.
{ "name": "tpl-test-agent", "templateName": "qa-test-tpl", ... }

--- stderr ---
(empty)
```

#### 判断: PASS
用加载的模板成功创建 Agent。

---

### [Step 28] agent create bad-agent -t nonexistent-tpl

#### 输入
```
node packages/cli/dist/bin/actant.js agent create bad-agent -t nonexistent-tpl
```

#### 输出
```
exit_code: 1

--- stdout ---
[RPC -32001] Template "nonexistent-tpl" not found in registry
  Context: {"templateName":"nonexistent-tpl"}

--- stderr ---
(empty)
```

#### 判断: PASS
使用不存在的模板创建 Agent 正确失败。

---

## 场景组 4: 错误处理 (error-handling)

### [Step 29] agent start ghost-agent (不存在)

#### 输入
```
node packages/cli/dist/bin/actant.js agent start ghost-agent
```

#### 输出
```
exit_code: 1

--- stdout ---
[RPC -32003] Agent instance "ghost-agent" not found
  Context: {"instanceName":"ghost-agent"}

--- stderr ---
(empty)
```

#### 判断: PASS
退出码 1，错误信息包含 not found。

---

### [Step 30] agent stop ghost-agent (不存在)

#### 输入
```
node packages/cli/dist/bin/actant.js agent stop ghost-agent
```

#### 输出
```
exit_code: 1

--- stdout ---
[RPC -32003] Agent instance "ghost-agent" not found
  Context: {"instanceName":"ghost-agent"}

--- stderr ---
(empty)
```

#### 判断: PASS
退出码 1，错误信息包含 not found。

---

### [Step 31] agent status ghost-agent (不存在)

#### 输入
```
node packages/cli/dist/bin/actant.js agent status ghost-agent
```

#### 输出
```
exit_code: 1

--- stdout ---
[RPC -32003] Agent instance "ghost-agent" not found
  Context: {"instanceName":"ghost-agent"}

--- stderr ---
(empty)
```

#### 判断: PASS
退出码 1，错误信息包含 not found。

---

### [Step 32] agent destroy ghost-agent --force (幂等)

#### 输入
```
node packages/cli/dist/bin/actant.js agent destroy ghost-agent --force
```

#### 输出
```
exit_code: 0

--- stdout ---
Destroyed ghost-agent (already absent)

--- stderr ---
(empty)
```

#### 判断: PASS
--force 幂等操作，不存在也返回 exit 0，输出 "already absent"。

---

### [Step 33] agent create missing-tpl-agent (缺少 -t 参数)

#### 输入
```
node packages/cli/dist/bin/actant.js agent create missing-tpl-agent
```

#### 输出
```
exit_code: 1

--- stdout ---
error: required option '-t, --template <template>' not specified

--- stderr ---
(empty)
```

#### 判断: PASS
缺少必填参数正确报错，提示需要 --template。

---

### [Step 34] agent resolve tpl-test-agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent resolve tpl-test-agent
```

#### 输出
```
exit_code: 0

--- stdout ---
Instance:  tpl-test-agent
Backend:   cursor
Workspace: ...\instances\tpl-test-agent
Command:   cursor.cmd
Args:      ...\instances\tpl-test-agent

--- stderr ---
(empty)
```

#### 判断: PASS
Resolve 成功。

---

### [Step 35] agent resolve tpl-test-agent (重复 resolve，幂等)

#### 输入
```
node packages/cli/dist/bin/actant.js agent resolve tpl-test-agent
```

#### 输出
```
exit_code: 0

--- stdout ---
(同上)

--- stderr ---
(empty)
```

#### 判断: PASS
重复 resolve 幂等成功。

---

### [Step 36] agent stop tpl-test-agent

#### 输入
```
node packages/cli/dist/bin/actant.js agent stop tpl-test-agent
```

#### 输出
```
exit_code: 0

--- stdout ---
Stopped tpl-test-agent

--- stderr ---
(empty)
```

#### 判断: PASS
成功停止。

---

### [Step 37] template validate (不存在的文件)

#### 输入
```
node packages/cli/dist/bin/actant.js template validate C:\tmp\this-file-does-not-exist.json
```

#### 输出
```
exit_code: 1

--- stdout ---
Invalid template
  - : Configuration file not found: C:\tmp\this-file-does-not-exist.json

--- stderr ---
(empty)
```

#### 判断: PASS
不存在的文件正确报错，exit 1。

---

## 场景组 5: 随机漫步探索测试

### [Step 38] 快速创建 3 个 Agent

#### 输入
```
agent create rand-a -t lifecycle-tpl
agent create rand-b -t qa-test-tpl
agent create rand-c -t lifecycle-tpl
```

#### 输出
```
exit_code: 0, 0, 0 (全部成功)
```

#### 判断: PASS
三个 Agent 全部成功创建。

---

### [Step 39] agent list (应显示 4 个)

#### 输入
```
node packages/cli/dist/bin/actant.js agent list -f quiet
```

#### 输出
```
exit_code: 0

--- stdout ---
tpl-test-agent
rand-a
rand-b
rand-c

--- stderr ---
(empty)
```

#### 判断: PASS
4 个 Agent 全部在列表中。

---

### [Step 40] destroy rand-b 后列表

#### 输入
```
agent destroy rand-b --force
agent list -f quiet
```

#### 输出
```
destroy exit_code: 0, output: Destroyed rand-b
list exit_code: 0, output: tpl-test-agent rand-a rand-c
```

#### 判断: PASS
销毁后 rand-b 从列表消失，其余不受影响。

---

### [Step 41] 重复创建 (同名)

#### 输入
```
node packages/cli/dist/bin/actant.js agent create rand-a -t lifecycle-tpl
```

#### 输出
```
exit_code: 1

--- stdout ---
[RPC -32002] Instance directory "rand-a" already exists
  Context: {"validationErrors":[{"path":"name","message":"Directory already exists: ..."}]}

--- stderr ---
(empty)
```

#### 判断: PASS
重复创建正确拒绝，exit 1 并给出明确的错误信息。

---

### [Step 42-45] 域管理命令列表

#### 输入
```
source list -f json → exit 0, []
skill list -f json → exit 0, []
daemon status -f json → exit 0, { "running": true, "version": "0.2.3", "uptime": 103, "agents": 3 }
schedule list (无参数) → exit 1, error: missing required argument 'name'
```

#### 判断: PASS
source/skill/daemon 命令正常返回。schedule list 需要 agent name 参数，缺参报错符合设计（schedule 是 per-agent 的）。

---

### [Step 46-50] 更多域管理命令

#### 输入
```
schedule list rand-a -f json → exit 0, { "sources": [], "running": false }
workflow list -f json → exit 0, []
prompt list -f json → exit 0, []
mcp list -f json → exit 0, []
plugin list -f json → exit 0, []
```

#### 判断: PASS
所有域管理列表命令正常返回空集合。

---

## 清理验证

#### 输入
```
agent destroy tpl-test-agent --force → Destroyed tpl-test-agent
agent destroy rand-a --force → Destroyed rand-a
agent destroy rand-c --force → Destroyed rand-c
agent list -f json → []
daemon stop → Daemon stopping...
```

#### 输出
```
Node processes before: 22
Node processes after: 22
临时目录已删除
```

#### 判断: PASS
所有资源已清理，无进程泄漏。

---

## Round 1 汇总

| 类别 | 总步骤 | PASS | WARN | FAIL |
|------|--------|------|------|------|
| 单元测试 | 1084 tests / 84 files | 1084 | 0 | 0 |
| Daemon 连通性 | 7 | 7 | 0 | 0 |
| 基本生命周期 | 12 | 12 | 0 | 0 |
| 模板管理 | 9 | 9 | 0 | 0 |
| 错误处理 | 9 | 9 | 0 | 0 |
| 随机漫步 | 13 | 13 | 0 | 0 |
| **总计** | **50 步 + 1084 单元测试** | **50/50 + 1084/1084** | **0** | **0** |
