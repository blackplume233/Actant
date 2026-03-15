# Actant Channel Protocol (ACP-EX) 白皮书

> **版本**：0.1.0-draft
> **日期**：2026-03-15
> **作者**：human, cursor-agent
> **关联 Issue**：#279（统一通信层与 Runtime Facade 收敛）
> **前置文档**：[ACP 未来发展分析](./acp-future-analysis.md)、[Agent 启动场景](./agent-launch-scenarios.md)

---

## 1. 概述

### 1.1 什么是 Actant Channel Protocol

Actant Channel Protocol（代号 **ACP-EX**，Agent Channel Protocol Extended）是 Actant 自有的 Agent 通信协议。它在概念和术语上**借鉴 ACP（Agent Client Protocol）的良好设计**，在 ACP 已覆盖的操作上**保持语义一致**，同时针对 Actant 作为 Agent Application Development Platform 的需求进行扩展。

ACP-EX 不是 ACP 的分支（fork），而是 ACP 的**应用层超集**——它站在 ACP 的设计基础上，增加了 ACP 未涉及的能力维度。

### 1.2 与 ACP 的关系

| 维度 | ACP | ACP-EX |
|------|-----|--------|
| 定位 | IDE ↔ Agent 通信标准（"Agent 版 LSP"） | Agent Platform ↔ Backend 通信协议 |
| 设计者 | Zed Industries + JetBrains | Actant |
| 角色模型 | Client（IDE）↔ Agent | Host（Actant）↔ Backend |
| 对称性 | 非对称（Client 调用，Agent 回调） | 对称（双方都可发起操作） |
| 可选性 | Callback 全量 required | 所有操作按能力声明 optional |
| 后端支持 | 单一 ACP 实现 | 多后端适配（Claude SDK、Pi、ACP bridge、Custom） |
| 扩展性 | 协议升级 | `x_` 命名空间 + `adapterOptions` 透传 |

### 1.3 设计原则

**原则 1：可选性（Optionality）**

不是每个后端都需要每个功能。协议中只有 `prompt` 是 required，其余操作（streaming、cancel、resume、callbacks）都是 optional，通过能力协商决定哪些激活。

**原则 2：对称性（Symmetry）**

Host 和 Backend 都可以主动发起操作。Host 通过 `ActantChannel` 调用 Backend，Backend 通过 `ChannelHostServices` 调用 Host。Backend 可以在任何时候推送事件，不限于 prompt 处理期间。

**原则 3：后端能力释放（Backend Leverage）**

协议不截断后端的独特能力。Claude SDK 的 hooks/structured output、Pi 的 personality——通过 `adapterOptions` 和 `backendOptions` 透传，协议层不解读也不限制。

**原则 4：ACP 兼容性（ACP Compatibility）**

在 ACP 已覆盖的操作上保持相同的语义和命名，降低认知成本和适配器映射成本。扩展部分用 `x_` 前缀清晰区分。

---

## 2. 协议分层

ACP-EX 协议分为三层 Profile：

```
┌─────────────────────────────────────────────────────────┐
│  External Profile                                        │
│  面向外部客户端的子集（Gateway Bridge, REST mapping）      │
├─────────────────────────────────────────────────────────┤
│  Extended Profile                                        │
│  Actant 特有扩展（Activity, VFS, Budget, Host Tools）     │
├─────────────────────────────────────────────────────────┤
│  Core Profile                                            │
│  与 ACP 1:1 对等的操作集（Session, Prompt, Callbacks）    │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Core Profile

与 ACP 标准保持语义一致的核心操作。任何 ACP-EX 适配器必须实现 Core Profile 中的 required 部分。

### 2.2 Extended Profile

Actant 平台特有的扩展能力。适配器按照后端能力选择性实现。

### 2.3 External Profile

面向外部客户端（IDE、REST、CLI）的协议子集。定义 Actant 作为 ACP Proxy 对外暴露的接口。

---

## 3. 角色模型

### 3.1 Host

**Host** 是协议的主控方，通常是 Actant Daemon（AgentManager）。Host 负责：
- 管理 Backend 的生命周期（connect / disconnect）
- 向 Backend 发起 prompt 请求
- 为 Backend 提供服务（文件 I/O、终端、权限审批、工具执行）
- 接收 Backend 推送的事件

### 3.2 Backend

**Backend** 是 Agent 运行时的抽象，通过适配器与 Host 通信。Backend 负责：
- 执行 prompt 并返回结果
- 管理自身的 session 状态
- 向 Host 请求服务（当自身无法处理时）
- 向 Host 推送事件（进度、工具调用、状态变更）

### 3.3 与 ACP 角色的对应关系

| ACP 角色 | ACP-EX 角色 | 说明 |
|---------|------------|------|
| Client | Host | 主控方，发起 prompt，提供 callback |
| Agent | Backend | 执行方，处理 prompt，请求服务 |

---

## 4. 双向接口

### 4.1 Host → Backend：ActantChannel

Host 通过 `ActantChannel` 接口与 Backend 通信。

```typescript
interface ActantChannel {
  /**
   * 发送 prompt 并等待完整响应。
   * [Required] 所有后端必须实现。
   */
  prompt(
    sessionId: string,
    text: string,
    options?: PromptOptions,
  ): Promise<ChannelPromptResult>;

