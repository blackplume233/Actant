## QA 集成测试报告

**场景**: 即兴探索 — 验证 #95 Gateway Terminal 转发 & #57 Windows Daemon Fork 修复
**测试工程师**: QA SubAgent
**时间**: 2026-02-23
**结果**: **PASSED** (7/7 步骤通过, 0 警告)

### 摘要

| # | 步骤 | 命令/检查 | 判定 |
|---|------|----------|------|
| 1 | #95 白盒验证 — terminal 转发代码完整性 | Code review gateway.ts + callback-router.ts | PASS |
| 2 | #57 构建验证 — spawn 修改已编译 | `npx tsup` + grep dist | PASS |
| 3 | #57 Foreground 基线 | `daemon start --foreground` + `daemon status` | PASS |
| 4 | **#57 核心场景 — Background daemon start** | `daemon start` (Windows spawn) | **PASS** |
| 5 | #57 Status 持久性 — daemon 持续运行 | `daemon status` × 2 (间隔 5s) | PASS |
| 6 | #57 Daemon stop | `daemon stop` + `daemon status` | PASS |
| 7 | 环境清理 | `Remove-Item` | PASS |

### 修复验证结论

#### Issue #95 — ACP Gateway Terminal 回调 IDE 转发

**结论**: 修复已完整实现，无需额外代码变更。

白盒审查确认 `gateway.ts` 中的 TerminalHandle Map 适配方案覆盖了所有 5 个 terminal 方法（createTerminal + 4 个委托方法），`callback-router.ts` 的 UpstreamHandler 接口匹配，Router 对每个方法都有 capability 检查和 try-catch fallback。断连清理覆盖 abort event 和 explicit disconnect 两条路径。Issue 已在 GitHub 关闭。

#### Issue #57 — Windows Daemon Fork 退出

**结论**: 修复有效，后台模式 daemon 在 Windows 上稳定运行。

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| `daemon start` exit code | 1 (早期退出) | 0 |
| `daemon status` | `running: false` | `running: true` |
| 进程持久性 | 几秒内退出 | 稳定运行 (uptime 24s+ 确认) |
| `daemon stop` | N/A (进程已死) | 正常停止 |

**修复机制**: Windows 上用 `spawn(process.execPath, [daemonScript])` 替代 `fork()`，避免 IPC channel 导致的假 detach。Unix 路径保持 `fork()` 不变。

### 发现的额外问题

测试过程中发现一个**环境配置问题**（非本次修复范围）：

`ACTANT_SOCKET` 环境变量仅被 CLI 客户端读取，Daemon (AppContext) 从 `getIpcPath(homeDir)` 计算 socket 路径。当使用自定义 `ACTANT_HOME` 时，CLI 和 Daemon 的 socket 路径不一致，需要手动设置 `ACTANT_SOCKET` 使两者匹配。此问题在 Windows 上尤为明显（`getDefaultIpcPath()` 返回固定值 `\\.\pipe\actant`，而 `getIpcPath(homeDir)` 动态计算）。

### 创建的 Issue

无新 Issue 创建。环境配置问题属于已知局限，不影响 #57 修复的正确性。

### 完整执行日志

见 `qa-log-round1.md`。
