# Unreal Engine 后端 Agent

将 Actant 管理的 Agent 作为 Unreal Engine 项目的智能后端服务。

## 架构

```
Unreal Engine (C++ / Blueprint)
      │
      ├── FPlatformProcess::CreateProc("actant", "proxy ue-ai --lease")
      │
      ▼
actant proxy (子进程, stdio ACP)
      │
      ▼
Actant Daemon ──▶ Agent Instance (acp-service)
      │
      ├── Skills: game-design, code-gen, ...
      ├── Prompts: unreal-context
      └── MCP: filesystem, project-analyzer
```

Unreal 通过 spawn `actant proxy` 子进程，以 **stdio** 上的 ACP 协议与 Agent 通信。这与 Zed 等编辑器接入 Agent 的机制完全一致。

## 连接方式

Actant 当前支持的 ACP 传输层：

| 传输 | 机制 | 说明 |
|------|------|------|
| **stdio** | `actant proxy <name>` | 父进程 spawn proxy，通过 stdin/stdout 收发 ACP JSON-RPC |
| **Unix socket** | `actant proxy <name> --lease` | Gateway 模式，通过 Named Pipe/Unix socket 连接 Daemon |

> **注意：** Actant 目前 **不支持** WebSocket 传输。所有 ACP 通信均基于 stdio 或 Unix socket。

## 1. 定义 Agent 模板

创建面向 Unreal 开发的 Agent Template：

```json
{
  "name": "unreal-assistant",
  "version": "1.0.0",
  "description": "Unreal Engine AI 助手",
  "backend": { "type": "claude-code" },
  "provider": {
    "type": "anthropic",
    "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" }
  },
  "domainContext": {
    "skills": ["cpp-expert", "unreal-engine"],
    "prompts": ["system-unreal-dev"],
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@anthropic/mcp-filesystem"]
      }
    ]
  },
  "permissions": { "preset": "standard" }
}
```

## 2. 部署为 ACP Service

```bash
# 加载模板
actant template load ./unreal-assistant.json

# 创建 Agent 实例
actant agent create ue-ai -t unreal-assistant

# 以 ACP Service 模式启动（崩溃自动重启）
actant agent start ue-ai --launch-mode acp-service
```

`acp-service` 模式确保 Agent 崩溃后自动重启，适合需要长时间运行的后端服务场景。

## 3. Unreal 端接入

Unreal 侧通过 `FPlatformProcess::CreateProc` spawn `actant proxy` 子进程，通过子进程的 stdin/stdout 收发 ACP 消息：

```cpp
// 伪代码：Unreal 端 spawn actant proxy
FProcHandle Proc = FPlatformProcess::CreateProc(
    TEXT("actant"),                    // 可执行文件
    TEXT("proxy ue-ai --lease"),       // 参数
    /* bLaunchDetached */ false,
    /* bLaunchHidden */ true,
    /* bLaunchReallyHidden */ true,
    /* OutProcessID */ &ProcId,
    /* Priority */ 0,
    /* WorkingDir */ nullptr,
    /* PipeWriteChild */ WritePipe,    // → proxy stdin
    /* PipeReadChild */ ReadPipe       // ← proxy stdout
);

// 通过 ReadPipe / WritePipe 收发 ACP JSON-RPC 消息
// 每条消息是一行 JSON，以 \n 分隔
```

通信协议：每行一条 JSON-RPC 2.0 消息，遵循 [ACP 规范](https://agentclientprotocol.com/)。

### ACP 消息示例

```json
// → 发送 initialize
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientCapabilities":{}}}

// ← 收到响应
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"agentInfo":{"name":"actant-proxy"},"agentCapabilities":{}}}

// → 创建 session
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{}}

// → 发送 prompt
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"...","prompt":[{"type":"text","text":"为这个 Actor 生成 AI Controller"}]}}
```

## 4. 典型使用场景

### 代码生成

Unreal 编辑器中选择一个 Actor，发送请求：

> "为这个 Actor 生成一个基于状态机的 AI Controller，支持巡逻、追击、撤退三种状态"

Agent 返回 C++ 代码，Unreal 插件将代码写入项目。

### 资产分析

> "分析 Content/Characters/ 目录下的所有 Blueprint，列出未使用的变量和潜在性能问题"

### 关卡设计建议

> "当前关卡有 3 个据点，玩家从南侧进入。建议敌人的巡逻路线和增援触发点"

## 5. 多 Agent 协作

可以同时运行多个专用 Agent：

```bash
# 代码生成 Agent
actant agent create ue-coder -t unreal-coder
actant agent start ue-coder --launch-mode acp-service

# 资产分析 Agent
actant agent create ue-analyzer -t asset-analyzer
actant agent start ue-analyzer --launch-mode acp-service

# 查看所有运行中的 Agent
actant agent list
```

Unreal 侧根据任务类型 spawn 不同的 `actant proxy <name>` 子进程，连接对应的 Agent。

## 参考

- [ACP 规范](https://agentclientprotocol.com/) — Agent Client Protocol 官方文档
- [Zed AgentServer 接入](/recipes/zed-agent-server) — 同样基于 stdio ACP 的 IDE 集成
- [打造雇员 Agent](/recipes/employee-agent) — Heartbeat / Cron 调度
- [UnrealFairy](https://github.com/blackplume233/UnrealFairy) — Unreal ACP Client 插件参考
