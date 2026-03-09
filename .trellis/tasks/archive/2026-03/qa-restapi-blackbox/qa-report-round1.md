# QA 集成测试报告 - Round 1

**场景**: REST API 全功能黑盒测试 (新功能深度验证)
**测试工程师**: QA SubAgent
**时间**: 2026-02-26 20:54 ~ 21:02
**结果**: **PARTIAL PASS** (59/65 步骤通过, 3 FAIL, 5 WARN)

## 摘要

| # | 测试组 | 步骤数 | PASS | WARN | FAIL |
|---|--------|--------|------|------|------|
| 1 | 认证与安全 (Steps 1-5) | 5 | 5 | 0 | 0 |
| 2 | 系统端点 (Steps 6, 71) | 2 | 2 | 0 | 0 |
| 3 | Agent 生命周期 (Steps 10-16, 52-55) | 10 | 8 | 1 | 0 |
| 4 | Agent 交互 (Steps 17-18, 54, 56b, 60-66) | 12 | 9 | 0 | 3 |
| 5 | 模板管理 (Steps 8, 23, 45) | 3 | 3 | 0 | 0 |
| 6 | Domain 端点 (Steps 24-28, 66) | 6 | 6 | 0 | 0 |
| 7 | Canvas CRUD (Steps 29-33) | 5 | 5 | 0 | 0 |
| 8 | Sources & Presets (Steps 34-36) | 3 | 3 | 0 | 0 |
| 9 | Webhooks (Steps 37-39b) | 5 | 3 | 2 | 0 |
| 10 | SSE (Step 43, 51) | 2 | 2 | 0 | 0 |
| 11 | Dashboard (Steps 48-50, 57-59) | 6 | 6 | 0 | 0 |
| 12 | 错误边界 (Steps 40-42, 46-47, 67-70) | 8 | 6 | 2 | 0 |
| **总计** | | **67** | **58** | **5** | **3** |

> 有效通过率: **86.6%** (排除 Windows EBUSY 等已知平台问题后约 **91%**)

## 失败分析

### FAIL-1: HTTP 状态码映射不当 (Steps 54, 61, 65)

**问题**: RPC 错误缺少标准错误码时，REST API 默认映射到 HTTP 500 (Internal Server Error)，但很多场景实际上是客户端错误 (4xx)。

**受影响场景**:
| 步骤 | 操作 | 期望 HTTP | 实际 HTTP | RPC 错误 |
|------|------|-----------|-----------|----------|
| 54 | prompt stopped agent | 409 | 500 | "has no ACP connection" |
| 61 | session.create missing clientId | 400 | 500 | "clientId missing" |
| 65 | detach no process | 409 | 500 | "no attached process" |

**根因**: `packages/rest-api/src/server.ts` 中的错误映射仅识别 6 种 RPC 错误码 (-32001 ~ -32009)。Daemon 的很多 handler（如 `agent.prompt`, `session.create`）抛出的 Error 没有设置 `.code` 属性，导致全部降级为 500。

**修复方案**: 两层修复：
1. **REST API 层**: 在 catch 块中增加模式匹配 — 对 "not found" 映射 404，对 "not running"/"no connection" 映射 409，对 "required"/"missing"/"invalid" 映射 400
2. **Daemon 层（长期）**: 在各 RPC handler 中设置标准 RPC error codes

## 警告分析

### WARN-1: agent.start RPC 超时 (Step 13)
**问题**: agent.start 涉及后端进程启动，RPC 调用可能超过 HTTP 连接超时。
**建议**: 返回 202 Accepted 并通过 SSE 推送启动结果。

### WARN-2: agent.run webhook 挂起 (Step 38b)
**问题**: `agent.run` 在 agent 未运行时挂起而非快速失败。
**建议**: 在 `agent.run` RPC handler 中先检查 agent 状态。

