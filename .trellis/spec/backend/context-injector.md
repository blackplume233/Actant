# Context Injector 规格

> `packages/core/src/context-injector/` — 动态上下文注入框架
> 关联 Issue: #249

---

## 概述

`SessionContextInjector` 是 Actant 的动态上下文注入框架。在 ACP session 创建前，它从所有已注册的 `ContextProvider` 收集三类资源（MCP Servers、Internal Tools、System Context），经去重和 Scope 过滤后聚合为 `SessionContext`，交给 ACP 连接层。

**核心设计原则**：
- 子系统通过注册 `ContextProvider` 实现松耦合扩展
- 每个 Provider 独立声明自己需要注入的资源
- Provider 可根据 `meta.archetype` / `meta.backendType` 等条件动态决定注入内容
- `AppContext.init()` 只负责注册顺序编排，不包含具体的上下文生成逻辑

---

## 1. 数据格式

### 1.1 输入：AgentInstanceMeta（关键字段）

```typescript
interface AgentInstanceMeta {
  name: string;
  archetype: "repo" | "service" | "employee";
  backendType: string;         // "pi" | "claude-code" | "cursor" | ...
  workspacePolicy: "persistent" | "ephemeral";
  launchMode: "managed" | "direct";
  // ... 其他字段
}
```

### 1.2 Provider 产出：三种资源类型

| 资源类型 | 接口 | 去重键 | 用途 |
|----------|------|--------|------|
| MCP Server | `AcpMcpServerStdio` | `name` | 注入给 agent 的 MCP 工具服务器 |
| Tool | `ActantToolDefinition` | `name` | 内部工具定义（经 scope 过滤） |
| SystemContext | `string` | 无去重 | system prompt 文本片段 |

```typescript
interface AcpMcpServerStdio {
  name: string;
  command: string;
  args: string[];
  env?: Array<{ name: string; value: string }>;
}

interface ActantToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;   // JSON Schema
  rpcMethod: string;                     // 对应的 Daemon RPC 方法
  scope: "all" | "service" | "employee"; // 最低 archetype 要求
  context?: string;                      // 附加使用说明
}
```

### 1.3 聚合输出：SessionContext

```typescript
interface SessionContext {
  mcpServers: AcpMcpServerStdio[];
  tools: ActantToolDefinition[];
  systemContextAdditions: string[];      // 按注册序排列
  token: string;                         // 64 字符 hex session token
}
```

---

## 2. 接口格式

### 2.1 ContextProvider 接口

```typescript
interface ContextProvider {
  readonly name: string;
  getMcpServers?(agentName: string, meta: AgentInstanceMeta): AcpMcpServerStdio[];
  getSystemContext?(agentName: string, meta: AgentInstanceMeta): string | undefined;
  getTools?(agentName: string, meta: AgentInstanceMeta): ActantToolDefinition[];
}
```

三个方法全部可选——Provider 只需实现自己关心的能力插口。

### 2.2 内置 Provider

| Provider 类 | name | 实现方法 | 模板文件 | 作用 |
|-------------|------|---------|---------|------|
| `CoreContextProvider` | `"core-identity"` | `getSystemContext` | `core-identity.md` | 身份声明 + 平台能力介绍 |
| `CanvasContextProvider` | `"canvas"` | `getTools` + `getSystemContext` | `canvas-context.md` | Canvas 工具注册 + 上下文提示 |

### 2.3 SessionContextInjector

```typescript
class SessionContextInjector {
  setEventBus(eventBus: HookEventBus): void;
  setTokenStore(tokenStore: SessionTokenStore): void;
  register(provider: ContextProvider): void;
  unregister(name: string): void;
  listProviders(): string[];
  revokeTokens(agentName: string): void;
  prepare(agentName: string, meta: AgentInstanceMeta, sessionId?: string): Promise<SessionContext>;
}
```

### 2.4 模板引擎

```typescript
function loadTemplate(name: string): string;
function renderTemplate(template: string, vars: Record<string, string>): string;
```

模板文件位于 `packages/core/src/prompts/*.md`，使用 `{{variable}}` 占位符。
运行时通过 `fs.readFileSync` 动态加载。构建后由 tsup `onSuccess` 复制到 `dist/prompts/`。

---

## 3. 协议格式

### 3.1 注册协议

- **键**: `provider.name`（字符串）
- **冲突策略**: 同名覆盖（后注册者替换先注册者）
- **注册顺序**: 决定 `systemContextAdditions` 中片段的出现顺序
- **可选注销**: `unregister(name)` 移除

### 3.2 收集协议（prepare 阶段）

