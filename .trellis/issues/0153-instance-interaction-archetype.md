## 动机

当前 `AgentInstanceMeta` 具备 `interactionModes`（open / start / chat / run / proxy）、`launchMode`（direct / acp-background / normal / one-shot）和 `schedule` 配置，但缺少一个高层语义字段来描述 **实例的交互范式（archetype）**。用户无法通过单一配置声明"这个 Agent 是自主运行的雇员型"或"这是按需调用的工具型"，导致：

1. **雇员型 Agent 无法自动启动** — 系统启动或 API 启动时无法自动拉起配有 schedule 的 Agent
2. **交互约束散落各处** — `interactionModes` 控制 CLI 命令可用性，`launchMode` 控制进程模式，`schedule` 控制任务调度，但三者之间缺乏上层关联
3. **运维成本高** — 用户必须手动组合多个字段才能表达"持续运行的自主 Agent"语义

## 提案

### 1. 引入 `archetype` 字段

在 `AgentTemplate` 顶层或 `backend` 配置中增加 `archetype`：

```typescript
export type AgentArchetype = "tool" | "employee" | "service";
```

| Archetype  | 语义                     | 默认行为                                     |
|------------|--------------------------|----------------------------------------------|
| `tool`     | 按需工具型（默认）        | 用户主动 open/start，无自动启动              |
| `employee` | 自主雇员型               | 自动启动 + schedule 驱动，后台持续运行       |
| `service`  | 服务型（API/ACP 对外暴露）| 自动启动，以 normal 模式监听请求        |

### 2. 雇员型自动启动能力

- `agent create` 时若 archetype = `employee`，且 template 包含 `schedule` 配置，则自动标记 `autoStart: true`
- API/Daemon 启动时扫描所有 `autoStart: true` 的 instance，自动调用 `agentManager.startAgent()`
- 与 #152 联动：启动后自动初始化 `EmployeeScheduler` 并注册到 `ctx.schedulers`

### 3. 交互模式约束推导

`archetype` 可作为 `interactionModes` 和 `launchMode` 的**默认推导源**：

| Archetype  | 默认 interactionModes      | 默认 launchMode   |
|------------|----------------------------|--------------------|
| `tool`     | `["open", "start", "chat"]`| `direct`           |
| `employee` | `["start", "run", "proxy"]`| `acp-background`   |
| `service`  | `["proxy"]`                | `normal`      |

用户仍可在 template 中显式覆盖。

## 涉及变更

- `packages/shared/src/types/template.types.ts` — 增加 `AgentArchetype` 类型和模板字段
- `packages/shared/src/types/agent.types.ts` — `AgentInstanceMeta` 增加 `archetype` + `autoStart`
- `packages/core/src/state/instance-meta-schema.ts` — Zod schema 更新
- `packages/core/src/manager/agent-manager.ts` — 创建实例时推导默认值
- `packages/api/src/services/app-context.ts` — 启动时扫描 autoStart 实例
- `packages/api/src/handlers/agent-handlers.ts` — start 时联动 EmployeeScheduler（关联 #152）

## 关联

- #152 EmployeeScheduler never created（前置修复，本 Issue 在其基础上扩展自动启动）

## 验收标准

- [ ] 模板可声明 `archetype: "employee"`，创建的实例自动标记 `autoStart: true`
- [ ] API 启动时自动拉起所有 `autoStart: true` 的 Agent 并初始化 Scheduler
- [ ] `archetype: "tool"` 的 Agent 行为与当前一致（无自动启动）
- [ ] 用户可通过 `agent start --no-auto` 或 template 显式覆盖推导的默认值
- [ ] `agent status` 显示 archetype 信息