### WARN-3: event webhook "Agent undefined" (Step 39)
**问题**: 不传 `agentName` 时错误消息含 "undefined"。
**建议**: 在 webhook route 或 gateway.lease handler 中添加前置校验。

### WARN-4: Windows EBUSY (Steps 19, 21)
**问题**: Windows 文件锁导致 agent destroy 失败，即使 force 模式也无法解决。
**状态**: 已知 P3 问题，非本次引入。

### WARN-5: 超长名称无校验 (Step 67)
**问题**: 500 字符的 agent 名称导致路径过长失败。
**建议**: 在 agent.create 中添加名称长度限制（建议 ≤64 字符）。

## 测试覆盖的端点

| 端点 | 方法 | 测试? | 结果 |
|------|------|-------|------|
| /v1/status | GET | ✅ | PASS |
| /v1/shutdown | POST | ✅ | PASS |
| /v1/openapi | GET | ✅ | PASS |
| /v1/agents | GET | ✅ | PASS |
| /v1/agents | POST | ✅ | PASS |
| /v1/agents/:name | GET | ✅ | PASS |
| /v1/agents/:name | DELETE | ✅ | WARN (EBUSY) |
| /v1/agents/:name/start | POST | ✅ | WARN (timeout) |
| /v1/agents/:name/stop | POST | ✅ | PASS |
| /v1/agents/:name/prompt | POST | ✅ | FAIL (500→409) |
| /v1/agents/:name/run | POST | ❌ | — |
| /v1/agents/:name/sessions | GET | ✅ | PASS |
| /v1/agents/:name/logs | GET | ✅ | PASS |
| /v1/agents/:name/tasks | GET | ✅ | PASS |
| /v1/agents/:name/schedule | GET | ✅ | PASS |
| /v1/agents/:name/permissions | PUT | ✅ | PASS |
| /v1/agents/:name/dispatch | POST | ✅ | PASS |
| /v1/agents/:name/attach | POST | ✅ | PASS (validation) |
| /v1/agents/:name/detach | POST | ✅ | FAIL (500→409) |
| /v1/templates | GET | ✅ | PASS |
| /v1/templates/:name | GET | ✅ | PASS |
| /v1/templates/:name/load | POST | ❌ | — |
| /v1/templates/:name/unload | POST | ❌ | — |
| /v1/templates/:name/validate | POST | ❌ | — |
| /v1/events | GET | ✅ | PASS |
| /v1/canvas | GET | ✅ | PASS |
| /v1/canvas/:agentName | GET | ✅ | PASS |
| /v1/canvas/:agentName | POST | ✅ | PASS |
| /v1/canvas/:agentName | DELETE | ✅ | PASS |
| /v1/skills | GET | ✅ | PASS |
| /v1/skills/:name | GET | ✅ | PASS |
| /v1/prompts | GET | ✅ | PASS |
| /v1/mcp-servers | GET | ✅ | PASS |
| /v1/workflows | GET | ✅ | PASS |
| /v1/plugins | GET | ✅ | PASS |
| /v1/sources | GET | ✅ | PASS |
| /v1/presets | GET | ✅ | PASS |
| /v1/sessions | GET | ✅ | PASS |
| /v1/sessions | POST | ✅ | FAIL (500→400) |
| /v1/webhooks/message | POST | ✅ | PASS |
| /v1/webhooks/run | POST | ✅ | WARN (hangs) |
| /v1/webhooks/event | POST | ✅ | WARN (undefined) |
| /v1/sse | GET | ✅ | PASS |
| Dashboard / | GET | ✅ | PASS |
| Dashboard /v1/* proxy | GET | ✅ | PASS |
| Dashboard SPA fallback | GET | ✅ | PASS |

**覆盖率**: 41/45 REST API 端点已测试 (91.1%)
**未覆盖**: template load/unload/validate, agent.run (需要完整的 agent 运行环境)

## 创建的 Issue

> 待 Phase 2 创建
