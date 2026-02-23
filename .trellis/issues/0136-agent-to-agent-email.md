---
id: 136
title: "Agent-to-Agent Email 通信 — 异步消息范式"
status: open
labels:
  - feature
  - protocol
  - "priority:P2"
  - architecture
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 47
  - 10
  - 11
relatedFiles:
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/scheduler/employee-scheduler.ts
  - packages/acp/src/connection-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#136"
closedAs: null
createdAt: 2026-02-23T00:00:00
updatedAt: 2026-02-23T00:00:00
closedAt: null
---

**Related Issues**: [[0047-employee-agent]], [[0010-instance-memory]], [[0011-memory-consolidation]], #16 (可选 MCP 接入，P4)
**Related Files**: `packages/core/src/manager/agent-manager.ts`, `packages/core/src/scheduler/employee-scheduler.ts`, `packages/api/src/handlers/`
**需求来源**: `docs/human/agent2agent.md`

---

## 目标

建立 Agent-to-Agent 的异步 **Email 通信范式**，通过 **CLI / JSON-RPC API** 作为主要通道。MCP 接入作为可选的未来扩展（#16, P4）。

## 背景

Agent 间通信需要一种异步、可持久化、支持路由的机制：

- **同步阻塞不可取**：Agent A 不应等待 Agent B 完成才能继续工作
- **需要路由能力**：CC/群发/广播
- **需要持久化**：通信记录作为公共知识保留
- **需要跨时间线**：消息可跨会话、跨 Agent 生命周期传递

参考石头门和 KimiCLI 的设计，采用 **Email 范式**可以解决上述所有问题。

### 通信通道优先级

| 优先级 | 通道 | 说明 |
|--------|------|------|
| **P1** | **CLI** | `actant email send/inbox/reply` — 人和 Agent 通过命令行发送 |
| **P1** | **JSON-RPC API** | `email.send` / `email.inbox` — Daemon RPC 接口，Agent 进程和外部应用直接调用 |
| **P1** | **Email Hub 内部** | Daemon 内部的 Email 路由/投递/持久化服务 |
| P4 | MCP (可选) | 未来通过 #16 MCP Server 暴露 `actant_send_email` 等 tools |

## 核心设计

### Email 范式

Agent 间通过异步 "Email" 通信，而非同步 tool call。

```
Agent A                    Actant Email Hub                Agent B
  │                              │                           │
  ├─── send email ──────────────►│                           │
  │    (to: B, subject, body)    │                           │
  │                              ├─── deliver ──────────────►│
  │    ◄─ ack (emailId) ─────── │                           │
  │                              │     (处理中...)            │
  │    ... A 继续其他工作 ...     │                           │
  │                              │◄── reply email ───────────┤
  │    ◄─── deliver reply ───── │                           │
```

### 来源与回复路由

每封 Email 必须标明 `sourceType`，Email Hub 据此路由回复：

| sourceType | 含义 | 回复行为 |
|-----------|------|---------|
| `agent` | 另一个 Agent 发送 | 回复投递到发送方 Agent 收件箱 |
| `human` | 人通过 CLI/UI 发送 | 回复标记为已完成，人通过 `actant email inbox` 查看 |
| `system` | Hook/Cron 等系统触发 | 回复投递到 system inbox |
| `external` | 外部应用发送 | 回复投递 + 触发 callback 通知 |

- **`replyTo` 路由覆盖**：当存在时，回复投递到 `replyTo` 而非 `from`。场景：人发送但希望回复投递到某个 Agent。
- **`callback` 回调机制**：Email Hub 投递回复后，若原始 Email 携带 `callback`，额外触发通知（webhook HTTP POST 或 Daemon 内部 RPC）。适用于外部应用集成。

### 不同 Agent 类型的处理方式

| Agent 类型 | Email 处理方式 |
|-----------|--------------|
| **雇员 Agent** | 主 Session 接收处理 Email，作为 TaskQueue 的一种 InputSource |
| **普通实例** | 启动新进程/Session 处理 Email，完成后自动回复并可选销毁 |

### Email 中枢（Hub）

Actant 维护一个 Email 记录中枢：

- **投递路由**：根据收件人解析到具体 Agent Instance
- **CC/群发**：一封 Email 可抄送或广播给多个 Agent
- **持久化**：Email 记录作为公共知识保存
- **状态追踪**：pending → delivered → processing → replied / failed

### 跨时间线传递

参考 KimiCLI 的跨时间线机制：

- Email 可跨会话传递：Agent A 在 Session 1 发送的 Email，Agent B 可在 Session 2 接收和回复
- Email 可跨 Agent 生命周期：Agent B 当前未运行时，Email 排队等待，Agent B 启动后投递
- 回复关联：reply 自动关联到原始 Email，形成 thread

### 时间线分叉 — "发往过去的 Email"

Email 链形成因果时间线（DAG）。特异能力：Agent 可以**向过去的某个节点发送 Email，创建新分叉**。

```
时间线（正常流）:
  E1[需求] → E2[方案A] → E3[实现] → E4[产出] → E5[发现问题]

分叉场景 1 — 正确但浪费上下文:
  E5 检测到上下文消耗过多，压缩结论，发回 E2 创建分叉:
  E1 → E2 → E2'[方案A + 压缩结论] → E3'[直接产出]
       原时间线 E3→E4→E5 标记为 obsolete

分叉场景 2 — 方向错误:
  E5 检测到方案错误，压缩失败教训，发回 E2 要求换方案:
  E1 → E2 → E2''[换方案B + 失败教训] → E3''[方案B实现]
       原时间线 E3→E4→E5 标记为 obsolete
```

**触发方式**：
- **人为指定**：用户判断当前方向需要回溯
- **Agent 自发**：Agent 自行判断上下文浪费或方向错误

