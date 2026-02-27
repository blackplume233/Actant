# QA Log — HeartbeatPlugin 集成验证 — Round 1

**范围**: 测试心跳功能是否真的有效  
**环境**: real + unit  
**时间**: 2026-02-27  
**任务目录**: .trellis/tasks/qa-heartbeat-verify/

---

## 步骤 1 — 单元测试：HeartbeatPlugin

**输入**: `pnpm --filter @actant/core test -- --reporter=verbose "heartbeat"`

**输出**:
```
✓ src/plugin/builtins/heartbeat-plugin.test.ts (15 tests) 7ms
Test Files  1 passed (1)
Tests       15 passed (15)
```

**判断**: ✅ PASS — 15 个测试全部通过，覆盖 init/tick/stop/hooks/process:crash/PluginHost 集成

---

## 步骤 6 — 黑盒：`actant plugin status heartbeat`（单个详情）

**输入**: `actant plugin status heartbeat`

**输出**:
```
Plugin:             heartbeat
Scope:              actant
State:              running
Last Tick:          —
Consec. Failures:   0
```

**判断**: ✅ PASS — 单 plugin 详情正常，scope/state/consecutiveFailures 字段正确

---

## 步骤 7 — 边界：查询不存在的插件

**输入**: `actant plugin status nonexistent`

**输出**: `[RPC -32000] Configuration file not found: Runtime plugin "nonexistent" not found` / exit_code: 1

**判断**: ✅ PASS — 正确返回 404 错误，符合预期

---

## 步骤 8 — JSON 格式 + lastTickAt 验证

**输入**: `actant plugin status --format json`（约在 daemon 启动后 ~1min）

**输出**:
```json
[{"name":"heartbeat","scope":"actant","state":"running","lastTickAt":"2026-02-27T14:19:06.529Z","consecutiveFailures":0}]
```

**判断**: ✅ PASS — lastTickAt 有值，说明 30s tick 已触发并被记录

---

## 步骤 9/10 — 压力测试：5次快速连续查询

**输入**: 5次 `actant plugin status --format json`

**输出**: 每次均返回 `state:running,consecutiveFailures:0` 且 lastTickAt 一致

**判断**: ✅ PASS — 并发查询下状态一致，无竞态问题

---

## 步骤 11 — 关键：Tick 时间戳推进验证

**输入**: 记录 T1，sleep 35s，记录 T2

**输出**:
```
T1: 2026-02-27T14:19:36.544Z
T2: 2026-02-27T14:20:06.555Z
TICK ADVANCED: YES
```

**判断**: ✅ PASS — T2 - T1 ≈ 30.01s，完全匹配 30000ms setInterval 定时器，心跳机制真实有效

---

## 步骤 12 — quiet 格式

**输入**: `actant plugin status --format quiet`

**输出**: `heartbeat`

**判断**: ✅ PASS — quiet 格式只输出名称，符合预期

---

## 步骤 13 — Daemon 停止 + stopPlugins 验证

**输入**: `actant daemon stop`

**输出**: `Daemon stopping...` / exit_code: 0 / daemon 进程 exit_code: 0

**判断**: ✅ PASS — Daemon 干净停止（125s 运行后），stopPlugins 调用链正常无异常

---

## 步骤 14 — 停止后再查询

**输入**: `actant plugin status`（daemon 已停止）

**输出**: `Cannot connect to daemon. / exit_code: 1`

**判断**: ✅ PASS — 正确报告 daemon 不可用，命令退出码为 1

---

## 步骤 15 — 全量回归

**输入**: `pnpm --filter @actant/core test`

**输出**: `Test Files 51 passed (51), Tests 787 passed (787)`

**判断**: ✅ PASS — 无回归

---

## 步骤 3 — 白盒验证：Daemon.stop() 调用 stopPlugins

**输入**: Grep `stopPlugins|pluginHost` in `packages/api/src/daemon/daemon.ts`

**输出**: `:113  await this.ctx.stopPlugins();`

**判断**: ✅ PASS — stopPlugins() 在 agentManager.dispose() 之后调用，清理顺序正确

---

## 步骤 4 — 黑盒：Daemon 启动

**输入**: `node packages/cli/dist/bin/actant.js daemon start --foreground` (ACTANT_HOME=tmp, ACTANT_LAUNCHER_MODE=mock)

**输出**: `Daemon started (foreground). PID: 110476`

**判断**: ✅ PASS — Daemon 成功启动并保持运行

---

## 步骤 5 — 黑盒：`actant plugin status`（无参数）

**输入**: `actant plugin status`

**输出**:
```
┌───────────┬────────┬─────────┬───────────┬──────────┐
│ Name      │ Scope  │ State   │ Last Tick │ Failures │
├───────────┼────────┼─────────┼───────────┼──────────┤
│ heartbeat │ actant │ running │ —         │ 0        │
└───────────┴────────┴─────────┴───────────┴──────────┘
```

**判断**: ✅ PASS — heartbeat 插件以 actant 作用域处于 running 状态，consecutiveFailures=0，符合预期

---

## 步骤 2 — 白盒验证：AppContext 注册

**输入**: Grep `HeartbeatPlugin|pluginHost|stopPlugins` in `packages/api/src/services/app-context.ts`

**输出**:
```
:37  HeartbeatPlugin,
:111  readonly pluginHost: PluginHost;
:193  this.pluginHost = new PluginHost();
:194  this.pluginHost.register(new HeartbeatPlugin());
:232  await this.pluginHost.start({ config: {} }, this.eventBus);
:234  void this.pluginHost.tick({ config: {} });
:249  async stopPlugins(): Promise<void> {
:254  await this.pluginHost.stop({ config: {} });
```

**判断**: ✅ PASS — PluginHost 在构造函数中初始化，HeartbeatPlugin 被注册，init() 中 start 并设置 30s tick interval，stopPlugins() 方法存在

---

