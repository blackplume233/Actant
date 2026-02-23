---
id: 26
title: agent.resolve / agent.attach / agent.detach API — 外部 Spawn 支持
status: closed
labels:
  - core
  - feature
  - api
  - "priority:P1"
milestone: near-term
author: cursor-agent
assignees: []
relatedIssues:
  - 22
  - 23
relatedFiles:
  - packages/shared/src/types/agent.types.ts
  - packages/core/src/state/instance-meta-schema.ts
  - packages/api/src/handlers/
taskRef: null
githubRef: "blackplume233/Actant#26"
closedAs: completed
createdAt: "2026-02-20T18:00:00"
updatedAt: "2026-02-20T15:50:29"
closedAt: "2026-02-20T15:50:29"
---

**Related Issues**: [[0022-processwatcher]], [[0023-launchmode]]
**Related Files**: `packages/shared/src/types/agent.types.ts`, `packages/core/src/state/instance-meta-schema.ts`, `packages/api/src/handlers/`

---

## 目标

实现三个新 RPC 方法，允许外部客户端（Unreal/Unity 等）自行 spawn Agent 进程，同时将状态注册到 Actant 进行跟踪。

## 背景

外部客户端可能需要自行管理 Agent 进程（保留对 ACP 连接的完全控制），但同时希望 Actant 提供 workspace 物化和状态追踪。这是四种外部接入模式中的 "Self-spawn + Attach" 模式。

## 功能

### agent.resolve
- 获取 spawn 所需的全部信息（command, args, env, workspaceDir）而不启动进程
- 若实例不存在但提供了 template，自动创建实例（含 workspace 物化）
- 返回 ResolveResult 结构

### agent.attach
- 外部客户端 spawn 后调用，告知 Actant PID
- 设置 processOwnership: "external"，status: "running"
- 注册 ProcessWatcher 监控（检测 PID 意外死亡 → status: "crashed"）
- 防止重复 attach（返回 AGENT_ALREADY_ATTACHED 错误）

### agent.detach
- 外部客户端终止进程后调用
- 清除 processOwnership、pid，status → stopped
- 可选 cleanup: true 删除 ephemeral workspace

## 新增配置字段

- `AgentInstanceMeta.processOwnership`: "managed" | "external"
- `AgentInstanceMeta.workspacePolicy`: "persistent" | "ephemeral"
- `AgentStatus` 新值: "crashed"

## CLI 命令

- `actant agent resolve <name> -t <template>`
- `actant agent attach <name> --pid <pid>`
- `actant agent detach <name> [--cleanup]`

## 依赖

- #8 ProcessWatcher（attach 后需要 PID 监控）
- #9 LaunchMode 行为分化（processOwnership 与 LaunchMode 交互）

## 验收

- [ ] agent.resolve 返回完整 spawn 信息
- [ ] agent.resolve 支持 template 参数自动创建
- [ ] agent.attach 正确更新 meta 并注册 ProcessWatcher
- [ ] agent.detach 正确清理状态
- [ ] detach cleanup 删除 ephemeral workspace
- [ ] 重复 attach 返回错误
- [ ] ProcessWatcher 检测到 PID 死亡 → crashed
- [ ] CLI 命令可用
- [ ] 单元测试覆盖

---

## Comments

### cursor-agent — 2026-02-20T15:09:27

Closed as completed

### cursor-agent — 2026-02-20T15:50:29

Closed as completed
