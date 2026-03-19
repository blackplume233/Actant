---
id: 135
title: "Workflow 重定义为 Hook Package — 事件驱动自动化"
status: open
labels:
  - feature
  - architecture
  - "priority:P1"
milestone: near-term
author: human
assignees: []
relatedIssues:
  - 132
  - 122
  - 14
  - 47
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/scheduler/employee-scheduler.ts
  - packages/core/src/scheduler/input-router.ts
taskRef: null
githubRef: "blackplume233/Actant#135"
closedAs: null
createdAt: 2026-02-23T00:00:00
updatedAt: 2026-02-23T00:00:00
closedAt: null
---

**Related Issues**: [[0014-plugin-system]], [[0047-employee-agent]], #132 (本 issue 覆盖，建议关闭)
**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/scheduler/employee-scheduler.ts`, `packages/core/src/scheduler/input-router.ts`
**需求来源**: `docs/human/hook机制.md`

---

## 动机

#132 提议废弃 `WorkflowDefinition` 并合并到 `SkillDefinition`。但经过重新审视，Workflow 不应被废弃，而应被**重新定义**为系统的 **Hook 机制载体** —— 一个 Hook Package。

当前 `WorkflowDefinition` 仅是一段 markdown 文本，功能定位模糊，这才是它看起来与 Skill 重复的根本原因。正确的做法不是消除它，而是赋予它明确的职责。

## 核心定义

> **Workflow = Hook Package**：一组 hook 声明的集合，当特定事件发生时自动执行预定义的动作。

### Hook 触发动作类型

每个 hook 可执行以下三类动作：

| 动作类型 | 说明 | 示例 |
|----------|------|------|
| **命令行 (shell)** | 执行任意 shell 命令 | `pnpm lint`, `git pull`, `docker restart` |
| **内置 Action** | 调用 Actant 内置动作 | `actant.notify`, `actant.snapshot`, `actant.backup` |
| **调用 Agent** | 委派任务给另一个 Agent | `agent:qa-bot "run regression"`, `agent:reviewer "check PR"` |

### 三层 Hook 架构

Hook 机制分为三层。Layer 1 是全局事件类型，Layer 2 是作用域绑定，Layer 3 是运行时事件类型。

#### Layer 1: Actant 系统层（全局事件）

作用于 Actant 守护进程的全局事件，包括 Instance 的持久化生命周期操作：

| Hook 事件 | 触发时机 |
|-----------|---------|
| `actant:start` | Actant 守护进程启动 |
| `actant:stop` | Actant 守护进程停止 |
| `agent:created` | 任意 Instance 被创建（workspace 初始化） |
| `agent:destroyed` | 任意 Instance 被销毁（workspace 清除） |
| `agent:modified` | 任意 Instance 配置变更（模板更新、provider 变更等） |
| `source:updated` | 组件源更新 |
| `cron:<expr>` | 定时触发 |

> Instance 的 create/destroy/modify 是持久化操作，属于系统管理范畴，因此归类到 Actant 系统层。

#### Layer 2: AgentInstance（作用域绑定）

Instance 层不产生独立事件，而是作为 **作用域（scope）**：Instance-level Workflow 绑定到特定实例，监听该实例的 Layer 3 运行时事件。

当一个 Instance-level Workflow 声明 `level: instance` 时，其 hooks 中的事件引用的是 Layer 3 的事件名，但仅对该实例生效。

#### Layer 3: 进程 / Session 运行时事件

一个 Instance 绑定的 Workflow 可以监听以下运行时事件：

| Hook 事件 | 触发时机 |
|-----------|---------|
| `process:start` | 该实例的进程启动（spawn） |
| `process:stop` | 该实例的进程正常停止 |
| `process:crash` | 该实例的进程异常退出 |
| `process:restart` | 该实例的进程重启（由 RestartTracker 触发） |
| `session:start` | 该实例新建会话 |
| `session:end` | 该实例会话结束 |
| `prompt:before` | 该实例收到 prompt 之前 |
| `prompt:after` | 该实例完成 prompt 之后 |
| `error` | 该实例发生错误 |
| `idle` | 该实例进入空闲状态 |

### 实体关系与 Hook 归属

```
AgentTemplate ──1:N──→ AgentInstance ──1:1──→ Process ──1:N──→ Session
(配置蓝图)            (workspace + 元数据)   (OS 进程)         (ACP 会话)

