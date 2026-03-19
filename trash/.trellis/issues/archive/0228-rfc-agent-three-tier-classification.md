---
id: 228
title: "RFC: Agent 三层分类重定义 — repo / service / employee"
status: open
labels:
  - rfc
  - architecture
  - core
  - "priority:P1"
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 194
  - 122
  - 40
  - 14
  - 193
  - 204
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/initializer/archetype-defaults.ts
  - packages/core/src/context-injector/session-context-injector.ts
  - packages/core/src/scheduler/employee-scheduler.ts
  - packages/core/src/permissions/permission-policy-enforcer.ts
  - packages/core/src/manager/agent-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#228"
closedAs: null
createdAt: 2026-02-27T12:00:00
updatedAt: 2026-02-27T12:00:00
closedAt: null
---

**Related Issues**: [[0182-instance-interaction-archetype]], [[0122-employee-service-mode]], [[0040-agent]], [[0014-plugin-heartbeat-scheduler-memory]], [[0171-service-instance-session-concurrency]], [[0204-actant-hub-default-employee-agent-templates]]
**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/initializer/archetype-defaults.ts`, `packages/core/src/context-injector/session-context-injector.ts`, `packages/core/src/scheduler/employee-scheduler.ts`, `packages/core/src/permissions/permission-policy-enforcer.ts`, `packages/core/src/manager/agent-manager.ts`

---

## 背景

当前项目已有 `AgentArchetype = "tool" | "employee" | "service"`（#194），但其语义边界模糊，且命名未能精确反映 Actant 对各层 Agent 的**管理程度差异**。现提出重新定义 Agent 三层分类体系，以管理深度为主轴，明确 Actant 在每一层的责任边界。

## 问题

当前 `tool / employee / service` 分类存在以下不足：

1. **"tool" 语义过窄** — 实际上很多 Agent 只需要 Actant 构建工作目录，用户自行在 IDE 中打开使用，并不局限于"工具"这一隐喻
2. **"service" 与 "employee" 的边界不清** — 现有定义中 service 是"长期运行的 ACP 服务"，employee 是"后台调度型"，但两者都 `autoStart: true`，管理机制高度重叠
3. **管理深度缺乏渐进层次** — 从"完全不管"到"完全自治"缺少一个清晰的阶梯，导致权限、进程管理、模板编排时无法对齐设计

## 方案

### 新的三层分类（以管理深度递进）

```
repo ──→ service ──→ employee
(最轻)    (中等)      (最重)
```

| 层级 | 名称 | Actant 职责 | 进程所有权 | 调度器 | 自我意识 | 典型用途 |
|------|------|------------|-----------|--------|---------|---------|
| **L1** | `repo` | 仅构建工作目录（resolve template → materialize workspace） | 无 — 用户自行打开 | 无 | 无 | IDE 内手动使用：`open` / `acp direct` |
| **L2** | `service` | 完全管理进程生命周期（spawn / monitor / restart） | Actant 拥有 | 无 | 无 | ACP 服务，响应外部请求，无自主行为 |
| **L3** | `employee` | 管理进程 + 调度 + 心跳 + 自主执行 | Actant 拥有 | 有（heartbeat / cron / hooks） | 有（持续执行使命） | 自治雇员：巡检、定时任务、持续监控 |

### 详细定义

#### L1: `repo`（仓库型）

- Actant 仅负责 **构建工作目录**：解析模板、物化组件（skills / prompts / mcp / permissions）
- 构建完成后 Actant **不持有任何进程**
- 用户通过 `actant agent open <name>` 在原生 IDE 中打开，或通过 `acp direct` 建立一次性会话
- 等同于当前 `tool` archetype 的核心行为，但命名更精确
- **权限**：由 workspace 内配置文件自行约束（Actant 仅物化配置，不运行时强制执行）
- **进程管理**：无。Actant 不追踪 repo 型 Agent 的运行状态

#### L2: `service`（服务型）

- Actant **完全管理进程生命周期**：spawn、health check、crash recovery、graceful shutdown
- 具备完整的 ACP 通信能力，可通过 `proxy` 模式接收外部请求
- **不具备调度器**：没有 heartbeat、cron、hooks —— 无自主行为，纯被动响应
- 支持多 Session 并发（参考 #193 Service Instance 多 Session 设计）
- **权限**：Actant 运行时强制执行 PermissionsConfig，受 PolicyEnforcer 管控
- **进程管理**：ProcessWatcher 监控 + auto-restart（crash recovery）

#### L3: `employee`（雇员型）

- 在 `service` 全部能力基础上，增加：
  - **心跳（Heartbeat）**：定期向系统汇报存活，HeartbeatInput 产生 tick
  - **调度器（EmployeeScheduler）**：heartbeat + cron + hooks 三种 InputSource
  - **自我意识**：持续执行使命（mission prompt），具备主动行为能力
- 雇员是"有使命感的服务" —— 不仅响应请求，还主动巡检、执行定时任务
- **权限**：最严格的管控层级，employee-scope tools 仅对此类型开放
- **进程管理**：ProcessWatcher + EmployeeScheduler + TaskQueue + TaskDispatcher

### 与现有系统的映射

| 当前 Archetype | 新分类 | 变化说明 |
|---------------|--------|---------|
| `tool` | `repo` | 重命名 + 语义收窄：强调"仅构建目录" |
| `service` | `service` | 语义调整：移除调度能力，纯被动服务 |
| `employee` | `employee` | 不变，但明确为 service 的超集 |

### 模板标注

模板文件 `archetype` 字段改为使用新分类值：

```typescript
export type AgentArchetype = "repo" | "service" | "employee";
```

模板编排时应明确标注可构建的 Agent 类型：

```json
{
  "name": "code-reviewer",
  "archetype": "repo",
  "metadata": {
    "supportedArchetypes": "repo,service"
  }
}
```

### 各层级默认行为推导

| 属性 | `repo` | `service` | `employee` |
|------|--------|-----------|------------|
| `launchMode` | `direct` | `acp-service` | `acp-background` |
| `interactionModes` | `["open", "start", "chat"]` | `["proxy"]` | `["start", "run", "proxy"]` |
| `autoStart` | `false` | `true` | `true` |
| `schedule` | 不允许 | 不允许 | 必须配置 |
| 进程监控 | 无 | ProcessWatcher | ProcessWatcher + Scheduler |
| 权限执行 | 物化时写入 | 运行时强制 | 运行时强制 + scope 限制 |

## 影响范围

### 需要变更的文件

| 文件 | 变更内容 |
|------|---------|
| `packages/shared/src/types/template.types.ts` | `AgentArchetype` 类型值变更 |
| `packages/core/src/initializer/archetype-defaults.ts` | `ARCHETYPE_TABLE` 重构 |
| `packages/core/src/context-injector/session-context-injector.ts` | scope 判断逻辑适配 |
| `packages/core/src/scheduler/employee-scheduler.ts` | 仅 employee 可初始化 |
| `packages/core/src/permissions/permission-policy-enforcer.ts` | 按层级差异化执行 |
| `packages/core/src/manager/agent-manager.ts` | create/start 流程适配 |
| `.trellis/spec/config-spec.md` | 规范更新 |
| `.trellis/spec/agent-lifecycle.md` | 生命周期规范更新 |
| `docs/wiki/guide/concepts.md` | 用户文档更新 |
| `docs/wiki/features/scheduler.md` | 调度器文档限定 employee |
| 所有模板 JSON 文件 | `archetype` 值迁移 |

### 下游设计依赖

- **权限体系**（#40）：不同层级的权限执行机制不同
- **进程管理**：repo 无需 ProcessWatcher，service / employee 需要
- **Plugin 体系**（#14）：heartbeat plugin 仅 employee 可用
- **Hub Kernel**（#204）：kernel agents 明确为 employee

## 替代方案

1. **保持 tool / employee / service 不变**：不改名，仅在文档中补充管理深度说明。缺点：tool 命名不直观，且 service 与 employee 边界仍需靠文档维持
2. **四层分类（增加 autonomous）**：在 employee 之上增加全自治层。缺点：当前阶段过度设计

## 验收标准

- [ ] `AgentArchetype` 类型更新为 `"repo" | "service" | "employee"`
- [ ] `ARCHETYPE_TABLE` 反映新的默认行为
- [ ] `repo` 类型 Agent 创建后不启动进程，仅生成工作目录
- [ ] `service` 类型禁止配置 `schedule`（构建时校验）
- [ ] `employee` 类型必须配置 `schedule`（至少 heartbeat）
- [ ] 模板 JSON 中 `archetype` 字段迁移为新值
- [ ] 权限执行按层级差异化（repo: 物化时写入，service / employee: 运行时强制）
- [ ] 文档（concepts.md、config-spec.md、agent-lifecycle.md）同步更新
- [ ] 现有模板文件完成迁移
