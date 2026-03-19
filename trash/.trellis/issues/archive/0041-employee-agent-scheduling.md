---
id: 41
title: 雇员型 Agent — 持续调度与主动行为系统
status: closed
labels:
  - feature
  - architecture
  - acp
  - "priority:P1"
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 25
  - 13
  - 14
  - 16
  - 18
  - 10
  - 11
relatedFiles:
  - packages/core/src/scheduler/task-queue.ts
  - packages/core/src/scheduler/task-dispatcher.ts
  - packages/core/src/scheduler/inputs/heartbeat-input.ts
  - packages/core/src/scheduler/inputs/cron-input.ts
  - packages/core/src/scheduler/inputs/hook-input.ts
  - packages/core/src/scheduler/inputs/input-router.ts
  - packages/core/src/scheduler/execution-log.ts
  - packages/api/src/http/webhook-server.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/acp/src/connection.ts
  - packages/acp/src/connection-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#41"
closedAs: completed
createdAt: "2026-02-21T06:00:00"
updatedAt: "2026-02-22T12:00:00"
closedAt: "2026-02-22T21:23:00Z"
---

**Related Issues**: [[0025-acp-service]], [[0013-acp-endpoint]], [[0014-plugin-heartbeat-scheduler-memory]], [[0016-mcp-server]], [[0018-acp-proxy-full-protocol]], [[0010-instance-memory-layer-phase-1]], [[0011-memory-consolidation-shared-memory-phase-2]]
**Related Files**: `packages/core/src/scheduler/task-queue.ts`, `packages/core/src/scheduler/task-dispatcher.ts`, `packages/core/src/scheduler/inputs/heartbeat-input.ts`, `packages/core/src/scheduler/inputs/cron-input.ts`, `packages/core/src/scheduler/inputs/hook-input.ts`, `packages/core/src/scheduler/inputs/input-router.ts`, `packages/core/src/scheduler/execution-log.ts`, `packages/api/src/http/webhook-server.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/acp/src/connection.ts`, `packages/acp/src/connection-manager.ts`

---

## 目标

实现雇员型 Agent 的持续调度能力，使 Daemon 能够像管理员工一样管理长驻 Agent——不仅保持进程存活，还能主动派发任务、响应事件、定时执行。

**核心差异**：当前 `acp-service` 模式只做了「保活」（崩溃重启），但雇员型 Agent 需要「保活 + 调度 + 主动行为」。

## 参考：OpenClaw 的输入系统

OpenClaw 的核心设计洞察是 **将 Time 和 State 视为 Input**，使 Agent 具备主动行为而非仅仅被动响应。它定义了六种输入类型：

