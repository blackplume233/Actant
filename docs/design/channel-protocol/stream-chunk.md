# StreamChunk Compatibility

**副标题**：Legacy StreamChunk 映射与升级路径

---

## Overview

`StreamChunk` 是 `@actant/core` 中当前的流式类型。它是 `ChannelEvent` 的简化投影。本文档描述兼容层与迁移路径。

---

## Current StreamChunk

```typescript
interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | "text" \| "tool_use" \| "result" \| "error" | 块类型 |
| content | string | 块内容 |

---

## ChannelEvent → StreamChunk Mapping

| ChannelEvent Type | StreamChunk Type | Mapping |
|-------------------|-----------------|---------|
| agent_message_chunk | "text" | content.text → content |
| tool_call | "tool_use" | title 或 toolCallId → content |
| tool_call_update (completed) | "tool_use" | content[0].content.text → content |
| x_result_success | "result" | result → content |
| x_result_error | "error" | errors.join(", ") → content |
| Other events | (ignored) | 不映射到 StreamChunk |

---

## Upgrade Path

### Phase 1 (Current)

- AgentManager 消费 StreamChunk
- Adapter 负责 ChannelEvent → StreamChunk 转换
- 现有 API 消费者无需变更

### Phase 2 (Planned)

```typescript
interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
  event?: ChannelEvent;  // Optional full event
}
```

- Adapter 在现有字段旁填充 `event` 字段
- 现有消费者不受影响（忽略 `event`）
- 新消费者可访问完整事件数据

### Phase 3 (Future)

- AgentManager 直接消费 ChannelEvent
- StreamChunk 仅作为外部 API 序列化格式
- 内部 pipeline 完全使用 ChannelEvent 类型