**两种分叉原因**：

| 原因 | 语义 | 压缩内容 |
|------|------|---------|
| `context-compression` | 当前方向正确，但上下文消耗过多 | 压缩后的正确结论，跳过中间推导 |
| `direction-change` | 当前方向错误，需要换方案 | 压缩后的失败教训 + "换方案"指令 |

**核心语义**：
- 新分叉从过去节点开始，但携带了未来的压缩知识（带记忆的 time travel）
- 原时间线中被分叉覆盖的 Email 标记为 `obsolete`
- Email Hub 维护完整的时间线 DAG，支持回溯查看所有分叉历史

### Email 结构（草案）

```typescript
interface AgentEmail {
  id: string;
  from: string;           // sender agent name
  to: string[];           // recipient agent names
  cc?: string[];          // CC agent names
  subject: string;        // brief topic
  body: string;           // prompt/message content
  inReplyTo?: string;     // reply to which email id
  threadId?: string;      // conversation thread
  priority?: 'normal' | 'urgent';
  attachments?: EmailAttachment[];
  metadata?: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'processing' | 'replied' | 'failed' | 'obsolete';
  createdAt: string;
  deliveredAt?: string;
  repliedAt?: string;

  // 来源与回复路由
  sourceType: 'human' | 'agent' | 'system' | 'external';
  replyTo?: string;            // 回复目标（缺省 = from）
  callback?: EmailCallback;    // 回复投递后触发的回调通知

  // 时间线分叉
  forkFrom?: string;          // 从哪封 Email 分叉（目标过去节点的 emailId）
  forkReason?: 'context-compression' | 'direction-change';
  compressedContext?: string;  // 压缩后的知识/结论/教训
  obsoletes?: string[];       // 本分叉使哪些 Email 作废（原时间线后续节点）
}

interface EmailCallback {
  type: 'webhook' | 'rpc';
  endpoint: string;           // webhook URL 或 RPC method
  headers?: Record<string, string>;
}
```

## 架构

```
人/Agent/外部应用
  │
  ├── CLI: actant email send/inbox/reply
  ├── RPC: email.send / email.inbox / email.reply (JSON-RPC via IPC)
  │
  ▼
Actant Daemon
  │
  ├── Email Hub（路由 + 投递 + 持久化 + 状态追踪）
  │     ├── 收件人解析 → Agent Instance
  │     ├── CC/群发路由
  │     ├── 排队（Agent 未运行时）
  │     └── Email 记录持久化
  │
  ├── 雇员 Agent → EmailInput → TaskQueue → 主 Session 处理
  └── 普通 Agent → 启动新进程/Session 处理 → 自动回复
```

## 与 #16 (MCP Server) 的关系

#16 **不再是前置依赖**。Email 通信通过 Actant 已有的 CLI / JSON-RPC 通道实现。

#16 (P4) 作为可选的未来扩展：当 Agent 需要从 IDE 内部（通过 MCP tool call）发送 Email 时，可通过 #16 MCP Server 暴露 `actant_send_email` 等 tools。但这不是必须的——Agent 可以直接调用 `actant email send` CLI 命令实现相同功能。

## 前置依赖

- **无硬性前置依赖**（CLI/RPC 基础设施已存在）
- **可选增强**：分层知识管理框架 (Phase 5 Memory #10/#11) 可增强 Email 记录的持久化和公共知识检索

## 实现路径（概要）

1. **Email schema 定义**：`AgentEmail` 接口和 Zod schema（含时间线分叉字段）
2. **Email Hub**：`EmailHub` 服务（路由、投递、持久化、状态追踪、时间线 DAG 管理）
3. **RPC handlers**：`email.send` / `email.inbox` / `email.reply` / `email.threads` / `email.fork` 注册到 Daemon
4. **CLI 命令**：`actant email send/inbox/reply/threads/fork`
5. **EmailInput for EmployeeScheduler**：作为新的 InputSource 接入 #47 调度体系
6. **跨时间线**：Email 排队、延迟投递、thread 关联
7. **时间线分叉**：`email.fork` 实现回溯分叉、上下文压缩、obsolete 标记

## 验收标准

### 基础 Email 通信
- [ ] `actant email send --to agent-b --subject "..." --body "..."` 可发送 Email
- [ ] `actant email inbox <agent-name>` 可查看收件箱
- [ ] `email.send` / `email.inbox` RPC handlers 可用
- [ ] 雇员 Agent 在主 Session 中接收和处理 Email
- [ ] 普通 Agent 自动启动新进程处理 Email 并回复
- [ ] 支持 CC 和群发
- [ ] Email Hub 持久化记录
- [ ] 跨时间线：Agent 未运行时 Email 排队，启动后自动投递
- [ ] Reply 自动关联到原始 Email thread

### 来源与回复路由
- [ ] `sourceType` 必填，Email Hub 根据类型路由回复
- [ ] `replyTo` 覆盖回复目标（缺省 = from）
- [ ] `callback` 在回复投递后触发 webhook/rpc 通知（适用于 external 类型）

### 时间线分叉
- [ ] `email.fork` 可指定 `forkFrom` 目标 Email，创建新分叉
- [ ] 支持 `context-compression` 和 `direction-change` 两种分叉原因
- [ ] 分叉时原时间线后续 Email 自动标记为 `obsolete`
- [ ] `compressedContext` 作为新分叉的初始知识注入
- [ ] Agent 可自发触发分叉（检测到上下文浪费或方向错误）
- [ ] 人为可通过 CLI `actant email fork --from <emailId> --reason ...` 触发
- [ ] Email Hub 维护完整时间线 DAG，`actant email threads` 可展示分叉历史

---

## Comments
