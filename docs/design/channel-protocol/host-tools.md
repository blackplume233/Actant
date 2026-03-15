# Host Tools

**副标题**：Host-provided tool management and execution

---

## Overview

Host 可以向 Backend 提供工具，Backend 将这些工具暴露给 LLM。当 LLM 调用 host tool 时，Backend 通过 `executeTool()` 回调 Host。此机制替代当前的 `ACTANT_TOOLS` 环境变量和 RPC hack。

---

## Static Tool Registration

通过 `ChannelConnectOptions.hostTools` 在 connect() 时提供，参见 [Initialization](./initialization.md)。

---

## HostToolDefinition

```typescript
interface HostToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  scope?: "all" | "service" | "employee";
  instructions?: string;
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| name | string | Yes | 工具名称，对 LLM 可见 |
| description | string | Yes | 工具描述，对 LLM 可见 |
| parameters | Record | Yes | 参数的 JSON Schema，对 LLM 可见 |
| scope | string | No | 访问范围限制 |
| instructions | string | No | 注入到 system context 的使用说明 |

---

## ActantChannel.registerHostTools()

> 运行时动态注册 Host 工具。

**Profile**：Extended  
**Requirement**：可选（`capabilities.dynamicTools = true`）

### Signature

```typescript
registerHostTools?(tools: HostToolDefinition[]): Promise<void>;
```

### Behavior

- Backend MUST 使新注册的工具对 LLM 可用
- 若同名工具已存在，Backend SHOULD 更新该工具

---

## ActantChannel.unregisterHostTools()

> 运行时动态注销 Host 工具。

**Profile**：Extended  
**Requirement**：可选（`capabilities.dynamicTools = true`）

### Signature

```typescript
unregisterHostTools?(toolNames: string[]): Promise<void>;
```

---

## ChannelHostServices.executeTool()

> Backend 调用 Host 提供的工具。

**Profile**：Extended  
**ACP Equivalent**：None（替代 `ACTANT_TOOLS` env var + RPC hack）

### Signature

```typescript
executeTool?(
  toolName: string,
  params: Record<string, unknown>,
): Promise<ToolExecutionResult>;
```

### Parameters

| 参数 | 类型 | 描述 |
|------|------|------|
| toolName | string | 工具名称（必须匹配已注册的 HostToolDefinition.name） |
| params | Record | 符合工具 JSON Schema 的参数 |

### ToolExecutionResult

```typescript
interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| success | boolean | 执行是否成功 |
| output | unknown | 成功时的工具输出 |
| error | string | 失败时的错误信息 |

### Behavior

- Backend MUST 仅对通过 hostTools 或 registerHostTools 注册的工具调用 executeTool
- Host MUST 执行工具并返回结果
- 若 toolName 未识别，Host SHOULD 返回 `{ success: false, error: "Unknown tool" }`

---

## Adapter Implementation

各适配器对 host tools 的实现方式：

| 适配器 | 实现方式 |
|--------|----------|
| **AcpChannelAdapter** | hostTools 映射为 ACTANT_TOOLS 环境变量和 system context 注入（legacy 兼容） |
| **ClaudeChannelAdapter** | hostTools 通过 createSdkMcpServer() 创建进程内 MCP，handler 调用 executeTool() |
| **PiChannelAdapter** | hostTools 通过 buildInternalTools() 转为 AgentTool[]，execute 时调用 executeTool() |
