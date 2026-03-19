# Tool Ownership

**副标题**：Tool ownership models and policy

---

## Overview

ACP-EX 识别四种不同的工具所有权模型。每种模型在定义、执行和 Channel 职责上有所不同。参见 [Tool Calls](./tool-calls.md)、[MCP](./mcp.md)、[Host Tools](./host-tools.md)。

---

## Four Ownership Models

### Backend Built-in Tools

- **定义方**：Backend（LLM 原生工具，如 bash、file_edit）
- **执行方**：Backend
- **Channel 职责**：观察（tool_call 事件）+ 审批（requestPermission）
- **示例**：Claude 的 bash tool、file edit tool

### MCP Tools

- **定义方**：外部 MCP Server
- **执行方**：Backend 连接 MCP 服务器
- **Channel 职责**：配置透传（mcpServers）+ 动态管理（setMcpServers）
- **示例**：用户配置的 MCP 服务器

### Host-Provided Tools

- **定义方**：Host（ContextFS Source）
- **执行方**：Host（通过 executeTool 回调）
- **Channel 职责**：定义透传（hostTools）+ 执行路由（executeTool）
- **示例**：Actant 的 context tools、workspace tools

### In-Process SDK Tools

- **定义方**：Backend 内部（SDK plugins/hooks）
- **执行方**：Backend 内部
- **Channel 职责**：不可见（通过 backendOptions 透传）
- **示例**：Claude SDK hooks、自定义 SDK 插件

---

## Tool Policy

```typescript
interface ToolPolicy {
  allowed?: string[];
  denied?: string[];
  autoApproved?: string[];
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| allowed | string[] | 白名单，仅允许列出的工具。若设置，则仅这些工具可用。 |
| denied | string[] | 黑名单，禁止使用的工具。这些工具 MUST NOT 被使用。 |
| autoApproved | string[] | 跳过 requestPermission 的工具。Host SHOULD 自动批准这些工具。 |

---

## Policy Resolution

- `denied` 优先于 `allowed`
- `autoApproved` 优先于 requestPermission
- 策略适用于所有工具类型（built-in、MCP、host、SDK）

---

## Adapter Tool/MCP Strategy Summary

| Feature | AcpChannelAdapter | ClaudeChannelAdapter | PiChannelAdapter |
|---------|:-----------------:|:--------------------:|:----------------:|
| mcpServers | ACP session/new | SDK options.mcpServers | Pi ACP bridge |
| hostTools | ACTANT_TOOLS env | createSdkMcpServer() | buildInternalTools() |
| executeTool | CLI/RPC callback | in-process MCP handler | AgentTool.execute |
| setMcpServers | Not supported | query.setMcpServers() | Depends on Pi SDK |
| registerHostTools | Not supported | Supported | Depends on Pi SDK |