```
for provider in registered_providers (insertion order):
  ① getMcpServers?(agentName, meta) → AcpMcpServerStdio[]
  ② getTools?(agentName, meta)      → ActantToolDefinition[]
  ③ getSystemContext?(agentName, meta) → string | undefined
```

### 3.3 去重与过滤

| 资源 | 去重键 | 冲突策略 | 额外过滤 |
|------|--------|----------|----------|
| MCP Server | `srv.name` | 先注册者胜 | 无 |
| Tool | `tool.name` | 先注册者胜 | Scope 层级检查 |
| SystemContext | 无去重 | 全部保留 | 跳过 `undefined` / 空 |

**Scope 层级检查**:

```
archetype 数值:  repo=0  service=1  employee=2
scope 最低要求:  all=0   service=1  employee=2
条件: ARCHETYPE_LEVEL[meta.archetype] >= SCOPE_MIN_LEVEL[tool.scope]
```

### 3.4 Post-collection 步骤

Provider 收集完成后，Injector 执行：

1. **Token 生成**: `tokenStore.generate(agentName, sessionId)` → 64 字符 hex token
2. **Tool Instructions 注入**: 当 `tools.length > 0 && token` 时，加载 `tool-instructions.md` 模板渲染后追加到 `systemContextAdditions` 末尾

### 3.5 事件协议

| 时机 | 事件名 | Payload |
|------|--------|---------|
| 收集前 | `session:preparing` | `{ providerCount: number }` |
| 收集后 | `session:context-ready` | `{ mcpServerCount, toolCount, contextAdditions }` |

---

## 4. 工作流

```
AppContext.init()
  → injector.register(CoreContextProvider)     ← 身份上下文
  → injector.register(CanvasContextProvider)   ← Canvas 工具 + 上下文
  → injector.register(FutureProvider...)       ← 未来扩展

AgentManager.startAgent(name)
  → injector.prepare(agentName, meta, sessionId)
    → emit "session:preparing"
    → Phase 1: 遍历 Provider，收集三类资源
    → Phase 2: 去重 + Scope 过滤
    → Phase 3: 生成 Token + 渲染 Tool Instructions
    → emit "session:context-ready"
    → return SessionContext
  → AcpConnectionManager.connect({ mcpServers, systemContextAdditions })
```

### systemContextAdditions 的最终顺序（employee 示例）

```
[0] "## Actant Agent Identity\nYou are **my-agent**..."     ← CoreContextProvider
[1] "You have a live canvas on the Actant dashboard..."     ← CanvasContextProvider
[2] "## Actant Internal Tools\n  - actant_canvas_update..." ← buildToolContextBlock
```

`[0]` 和 `[1]` 由 Provider 注册顺序决定，`[2]` 始终在末尾（post-collection 产生）。

---

## 5. 模板文件一览

| 文件 | 变量 | 用途 |
|------|------|------|
| `core-identity.md` | `agentName`, `archetype`, `archetypeDescription`, `backendType`, `workspacePolicy` | 身份声明 + 平台能力 |
| `canvas-context.md` | 无 | Canvas 功能简介 |
| `tool-instructions.md` | `toolList`, `token` | 工具使用说明 + token 声明 |

---

## 6. 扩展指南：添加新 Provider

1. 在 `packages/core/src/context-injector/` 创建 `xxx-context-provider.ts`
2. 实现 `ContextProvider` 接口（只实现需要的方法）
3. 如需外部文本模板，在 `packages/core/src/prompts/` 添加 `.md` 文件
4. 在 `context-injector/index.ts` 中导出
5. 在 `AppContext.init()` 中 `register()` 新 Provider
6. 添加对应单测
7. 更新本文档

---

## 7. 公共导出

从 `@actant/core` 导出：

```typescript
// 核心类
export { SessionContextInjector, SessionTokenStore };
export { CanvasContextProvider, CoreContextProvider };

// 类型
export type { ContextProvider, SessionContext, AcpMcpServerStdio, ActantToolDefinition, ToolScope };
export type { SessionToken };

// 模板引擎
export { loadTemplate, renderTemplate };
```

---

## 实现参考

| 文件 | 说明 |
|------|------|
| `packages/core/src/context-injector/session-context-injector.ts` | Injector 核心 + 接口定义 |
| `packages/core/src/context-injector/canvas-context-provider.ts` | Canvas Provider |
| `packages/core/src/context-injector/core-context-provider.ts` | 核心身份 Provider |
| `packages/core/src/context-injector/session-token-store.ts` | Session Token 管理 |
| `packages/core/src/prompts/template-engine.ts` | 模板加载 + 渲染 |
| `packages/core/src/prompts/*.md` | 模板文件 |
| `packages/api/src/services/app-context.ts` | Provider 注册入口 |
