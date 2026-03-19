---
id: 15
title: ACP Proxy — 标准 ACP 协议网关
status: closed
labels:
  - acp
  - feature
  - protocol
  - "priority:P1"
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues:
  - 23
  - 13
  - 26
relatedFiles:
  - packages/cli/src/commands/
  - packages/api/src/handlers/
taskRef: null
githubRef: "blackplume233/Actant#15"
closedAs: completed
createdAt: "2026-02-20T18:00:00"
updatedAt: "2026-02-20T18:00:00"
closedAt: "2026-02-22T21:23:00Z"
---

**Related Issues**: [[0023-launchmode]], [[0013-acp-endpoint]], [[0026-resolve-attach-detach]]
**Related Files**: `packages/cli/src/commands/`, `packages/api/src/handlers/`

---

## 目标

实现 ACP Proxy（`actant proxy`），使外部 ACP Client（IDE / Unreal / Unity）可以标准 ACP/stdio 协议接入 Actant 托管的 Agent，无需了解 Actant 内部实现。

## 背景

ACP 是不对称协议（Client 提供环境，Agent 消费）。托管 Agent 的 ACP/stdio 连接已被 Actant Daemon 占用。ACP Proxy 在外部客户端和 Daemon 之间搭建协议桥梁。

从外部客户端视角：`actant proxy` 就是一个标准 ACP Agent，配置方式与 `claude` / `cursor-agent` 完全相同。

## 架构

```
外部 ACP Client
    │  ACP / stdio
actant proxy --agent <name>
    │  JSON-RPC / Unix Socket
Actant Daemon
    │  ACP / stdio
托管 Agent
```

## 两种模式

### Workspace 隔离模式（默认）
- Agent 环境请求在 Actant workspace 内闭环
- 外部客户端只发 prompt、收 response
- 适用：纯任务委托

### 环境穿透模式（--env-passthrough）
- Agent 的 fs/readTextFile 等请求穿透回外部客户端
- Agent 操作外部客户端的文件系统
- 适用：远程 Agent 协作

## 功能

1. **ACP 握手翻译**：将 ACP initialize 映射为 proxy.connect RPC
2. **会话消息转发**：将 ACP session/prompt 映射为 proxy.forward RPC
3. **流式响应回传**：将 Daemon 流式响应转为 ACP session/update
4. **环境穿透**（可选）：Agent 环境请求 → Daemon → Proxy → 外部客户端 → 回传
5. **优雅断开**：Proxy 退出时调用 proxy.disconnect

## 外部客户端配置示例

```json
{
  "agent": {
    "command": "actant",
    "args": ["proxy", "--agent", "my-agent"],
    "protocol": "acp/stdio"
  }
}
```

## Daemon 侧新增

- ProxySession 管理（连接状态、EnvChannel 路由）
- proxy.connect / proxy.disconnect / proxy.forward / proxy.envCallback RPC 方法
- EnvChannel: local | passthrough

## 依赖

- #9 LaunchMode 行为分化
- #15 agent.resolve / attach / detach（Proxy 启动时可自动 resolve）
- #12 ACP 协议集成（Daemon 侧 ACP Client 实现）

## 验收

- [ ] `actant proxy <name>` 可启动，外部 ACP Client 可连接
- [ ] ACP initialize → 正确返回能力声明
- [ ] ACP session/prompt → 任务转发到 Agent → 响应回传
- [ ] Workspace 隔离模式可用
- [ ] 环境穿透模式可用
- [ ] Proxy 退出时优雅断开
- [ ] 集成测试覆盖两种模式