  /**
   * 发送 prompt 并流式返回事件。
   * [Optional] capabilities.streaming = true 时可用。
   * ACP 等价：session/prompt（streaming mode）
   */
  streamPrompt?(
    sessionId: string,
    text: string,
    options?: PromptOptions,
  ): AsyncIterable<ChannelEvent>;

  /**
   * 取消正在进行的 prompt。
   * [Optional] capabilities.cancel = true 时可用。
   * ACP 等价：session/cancel
   */
  cancel?(sessionId: string): Promise<void>;

  /**
   * 在已有 session 内创建新的子 session。
   * [Optional] capabilities.multiSession = true 时可用。
   * ACP 等价：session/new
   */
  newSession?(cwd: string, options?: SessionOptions): Promise<{ sessionId: string }>;

  /**
   * 恢复已有 session。
   * [Optional] capabilities.resume = true 时可用。
   * ACP 等价：session/load
   */
  resumeSession?(sessionId: string, options?: ResumeOptions): Promise<void>;

  /**
   * 配置 session 参数。
   * [Optional] capabilities.configurable = true 时可用。
   * ACP 等价：session/set_mode + session/set_config_option
   */
  configure?(sessionId: string, config: Record<string, unknown>): Promise<void>;

  /**
   * 动态设置 MCP 服务器。
   * [Optional] capabilities.dynamicMcp = true 时可用。
   * ACP 无等价物。
   */
  setMcpServers?(
    servers: Record<string, McpTransportConfig>,
  ): Promise<McpSetResult>;

  /**
   * 查询 MCP 服务器状态。
   * [Optional] capabilities.dynamicMcp = true 时可用。
   */
  getMcpStatus?(): Promise<McpServerStatus[]>;

  /**
   * 动态注册 Host 工具。
   * [Optional] capabilities.dynamicTools = true 时可用。
   */
  registerHostTools?(tools: HostToolDefinition[]): Promise<void>;

  /**
   * 动态注销 Host 工具。
   * [Optional] capabilities.dynamicTools = true 时可用。
   */
  unregisterHostTools?(toolNames: string[]): Promise<void>;

  /**
   * 设置 Backend → Host 的回调处理器。
   * [Optional] capabilities.callbacks = true 时可用。
   */
  setCallbackHandler?(handler: ChannelHostServices): void;

  /** 连接状态。 */
  readonly isConnected: boolean;

  /** 后端声明的能力集。connect 之后可读。 */
  readonly capabilities: ChannelCapabilities;
}
```

### 4.2 Backend → Host：ChannelHostServices

Backend 通过 `ChannelHostServices` 接口回调 Host。Host 在 `connect()` 时注入。

```typescript
/**
 * Host 注入给 Backend 适配器的服务接口。
 *
 * Backend adapter 在 connect 时接收，可在任何时候调用。
 * 所有方法都是 optional——Backend 在 capabilities 中声明
 * 自己需要哪些 Host 服务，Host 只提供被需要的。
 */
interface ChannelHostServices {

  // ================================================================
  // Event Push（fire-and-forget）
  // ACP 等价：sessionUpdate callback
  // 区别：不限于 prompt 期间，Backend 任何时候都可以推送
  // ================================================================

  /**
   * 推送事件到 Host。
   *
   * streamPrompt 期间：事件成为流输出的旁路副本
   * streamPrompt 之外：事件成为 out-of-band 通知
   */
  sessionUpdate?(notification: SessionNotification): void;

