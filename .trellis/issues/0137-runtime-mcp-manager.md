---
id: 137
title: "Runtime MCP Manager — Actant 托管 Agent 的 MCP 运行时管理与 CLI 桥接"
status: open
labels:
  - rfc
  - architecture
  - mcp
  - acp
  - "priority:P1"
milestone: null
author: human
assignees: []
relatedIssues:
  - 16
  - 17
  - 40
relatedFiles:
  - packages/core/src/domain/mcp/mcp-config-manager.ts
  - packages/acp/src/connection.ts
  - packages/pi/src/acp-bridge.ts
  - packages/mcp-server/src/index.ts
taskRef: null
githubRef: "blackplume233/Actant#137"
closedAs: null
createdAt: 2026-02-24T12:00:00
updatedAt: 2026-02-24T12:00:00
closedAt: null
---

**Related Issues**: [[0016-mcp-server]], [[0017-acp-fleet]], [[0040-agent-tool-permission]]
**Related Files**: `packages/core/src/domain/mcp/mcp-config-manager.ts`, `packages/acp/src/connection.ts`, `packages/pi/src/acp-bridge.ts`, `packages/mcp-server/src/index.ts`

---

## 背景

当前 Actant 对 MCP 的支持仅限于**配置层面**：

- `McpConfigManager` 管理 MCP Server 定义（名称、命令、参数、环境变量）
- 构建时将配置物化为 `.cursor/mcp.json` / `.claude/mcp.json`
- **实际的 MCP Server 进程生命周期由宿主 IDE（Cursor / Claude Code）负责管理**

这意味着 Actant 托管的 headless Agent（通过 ACP 协议运行）**无法使用任何 MCP 工具**：
- ACP `newSession` 的 `mcpServers` 参数目前总是传递 `[]`
- Pi Agent 的 builder 显式跳过 MCP（`"Pi does not support MCP"`）
- 没有任何 runtime 组件负责启动、监控、重连 MCP Server 进程

## 问题

1. **MCP 连接由客户端（IDE）管理，Agent 无法自主访问**：当 Agent 脱离 IDE 运行（headless / ACP 模式）时，MCP 能力完全丧失
2. **ACP 协议设计中预留了 mcpServers 但未实现**：`newSession(cwd, mcpServers)` 的 mcpServers 始终为空数组
3. **缺少独立的 MCP Runtime Manager**：Actant Daemon 没有能力自行启动和维护与 MCP Server 的连接
4. **缺少 MCP-to-CLI 桥接**：对于无法直接使用 MCP SDK 的场景（脚本、测试、非 Node 环境），没有统一的 CLI 入口

## 方案

### Phase 1: Runtime MCP Manager（核心）

在 Actant Daemon / Core 中实现 `RuntimeMcpManager`：

```
Agent Template (mcpServers config)
        │
        ▼
RuntimeMcpManager (packages/core)
  ├── spawn MCP Server 子进程
  ├── 建立 stdio/SSE 连接
  ├── 维护连接状态（健康检查、自动重连）
  ├── 管理 tool 列表缓存
  └── 提供 callTool / listTools 接口
        │
        ▼
Agent Runtime (通过 ToolProvider 调用)
```

关键职责：
- **进程生命周期管理**：spawn / monitor / restart / graceful-shutdown
- **连接管理**：支持 stdio 和 SSE 两种传输方式
- **Tool 发现与缓存**：启动时拉取 tools/list，支持动态刷新
- **资源隔离**：每个 Agent 实例独立的 MCP Server 连接（或按配置共享）

### Phase 2: ACP MCP Passthrough

在 ACP 协议层实现 MCP 配置的客户端-服务端传递：

```
ACP Client (IDE / CLI)
  │ newSession({ mcpServers: [...] })
  ▼
ACP Server (Actant Daemon)
  │ 解析 mcpServers 配置
  ▼
RuntimeMcpManager
  │ 启动 MCP Server 进程
  ▼
Agent Session (可使用 MCP tools)
```

- ACP Client 在 `newSession` 时传递 `mcpServers` 配置
- Daemon 侧的 `RuntimeMcpManager` 接收并启动对应的 MCP Server
- Agent 的 tool 列表中自动包含 MCP 提供的 tools

### Phase 3: `@actant/mcp-cli` 包

将所有 MCP 交互转换为 CLI 命令，提供统一的命令行入口：

```bash
# 启动 MCP Server 并进入交互模式
actant mcp connect <server-name>

# 调用 MCP tool
actant mcp call <server-name> <tool-name> [--param key=value]

# 列出 MCP Server 提供的工具
actant mcp tools <server-name>

# 列出 MCP Server 提供的资源
actant mcp resources <server-name>

# 读取 MCP 资源
actant mcp read-resource <server-name> <uri>

# 管道模式（适合脚本 / Agent 调用）
echo '{"tool":"search","args":{"query":"test"}}' | actant mcp pipe <server-name>
```

用途：
- 脚本和自动化场景
- 非 Node.js 环境通过 CLI 使用 MCP
- 调试和测试 MCP Server
- Agent 在 shell 工具中调用 MCP（作为 MCP-over-CLI 桥接）

## 替代方案

1. **仅依赖 IDE 管理 MCP**：保持现状，但 headless Agent 永远无法使用 MCP —— 不可接受
2. **在 Agent 进程内管理 MCP**：每个 Agent 自己 spawn MCP Server，但资源浪费且不易共享 —— 作为 fallback
3. **使用独立的 MCP Proxy**：外部进程作为 MCP 多路复用器 —— 增加运维复杂度，暂不考虑

## 影响范围

- `packages/core/src/domain/mcp/` — 扩展为 Runtime Manager
- `packages/acp/src/connection.ts` — 实现 mcpServers passthrough
- `packages/pi/src/acp-bridge.ts` — 接入 RuntimeMcpManager
- `packages/mcp-server/` — 可能重新定位或合并
- `packages/mcp-cli/` (新) — MCP CLI 桥接包
- `packages/shared/` — 新增 MCP runtime 相关类型

## 验收标准

- [ ] RuntimeMcpManager 能 spawn 和管理 MCP Server 进程
- [ ] 支持 stdio 和 SSE 两种传输方式
- [ ] ACP newSession 可传递 mcpServers 并自动启动
- [ ] headless Agent 可调用 MCP tools
- [ ] `actant mcp call` CLI 可调用任意 MCP tool
- [ ] `actant mcp tools` 可列出 MCP Server 的工具
- [ ] 单元测试和集成测试覆盖核心路径

---

## Comments
