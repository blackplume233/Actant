---
id: 17
title: ACP-Fleet 扩展协议 — Actant API 对齐 ACP 标准
status: open
labels:
  - acp
  - protocol
  - vision
  - "priority:P4"
milestone: long-term
author: cursor-agent
assignees: []
relatedIssues:
  - 13
  - 15
  - 16
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#17"
closedAs: null
createdAt: "2026-02-20T19:00:00"
updatedAt: "2026-02-20T19:00:00"
closedAt: null
---

**Related Issues**: [[0013-acp-endpoint]], [[0015-acp-proxy]], [[0016-mcp-server]]

---

## 愿景

将 Actant 的自定义 JSON-RPC API 演进为 ACP 的标准扩展协议（ACP-Fleet），使 Actant Daemon 本身成为一个 ACP Server，任何 ACP Client 无需额外适配即可管理 Agent 集群。

## 背景

当前 Actant 使用自定义 JSON-RPC 协议与 CLI / ACP Proxy / MCP Server 通信，这导致：
- 每种接入方式需要单独的协议适配层
- 外部客户端必须了解 Actant 的私有 API
- ACP Proxy 需要完整的协议翻译（ACP ↔ JSON-RPC）

ACP 建立在 JSON-RPC 2.0 上，使用命名空间方法，天然支持扩展。如果 Actant 的 API 直接表达为 ACP 扩展命名空间（fleet/*），则：
- Daemon 本身就是 ACP Server，ACP Proxy 简化为纯 transport 适配（stdio↔socket）
- 标准 ACP Client 通过 capabilities 发现 fleet 扩展
- Agent 管理平台之间可互操作

## 设计概要

### 协议扩展

```
标准 ACP 命名空间（已有）：
  initialize, session/*, fs/*, terminal/*, tool/*

ACP-Fleet 扩展命名空间（新增）：
  fleet/agent.create, fleet/agent.start, fleet/agent.stop
  fleet/agent.resolve, fleet/agent.attach, fleet/agent.detach
  fleet/agent.list, fleet/agent.status
  fleet/session.create  → 绑定目标 Agent 后使用标准 session/prompt
  fleet/template.list, fleet/template.load
  fleet/ping, fleet/shutdown
```

### 能力声明

```json
{
  "capabilities": {
    "session": true,
    "fleet": {
      "version": "0.1.0",
      "agents": true,
      "templates": true,
      "routing": true
    }
  }
}
```

不认识 fleet 扩展的标准 ACP Client 会忽略它，完全向后兼容。

### Transport 扩展

| Transport | 场景 |
|-----------|------|
| stdio | 外部 ACP Client spawn 进程（需 shim） |
| Unix Socket | 本地 CLI / 本地应用 |
| WebSocket | 远程客户端 / Web 应用 |
| HTTP | REST 风格 / CI/CD |

### Session 路由

```
fleet/session.create({ agent: "reviewer" }) → { sessionId: "s-123" }
session/prompt({ sessionId: "s-123", message: "..." }) → 路由到 reviewer
```

Client 先绑定目标 Agent，之后用标准 session/prompt，标准 ACP Client 无需修改。

### ACP Proxy 简化

旧设计：Client → ACP Proxy (协议翻译) → Daemon
新设计：Client → actant connect (纯 stdio↔socket transport) → Daemon (ACP Server)

## 演进路径

1. Phase 1（当前）：自定义 JSON-RPC — 已实现
2. Phase 2：ACP 框架对齐 — 消息格式对齐 ACP 规范，添加 initialize + capabilities
3. Phase 3：ACP-Fleet 发布 — 正式定义 fleet/* 命名空间，transport 扩展
4. Phase 4：社区标准化 — 发布 ACP-Fleet Extension Spec

## 对现有 Issue 的影响

- #12 ACP 协议集成 → Daemon ACP Client + 未来 ACP Server 框架
- #16 ACP Proxy → 从协议翻译降级为 transport shim
- #17 MCP Server → 成为 ACP-Fleet 到 MCP 的桥接
- #15 resolve/attach/detach → 语义不变，换命名空间

## 依赖

- #12 ACP 协议集成（Daemon 侧 ACP 能力基础）
- #16 ACP Proxy（验证 ACP 接入模式可用性）
- ACP 标准演进方向

## 验收

- [ ] Actant Daemon 可作为 ACP Server 接受连接
- [ ] fleet/* 命名空间方法可用
- [ ] 标准 ACP Client 通过 capabilities 发现 fleet 扩展
- [ ] actant connect (stdio shim) 替代 actant proxy
- [ ] fleet/session.create + session/prompt 路由可用
- [ ] ACP-Fleet Extension Spec 文档发布
