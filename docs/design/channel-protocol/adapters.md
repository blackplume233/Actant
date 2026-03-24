# Adapters

**副标题**：适配器实现指南

---

## Overview

Adapter 将 ActantChannel 桥接到 backend 特有协议。每个 adapter 实现 ActantChannel 并处理 ChannelHostServices 注入。本文档提供各 adapter 的实现指导。

---

## Adapter Architecture

```
ActantChannelManager
  ├── AcpChannelAdapter      (wraps AcpConnectionManager, ACP/NDJSON over stdio)
  ├── ClaudeChannelAdapter   (uses @anthropic-ai/claude-agent-sdk)
  ├── PiChannelAdapter       (uses Pi SDK)
  └── CustomChannelAdapter   (user-provided)
```

---

## AcpChannelAdapter

> 将现有 ACP 连接桥接到 ActantChannel。

### Implementation Package

`@actant/acp` → `AcpChannelManagerAdapter` + `AcpChannelAdapter`

### Capabilities

| Capability | Value |
|------------|-------|
| streaming | true |
| cancel | true |
| resume | partial (loadSession) |
| multiSession | true |
| configurable | true |
| callbacks | true |
| needsFileIO | true |
| needsTerminal | true |
| needsPermission | true |
| structuredOutput | false |
| thinking | false |
| dynamicMcp | false |
| dynamicTools | false |
| contentTypes | ["text"] |
| extensions | [] |

### Key Implementation Details

- 封装 `AcpConnectionManager` 和 `AcpConnection`
- `prompt()` → ACP `session/prompt`（通过 AcpCommunicator）
- `streamPrompt()` → ACP streaming（通过 raw event 解析）
- `cancel()` → ACP `session/cancel`
- `newSession()` → ACP `session/new`
- `resumeSession()` → ACP `session/load`
- `configure()` → ACP `session/set_mode` + `session/set_config_option`
- HostServices 回调透传给 ACP callback handler
- Activity recording 通过 RecordingCallbackHandler 包装（legacy）

### Limitations

- 无 dynamic MCP 支持（setMcpServers 不可用）
- 无 dynamic tool 注册
- 无 structured output
- Host tools 通过环境变量 hack（legacy path）

---

## ClaudeChannelAdapter

> 与 Claude Agent SDK 直接集成。

### Implementation Package

`@actant/channel-claude`

### Capabilities

| Capability | Value |
|------------|-------|
| streaming | true |
| cancel | true |
| resume | true |
| multiSession | false |
| configurable | true |
| callbacks | false |
| needsFileIO | false |
| needsTerminal | false |
| needsPermission | true |
| structuredOutput | true |
| thinking | true |
| dynamicMcp | true |
| dynamicTools | true |
| contentTypes | ["text", "image", "resource"] |
| extensions | ["hooks", "agents", "effort"] |

### Key Implementation Details

- 使用 `@anthropic-ai/claude-agent-sdk` 的 `query()` 函数
- `prompt()` → `query()` 配合 `maxTurns`，返回最终结果
- `streamPrompt()` → `query()` 配合 event streaming，将 SDK 事件映射为 ChannelEvent
- `cancel()` → AbortController signal
- `configure()` → SDK session 配置
- `setMcpServers()` → `query.setMcpServers()`
- Host tools → `createSdkMcpServer()` 作为 in-process MCP，tool 调用路由到 `hostServices.executeTool()`
- 不需要 Host 文件 I/O 或终端服务（Claude SDK 原生支持）
- 支持 structured output、thinking 控制、effort 控制

### Advantages

- 完整 Extended Profile 支持
- 直接 SDK 访问，消除 ACP binary 开销
- 原生支持 hooks、agents、runtime integrations

---

## PiChannelAdapter

> 与 Pi agent SDK 集成。

### Implementation Package

`@actant/channel-pi`

### Capabilities

| Capability | Value |
|------------|-------|
| streaming | true |
| cancel | false |
| resume | false |
| multiSession | false |
| configurable | false |
| callbacks | true |
| needsFileIO | true |
| needsTerminal | true |
| needsPermission | true |
| structuredOutput | false |
| thinking | false |
| dynamicMcp | false |
| dynamicTools | false |
| contentTypes | ["text"] |
| extensions | [] |

### Key Implementation Details

- Pi 特有协议转换
- 需要 Host 文件 I/O 和终端服务
- Host tools 通过 buildInternalTools() → AgentTool[]

---

## CustomChannelAdapter

> 用户提供的 custom backend 适配器。

### Minimum Implementation

```typescript
class CustomAdapter implements ActantChannel {
  async prompt(sessionId: string, text: string): Promise<ChannelPromptResult> {
    // Required: 实现 prompt 逻辑
  }
  get isConnected(): boolean { return true; }
  get capabilities(): ChannelCapabilities {
    return {
      streaming: false, cancel: false, resume: false,
      multiSession: false, configurable: false, callbacks: false,
      needsFileIO: false, needsTerminal: false, needsPermission: false,
      structuredOutput: false, thinking: false, dynamicMcp: false,
      dynamicTools: false, contentTypes: ["text"], extensions: [],
    };
  }
}
```

### Checking Support

Custom adapter 实现者 MUST 在 `capabilities` 中准确声明支持的能力。Host 将据此决定可调用的方法及需注入的 Host 服务。