| 输入类型 | 说明 | Actant 对应 |
|----------|------|----------------|
| **Messages** | 人类通过各渠道发送的消息 | `agent.prompt` / `agent chat` |
| **Heartbeats** | 定时器（默认 30 分钟）提示 Agent "检查是否有待办任务" | **新增：HeartbeatInput** |
| **Cron Jobs** | 按 cron 表达式定时触发，带具体指令 | **新增：CronInput** |
| **Hooks** | 内部状态变更触发（系统启动、任务完成等） | **新增：HookInput** |
| **Webhooks** | 外部系统通知（GitHub PR、Jira ticket 等） | **新增：WebhookInput** |
| **Agent-to-Agent** | Agent 间消息传递，协作完成任务 | MCP Server (#17) |

OpenClaw 的关键设计：
- Hub-and-Spoke 架构：Gateway 做连接管理和消息路由，不做推理
- Lane Queue：每个 session 串行执行（一个 prompt 完成才发下一个）
- SOUL.md / AGENTS.md / TOOLS.md：agent 配置与能力声明（Actant 已有类似设计）
- Memory 分层：Context（临时，token 窗口内） vs Memory（持久，磁盘存储）
- Debounced Indexing：批量写入避免频繁索引

## 架构设计

### 雇员型 Agent 连接模型

```
┌─────────────────────────────────────────────────────────────┐
│  Actant Daemon                                          │
│                                                             │
│  ┌─── Input Router ───────────────────────────────────────┐ │
│  │                                                         │ │
│  │  ┌────────────┐  ┌───────────┐  ┌──────────────────┐  │ │
│  │  │ Heartbeat  │  │ Cron      │  │ Webhook          │  │ │
│  │  │ Timer      │  │ Scheduler │  │ Receiver         │  │ │
│  │  │ (30min)    │  │ (crontab) │  │ (HTTP endpoint)  │  │ │
│  │  └─────┬──────┘  └─────┬─────┘  └────────┬─────────┘  │ │
│  │        │               │                  │            │ │
│  │        ▼               ▼                  ▼            │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │           Task Queue (per agent, serial)         │  │ │
│  │  │  [heartbeat] [cron:email] [webhook:pr-42] [hook] │  │ │
│  │  └──────────────────────┬───────────────────────────┘  │ │
│  │                         │                              │ │
│  │                    dequeue → dispatch                   │ │
│  └─────────────────────────┼──────────────────────────────┘ │
│                            │                                │
│                            ▼                                │
│  ┌─── AcpConnection ─────────────────────────────────────┐ │
│  │  prompt(sessionId, taskPrompt)                         │ │
│  │  ← sessionUpdate (streaming)                           │ │
│  │  → execution log                                       │ │
│  └─────────────────────────┬─────────────────────────────┘ │
│                            │ ACP / stdio                    │
└────────────────────────────┼────────────────────────────────┘
                             ▼
                      ┌──────────────┐
                      │ Agent 子进程  │  cwd = agent workspace
                      │ (长驻运行)    │  domain context 完整
                      └──────────────┘
```

### 与工具型 Agent 的对比

| 维度 | 工具型 (#35) | 雇员型 (本 issue) |
|------|------------|------------------|
| AcpConnection 归属 | Proxy/Chat CLI | **Daemon** |
| 进程生命周期 | 跟随连接 | **长驻，Daemon 管理** |
| 驱动方 | 人类（IDE/Chat） | **Daemon 调度器** |
| 输入来源 | 人类 prompt | Heartbeat / Cron / Webhook / Hook / Agent-to-Agent / 人类 |
| cwd | agent workspace | agent workspace |
| launchMode | interactive / acp-background | **acp-service** |
| processOwnership | external | **managed** |

两种类型共存，不需要 ACP Gateway。

## 输入系统设计

### 1. Heartbeat — 主动检查

定时提示 Agent 检查是否有待办事项。这是雇员型 Agent "活力感" 的核心来源。

```typescript
interface HeartbeatConfig {
  enabled: boolean;
  intervalMs: number;         // 默认 30 分钟
  prompt: string;             // "检查是否有待处理的任务"
  suppressNoAction: boolean;  // Agent 无操作时不记录
}
```

行为：
- 每隔 `intervalMs` 发送 heartbeat prompt
- Agent 检查环境状态（文件变更、pending tasks 等）
- 如果 Agent 回复 "无需操作"，可选择静默（suppressNoAction）
- 如果 Agent 发现需要处理的事项，正常执行

### 2. Cron — 定时任务

按 cron 表达式定时触发，带具体指令。

```typescript
interface CronConfig {
  schedule: string;           // cron 表达式: "0 9 * * 1-5"
  prompt: string;             // "检查邮件并汇总重要事项"
  label?: string;             // 任务标签: "morning-email"
  timezone?: string;          // 时区
}
```

示例场景：
- `"0 9 * * 1-5"`: 工作日早 9 点检查邮件
- `"0 */4 * * *"`: 每 4 小时巡检代码仓库
- `"0 18 * * 5"`: 每周五下午 6 点生成周报

### 3. Hook — 内部事件触发

内部状态变更触发 Agent 行动。

```typescript
interface HookConfig {
  event: HookEvent;
  prompt: string;
}

type HookEvent =
  | "agent:started"         // Agent 进程启动完成
  | "agent:recovered"       // 崩溃重启恢复
  | "task:completed"        // 上一个任务完成
  | "task:failed"           // 上一个任务失败
  | "memory:updated"        // 记忆系统更新（future）
  | "agent:idle"            // Agent 空闲超过阈值
```

### 4. Webhook — 外部事件触发

外部系统通过 HTTP 通知 Agent。

```typescript
interface WebhookConfig {
  path: string;              // "/agents/:name/webhook/:event"
  secret?: string;           // HMAC 验证
  promptTemplate: string;    // "处理 GitHub event: {{payload}}"
}
```

示例：
- GitHub Push → Agent 自动 code review
- Jira Ticket Created → Agent 分析并回复
- Slack @mention → Agent 响应团队问题

### 5. Agent-to-Agent — 协作

通过 MCP Server (#17) 实现，Agent A 完成任务后可派发给 Agent B。

## Task Queue 设计

### 串行执行（参考 OpenClaw Lane Queue）

ACP session 是串行的——一个 prompt 响应完才能发下一个。Task Queue 保证执行顺序：

```typescript
interface TaskQueue {
  enqueue(task: AgentTask): void;
  dequeue(): AgentTask | undefined;
  peek(): AgentTask | undefined;
  size: number;
  isProcessing: boolean;
}

interface AgentTask {
  id: string;
  source: "heartbeat" | "cron" | "hook" | "webhook" | "prompt" | "agent";
  prompt: string;
  priority: number;           // 0 = 最高
  createdAt: string;
  metadata?: Record<string, unknown>;
}
```

### 执行流程

```
1. Input 到达（heartbeat/cron/webhook/prompt）
2. 创建 AgentTask，入队
3. 如果 Agent 空闲 → 立即 dequeue + dispatch
4. 如果 Agent 忙碌 → 等待当前任务完成
5. dispatch: acpConnection.prompt(sessionId, task.prompt)
6. 收集 sessionUpdate → 记录执行日志
7. 完成 → 触发 task:completed hook → dequeue 下一个
8. 失败 → 触发 task:failed hook → 可选重试
```

### 优先级

- 人类 prompt（`agent.prompt` RPC）> Webhook > Cron > Heartbeat
- 高优先级任务可插队（enqueue 到队首）

## 可观测性

### Execution Log

每次任务执行记录：

```typescript
interface ExecutionRecord {
  taskId: string;
  agentName: string;
  source: string;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  responseText?: string;
  toolCalls?: string[];
  durationMs?: number;
}
```

### 观察命令

```bash
actant agent logs my-employee           # 查看历史执行日志
actant agent watch my-employee          # 实时订阅 sessionUpdate 流
actant agent tasks my-employee          # 查看任务队列状态
actant agent dispatch my-employee "..." # 手动派发任务
```

### Notification Stream

Daemon 通过 RPC stream 或 Unix socket 向观察者推送实时通知。观察者是只读的，不参与 ACP 协议。

## 模板配置

在 AgentTemplate 中新增 `schedule` 字段：

```json
{
  "name": "pr-reviewer",
  "backendType": "claude-code",
  "launchMode": "acp-service",
  "schedule": {
    "heartbeat": {
      "enabled": true,
      "intervalMs": 1800000,
      "prompt": "检查是否有新的 PR 需要审查",
      "suppressNoAction": true
    },
    "cron": [
      {
        "schedule": "0 9 * * 1-5",
        "prompt": "生成昨日代码审查报告",
        "label": "daily-report"
      }
    ],
    "webhooks": [
      {
        "path": "/webhook/github",
        "promptTemplate": "GitHub 事件: {{event}} - {{payload.action}} on {{payload.repository.full_name}}"
      }
    ],
    "hooks": [
      {
        "event": "agent:started",
        "prompt": "你已启动。检查待处理事项并向我汇报。"
      }
    ]
  },
  "domainContext": {
    "skills": ["code-review", "github-integration"],
    "prompts": ["pr-reviewer-system"],
    "mcpServers": ["github-mcp"]
  }
}
```

## 实现计划

### Phase 1: Task Queue + Dispatch 基础

1. **`packages/core/src/scheduler/task-queue.ts`**（新增）— 串行任务队列
2. **`packages/core/src/scheduler/task-dispatcher.ts`**（新增）— 任务派发器
3. **`packages/core/src/manager/agent-manager.ts`**（修改）— 集成 dispatcher
4. **CLI: `agent dispatch <name> "prompt"`**（新增）— 手动派发

### Phase 2: 输入系统

1. **`packages/core/src/scheduler/inputs/heartbeat-input.ts`**（新增）
2. **`packages/core/src/scheduler/inputs/cron-input.ts`**（新增）
3. **`packages/core/src/scheduler/inputs/hook-input.ts`**（新增）
4. **`packages/core/src/scheduler/inputs/input-router.ts`**（新增）— 统一路由
5. 模板 schema 扩展 `schedule` 字段

### Phase 3: Webhook + 可观测性

1. **`packages/api/src/http/webhook-server.ts`**（新增）— HTTP webhook 接收
2. **`packages/core/src/scheduler/execution-log.ts`**（新增）— 执行日志
3. **CLI: `agent logs` / `agent watch` / `agent tasks`**（新增）
4. RPC stream 通知推送

### Phase 4: 与 Memory 集成（依赖 #1/#2）

- Agent 执行结果持久化到 Memory
- Heartbeat 检查包含 Memory 上下文
- Daily summary 自动写入 Memory

## 依赖

| 依赖 | 状态 | 说明 |
|------|------|------|
| #11 acp-service 崩溃重启 | ✅ 完成 | 进程保活基础 |
| #12 Daemon ↔ Agent 通信 | ✅ 完成 | AcpConnection 基础 |
| #13 Plugin 体系 | 待开始 | Heartbeat/Scheduler 可作为 Plugin |
| #17 MCP Server | 待开始 | Agent-to-Agent 通信 |
| #1/#2 Memory 系统 | 待开始 | Phase 4 依赖 |

## 与 #13 Plugin 体系的关系

#13 定义了 Plugin 接口（onStart / onStop / onTick）和 HeartbeatMonitor。本 issue 的输入系统可以实现为 Plugin：

- HeartbeatInput → HeartbeatMonitor plugin 的扩展
- CronInput → Scheduler plugin
- 如果 #13 先实现 Plugin 接口，本 issue 的各 Input 可作为 Plugin 注册
- 如果本 issue 先实现，可后续重构为 Plugin 形态

建议：本 issue 先实现核心调度能力（不依赖 Plugin 接口），#13 后续提供 Plugin 化的重构路径。

## 验收标准

- [ ] Daemon 可持续调度 acp-service 模式的 Agent（任务串行执行）
- [ ] Heartbeat 定时触发 Agent 主动检查任务
- [ ] Cron 按表达式定时派发任务
- [ ] Hook 在内部事件时触发 Agent 行动
- [ ] Task Queue 保证串行执行、支持优先级
- [ ] `agent dispatch` 手动派发任务
- [ ] `agent logs` 查看执行历史
- [ ] `agent watch` 实时观察 Agent 输出
- [ ] 模板支持 `schedule` 配置字段
- [ ] 任务失败时正确处理（记录、触发 hook、可选重试）

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

Phase 3c MVP completed: TaskQueue + TaskDispatcher (#48), InputRouter + HeartbeatInput/CronInput/HookInput (#49), EmployeeScheduler + CLI integration (#50). 51/51 scheduler tests passing. Remaining P2 optional items: WebhookInput + HMAC, N8N Bridge, agent watch command. Keeping open as reference design doc for future enhancements.
