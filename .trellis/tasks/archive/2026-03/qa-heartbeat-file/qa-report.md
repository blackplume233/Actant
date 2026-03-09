# QA Report: Heartbeat `.heartbeat` File Convention (E2E)

**Date**: 2026-02-27  
**Duration**: ~150 seconds observation  
**Backend**: Pi (via Kimi API, Anthropic protocol)  
**Heartbeat interval**: 10,000ms

## Summary

**PASS** — 心跳机制端到端测试通过。Agent 在真实 LLM 环境下连续 13+ 次心跳中读取并更新了 `.heartbeat` 文件。

## Test Configuration

| Item | Value |
|------|-------|
| Template | `heartbeat-qa-test@1.0.0` |
| Backend | `pi` (acpOwnsProcess) |
| Provider | anthropic via Kimi (api.kimi.com/coding/) |
| Heartbeat interval | 10,000ms |
| Seed prompt | 检查工作目录 / 报告时间 / 更新 .heartbeat |
| Observation time | ~150s |

## Assertions

| # | Assertion | Result | Details |
|---|-----------|--------|---------|
| 1 | `.heartbeat` 文件被种子化 | **PASS** | 创建 agent 后文件立即存在，内容为模板 prompt |
| 2 | heartbeat:tick 事件数量 >= 10 | **PASS** | 共 17 个 tick 事件 |
| 3 | 事件 payload 包含 intervalMs 和 tickCount | **PASS** | 每个事件均含 `intervalMs: 10000` 和递增 `tickCount` |
| 4 | heartbeat prompt 引用 `.heartbeat` 文件 | **PASS** | prompt 为 "心跳触发。请先读取工作目录下的 .heartbeat 文件..." |
| 5 | LLM 真实执行（非空 result） | **PASS** | 13/13 tasks 有非空 result |
| 6 | `.heartbeat` 文件被 Agent 自主更新 | **PASS** | 文件从 3 行种子内容演变为完整状态报告（含 11 次心跳历史） |
| 7 | Agent 执行耗时合理（真实 LLM 调用） | **PASS** | 平均 13,017ms，范围 9,122ms - 16,285ms |

## Key Metrics

- **Total heartbeat:tick events**: 17
- **Total tasks executed**: 13 (some ticks queued while LLM was busy)
- **Tasks completed**: 13 (100%)
- **Tasks failed**: 0
- **Average duration**: 13,017ms
- **Min duration**: 9,122ms
- **Max duration**: 16,285ms

## `.heartbeat` File Evolution

### Initial content (seed):
```
- 检查工作目录中有哪些文件
- 报告当前时间
- 更新 .heartbeat 文件写入你下一步计划
```

### After 11 heartbeats:
Agent autonomously evolved the file into a structured status report containing:
- Completed task checklist (11 heartbeat records)
- Environment configuration summary
- Working directory structure map
- Execution log statistics
- Next steps plan
- Attention items with priority markers

## Issues Found During Testing

### Issue 1: Pi backend `baseUrl` not passed to pi-ai model (FIXED)

**Severity**: Critical (blocked LLM execution)  
**Root cause**: `createPiAgent()` accepted `baseUrl` option but never applied it to the pi-ai model instance. The model's `baseUrl` was hardcoded to `https://api.anthropic.com` in pi-ai's model registry.  
**Fix**: Added `baseUrl` override in `createPiAgent()` to mutate `model.baseUrl` when option is provided.  
**Files changed**: `packages/pi/src/pi-tool-bridge.ts`

### Issue 2: PiCommunicator missing `baseUrl` support (FIXED)

**Severity**: High (communicator fallback path broken for custom endpoints)  
**Root cause**: `PiCommunicatorConfig` didn't include `baseUrl`, and `configFromBackend()` didn't read `ACTANT_BASE_URL` env var.  
**Fix**: Added `baseUrl` to config interface, `configFromBackend()`, and `buildAgent()`.  
**Files changed**: `packages/pi/src/pi-communicator.ts`

### Issue 3: ACP bridge connection drops after startup

**Severity**: Medium (mitigated by PiCommunicator fallback)  
**Observation**: The ACP bridge process connects successfully during `agent start` but appears to crash during subsequent prompt calls. The scheduler falls back to PiCommunicator (in-process mode).  
**Impact**: No functional impact after Issues 1&2 are fixed — the fallback path works correctly.  
**Status**: Deferred — needs further investigation of ACP bridge lifecycle.

## Conclusion

心跳 `.heartbeat` 文件约定机制已验证可用：
1. **种子化**：agent 创建时 `.heartbeat` 文件正确初始化
2. **Prompt 引导**：每次心跳 prompt 正确引导 Agent 读取 `.heartbeat`
3. **自主更新**：Agent 在每次心跳后自主更新 `.heartbeat` 内容
4. **状态持续演进**：文件内容从简单待办列表演变为结构化状态报告
5. **真实 LLM 调用**：所有 13 次 task 均有实质性响应，平均耗时 ~13s
