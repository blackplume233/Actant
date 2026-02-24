---
name: "Initializer 框架 + Template 热重载 + 进程日志收集"
overview: "实现三个核心增强：可扩展的 Agent 初始化流程框架 (#37 P1)、模板文件热重载 (#8 P2)、Agent 进程 stdout/stderr 日志收集 (#9 P3)"
todos:
  - id: p1-step-executor
    content: "P1: 设计并实现 InitializerStepExecutor 抽象基类与 StepRegistry"
    status: pending
  - id: p1-pipeline
    content: "P1: 实现 InitializationPipeline 执行引擎（顺序执行、失败回滚、超时控制）"
    status: pending
  - id: p1-builtin-steps
    content: "P1: 实现 5 个内置步骤（git-clone, npm-install, file-copy, exec, mkdir）"
    status: pending
  - id: p1-integration
    content: "P1: 集成到 AgentInitializer.createInstance() 并增强 validateTemplate()"
    status: pending
  - id: p1-tests
    content: "P1: #37 完整单元测试覆盖"
    status: pending
  - id: p2-file-watcher
    content: "P2: 实现 TemplateFileWatcher 模块（基于 fs.watch 或 chokidar）"
    status: pending
  - id: p2-integration
    content: "P2: 集成到 AppContext/Daemon 生命周期（start 启动、stop 关闭）"
    status: pending
  - id: p2-tests
    content: "P2: #8 单元测试"
    status: pending
  - id: p3-log-writer
    content: "P3: 实现 ProcessLogWriter（stdout/stderr → 文件 + 轮转策略）"
    status: pending
  - id: p3-launcher-integration
    content: "P3: 修改 ProcessLauncher，非 ACP 后端也捕获 stdio"
    status: pending
  - id: p3-rpc
    content: "P3: 新增 agent.processLogs RPC 接口"
    status: pending
  - id: p3-tests
    content: "P3: #9 单元测试"
    status: pending
isProject: false
---

# Initializer 框架 + Template 热重载 + 进程日志收集

本计划合并处理三个相关的核心增强 Issue，按优先级排序实施。三者共同提升 Actant 的运行时能力：Agent 初始化更灵活、配置变更免重启、进程日志可追溯。

---

## 一、背景分析

### Issue #37 — Initializer 可扩展初始化框架 (P1, mid-term)

当前 `AgentInitializer.createInstance()` 只做基础工作：创建 workspace 目录 → WorkspaceBuilder 物化 Domain Context → 写 `.actant.json`。虽然 `AgentTemplate` 已定义 `InitializerConfig.steps` 字段且 Zod schema 已存在，但这些步骤**从未被执行**。

需要构建一个完整的 pipeline 引擎，支持声明式步骤编排、失败回滚、超时控制、自定义扩展。

### Issue #8 — Template 热重载 (P2, long-term)

Daemon 进程启动时加载 `configsDir/templates/` 下的模板文件，但之后**不再监控文件变化**。如果用户修改了模板 JSON，必须重启 Daemon 才能生效。需要添加文件监听，自动 reload TemplateRegistry。

### Issue #9 — Agent 进程 stdout/stderr 日志 (P3, long-term)

`ProcessLauncher` 对非 ACP 后端使用 `stdio: "ignore"`，所有输出丢弃。调试时无法看到 Agent 进程的 stdout/stderr。需要捕获输出到日志文件，并提供 RPC 查询接口。

---

## 二、方案设计

### 2.1 Initializer 框架 (#37)

**架构设计：**

```
packages/core/src/initializer/
├── agent-initializer.ts        # 现有：集成 pipeline 调用
├── pipeline/
│   ├── step-executor.ts        # StepExecutor 抽象基类
│   ├── step-registry.ts        # 步骤类型注册表
│   ├── initialization-pipeline.ts  # 执行引擎
│   └── types.ts                # StepContext, StepResult 等
└── steps/
    ├── git-clone-step.ts       # git clone
    ├── npm-install-step.ts     # npm/pnpm install
    ├── file-copy-step.ts       # 复制文件/目录
    ├── exec-step.ts            # 执行任意命令
    ├── mkdir-step.ts           # 创建目录结构
    └── index.ts                # 统一导出 + 默认注册
```

