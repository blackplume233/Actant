# Session Events

**副标题**：Core and extended event types

---

## Overview

Event 是 Backend 向 Host 通信的主要机制。流式模式下，事件由 `streamPrompt()` yield；Out-of-band 时，事件可通过 `ChannelHostServices.sessionUpdate()` 推送。Core 事件类型与 ACP `SessionUpdate` 完全一致；Extended 类型使用 `x_` 前缀。

当前实现规则：

- adapter SHOULD 在每个可映射的 `StreamChunk` 上附带 `chunk.event`
- `event-compat.ts` 负责 `ChannelEvent <-> StreamChunk` 的双向兼容和 record entry 映射
- recording 优先消费原生 `ChannelEvent`，仅在旧 chunk 路径下回退到 `legacyChunkToChannelEvent()`
- 对于没有合适 legacy chunk 表示的事件，Host 应通过 `sessionUpdate()` 处理，而不是强行压缩到旧四元 chunk 形态

---

## ChannelEvent Base

```typescript
interface ChannelEvent {
  type: ChannelEventType;
  sessionId: string;
  timestamp?: number;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | ChannelEventType | Yes | 事件类型判别符 |
| sessionId | string | Yes | 产生此事件的 session |
| timestamp | number | No | Unix 时间戳（毫秒） |

---

## ChannelEventType

```typescript
type ChannelEventType = CoreEventType | ExtendedEventType;
```

---

## Core Event Types

### agent_message_chunk

> Agent 的文本响应片段。

**ACP Equivalent**：`sessionUpdate: "agent_message_chunk"`

```typescript
interface AgentMessageChunkEvent extends ChannelEvent {
  type: "agent_message_chunk";
  content: ChannelContent;
}
```

- Backend SHOULD 在 LLM 生成文本时增量发送
- Host SHOULD 将 content 追加到对话展示

---

### agent_thought_chunk

> Agent 的内部推理/thinking 片段。

**ACP Equivalent**：`sessionUpdate: "agent_thought_chunk"`

```typescript
interface AgentThoughtChunkEvent extends ChannelEvent {
  type: "agent_thought_chunk";
  content: ChannelContent;
}
```

- 表示 Host MAY 在折叠/特殊区域展示的内部推理

---

### user_message_chunk

> 用户消息片段（session 恢复时的回放）。

**ACP Equivalent**：`sessionUpdate: "user_message_chunk"`

- 仅在 `resumeSession()` 期间发送，用于回放对话历史

---

### tool_call

> 工具调用上报。

**ACP Equivalent**：`sessionUpdate: "tool_call"`

```typescript
interface ToolCallEvent extends ChannelEvent {
  type: "tool_call";
  toolCallId: string;
  title?: string;
  kind?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
}
```

| Field | Type | Description |
|-------|------|-------------|
| toolCallId | string | 工具调用唯一 ID |
| title | string | 可选的展示标题 |
| kind | string | 工具类型，见下表 |
| status | string | 状态：pending / in_progress / completed / failed |
| input | unknown | 输入参数 |
| output | unknown | 输出结果（completed 时） |

**kind 取值**：`"bash"` | `"file_edit"` | `"read"` | `"search"` | `"mcp_tool"` | `"host_tool"` | `"think"` | `"other"`

---

### tool_call_update

> 工具调用进度/结果更新。

**ACP Equivalent**：`sessionUpdate: "tool_call_update"`

```typescript
interface ToolCallUpdateEvent extends ChannelEvent {
  type: "tool_call_update";
  toolCallId: string;
  status?: "pending" | "in_progress" | "completed" | "failed";
  content?: ToolCallContent[];
}

type ToolCallContent =
  | { type: "content"; content: ChannelContent }
  | { type: "diff"; path: string; oldText?: string; newText?: string }
  | { type: "terminal"; terminalId: string; output?: string };
