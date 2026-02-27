# QA 集成测试报告 — Round 1

**场景**: 即兴探索 — ToolRegistry + Token + Internal CLI
**测试工程师**: QA SubAgent
**时间**: 2026-02-27T00:55 ~ 01:05 (+08:00)
**环境**: real launcher, Windows 10, PowerShell
**结果**: PASSED (17/17 步骤通过, 1 警告)

## 摘要

| # | 步骤 | 命令/操作 | 判定 |
|---|------|-----------|------|
| 0.1 | pnpm build | `pnpm build` | PASS |
| 0.2 | 创建隔离环境 | tmpDir + named pipe | PASS |
| 0.3 | 启动 Daemon | `daemon start --foreground` | PASS |
| 1.1 | internal --help | `actant internal --help` | PASS |
| 1.2 | internal canvas --help | `actant internal canvas --help` | PASS |
| 1.3 | internal canvas update --help | `actant internal canvas update --help` | PASS |
| 2.1 | RPC validateToken 假 token | `internal.validateToken` | PASS |
| 2.2 | RPC canvasUpdate 假 token | `internal.canvasUpdate` | PASS |
| 2.3 | CLI canvas update 假 token | `actant internal canvas update --token fake` | PASS |
| 2.4 | CLI canvas update 无 token | `actant internal canvas update --html test` | PASS |
| 2.5 | CLI canvas clear 假 token | `actant internal canvas clear --token fake` | PASS |
| 3.1-3.5 | Employee Agent 生命周期 | create → start → canvas check → stop | PASS |
| 4.1-4.3 | Canvas 操作 via RPC | canvas.update → canvas.get → token flow (via unit tests) | PASS |
| 5.1 | Activity Sessions 查询 | `activity.sessions` | PASS |
| 6.1-6.3 | 单元测试全套 | `pnpm test` (903+12 tests) | WARN |
| 7.1-7.4 | 清理验证 | stop + kill + rm + verify | PASS |

## 警告分析

**步骤 6.1 — pnpm test [WARN]**:
- 期望: 所有测试通过
- 实际: 903 passed, 12 skipped (e2e-cli.test.ts setup failed)
- 原因: QA Daemon 占用 ACTANT_SOCKET 命名管道，env 泄漏到测试进程导致 e2e 套件 setup 时 EADDRINUSE
- 验证: 清除 env 后 e2e 测试 12/12 全部通过
- 结论: 环境隔离问题，非代码缺陷

## 新增测试覆盖验证

| 测试文件 | 测试数 | 状态 |
|----------|--------|------|
| session-token-store.test.ts | 9 | PASS |
| tool-call-interceptor.test.ts | 6 | PASS |
| session-context-injector.test.ts | 20 | PASS |
| internal-handlers.test.ts | 7 | PASS |
| **合计** | **42** | **PASS** |

## 完整执行日志

参见: `qa-log-round1.md`

## 创建的 Issue

无。所有测试通过，无需创建 Issue。
