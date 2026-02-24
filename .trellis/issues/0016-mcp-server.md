---
id: 16
title: MCP Server — Agent 管理能力暴露（可选 MCP 接入）
status: open
labels:
  - mcp
  - feature
  - protocol
  - "priority:P4"
milestone: long-term
author: cursor-agent
assignees: []
relatedIssues:
  - 13
  - 136
  - 137
relatedFiles:
  - packages/mcp-server/
taskRef: null
githubRef: "blackplume233/Actant#16"
closedAs: null
createdAt: "2026-02-20T18:00:00"
updatedAt: "2026-02-23T00:00:00"
closedAt: null
---

**Related Issues**: [[0013-acp-endpoint]], [[0136-agent-to-agent-email]], [[0137-runtime-mcp-manager]]
**Related Files**: `packages/mcp-server/`

> **优先级调整（P2 → P4）**：Agent-to-Agent 通信优先通过 CLI / JSON-RPC API / Email (#136) 实现，
> MCP Server 作为**可选的未来 MCP 接入方式**保留，不再是 #136 的前置依赖。
> 当前阶段不投入实现。

---

## 目标

实现 Actant MCP Server（packages/mcp-server），向其他 Agent 暴露 Agent 管理能力。Agent A 通过 MCP tool call 即可创建、调用、查询 Actant 管理的 Agent。

## 背景

Agent 不能直接用 ACP 和另一个托管 Agent 通信（ACP 连接被 Daemon 独占，Agent 无法扮演 ACP Client 角色）。正确路径是 MCP：Agent 调用 Actant MCP Server 的 tools，MCP Server 内部通过 Actant API 操作目标 Agent。

### 协议分工
- ACP: 人/应用 ↔ Agent（交互协议）
- MCP: Agent ↔ 工具/服务（能力协议）

## 架构

```
Agent A (在 IDE 中运行)
    │  MCP tool call
Actant MCP Server
    │  Actant API (JSON-RPC / Unix Socket)
Actant Daemon
    │  ACP / stdio
Agent B (headless, 被管理)
```

## MCP Tools

| Tool | 参数 | 返回 | 说明 |
|------|------|------|------|
| actant_run_agent | { template, prompt } | { response, artifacts? } | 创建 ephemeral Agent 执行任务 |
| actant_prompt_agent | { name, message, sessionId? } | { response, sessionId } | 向持久 Agent 发送消息 |
| actant_agent_status | { name } | AgentInstanceMeta | 查询状态 |
| actant_create_agent | { name, template } | { name, workspaceDir, status } | 创建实例（不启动） |
| actant_list_agents | {} | AgentInstanceMeta[] | 列出所有 Agent |

## 依赖

- #12 ACP 协议集成（agent.run / agent.prompt 需要 Daemon 侧 ACP Client）

## 验收

- [ ] MCP Server 可作为 MCP Server 进程启动
- [ ] actant_run_agent 可执行完整的 ephemeral Agent 流程
- [ ] actant_prompt_agent 可向持久 Agent 发送消息
- [ ] actant_agent_status / list_agents 返回正确状态
- [ ] Agent A 可通过 MCP tool call 使用以上 tools
- [ ] 集成测试覆盖核心 tools
