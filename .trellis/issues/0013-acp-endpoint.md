---
id: 13
title: ACP 协议集成 — Daemon 侧 ACP Client + agent.run/prompt
status: closed
labels:
  - acp
  - core
  - feature
  - "priority:P1"
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 23
  - 15
  - 16
relatedFiles:
  - packages/core/src/manager/launcher/
  - packages/api/src/handlers/
taskRef: null
githubRef: "blackplume233/Actant#13"
closedAs: completed
createdAt: "2026-02-20T11:35:35"
updatedAt: "2026-02-20T18:00:00"
closedAt: "2026-02-22T21:23:00Z"
---

**Related Issues**: [[0023-launchmode]], [[0015-acp-proxy]], [[0016-mcp-server]]
**Related Files**: `packages/core/src/manager/launcher/`, `packages/api/src/handlers/`

---

## 目标

实现 Daemon 作为 ACP Client 与托管 Agent 进程通信的能力。这是 ACP Proxy (#16) 和 MCP Server (#17) 的共同基础。

## 背景

当前 ProcessLauncher spawn Agent 后，Daemon 不持有 Agent 的 ACP 连接（stdin/stdout）。要实现 agent.run（一站式任务执行）和 agent.prompt（向运行中 Agent 发消息），Daemon 需要作为 ACP Client 管理 Agent 的 stdio 通信。

## 功能

### 1. Daemon 侧 ACP Client
- ProcessLauncher spawn 时捕获 Agent 的 stdin/stdout
- 实现 ACP Client 协议栈（initialize, session/new, session/prompt）
- 处理 Agent 的环境请求回调（fs/readTextFile 等）→ 在 workspace 内本地处理或通过 EnvChannel 转发
- 连接状态管理（AcpConnection per Agent）

### 2. agent.run RPC 方法
- 一站式操作：create ephemeral instance → spawn → ACP session → prompt → wait → cleanup
- 返回 Agent 完成结果
- processOwnership: "managed"

### 3. agent.prompt RPC 方法
- 向已运行的 managed Agent 发送消息
- 支持 session 复用（sessionId 参数）
- 仅 processOwnership: "managed" 可用（external 的 ACP 连接不在 Daemon 手中）

### 4. EnvChannel 路由
- local: Daemon 在 workspace 内处理环境请求（默认）
- passthrough: 转发给 ACP Proxy（由 #16 实现）

## 设计变更

> 旧方案（已弃用）：Agent 暴露 ACP endpoint (port/socket)，客户端直连。
> 新方案：Daemon 持有 ACP 连接，通过 RPC 或 Proxy 桥接外部访问。
> 原因：统一管理、安全性更好、支持更灵活的接入模式。

## 依赖

- #9 LaunchMode 行为分化（spawn 时需要根据 LaunchMode 决定是否捕获 stdio）

## 被依赖

- #16 ACP Proxy（需要 Daemon ACP 连接来转发消息）
- #17 MCP Server（需要 agent.run / agent.prompt）

## 验收

- [ ] Daemon spawn Agent 时正确捕获 stdin/stdout
- [ ] ACP Client 握手成功（initialize）
- [ ] agent.run 完整流程可用（create → spawn → prompt → result → cleanup）
- [ ] agent.prompt 可向 running Agent 发送消息
- [ ] Agent 环境请求在 workspace 内正确处理
- [ ] EnvChannel 路由框架就绪
- [ ] 单元测试覆盖