```

| Field | Type | Description |
|-------|------|-------------|
| toolCallId | string | 对应的工具调用 ID |
| status | string | 更新后的状态 |
| content | ToolCallContent[] | 增量内容（content、diff、terminal） |

---

### plan

> Agent 执行计划。

**ACP Equivalent**：`sessionUpdate: "plan"`

```typescript
interface PlanEvent extends ChannelEvent {
  type: "plan";
  entries: Array<{ status: string; content: string; priority?: string }>;
}
```

---

### available_commands_update

> 可用 slash 命令更新。

**ACP Equivalent**：`sessionUpdate: "available_commands_update"`

---

### current_mode_update

> Session 模式变更。

**ACP Equivalent**：`sessionUpdate: "current_mode_update"`

```typescript
interface CurrentModeUpdateEvent extends ChannelEvent {
  type: "current_mode_update";
  modeId: string;
}
```

---

### config_option_update

> 配置项变更。

**ACP Equivalent**：`sessionUpdate: "config_option_update"`

```typescript
interface ConfigOptionUpdateEvent extends ChannelEvent {
  type: "config_option_update";
  configId: string;
  value: unknown;
}
```

---

## Extended Event Types

### x_result_success

> Prompt 成功完成。

```typescript
interface ResultSuccessEvent extends ChannelEvent {
  type: "x_result_success";
  result: string;
  stopReason: string;
  usage?: ChannelUsage;
  structuredOutput?: unknown;
}
```

- 这是 `streamPrompt()` 成功完成时的最终事件

---

### x_result_error

> Prompt 失败。

```typescript
interface ResultErrorEvent extends ChannelEvent {
  type: "x_result_error";
  errors: string[];
  stopReason: string;
  usage?: ChannelUsage;
}
```

---

### x_tool_use_summary

> 工具使用摘要（Claude SDK 特有）。

当前仍通过 `tool_call_update` 兼容映射落到旧 `StreamChunk` 展示层；如需保留更强语义，应优先扩展原生 `ChannelEvent` 消费端而不是继续扩充 legacy chunk 类型。

---

### x_session_init / x_session_ready

> Session 初始化/就绪事件。

这两个事件保留为扩展点；当前主链路更多依赖 connect 返回值与 `sessionUpdate()` 回调，而不是单独的 init/ready 事件。

---

### x_prompt_start / x_prompt_end

> Prompt 处理边界事件。

- Claude SDK adapter 会显式发送这两个事件
- `RecordingChannelDecorator` 会把它们映射为 `prompt_sent` / `prompt_complete`
- service lease 覆盖场景下，事件记录使用 activity session override，而不是底层 ACP session ID

---

### x_activity_record

> Activity 记录事件。

这是协议层将 backend-specific activity 上送到统一记录系统的扩展口。`channelEventToRecordEntry()` 会把它映射到对应 category/type/data。

---

### x_budget_update

> Token/成本预算更新。

---

### x_keepalive

> 连接保活。

---

## SessionNotification Format (ACP Compatible)

ACP 兼容的 SessionNotification 包装结构：

```typescript
interface SessionNotification {
  sessionId: string;
  update: SessionUpdate;
}

type SessionUpdate =
  | { sessionUpdate: "agent_message_chunk"; content: ChannelContent }
  | { sessionUpdate: "agent_thought_chunk"; content: ChannelContent }
  | { sessionUpdate: "user_message_chunk"; content: ChannelContent }
  | { sessionUpdate: "tool_call"; toolCallId: string; /* ... */ }
  | { sessionUpdate: "tool_call_update"; toolCallId: string; /* ... */ }
  | { sessionUpdate: "plan"; entries: Array<{ status: string; content: string; priority?: string }> }
  | { sessionUpdate: "available_commands_update"; /* ... */ }
  | { sessionUpdate: "current_mode_update"; modeId: string }
  | { sessionUpdate: "config_option_update"; configId: string; value: unknown }
  | { sessionUpdate: "x_result_success"; result: string; stopReason: string; /* ... */ }
  | { sessionUpdate: "x_result_error"; errors: string[]; stopReason: string; /* ... */ }
  /* ... 其他 Extended 类型 ... */;
```
