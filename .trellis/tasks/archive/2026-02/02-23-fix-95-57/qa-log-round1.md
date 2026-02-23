# QA 日志 — 修复 #95 #57 验证

**场景**: 即兴探索 — 验证 #95 Gateway Terminal 转发 & #57 Windows Daemon Fork 修复
**测试工程师**: QA SubAgent
**开始时间**: 2026-02-23

---

### [Step 1] #95 白盒验证 — gateway.ts Terminal 转发代码完整性
**时间**: 2026-02-23T10:40:00+08:00

#### 输入
```
White-box review of packages/acp/src/gateway.ts and packages/acp/src/callback-router.ts
```

#### 检查项

**1. TerminalHandle Map 声明 (gateway.ts L55)**
```typescript
private terminalHandles = new Map<string, TerminalHandle>();
```
✅ 存在，类型正确

**2. createTerminal 存储 handle (gateway.ts L129-132)**
```typescript
createTerminal: async (p) => {
  const handle = await conn.createTerminal(p);
  this.terminalHandles.set(handle.id, handle);
  return { terminalId: handle.id };
},
```
✅ handle 存储到 map，返回 terminalId

**3. 4 个委托方法 (gateway.ts L134-155)**
- terminalOutput → handle.currentOutput() ✅
- waitForTerminalExit → handle.waitForExit() ✅
- killTerminal → handle.kill() ✅
- releaseTerminal → handle.release() + map delete ✅

**4. 断连清理 (gateway.ts L86-91, L103-106)**
- abort listener: release all handles + clear map ✅
- disconnectUpstream: release all handles + clear map ✅

**5. UpstreamHandler 接口 (callback-router.ts L32-42)**
- 所有 5 个 terminal 方法都在 interface 中声明 ✅

**6. Router 转发 (callback-router.ts L159-217)**
- 所有 5 个 terminal 方法检查 `this.upstream && this.ideCapabilities?.terminal` ✅
- 每个方法都有 try-catch fallback 到 local ✅

**7. SDK 注释说明 (gateway.ts L47-53)**
- 明确标注为 SDK 限制的 workaround，引用 #95 ✅
- 说明移除条件：SDK 添加 flat terminal 方法后 ✅

#### 判断: PASS
代码链路完整：gateway.ts UpstreamHandler 实现了全部 5 个 terminal 方法，callback-router.ts 接口匹配，Router 有 capability 检查和 fallback。断连清理覆盖两条路径。

---

### [Step 2] #57 构建验证 — spawn 修改已编译到 dist
**时间**: 2026-02-23T10:42:00+08:00

#### 输入
```
npx tsup (in packages/cli/)
grep for spawn/isWindows in dist/chunk-EVNSJDRO.js
```

#### 输出
```
exit_code: 0

--- stdout ---
ESM Build start
ESM dist\chunk-EVNSJDRO.js       95.58 KB
ESM ⚡️ Build success in 43ms

--- grep ---
packages\cli\dist\chunk-EVNSJDRO.js:
  2018: import { onShutdownSignal, isWindows } from "@actant/shared";
  2046: const child = isWindows() ? spawn(process.execPath, [daemonScript], {
```

#### 判断: PASS
构建产物确认包含 `isWindows()` 条件分支和 `spawn(process.execPath, ...)` 调用。

---

### [Step 3] #57 Foreground 基线 — 确认 daemon 在正确 socket 上可达
**时间**: 2026-02-23T10:45:00+08:00

#### 输入
```
ACTANT_HOME="C:\Users\black\AppData\Local\Temp\ac-qa-fix95-57"
ACTANT_SOCKET="\\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qa-fix95-57"
node packages/cli/dist/bin/actant.js daemon start --foreground
```

#### 输出
```
exit_code: (backgrounded, still running)

--- stdout ---
Daemon started (foreground). PID: 60084
Press Ctrl+C to stop.
```

#### 产物检查
```
node packages/cli/dist/bin/actant.js daemon status -f json
→ { "running": true, "version": "0.1.0", "uptime": 11, "agents": 0 }
exit_code: 0
```

#### 判断: PASS
Foreground daemon 正常启动，RPC status 返回 running: true。基线确认。

---

### [Step 4] #57 核心场景 — Background daemon start (Windows spawn)
**时间**: 2026-02-23T10:48:00+08:00

#### 输入
```
ACTANT_HOME="C:\Users\black\AppData\Local\Temp\ac-qa-fix95-57"
ACTANT_SOCKET="\\.\pipe\actant-C__Users_black_AppData_Local_Temp_ac-qa-fix95-57"
node packages/cli/dist/bin/actant.js daemon start
```

#### 输出
```
exit_code: 0

--- stdout ---
Daemon started. PID: 4116

--- stderr ---
(empty)
```

#### 判断: PASS
**这是 #57 的核心修复验证。** 后台模式 daemon 启动成功，exit code 0，PID 正常返回。在修复前，此命令在 Windows 上会因 `fork()` + `detached: true` 导致子进程立即退出。

---

### [Step 5] #57 Status 验证 — daemon 在后台持续运行
**时间**: 2026-02-23T10:49:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js daemon status -f json
(immediately after start)
```

#### 输出
```
exit_code: 0

--- stdout ---
{ "running": true, "version": "0.1.0", "uptime": 13, "agents": 0 }
```

#### 产物检查（5 秒后再次验证持久性）
```
node packages/cli/dist/bin/actant.js daemon status -f json
→ { "running": true, "version": "0.1.0", "uptime": 24, "agents": 0 }
exit_code: 0
```

#### 判断: PASS
Daemon 在后台持续运行，uptime 从 13s 增长到 24s，证明进程未退出。

---

### [Step 6] #57 Daemon stop — 清理验证
**时间**: 2026-02-23T10:50:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js daemon stop
```

#### 输出
```
exit_code: 0

--- stdout ---
Daemon stopping...
```

#### 产物检查（2 秒后验证已停止）
```
node packages/cli/dist/bin/actant.js daemon status -f json
→ { "running": false }
exit_code: 1
```

#### 判断: PASS
Daemon 正常停止，status 确认 running: false。

---

### [Step 7] 环境清理
**时间**: 2026-02-23T10:51:00+08:00

```
Remove-Item -Recurse -Force "C:\Users\black\AppData\Local\Temp\ac-qa-fix95-57"
→ Cleaned up
```

#### 判断: PASS
临时目录已删除。
