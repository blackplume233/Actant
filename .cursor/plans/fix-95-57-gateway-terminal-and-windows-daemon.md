---
name: "修复 #95 Gateway Terminal 转发 & #57 Windows Daemon Fork"
overview: "验证并关闭已修复的 #95，修复 Windows 平台 daemon 后台启动立即退出的问题 #57"
todos:
  - id: verify-close-95
    content: "P0: 验证 #95 Gateway Terminal 转发已修复，关闭 Issue"
    status: pending
  - id: fix-57-spawn-windows
    content: "P0: 修复 #57 — Windows 上改用 spawn 替代 fork 启动 daemon"
    status: pending
  - id: fix-57-health-check
    content: "P1: 优化 daemon 启动健康检查，适配 spawn 无 IPC 场景"
    status: pending
  - id: fix-57-cleanup-disconnect
    content: "P1: 修复 spawn 场景下 child.disconnect() 的兼容性"
    status: pending
  - id: quality-check
    content: "P1: 运行 lint、typecheck 和增量测试验证"
    status: pending
isProject: false
---

# 修复 #95 Gateway Terminal 转发 & #57 Windows Daemon Fork

修复两个 bug：#95（ACP Gateway Terminal 回调转发）和 #57（Windows daemon 后台启动退出）。

---

## 一、背景分析

### Issue #95 — ACP Gateway Terminal 回调 IDE 转发

**状态：已修复，待验证关闭。**

`gateway.ts` 中的 4 个 terminal 回调方法（`terminalOutput`, `waitForTerminalExit`, `killTerminal`, `releaseTerminal`）已通过 `Map<string, TerminalHandle>` 适配层实现。Issue body 本身也标注了"临时方案（已实现）"。代码审查确认修复完整：
- L55: `terminalHandles` Map 声明
- L129-132: `createTerminal` 存储 handle
- L134-155: 4 个方法通过 handle 委托
- L86-91, L103-106: 断连时释放所有 handles

仅需验证代码正确性后关闭 Issue。

### Issue #57 — Windows 平台 daemon start fork 后退出

**状态：待修复。**

`daemon start` 在非 foreground 模式下使用 `child_process.fork()` + `detached: true`，这在 Windows 上不可靠（Node.js 已知问题 #36808）。`fork()` 创建 IPC channel 导致子进程与父进程绑定，父进程退出后子进程也被终止。

根因：
1. `fork()` 在 Windows 上 detached 不完全独立
2. IPC channel 保持了父子进程关联
3. `stdio: "ignore"` 吞掉了所有错误信息

## 二、方案设计

### #95 — 仅需验证

审查已实现的代码，确认无遗漏，添加评论并关闭 Issue。

### #57 — 平台感知的 spawn 策略

**核心思路**：Windows 上用 `spawn(process.execPath, [daemonScript])` 替代 `fork()`，避免 IPC channel。

```
Windows:   spawn(process.execPath, [script], { detached, stdio: [ignore,ignore,pipe] })
Unix:      fork(script, [], { detached, stdio: [ignore,ignore,pipe,ipc] })  // 保持不变
```

关键差异处理：
- `spawn` 无 IPC → 跳过 `child.disconnect()`
- `spawn` 的 `child.pid` 行为一致
- stderr 捕获方式一致（pipe）
- 健康检查基于 RPC ping 而非 IPC，无需改动

## 三、实施计划

### Phase 1: 验证 #95

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 1 | 审查 gateway.ts terminal 代码完整性 | P0 | - | 5min |
| 2 | 在 GitHub 添加验证评论并关闭 Issue | P0 | #1 | 2min |

### Phase 2: 修复 #57

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 3 | 修改 start.ts — Windows 用 spawn 替代 fork | P0 | - | 15min |
| 4 | 适配 spawn 无 IPC 的 disconnect 逻辑 | P1 | #3 | 5min |
| 5 | 运行 lint + typecheck 验证 | P1 | #3, #4 | 5min |

## 四、影响范围

### Files to Modify
- `packages/cli/src/commands/daemon/start.ts`: Windows spawn 替代 fork

### Files to Verify (不修改)
- `packages/acp/src/gateway.ts`: 确认 #95 修复完整

### Risk Assessment
- **spawn 无 IPC**: 当前代码不依赖 IPC 消息传递（仅用于 `child.disconnect()`），风险低
- **Unix 回归**: Unix 路径不变（仍用 fork），零风险
- **daemon-entry.js 路径**: `spawn` 用 `process.execPath` + script 路径，路径解析逻辑不变

## 五、验收标准

- [x] #95 gateway.ts terminal 转发代码经过审查，Issue 已关闭
- [ ] #57 Windows daemon start 使用 spawn 替代 fork
- [ ] `child.disconnect()` 仅在有 IPC 连接时调用
- [ ] lint 和 typecheck 通过
- [ ] 增量测试通过

## 六、相关参考

- `packages/acp/src/gateway.ts` — #95 已修复代码
- `packages/cli/src/commands/daemon/start.ts` — #57 需修改
- `packages/shared/src/platform/platform.ts` — `isWindows()` 工具函数
- Node.js issue #36808 — fork+detach 在 Windows 上的已知问题