  // ================================================================
  // Permission（request/response）
  // ACP 等价：requestPermission callback
  // ================================================================

  requestPermission?(request: PermissionRequest): Promise<PermissionResponse>;

  // ================================================================
  // File Service（request/response, optional）
  // ACP 等价：readTextFile, writeTextFile callback
  // Backend 自己能做文件 I/O 时不需要（如 Claude SDK 自带）
  // ================================================================

  readTextFile?(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile?(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;

  // ================================================================
  // Terminal Service（request/response, optional）
  // ACP 等价：createTerminal, terminalOutput, waitForTerminalExit,
  //          killTerminal, releaseTerminal callback
  // Backend 自己能执行命令时不需要
  // ================================================================

  createTerminal?(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  waitForTerminalExit?(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse>;
  killTerminal?(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse>;
  releaseTerminal?(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse>;

  // ================================================================
  // Host Tool Execution（Extended Profile）
  // ACP 无等价物
  // 替代当前的 ACTANT_TOOLS 环境变量 + RPC 回调 hack
  // ================================================================

  /**
   * Backend 调用 Host 提供的工具。
   *
   * Host 在 connect 时通过 hostTools 注册工具定义，
   * Backend 通过此接口请求 Host 执行。
   */
  executeTool?(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<ToolExecutionResult>;

  // ================================================================
  // VFS Service（Extended Profile, optional）
  // ACP 无等价物
  // 虚拟文件系统：/memory/, /proc/, /config/, /canvas/ 等
  // ================================================================

  vfsRead?(path: string): Promise<{ content: string }>;
  vfsWrite?(path: string, content: string): Promise<void>;

  // ================================================================
  // Activity Recording（Extended Profile, optional）
  // ACP 无等价物（ACP 通过 RecordingCallbackHandler 在外部包装）
  // ACP-EX 让 activity recording 成为一等公民
  // ================================================================

  activityRecord?(event: ActivityEvent): Promise<void>;
  activitySetSession?(id: string | null): void;

  // ================================================================
  // Generic Extension Point（终极可选性）
  // 任何上面没有覆盖的 Host 能力
  // ================================================================

  invoke?(method: string, params: unknown): Promise<unknown>;
}
```

### 4.3 双向关系图

```
Host (AgentManager)                          Backend (Adapter)
       │                                            │
       │  ──── ActantChannel ────────────────────→  │
       │       prompt()                              │
       │       streamPrompt?()                       │
       │       cancel?()                             │
       │       newSession?()                         │
       │       configure?()                          │
       │       setMcpServers?()                      │
       │       registerHostTools?()                  │
       │                                            │
       │  ←── ChannelHostServices ───────────────  │
       │       sessionUpdate?()                      │
       │       requestPermission?()                  │
       │       readTextFile?() / writeTextFile?()    │
       │       createTerminal?() / ...               │
       │       executeTool?()                        │
       │       vfsRead?() / vfsWrite?()              │
       │       activityRecord?()                     │
       │       invoke?()                             │
       │                                            │
```

---

## 5. 能力协商

### 5.1 ChannelCapabilities

Backend 在 connect 完成后通过 `capabilities` 属性声明自己的能力。Host 在调用 optional 方法前必须检查对应的 capability。

```typescript
interface ChannelCapabilities {
  // ---- Core Profile ----

  /** 是否支持流式 prompt。默认 false。 */
  streaming: boolean;

  /** 是否支持取消正在进行的 prompt。默认 false。 */
  cancel: boolean;

  /** 是否支持 session 恢复（resume）。默认 false。 */
  resume: boolean;

  /** 是否支持多 session。默认 false。 */
  multiSession: boolean;

  /** 是否支持 session 配置变更。默认 false。 */
  configurable: boolean;

  /** 是否需要 Host 提供 callback 服务。默认 false。 */
  callbacks: boolean;

  // ---- Callback 需求声明 ----
  // Backend 声明自己需要 Host 提供哪些 callback 服务。
  // Host 根据这些声明决定注入哪些 HostServices 实现。

  /** Backend 需要 Host 提供文件 I/O。 */
  needsFileIO: boolean;

  /** Backend 需要 Host 提供终端服务。 */
  needsTerminal: boolean;

  /** Backend 需要 Host 审批权限。 */
  needsPermission: boolean;

  // ---- Extended Profile ----

  /** 是否支持结构化输出。 */
  structuredOutput: boolean;

  /** 是否支持 thinking/reasoning control。 */
  thinking: boolean;

  /** 是否支持运行时 MCP 服务器管理。 */
  dynamicMcp: boolean;

  /** 是否支持运行时 Host 工具管理。 */
  dynamicTools: boolean;

  /** 支持的内容类型。 */
  contentTypes: string[];  // ["text", "image", "audio", "resource"]

  /** 后端特有的扩展能力标识。 */
  extensions: string[];  // e.g. ["hooks", "agents", "plugins", "effort"]
}
```

### 5.2 Host 端的能力检查

```typescript
// Host 调用 optional 方法前的标准模式
if (channel.capabilities.streaming && channel.streamPrompt) {
  yield* channel.streamPrompt(sessionId, text, options);
} else {
  const result = await channel.prompt(sessionId, text, options);
  yield { type: "x_result_success", sessionId, result: result.text, stopReason: result.stopReason };
}
```

### 5.3 各适配器的能力声明

| Capability | AcpChannelAdapter | ClaudeChannelAdapter | PiChannelAdapter |
|-----------|:-:|:-:|:-:|
| streaming | true | true | true |
| cancel | true | true | false |
| resume | partial (loadSession) | true | false |
| multiSession | true | false | false |
| configurable | true | true | false |
| callbacks | true | false | true |
| needsFileIO | true | false | true |
| needsTerminal | true | false | true |
| needsPermission | true | true | true |
| structuredOutput | false | true | false |
| thinking | false | true | false |
| dynamicMcp | false | true | false |
| dynamicTools | false | true | false |
| extensions | [] | ["hooks","agents","effort"] | [] |

---

## 6. 连接与 Session 管理

### 6.1 ActantChannelManager

管理多个 Backend 连接的顶层接口。

```typescript
interface ActantChannelManager {
  /**
   * 建立到 Backend 的连接。
   * 返回初始 session ID 和 Backend 声明的能力。
   */
  connect(
    name: string,
    options: ChannelConnectOptions,
    hostServices: ChannelHostServices,
  ): Promise<{ sessionId: string; capabilities: ChannelCapabilities }>;

  /** 检查是否存在指定名称的连接。 */
  has(name: string): boolean;

  /** 获取指定名称的 Channel 实例。 */
  getChannel(name: string): ActantChannel | undefined;

  /** 获取指定连接的主 session ID。 */
  getPrimarySessionId(name: string): string | undefined;

  /** 获取指定连接的能力声明。 */
  getCapabilities(name: string): ChannelCapabilities | undefined;

  /** 断开指定连接。 */
  disconnect(name: string): Promise<void>;

  /** 断开所有连接。 */
  disposeAll(): Promise<void>;
}
```

### 6.2 ChannelConnectOptions

```typescript
interface ChannelConnectOptions {
  // ---- 通用选项（所有适配器）----

  /** Backend 工作目录。 */
  cwd: string;

  /** 传递给 Backend 进程的环境变量。 */
  env?: Record<string, string>;

  /** 自动审批所有权限请求。 */
  autoApprove?: boolean;

  /** 注入到 Backend 的系统上下文。 */
  systemContext?: string[];

  /**
   * MCP 服务器配置。
   * Host 提供，Backend 负责连接和使用。
   */
  mcpServers?: McpServerSpec[];

  /**
   * Host 提供的工具定义。
   * Backend 暴露给 LLM，执行时通过 hostServices.executeTool() 回调 Host。
   */
  hostTools?: HostToolDefinition[];

  /** 工具策略。 */
  toolPolicy?: ToolPolicy;

  // ---- ACP 兼容字段（AcpChannelAdapter 使用，其他适配器忽略）----

  /** ACP Binary 命令。 */
  command?: string;

  /** ACP Binary 参数。 */
  args?: string[];

  /** npm 包名，用于 binary 自动解析。 */
  resolvePackage?: string;

  // ---- 适配器特有选项 ----

  /**
   * 适配器自行解读的扩展选项。
   * 协议层不解读，直接透传给适配器。
   *
   * AcpChannelAdapter: { connectionOptions, activityRecorder, sessionToken }
   * ClaudeChannelAdapter: { model, permissionMode, hooks, agents, thinking, effort }
   * PiChannelAdapter: { personality, voiceMode }
   */
  adapterOptions?: Record<string, unknown>;
}
```

### 6.3 Session 生命周期

```
connect()
  │
  ├─→ [Connected] ← capabilities 可读
  │
  ├─→ prompt() / streamPrompt()
  │     │
  │     ├─→ [Prompting] ← 可 cancel()
  │     │
  │     └─→ [Idle] ← 等待下一次 prompt
  │
  ├─→ newSession?() ← 创建子 session
  │
  ├─→ resumeSession?() ← 恢复已有 session
  │
  ├─→ configure?() ← 变更 session 配置
  │
  └─→ disconnect()
        │
        └─→ [Disconnected]
```

---

## 7. 事件类型体系

### 7.1 ChannelEvent

所有事件的基础结构。

```typescript
interface ChannelEvent {
  /** 事件类型。Core Profile 类型与 ACP 一致，Extended 用 x_ 前缀。 */
  type: ChannelEventType;

  /** 产生此事件的 session ID。 */
  sessionId: string;

  /** 事件时间戳（Unix ms）。 */
  timestamp?: number;
}
```

### 7.2 Core Event Types（与 ACP 一致）

以下事件类型的命名和语义与 ACP `SessionUpdate` 保持一致：

```typescript
type CoreEventType =
  /** Agent 文本响应块。ACP: agent_message_chunk */
  | "agent_message_chunk"
  /** Agent 思考块。ACP: agent_thought_chunk */
  | "agent_thought_chunk"
  /** 用户消息块（回放）。ACP: user_message_chunk */
  | "user_message_chunk"
  /** 工具调用。ACP: tool_call */
  | "tool_call"
  /** 工具调用进度/结果。ACP: tool_call_update */
  | "tool_call_update"
  /** 计划更新。ACP: plan */
  | "plan"
  /** 可用命令更新。ACP: available_commands_update */
  | "available_commands_update"
  /** 模式变更。ACP: current_mode_update */
  | "current_mode_update"
  /** 配置选项变更。ACP: config_option_update */
  | "config_option_update";
```

### 7.3 Extended Event Types（ACP-EX 独有）

```typescript
type ExtendedEventType =
  /** Prompt 成功结果。 */
  | "x_result_success"
  /** Prompt 错误结果。 */
  | "x_result_error"
  /** 工具使用摘要（Claude SDK 特有）。 */
  | "x_tool_use_summary"
  /** Session 初始化完成。 */
  | "x_session_init"
  /** Session 就绪。 */
  | "x_session_ready"
  /** Prompt 处理开始。 */
  | "x_prompt_start"
  /** Prompt 处理结束。 */
  | "x_prompt_end"
  /** Activity 记录事件。 */
  | "x_activity_record"
  /** Budget 变更。 */
  | "x_budget_update"
  /** VFS 访问。 */
  | "x_vfs_access"
  /** 连接保活。 */
  | "x_keepalive";

type ChannelEventType = CoreEventType | ExtendedEventType;
```

### 7.4 内容类型（与 ACP ContentBlock 一致）

```typescript
type ChannelContent =
  /** 文本内容。ACP: ContentBlock type="text" */
  | { kind: "text"; text: string }
  /** 图片内容。ACP: ContentBlock type="image" */
  | { kind: "image"; data: string; mimeType: string }
  /** 音频内容。ACP: ContentBlock type="audio" */
  | { kind: "audio"; data: string; mimeType: string }
  /** 资源引用。ACP: ContentBlock type="resource" */
  | { kind: "resource"; uri: string; content?: string }
  /** 资源链接。ACP: ContentBlock type="resource_link" */
  | { kind: "resource_link"; uri: string; name?: string }
  /** 结构化数据。ACP-EX 扩展。 */
  | { kind: "x_structured"; schema: string; data: unknown };
```

### 7.5 具体事件结构

```typescript
// ---- Core Events ----

interface AgentMessageChunkEvent extends ChannelEvent {
  type: "agent_message_chunk";
  content: ChannelContent;
}

interface ToolCallEvent extends ChannelEvent {
  type: "tool_call";
  toolCallId: string;
  title?: string;
  kind?: string;       // "bash", "file_edit", "mcp_tool", "host_tool"
  status: "pending" | "in_progress" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
}

interface ToolCallUpdateEvent extends ChannelEvent {
  type: "tool_call_update";
  toolCallId: string;
  content?: Array<
    | { type: "content"; content: ChannelContent }
    | { type: "diff"; path: string }
    | { type: "terminal"; terminalId: string; output: string }
  >;
}

interface PlanEvent extends ChannelEvent {
  type: "plan";
  entries: Array<{ status: string; content: string }>;
}

// ---- Extended Events ----

interface ResultSuccessEvent extends ChannelEvent {
  type: "x_result_success";
  result: string;
  stopReason: string;
  usage?: ChannelUsage;
  structuredOutput?: unknown;
}

interface ResultErrorEvent extends ChannelEvent {
  type: "x_result_error";
  errors: string[];
  stopReason: string;
  usage?: ChannelUsage;
}

interface ChannelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
}
```

---

## 8. Prompt 选项

```typescript
interface PromptOptions {
  // ---- Core（所有后端）----

  /** 最大对话轮数。 */
  maxTurns?: number;

  // ---- Optional（按 capabilities 判断）----

  /** 模型选择。 */
  model?: string;

  /** 结构化输出格式。capabilities.structuredOutput = true。 */
  outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };

  /** Thinking/reasoning 控制。capabilities.thinking = true。 */
  thinking?:
    | { type: "adaptive" }
    | { type: "enabled"; budgetTokens: number }
    | { type: "disabled" };

  /** 后端特有选项，协议层不解读。 */
  backendOptions?: Record<string, unknown>;
}

interface ChannelPromptResult {
  /** 停止原因。ACP: stopReason */
  stopReason: string;

  /** 完整响应文本。 */
  text: string;

  /** Session ID（可能与输入不同，如 fork 场景）。 */
  sessionId?: string;

  /** Token 使用量（Extended）。 */
  usage?: ChannelUsage;

  /** 结构化输出（Extended）。 */
  structuredOutput?: unknown;
}
```

---

## 9. Tool 与 MCP 透传

### 9.1 四种工具所有权模型

| 类型 | 定义方 | 执行方 | Channel 角色 |
|------|--------|--------|------------|
| **Backend Built-in Tools** | Backend | Backend | 观察（tool_call event）+ 审批（requestPermission） |
| **MCP Tools** | External MCP Server | Backend 连接并使用 | 配置透传（mcpServers）+ 动态管理（setMcpServers） |
| **Host-Provided Tools** | Host（ContextProvider） | Host（via executeTool） | 定义透传（hostTools）+ 执行路由（executeTool） |
| **In-Process SDK Tools** | Backend 内部 | Backend 内部 | 不可见（backendOptions 透传） |

### 9.2 MCP 服务器配置

```typescript
interface McpServerSpec {
  name: string;
  transport: McpTransportConfig;
}

type McpTransportConfig =
  /** 标准 stdio 传输。ACP 兼容。 */
  | { type: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  /** SSE 传输。 */
  | { type: "sse"; url: string; headers?: Record<string, string> }
  /** HTTP Streamable 传输。 */
  | { type: "http"; url: string; headers?: Record<string, string> }
  /** In-process SDK MCP server。ACP-EX 扩展。 */
  | { type: "x_sdk"; name: string };
```

### 9.3 Host 工具定义

```typescript
interface HostToolDefinition {
  /** 工具名称。LLM 可见。 */
  name: string;

  /** 工具描述。LLM 可见。 */
  description: string;

  /** 参数 JSON Schema。LLM 可见。 */
  parameters: Record<string, unknown>;

  /** 作用域限制。 */
  scope?: "all" | "service" | "employee";

  /** 使用说明，注入到 system context。 */
  instructions?: string;
}

interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}
```

### 9.4 工具策略

```typescript
interface ToolPolicy {
  /** 明确允许的工具白名单。 */
  allowed?: string[];

  /** 明确禁止的工具黑名单。 */
  denied?: string[];

  /** 自动审批的工具（跳过 requestPermission）。 */
  autoApproved?: string[];
}
```

### 9.5 适配器的 Tool/MCP 实现策略

**AcpChannelAdapter**：
- `mcpServers` → ACP `session/new` 的 mcpServers 参数
- `hostTools` → `ACTANT_TOOLS` 环境变量 + system context 注入（兼容现有）
- `executeTool` → Backend 通过 CLI/RPC 回调 Host（现有路径）
- `setMcpServers` → 不支持（ACP 无此能力）

**ClaudeChannelAdapter**：
- `mcpServers` → SDK `options.mcpServers`（支持全部传输类型）
- `hostTools` → `createSdkMcpServer()` 注册为 in-process MCP，handler 回调 `hostServices.executeTool()`
- `executeTool` → in-process MCP handler 直接调用
- `setMcpServers` → `query.setMcpServers()`

**PiChannelAdapter**：
- `mcpServers` → Pi ACP bridge 的 session/new
- `hostTools` → `buildInternalTools()` → `AgentTool[]`，execute 回调 `hostServices.executeTool()`
- `executeTool` → AgentTool.execute 直接调用
- `setMcpServers` → 视 Pi SDK 能力

---

## 10. SessionNotification 格式（ACP 兼容）

Core Profile 中 Backend → Host 的事件推送采用与 ACP 相同的 `SessionNotification` 结构：

```typescript
interface SessionNotification {
  sessionId: string;
  update: SessionUpdate;
}

/**
 * SessionUpdate 是一个带有 sessionUpdate 鉴别字段的联合类型。
 * Core 类型与 ACP 完全一致，Extended 类型用 x_ 前缀。
 */
type SessionUpdate =
  // Core（ACP 一致）
  | { sessionUpdate: "agent_message_chunk"; content: ChannelContent }
  | { sessionUpdate: "agent_thought_chunk"; content: ChannelContent }
  | { sessionUpdate: "tool_call"; toolCallId: string; title?: string; kind?: string; status: string }
  | { sessionUpdate: "tool_call_update"; toolCallId: string; content?: unknown[] }
  | { sessionUpdate: "plan"; entries: Array<{ status: string; content: string }> }
  | { sessionUpdate: "current_mode_update"; modeId: string }
  | { sessionUpdate: "config_option_update"; configId: string; value: unknown }
  // Extended（ACP-EX）
  | { sessionUpdate: "x_result_success"; result: string; stopReason: string; usage?: ChannelUsage }
  | { sessionUpdate: "x_result_error"; errors: string[]; stopReason: string }
  | { sessionUpdate: "x_tool_use_summary"; summary: string; toolUseIds: string[] }
  | { sessionUpdate: "x_prompt_start" }
  | { sessionUpdate: "x_prompt_end" };
```

---

## 11. 与 StreamChunk 的关系

### 11.1 现有 StreamChunk（向后兼容）

当前 `@actant/core` 的 `StreamChunk` 是 `ChannelEvent` 的简化投影：

```typescript
interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
}
```

### 11.2 升级路径

```typescript
// Phase 1（当前）：保持 StreamChunk 不变
// AgentManager 内部使用 StreamChunk
// 适配器负责 ChannelEvent → StreamChunk 映射

// Phase 2：StreamChunk 携带可选的完整事件
interface StreamChunk {
  type: "text" | "tool_use" | "result" | "error";
  content: string;
  /** 完整的 ChannelEvent（适配器选择性填充）。 */
  event?: ChannelEvent;
}

// Phase 3：AgentManager 直接消费 ChannelEvent
// StreamChunk 退化为外部 API 的序列化格式
```

---

## 12. 适配器实现矩阵

```
Host (AgentManager)
  │
  └── ActantChannelManager
        │
        ├── AcpChannelAdapter
        │     ├── wraps AcpConnectionManager
        │     ├── ACP/NDJSON over stdio
        │     ├── Core Profile: full
        │     ├── Extended Profile: partial (via recording handler)
        │     └── External Profile: full (Gateway support)
        │
        ├── ClaudeChannelAdapter
        │     ├── uses @anthropic-ai/claude-agent-sdk query()
        │     ├── SDK native protocol
        │     ├── Core Profile: full
        │     ├── Extended Profile: full (hooks, structured output, dynamic MCP)
        │     └── External Profile: N/A (internal only)
        │
        ├── PiChannelAdapter
        │     ├── uses Pi SDK
        │     ├── Pi native protocol
        │     ├── Core Profile: partial
        │     └── Extended Profile: partial
        │
        └── CustomChannelAdapter
              ├── user-provided implementation
              ├── Core Profile: minimum (prompt only)
              └── Extended Profile: optional
```

---

## 13. External Profile：ACP Proxy 模式

Actant 对外暴露 ACP 标准协议时，作为 **ACP Proxy** 在 Channel Protocol 和 ACP 之间翻译。

### 13.1 翻译规则

| ACP 操作（IDE → Actant） | Channel 操作（Actant → Backend） |
|--------------------------|-------------------------------|
| `initialize` | `connect()` |
| `session/new` | `newSession()` 或使用 primary session |
| `session/load` | `resumeSession()` |
| `session/prompt` | `streamPrompt()` 或 `prompt()` |
| `session/cancel` | `cancel()` |
| `session/set_mode` | `configure()` |
| `session/set_config_option` | `configure()` |

| Channel 事件（Backend → Actant） | ACP 回调（Actant → IDE） |
|---------------------------------|------------------------|
| `sessionUpdate` (Core events) | `sessionUpdate` (直接转发) |
| `requestPermission` | `requestPermission` (直接转发) |
| `readTextFile` / `writeTextFile` | `readTextFile` / `writeTextFile` (路由到 IDE 或本地) |
| `createTerminal` / ... | `createTerminal` / ... (路由到 IDE 或本地) |
| `executeTool` | N/A (Host 内部处理) |

### 13.2 Gateway Bridge

```
IDE (ACP Client)
  │
  │  ACP standard protocol
  │
  ▼
AcpProxyAdapter (Actant External Profile)
  │
  │  ACP → Channel translation
  │
  ▼
Communication Router (AgentManager)
  │
  │  ActantChannel interface
  │
  ▼
Backend Adapter (ACP / SDK / Pi / Custom)
  │
  │  Backend-specific protocol
  │
  ▼
Agent Runtime
```

---

## 14. 分阶段实施路径

### Phase 1：接口迁移（当前 #279）

- **已完成**：定义 `ActantChannelManager` / `ActantChannel` 基础接口
- **已完成**：`AgentManager` 迁移到 `channelManager` + `AcpChannelManagerAdapter` 兼容层
- **进行中**：`ClaudeChannelAdapter` 实现（SDK 直连）
- **接口**：保持当前 `ChannelConnectOptions`（含 ACP 兼容字段），`StreamChunk` 不变
- **未引入**：`ChannelHostServices`、`ChannelCapabilities`、`ChannelEvent`

### Phase 2：协议升级

- 重构 `ChannelConnectOptions` 为通用基础 + `adapterOptions`
- 引入 `ChannelHostServices` 注入机制
- 引入 `ChannelCapabilities` 能力协商
- `StreamChunk` 增加可选 `event` 字段
- `executeTool` 替代 `ACTANT_TOOLS` 环境变量 hack

### Phase 3：事件体系

- 引入完整的 `ChannelEvent` 类型体系
- `AgentManager` 逐步切换到消费 `ChannelEvent`
- Activity recording 迁移到 `ChannelHostServices.activityRecord`

### Phase 4：External Profile

- `AcpProxyAdapter` 使用 Channel Protocol 替代直接 ACP SDK 调用
- REST Session API 直接映射到 Channel Protocol
- Gateway Bridge 标准化

---

## 附录 A：术语对照表

| ACP-EX 术语 | ACP 术语 | 说明 |
|------------|---------|------|
| Host | Client | 主控方 |
| Backend | Agent | 执行方 |
| ActantChannel | ClientSideConnection | Host → Backend 接口 |
| ChannelHostServices | Client callbacks | Backend → Host 接口 |
| ChannelEvent | SessionNotification + SessionUpdate | 事件 |
| ChannelCapabilities | ClientCapabilities (单向) | 能力协商（双向） |
| Core Profile | ACP standard | ACP 兼容层 |
| Extended Profile | (无) | Actant 扩展 |
| External Profile | (无) | 外部客户端接口 |
| `x_` prefix | (无) | 扩展事件/内容类型的命名空间 |
| hostTools | (无) | Host 提供的工具 |
| executeTool | (无) | Host 工具执行回调 |
| adapterOptions | (无) | 适配器特有选项透传 |
| backendOptions | (无) | prompt 级别的后端特有选项透传 |

## 附录 B：与 ACP RFD 的对应关系

| ACP RFD | ACP-EX 对应 | 状态 |
|---------|-----------|------|
| Proxy Chains | External Profile — Gateway Bridge | Actant 本身即 Proxy |
| MCP-over-ACP | `mcpServers` in `ChannelConnectOptions` + `setMcpServers()` | 已原生支持 |
| Remote Agents | `adapterOptions.spawnClaudeCodeProcess` (SDK) | SDK 已支持 |
| Session Fork | `resumeSession()` + `adapterOptions.forkSession` | 按需实现 |
| Session Info / Usage Update | `x_result_success.usage`, `x_budget_update` | Extended Profile |
