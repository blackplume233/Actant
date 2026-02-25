---
generated: true
---

<!-- GENERATED -->

# 架构概览

Actant 借鉴 Docker 的 CLI → Daemon → Runtime 分层架构。

## 模块结构

```
packages/
├── shared/       类型、日志、平台检测
├── core/         模板、构建器、管理器、调度器、组件、Source
├── api/          Daemon 服务层、RPC Handlers
├── cli/          68 子命令、REPL、流式输出
├── acp/          ACP 协议（连接、回调路由）
├── pi/           Pi Agent 后端
├── mcp-server/   MCP 服务端（骨架）
└── actant/       统一入口（门面包）
```

## 依赖关系

```
shared ← core ← pi
              ← acp
              ← mcp-server
              ← api ← cli ← actant (facade)
```

## 通信架构

```
┌─────────┐  JSON-RPC/IPC  ┌──────────┐  ACP/stdio  ┌───────────────┐
│   CLI   │ ◄────────────► │  Daemon  │ ◄──────────► │ Agent Process │
└─────────┘                └──────────┘              └───────────────┘
```

- **管理通道**：JSON-RPC 2.0 over Unix socket / Windows named pipe
- **交互通道**：ACP（Agent Client Protocol）

## 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | Node.js 22+ |
| 语言 | TypeScript 5.9（strict） |
| 包管理 | pnpm 9+（monorepo） |
| 构建 | tsup |
| 测试 | Vitest（669 tests） |
| Schema | Zod |
| CLI | Commander.js v14 |
| 日志 | pino |
| 定时 | croner |
| Agent 协议 | ACP SDK |

## 数据流：创建 Agent

```
CLI ──RPC──▶ Daemon
              │
              ▼
        AgentManager.create()
              │
     ┌────────┴────────┐
     ▼                 ▼
TemplateRegistry    WorkspaceBuilder
(解析模板)            │
                     ▼
               BackendBuilder
               (物化 Skills/Prompts/MCP)
                     │
                     ▼
               写入 .actant.json
               注册到 InstanceRegistry
```

详细版本快照见仓库中 `docs/stage/v0.2.2/architecture.md`。
