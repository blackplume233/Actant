# QA 日志 — Hook 系统全面测试 (Round 1)

**时间**: 2026-02-24
**焦点**: Hook 事件系统有效性 + Agent 自注册 Hook

---

### [Step 1] 构建检查
**时间**: 2026-02-24T09:12:00

#### 输入
```
pnpm build
```

#### 输出
```
exit_code: 0

--- stdout ---
全部 packages 构建成功（shared → core → acp → pi → api → cli → actant）

--- stderr ---
(empty)
```

#### 判断: PASS
构建全部通过，无报错无警告。

---

### [Step 2] Hook 模块单元测试
**时间**: 2026-02-24T09:12:28

#### 输入
```
npx vitest run packages/core/src/hooks/
```

#### 输出
```
exit_code: 0

--- stdout ---
✓ packages/core/src/hooks/hook-category-registry.test.ts (42 tests) 8ms
✓ packages/core/src/hooks/hook-event-bus.test.ts (15 tests) 25ms

Test Files  2 passed (2)
     Tests  57 passed (57)

--- stderr ---
(empty)
```

#### 判断: PASS
57 个 hook 系统单元测试全部通过（HookCategoryRegistry 42 个 + HookEventBus 15 个）。

---

### [Step 3] WorkflowDefinitionSchema 与 TypeScript 类型不一致
**时间**: 2026-02-24T09:13:00

#### 输入
```
检查 WorkflowDefinitionSchema（Zod）vs WorkflowDefinition（TypeScript interface）
```

#### 输出
```
WorkflowDefinitionSchema:
  content: z.string().min(1)   → 必填，最小 1 字符

WorkflowDefinition (TypeScript):
  content?: string             → 可选
```

#### 判断: FAIL
**Schema-Type 不一致 Bug**：
- `WorkflowDefinitionSchema`（`packages/core/src/domain/workflow/workflow-manager.ts:5-11`）要求 `content` 字段为 `z.string().min(1)` 即必填。
- `WorkflowDefinition`（`packages/shared/src/types/domain-component.types.ts:67-76`）中 `content?: string` 为可选。
- **影响**：纯 Hook Workflow（只有 `hooks` 数组、没有 `content` 字段）无法通过 Zod 校验，会被 `loadFromDirectory` 静默跳过。
- **根因**：PR #179 新增了 `hooks`/`level`/`enabled` 字段到 TypeScript 接口，但 Zod schema 未同步更新。
- **严重度**：**P1** — 阻碍纯事件驱动 workflow 的使用。

---

### [Step 4] Workflow 加载验证（含 content 字段）
**时间**: 2026-02-24T09:14:00

#### 输入
```
创建包含 content + hooks 的 workflow JSON → 重启 Daemon → workflow list -f json
```

#### 输出
```
exit_code: 0

--- stdout ---
[{ "name": "qa-test-hooks", "hooks": [...5 个 hook 声明...] }]

--- stderr ---
(empty)
```

#### 判断: PASS
添加 content 字段后，workflow 正常加载，hooks 数组完整保留。

---

### [Step 5] HookRegistry 集成缺口检查
**时间**: 2026-02-24T09:14:30

#### 输入
```
rg "HookRegistry|hookRegistry|registerWorkflow" packages/api/
```

#### 输出
```
No matches found
```

#### 产物检查
```
在 AppContext 中：
- eventBus = new HookEventBus() ✓ （已实例化）
- hookCategoryRegistry = new HookCategoryRegistry() ✓ （已实例化）
- eventBus.setEmitGuard(...) ✓ （已连接 EmitGuard）
- AgentManager 接收 eventBus 参数 ✓ （事件会被发射）

缺失：
- HookRegistry 未在 AppContext 中实例化
- workflowManager.list() 的结果从未传给 HookRegistry.registerWorkflow()
- 因此 EventBus 上的事件没有任何 workflow hook listener
```

#### 判断: FAIL
**关键集成缺口**：`HookRegistry` 虽然在 `@actant/core` 中完整实现（注册/注销/事件监听），但在 Daemon 启动流程中（`AppContext`/`Daemon`）**从未被实例化或连接**。

这意味着：
1. AgentManager 在每次 create/start/stop/destroy 时正确 emit 事件到 EventBus ✓
2. 但 EventBus 上没有任何 listener ✗
3. Workflow JSON 的 hooks 声明是**死数据** ✗

**影响**：**整个 hook 触发链路断裂**。用户定义的 workflow hooks 虽然可以加载和查看，但**永远不会被执行**。

---

### [Step 6] Agent 生命周期 CLI 操作
**时间**: 2026-02-24T09:15:00

#### 输入
```
agent create hook-test-agent -t qa-hook-test-tpl
agent start hook-test-agent
agent stop hook-test-agent
agent destroy hook-test-agent --force
```

#### 输出
```
exit_code: 0 (所有四步)

--- stdout ---
Agent created successfully. (status: created)
Started hook-test-agent (status: running, pid: 10000)
Stopped hook-test-agent
Destroyed hook-test-agent

--- stderr ---
(empty)
```

