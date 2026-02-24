---
id: 134
title: "feat(cli): agent open + interactionModes — 前台 TUI 与模板交互模式声明"
status: closed
closedAt: "2026-02-24"
labels:
  - feature
  - "priority:P2"
  - cli
milestone: null
author: human
assignees: []
relatedIssues:
  - 133
relatedFiles:
  - packages/cli/src/commands/agent/start.ts
  - packages/cli/src/commands/agent/chat.ts
  - packages/cli/src/commands/proxy.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/manager/launcher/backend-resolver.ts
  - packages/shared/src/types/template.types.ts
  - packages/shared/src/types/agent.types.ts
taskRef: null
githubRef: "blackplume233/Actant#134"
closedAs: null
createdAt: 2026-02-23T00:00:00
updatedAt: 2026-02-23T00:00:00
closedAt: null
---

**Related Issues**: [[0133-actant-env-var-default-provider-config]]
**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/shared/src/types/agent.types.ts`, `packages/cli/src/commands/agent/start.ts`, `packages/cli/src/commands/agent/chat.ts`, `packages/cli/src/commands/proxy.ts`, `packages/core/src/manager/launcher/backend-resolver.ts`

---

## 目标

1. 模板层面声明 Agent 支持哪些交互方式（`interactionModes`），实例化时继承，CLI 命令执行前校验
2. 新增 `actant agent open <name>` 命令，前台交互模式直接打开 Agent 原生 TUI

## 背景

**问题一**：没有直接打开原生 TUI 的命令

| 命令 | 行为 | 问题 |
|------|------|------|
| `agent start` | Daemon 后台启动 ACP 进程，CLI 立即返回 | 无前台交互 |
| `agent chat` | Actant 自有 REPL，底层走 ACP | 非原生 TUI，功能受限 |
| `agent run` | 单次 prompt，等结果后退出 | 无交互 |
| `proxy` | stdin/stdout 管道桥接，面向 IDE 集成 | 面向机器，非人类交互 |

**问题二**：任何命令都可以对任何 Agent 使用，没有根据后端能力做校验（例如对 cursor 后端执行 `agent open` 没有意义）

## 方案

### Part 1：模板声明 `interactionModes`

在 `AgentBackendConfig` 中新增可选字段：

```typescript
export type InteractionMode = "open" | "start" | "chat" | "run" | "proxy";

export interface AgentBackendConfig {
  type: AgentBackendType;
  config?: Record<string, unknown>;
  interactionModes?: InteractionMode[];
}
```

#### 各后端默认值

| backendType | 默认 interactionModes | 说明 |
|-------------|----------------------|------|
| `cursor` | `["start"]` | start 打开 IDE，无 TUI 概念 |
| `claude-code` | `["open", "start", "chat", "run", "proxy"]` | 完整支持 |
| `pi` | `["open", "start", "chat", "run", "proxy"]` | 完整支持 |
| `custom` | `["start"]` | 保守默认，用户可显式扩展 |

#### 实例化时持久化

`AgentInstanceMeta` 新增：

```typescript
interactionModes: InteractionMode[];
```

#### CLI 命令校验

不支持时报错并提示：

```
actant agent open my-cursor-agent
→ Error: Agent "my-cursor-agent" (cursor) does not support "open" mode.
  Supported modes: start
```

### Part 2：`agent open` 命令

```
actant agent open <name> [-t <template>] [--no-attach]
```

1. `agent.resolve` 获取 spawn 信息
2. 校验 `interactionModes` 包含 `"open"`
3. 默认 `agent.attach`（`--no-attach` 可跳过，attach 失败不阻塞）
4. `spawn(command, args, { cwd, stdio: "inherit" })`
5. 等待退出后 `agent.detach`

#### open 模式下的 backend-resolver

| backendType | `start` 解析结果 | `open` 解析结果 |
|-------------|-----------------|----------------|
| `claude-code` | `claude-agent-acp` | `claude`（原生 TUI） |
| `pi` | `pi-acp-bridge` | `pi`（原生 TUI） |
| `cursor` | `cursor <dir>` | 不支持 |
| `custom` | 用户配置 | 用户配置 `openCommand` |

### 关键差异：open vs start

| 维度 | `agent start` | `agent open` |
|------|--------------|-------------|
| stdio | pipe（Daemon 管理） | inherit（用户终端） |
| 进程归属 | Daemon | CLI 前台 |
| attach | 隐式 | 默认，可 `--no-attach` |
| 退出行为 | LaunchMode 决定 | CLI 等待退出后 detach |
| Daemon 依赖 | 必须 | 可选 |
| 命令解析 | ACP 命令 | 原生 TUI 命令 |

## 验收标准

### interactionModes

- [ ] `AgentBackendConfig` 新增 `interactionModes?: InteractionMode[]`
- [ ] `AgentInstanceMeta` 新增 `interactionModes: InteractionMode[]`
- [ ] 各 backendType 有合理默认值
- [ ] 实例化时从模板解析并持久化到 `.actant.json`
- [ ] `agent open/start/chat/run/proxy` 执行前校验，不支持时友好报错

### agent open

- [ ] `actant agent open my-agent` 直接打开 Claude Code 原生 TUI
- [ ] 默认 attach，`agent status` 可见
- [ ] `--no-attach` 跳过注册
- [ ] attach 失败降级为 warning，不阻塞
- [ ] 支持 `-t` 自动创建实例
- [ ] 进程退出后 detach + stopped
- [ ] 实例已在运行时友好提示
- [ ] `actant help agent open` 有文档

---

## Comments
