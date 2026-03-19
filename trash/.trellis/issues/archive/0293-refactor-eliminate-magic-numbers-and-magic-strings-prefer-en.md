---
id: 293
title: "refactor: eliminate magic numbers and magic strings, prefer enums/constants"
status: closed
labels:
  - enhancement
  - chore
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#293"
closedAs: completed
createdAt: "2026-03-15T14:02:49Z"
updatedAt: "2026-03-18T06:39:32"
closedAt: "2026-03-18T06:37:26Z"
---

## 目标

系统性地消除代码库中的魔法数字（magic numbers）和魔法字符串（magic strings），统一使用枚举（enum）或命名常量（const）替代，提升代码可读性、可维护性和重构安全性。

## 背景

当前代码库中存在大量硬编码的数值和字符串字面量，分散在多个包中，带来以下问题：
- 含义不直观，新开发者需要猜测 `305_000` 或 `"running"` 的语义
- 修改时容易遗漏某些散落的字面量
- IDE 无法提供类型安全的自动补全

## 具体问题清单

### 魔法数字

| 位置 | 值 | 上下文 | 建议 |
|------|-----|--------|------|
| `rest-api/src/server.ts:101-104` | `-32001`, `-32003` 等 | RPC 错误码 | 使用 `RPC_ERROR_CODES` (已定义在 shared) |
| `cli/src/commands/proxy.ts:395,444,450,457,470` | `-32603`, `-32602`, `-32601` | JSON-RPC 错误 | 同上 |
| 多处 (webhooks, agents, sessions, prompt, proxy) | `305_000` | RPC 超时 | 提取为 `PROMPT_RPC_TIMEOUT_MS` |
| `rest-api/src/server.ts:99-113` | `500`, `404`, `400`, `409`, `501` | HTTP 状态码 | 使用 `HTTP_STATUS` 常量 |
| `rest-api/src/index.ts:45` | `3100` | 默认端口 | 使用 `DEFAULT_REST_API_PORT` |
| `core/src/source/source-validator.ts:544,601,612,628` | `64`, `1024`, `500` | Skills 校验限制 | 使用 `AGENT_SKILLS_LIMITS` |
| `core/src/template/schema/config-validators.ts:105,108` | `5000` | 心跳间隔 | 使用 `MIN_HEARTBEAT_INTERVAL_MS` |
| `acp/src/connection-manager.ts:100` | `128 * 1024` | 环境变量大小限制 | 提取为共享常量 |
| `rest-api/src/routes/agents.ts:11` | `500` | 分页上限 | 使用 `MAX_AGENTS_PAGE_LIMIT` |
| `core/src/manager/launcher/process-launcher.ts:186-199` | `200`, `500` | 轮询间隔 | 命名常量 |
| `core/src/initializer/agent-initializer.ts:379` | `[500, 1000, 2000, 4000]` | EBUSY 重试退避 | 已命名但内联，应提取 |

### 魔法字符串

| 位置 | 值 | 上下文 | 建议 |
|------|-----|--------|------|
| `core/src/manager/agent-manager.ts` 多处 | `"running"`, `"stopped"`, `"error"` 等 | Agent 状态 | 使用 `AgentStatus` 枚举（已定义但未引用） |
| `core/src/channel/event-compat.ts:33-167` | `"agent_message_chunk"`, `"tool_call"` 等 | Channel 事件类型 | 集中为 `CHANNEL_EVENT_TYPES` |
| `core/src/record/record-system.ts:277,555-573` | `"lifecycle"`, `"session"` 等 | Record 分类 | 使用 `RecordCategory` 常量 |
| `core/src/communicator/create-communicator.ts:29-32` | `"claude-code"`, `"cursor"` | Backend 标识 | 使用 backend type 常量 |
| `api/src/daemon/socket-server.ts:126`, `cli/proxy.ts:475` | `"2.0"` | JSON-RPC 版本 | 使用 `JSONRPC_VERSION` |
| `core/src/source/source-validator.ts` 多处 | `"error"`, `"warning"`, `"info"` | 校验严重级别 | 使用 `Severity` 枚举 |
| `channel-claude/src/claude-channel-adapter.ts:183` | `"cancelled"`, `"end_turn"` | 停止原因 | 使用 `StopReason` 常量 |
| `core/src/manager/launch-mode-handler.ts:88-91` | `"direct"`, `"acp-background"` 等 | 启动模式 | 对齐 shared types |

## 方案

1. **审计现有枚举/常量**：部分类型已定义但调用方未使用（如 `AgentStatus`、`RPC_ERROR_CODES`），优先替换这些
2. **新建缺失的枚举/常量**：对未有定义的值，在 `packages/shared/src/` 中集中定义
3. **逐包替换**：按包逐步替换，每个包一个 commit，便于 review
4. **类型收窄**：利用 TypeScript 的 `as const` + `typeof` 或 `enum` 获得类型安全

## 验收标准

- [ ] 所有 RPC 错误码引用 `RPC_ERROR_CODES` 而非数字字面量
- [ ] 超时常量（`305_000` 等）提取为共享命名常量
- [ ] Agent 状态字符串全部使用 `AgentStatus` 枚举
- [ ] Channel 事件类型提取为集中常量
- [ ] Record 分类提取为集中常量
- [ ] 无新增未命名的魔法数字/字符串（后续 PR review 检查项）