#### 产物检查
```
Daemon 前台日志中无任何 hook 触发记录（仅显示 "Daemon started"）
```

#### 判断: WARN
Agent 生命周期操作本身全部正常，但无法观察到任何 hook 触发效果（符合 Step 5 的发现：HookRegistry 未连接）。

---

### [Step 7] HookCategoryRegistry 单元测试分析
**时间**: 2026-02-24T09:16:00

#### 输入
```
检查 hook-category-registry.test.ts 覆盖度
```

#### 输出
```
42 tests covering:
- 初始化（加载内置类别）
- 自定义类别注册/注销
- 重复注册拒绝
- 前缀/名称查询
- 层级过滤（listByLayer）
- 事件验证（静态/动态/独立事件）
- 事件元数据注册与查询
- 权限检查（canEmit/canListen）
- Agent 订阅性检查（isAgentSubscribable）
- EmitGuard 构建
- 注销时清理 eventMeta
```

#### 判断: PASS
测试覆盖全面，关键边界条件均已覆盖（重复注册、未知事件、空 allowedEmitters、内置类别保护等）。

---

### [Step 8] HookEventBus 单元测试分析
**时间**: 2026-02-24T09:16:30

#### 输入
```
检查 hook-event-bus.test.ts 覆盖度
```

#### 输出
```
15 tests covering:
- 基本 emit/listen（旧签名兼容）
- ISO 时间戳生成
- 监听器移除
- 多监听器
- 异步/同步异常处理（不抛出）
- removeAllListeners
- dispose
- cron 风格事件名
- 显式 HookEmitContext（callerType/callerId）
- EmitGuard 阻断/放行
- dispose 清除 guard
```

#### 判断: PASS
EventBus 核心功能测试完整，异常安全性（async reject / sync throw）有覆盖。

---

### [Step 9] ActionRunner 单元测试覆盖检查
**时间**: 2026-02-24T09:17:00

#### 输入
```
rg "action-runner|ActionRunner|runActions" packages/core/src --glob "*.test.ts" --files-with-matches
```

#### 输出
```
No files with matches found
```

#### 判断: WARN
ActionRunner（`packages/core/src/hooks/action-runner.ts`）**没有专门的单元测试**。该模块实现了三种动作类型（shell/builtin/agent）的执行逻辑、模板变量插值（`${agent.name}`、`${event}`、`${timestamp}`）、错误处理（best-effort 策略）。这些关键逻辑缺乏测试覆盖。

---

### [Step 10] HookRegistry 单元测试覆盖检查
**时间**: 2026-02-24T09:17:30

#### 输入
```
rg "registerWorkflow|HookRegistry" packages/core/src --glob "*.test.ts" --files-with-matches
```

#### 输出
```
No files with matches found
```

#### 判断: WARN
HookRegistry（`packages/core/src/hooks/hook-registry.ts`）**没有单元测试**。该模块实现了 workflow hook 注册/注销、事件监听绑定、instance-level 过滤、allowedCallers 过滤等核心功能。虽然代码量不大，但作为 hook 触发链路的关键环节，缺乏测试覆盖是风险。

---

### [Step 11] Hook CLI 命令实现状态检查
**时间**: 2026-02-24T09:18:00

#### 输入
```
node packages/cli/dist/bin/actant.js hook subscribe --agent self --event heartbeat:tick --prompt "test"
```

#### 输出
```
exit_code: 1

--- stderr ---
error: unknown command 'hook'
```

#### 产物检查
```
API contracts §4.8 标记为 🚧 待实现：
- hook subscribe / hook unsubscribe / hook list CLI 命令未实现
- hook.subscribe / hook.unsubscribe / hook.list RPC handler 未实现
- Agent 自注册 Hook（订阅模型 C）完全不可用
```

#### 判断: WARN
`hook` CLI 命令及其对应的 RPC handler 均未实现。这在 API contracts 中已标记为 🚧（Phase 4），属于已知的规划中功能。但考虑到 PR #179 已经合并了统一事件系统的基础设施（EventBus、CategoryRegistry、BUILTIN_EVENT_META 等），上层集成（HookRegistry 连接和 hook CLI）是完成事件系统的关键缺失环节。

---

### [Step 12] EmitGuard 集成验证（通过 AppContext）
**时间**: 2026-02-24T09:18:30

#### 输入
```
检查 AppContext 构造函数中 EmitGuard 的设置
```

#### 输出
```
app-context.ts line 146:
  this.eventBus.setEmitGuard(this.hookCategoryRegistry.buildEmitGuard());

buildEmitGuard() 内部调用 canEmit()，验证:
- actant:start/stop: 只有 system 可以 emit
- agent:created/destroyed/modified: system 和 user 可以 emit，plugin/agent 不行
- process:start/stop/crash/restart: 只有 system 可以 emit
- heartbeat:tick/prompt:before/after/idle: 所有 callerType 可以 emit
```

#### 判断: PASS
EmitGuard 正确集成到 AppContext 中。通过 HookCategoryRegistry.buildEmitGuard()，EventBus 会在每次 emit 时验证 callerType 权限。系统事件被正确保护，只有 system caller 可以触发。

---