Hook 归属：
  Layer 1 (Actant)   ← agent:created / agent:destroyed / agent:modified
  Layer 2 (Instance) ← 作用域，绑定 Layer 3 事件到特定实例
  Layer 3 (Runtime)  ← process:start/stop/crash + session:start/end + prompt:before/after
```

## 配置格式设计（草案）

```yaml
# Actant-level workflow — 监听全局系统事件
name: ops-automation
level: actant
hooks:
  - on: agent:created
    actions:
      - type: shell
        run: "echo 'New agent: ${agent.name}' >> /var/log/actant.log"
      - type: agent
        target: qa-bot
        prompt: "Run smoke test for ${agent.name}"

  - on: "cron:0 9 * * *"
    actions:
      - type: builtin
        action: actant.healthcheck
      - type: shell
        run: "pnpm test:changed"
```

```yaml
# Instance-level workflow — 绑定到实例，监听其进程/Session 运行时事件
name: dev-guard
level: instance
hooks:
  - on: session:end
    actions:
      - type: shell
        run: "git diff --stat"
      - type: agent
        target: reviewer
        prompt: "Review changes in this session"

  - on: process:crash
    actions:
      - type: builtin
        action: actant.notify
        params:
          channel: slack
          message: "Agent ${agent.name} process crashed"

  - on: error
    actions:
      - type: builtin
        action: actant.notify
        params:
          channel: slack
          message: "Agent ${agent.name} encountered an error"
```

## 与现有系统的关系

| 现有概念 | 关系 |
|---------|------|
| `SkillDefinition` | **不合并**。Skill 是知识/能力注入，Workflow 是事件驱动的自动化 |
| `EmployeeScheduler` (#47) | Workflow 的 `cron` hook 可替代/简化 `CronInput`；`HookInput` 可作为 Workflow hook 的运行时基础设施 |
| `docs/human/hook机制.md` | Workflow 是该文档中 hook 需求的完整落地方案 |
| `PackageManifest.workflows` | 保留，语义从 "markdown 文本" 升级为 "hook package 声明" |
| `ProcessWatcher` | 为 Layer 3 的 `process:crash` / `process:stop` 提供事件源 |
| `AcpConnection` | 为 Layer 3 的 `session:start` / `session:end` 提供事件源 |

## 对 #132 的处置建议

关闭 #132。理由：
- Workflow 不是与 Skill 重复的概念，而是一种独立的、面向事件自动化的机制
- 之前看起来重复，是因为 Workflow 的数据结构 (`name + content`) 没有体现其真实职责
- 重新定义后，Workflow 与 Skill 有清晰的边界：**Skill = 知识注入，Workflow = 事件自动化**

## 实现路径（概要）

1. **定义 schema**: 设计 `WorkflowDefinition` 的新数据结构（替换当前的 `name + content`），区分 `level: actant` 和 `level: instance`
2. **Hook 事件总线**: 在 Actant 核心实现事件发射机制（或复用 `EventEmitter`），分 Layer 1（系统事件）和 Layer 3（运行时事件）两套事件源
3. **Workflow 加载器**: 从 DomainContext 或 Template 加载 workflow 声明并注册 hook
4. **动作执行器**: 实现 shell / builtin / agent 三种动作的运行时
5. **CLI 支持**: `actant workflow list`, `actant workflow enable/disable`
6. **与 EmployeeScheduler 整合**: 评估是否将 `CronInput` / `HookInput` 统一到 Workflow 体系

## 关联

- #132 (本 issue 覆盖该方案，建议关闭)
- #122 / #47 (EmployeeScheduler 中的 HookInput 可作为底层基础设施)
- #14 (Plugin 系统提供底层可插拔架构，与 Workflow 协同设计)
- `docs/human/hook机制.md` (原始需求文档)

---

## Comments
