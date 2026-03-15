# MCP

**副标题**：MCP server management

---

## Overview

MCP（Model Context Protocol）服务器提供外部工具和数据源。Host 在 connect() 时或运行时动态提供 MCP 服务器配置。ACP-EX 支持 ACP 的所有传输类型，并增加 `x_sdk` 用于进程内 SDK 服务器。

---

## Static MCP Configuration

通过 `ChannelConnectOptions.mcpServers` 在 connect() 时提供，参见 [Initialization](./initialization.md)。

---

## McpServerSpec

```typescript
interface McpServerSpec {
  name: string;
  transport: McpTransportConfig;
}
```


| 字段        | 类型                 | 描述          |
| --------- | ------------------ | ----------- |
| name      | string             | 人类可读的服务器标识符 |
| transport | McpTransportConfig | 传输配置        |


---

## McpTransportConfig

```typescript
type McpTransportConfig =
  | StdioTransport
  | SseTransport
  | HttpTransport
  | SdkTransport;
```

---

## Stdio Transport

**Support**：所有 Backend MUST 支持 stdio 传输。

```typescript
interface StdioTransport {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```


| 字段      | 类型                     | 必填  | 描述                |
| ------- | ---------------------- | --- | ----------------- |
| type    | "stdio"                | Yes | 传输类型判别符           |
| command | string                 | Yes | MCP 服务器可执行文件的绝对路径 |
| args    | string[]               | No  | 命令行参数             |
| env     | Record<string, string> | No  | 环境变量              |


---

## SSE Transport (deprecated)

**ACP Equivalent**：SSE transport  
**Support**：可选（connect 时通过 capabilities 检查）

```typescript
interface SseTransport {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}
```

---

## HTTP Transport

**ACP Equivalent**：HTTP transport

```typescript
interface HttpTransport {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}
```

---

## SDK Transport (Extended)

**ACP Equivalent**：None  
**Profile**：Extended

```typescript
interface SdkTransport {
  type: "x_sdk";
  name: string;
}
```

用于进程内 SDK MCP 服务器（例如 ClaudeChannelAdapter 为 host tools 创建 SDK MCP 服务器）。


| 字段   | 类型      | 描述        |
| ---- | ------- | --------- |
| type | "x_sdk" | 判别符       |
| name | string  | SDK 服务器名称 |


---

## ActantChannel.setMcpServers()

> 运行时动态添加或移除 MCP 服务器。

**Profile**：Extended  
**Requirement**：可选（`capabilities.dynamicMcp = true`）  
**ACP Equivalent**：None

### Checking Support

```typescript
if (!channel.capabilities.dynamicMcp || !channel.setMcpServers) {
  // Dynamic MCP not supported
  return;
}
```

### Signature

```typescript
setMcpServers?(
  servers: Record<string, McpTransportConfig>,
): Promise<McpSetResult>;
```

### Parameters


| 参数      | 类型                                 | 描述                       |
| ------- | ---------------------------------- | ------------------------ |
| servers | Record<string, McpTransportConfig> | 服务器名称到传输配置的映射。空对象表示移除所有。 |


### McpSetResult

```typescript
interface McpSetResult {
  connected: string[];
  failed: Array<{ name: string; error: string }>;
}
```


| 字段        | 类型       | 描述            |
| --------- | -------- | ------------- |
| connected | string[] | 成功连接的服务器名称列表  |
| failed    | Array    | 连接失败的服务器及错误信息 |


---

## ActantChannel.getMcpStatus()

> 查询已连接 MCP 服务器状态。

**Profile**：Extended  
**Requirement**：可选（`capabilities.dynamicMcp = true`）

### Signature

```typescript
getMcpStatus?(): Promise<McpServerStatus[]>;
```

### McpServerStatus

```typescript
interface McpServerStatus {
  name: string;
  connected: boolean;
  transport: string;
  tools?: string[];
  error?: string;
}
```


| 字段        | 类型       | 描述        |
| --------- | -------- | --------- |
| name      | string   | 服务器名称     |
| connected | boolean  | 是否已连接     |
| transport | string   | 传输类型      |
| tools     | string[] | 可选，可用工具列表 |
| error     | string   | 可选，连接错误信息 |