**关键设计决策：**

1. **StepExecutor 抽象类** — 每个步骤类型实现 `validate()` + `execute()` + 可选 `rollback()`
2. **StepRegistry** — 类似 WorkspaceBuilder 的 handler 注册模式，支持用户扩展
3. **InitializationPipeline** — 顺序执行、事务性回滚、每步可配超时、dry-run 支持
4. **StepContext** — 提供 `workspaceDir`、`instanceMeta`、`template`、`logger`、步骤间共享 `state`

**集成点：**

- `AgentInitializer.createInstance()` — 在 `builder.build()` 之后、`writeInstanceMeta()` 之前执行 pipeline
- `TemplateRegistry.validate()` — 增加步骤类型验证（检查 type 是否已注册）

### 2.2 Template 热重载 (#8)

**方案：使用 Node.js `fs.watch` 递归监听**

```
packages/core/src/template/watcher/
├── template-file-watcher.ts    # 核心 watcher 类
└── index.ts
```

- 使用 `fs.watch(dir, { recursive: true })` 监听 `templatesDir`
- debounce 防抖（300ms），避免编辑器保存时的多次触发
- 变更时调用 `TemplateRegistry` 的 reload 方法
- 新增文件 → register；删除文件 → unregister；修改文件 → re-register

**集成点：**

- `AppContext` — 新增 `templateWatcher` 属性，`init()` 中启动
- `Daemon.stop()` — 关闭 watcher

### 2.3 进程日志收集 (#9)

**方案：**

```
packages/core/src/manager/launcher/
├── process-launcher.ts         # 修改：所有后端使用 pipe stdio
├── process-log-writer.ts       # 新增：日志写入 + 轮转
└── agent-launcher.ts           # 扩展 AgentProcess 接口
```

- `ProcessLauncher` — 非 ACP 后端也使用 `["pipe", "pipe", "pipe"]`（detached 仍保持）
- `ProcessLogWriter` — 将 stdout/stderr 写入 `{instanceDir}/logs/stdout.log` 和 `stderr.log`
- 轮转策略：单文件最大 10MB，保留最近 3 个历史文件
- 非 ACP 后端不需要 stdin，设为 `"ignore"`

**RPC 接口：**

- `agent.processLogs` — 返回指定 agent 最近 N 行日志

---

## 三、实施计划

### Phase 1: Initializer 框架 (#37) — P1

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 1 | StepExecutor 抽象基类 + StepRegistry + 类型定义 | P0 | - | 中 |
| 2 | InitializationPipeline 执行引擎 | P0 | Task 1 | 中 |
| 3 | 5 个内置步骤实现 | P0 | Task 1 | 中 |
| 4 | 集成 AgentInitializer + validateTemplate | P0 | Task 2, 3 | 小 |
| 5 | 单元测试覆盖 | P1 | Task 1-4 | 中 |

### Phase 2: Template 热重载 (#8) — P2

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 6 | TemplateFileWatcher 模块实现 | P0 | - | 小 |
| 7 | AppContext/Daemon 生命周期集成 | P0 | Task 6 | 小 |
| 8 | 单元测试 | P1 | Task 6-7 | 小 |

### Phase 3: 进程日志收集 (#9) — P3

| # | Task | Priority | Dependencies | Estimated Effort |
|---|------|----------|--------------|-----------------|
| 9 | ProcessLogWriter 实现（写入 + 轮转） | P0 | - | 中 |
| 10 | ProcessLauncher 修改 + 集成 | P0 | Task 9 | 小 |
| 11 | agent.processLogs RPC 接口 | P1 | Task 9-10 | 小 |
| 12 | 单元测试 | P1 | Task 9-11 | 小 |

---

## 四、影响范围

### Files to Modify

- `packages/core/src/initializer/agent-initializer.ts`: 集成 InitializationPipeline 调用
- `packages/core/src/template/registry/template-registry.ts`: 添加 reload 单文件能力
- `packages/core/src/manager/launcher/process-launcher.ts`: 修改 stdio 策略，集成 LogWriter
- `packages/core/src/manager/launcher/agent-launcher.ts`: 扩展 AgentProcess 接口
- `packages/api/src/services/app-context.ts`: 添加 templateWatcher、pipeline 注入
- `packages/api/src/daemon/daemon.ts`: watcher 生命周期管理
- `packages/api/src/handlers/agent-handlers.ts`: 新增 agent.processLogs handler
- `packages/core/src/index.ts`: 导出新模块

### New Files

- `packages/core/src/initializer/pipeline/step-executor.ts`: 抽象基类
- `packages/core/src/initializer/pipeline/step-registry.ts`: 步骤注册表
- `packages/core/src/initializer/pipeline/initialization-pipeline.ts`: 执行引擎
- `packages/core/src/initializer/pipeline/types.ts`: 类型定义
- `packages/core/src/initializer/steps/*.ts`: 5 个内置步骤
- `packages/core/src/template/watcher/template-file-watcher.ts`: 文件监听
- `packages/core/src/manager/launcher/process-log-writer.ts`: 日志收集

### Risk Assessment

| 风险 | 严重性 | 缓解措施 |
|------|--------|---------|
| Initializer 步骤执行超时导致 createInstance 阻塞 | 高 | 每步设默认超时(60s)，pipeline 总超时(5min) |
| fs.watch 在某些平台不可靠（Windows junction） | 中 | 使用 debounce + 错误恢复；fallback 到轮询 |
| 非 ACP 后端 detached 进程的 pipe 可能挂起 | 中 | 使用 `["ignore", "pipe", "pipe"]` 仅捕获输出，stdin 不 pipe |
| 步骤回滚可能不完整 | 中 | 回滚按 best-effort 执行，失败时记录日志但不抛出 |
| 日志文件轮转的竞态条件 | 低 | 使用 rename + 重新打开策略，atomic 操作 |

---

## 五、验收标准

### #37 Initializer 框架
- [ ] `InitializerStepExecutor` 抽象基类可被正常继承和实例化
- [ ] `InitializationPipeline` 支持顺序执行、失败回滚、超时控制
- [ ] 5 个内置步骤（git-clone, npm-install, file-copy, exec, mkdir）可正常执行
- [ ] `StepRegistry` 支持注册/查询自定义步骤
- [ ] `AgentInitializer.createInstance()` 自动执行 template.initializer.steps
- [ ] `validateTemplate()` 检查步骤类型是否已注册
- [ ] 完整单元测试通过

### #8 Template 热重载
- [ ] 修改 templates/ 下 JSON 文件后，TemplateRegistry 自动更新
- [ ] 新增模板文件自动注册
- [ ] 删除模板文件自动注销
- [ ] Daemon stop 时 watcher 正确关闭
- [ ] 单元测试通过

### #9 进程日志收集
- [ ] Agent 进程 stdout/stderr 写入 `{instanceDir}/logs/`
- [ ] 日志文件支持轮转（10MB 上限）
- [ ] `agent.processLogs` RPC 可查询最近 N 行
- [ ] 单元测试通过

---

## 六、相关参考

- 现有实现：`packages/core/src/initializer/agent-initializer.ts`
- WorkspaceBuilder 模式（handler 注册）：`packages/core/src/builder/workspace-builder.ts`
- 模板类型定义：`packages/shared/src/types/template.types.ts`
- 模板 Schema：`packages/core/src/template/schema/template-schema.ts`
- ProcessLauncher：`packages/core/src/manager/launcher/process-launcher.ts`
- AppContext 初始化流程：`packages/api/src/services/app-context.ts`
- Daemon 生命周期：`packages/api/src/daemon/daemon.ts`
- 配置规范：`.trellis/spec/config-spec.md`
- API 契约：`.trellis/spec/api-contracts.md`
