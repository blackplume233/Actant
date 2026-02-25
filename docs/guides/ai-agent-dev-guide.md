# Actant 开发手册 — AI Agent 版

> 本文档面向需要**修改 Actant 源码**的 AI Agent，包含仓库结构、代码架构、开发规范、文件索引和常见任务指南。
> 如果你只是要**使用** Actant（创建和管理 Agent），请阅读 [使用手册](ai-agent-usage-guide.md)。

---

## 1. 仓库结构

```
Actant/
├── packages/                  # 源码 Monorepo（6 个包）
│   ├── shared/                # 公共类型、错误、日志、平台工具
│   ├── core/                  # 核心引擎（模板、构建、管理、调度、组件）
│   ├── api/                   # Daemon 服务层、RPC Handler、AppContext
│   ├── acp/                   # ACP 协议集成（连接、网关、回调路由）
│   ├── cli/                   # CLI 前端（61 子命令、REPL、流式输出）
│   └── mcp-server/            # MCP 协议服务端（Phase 4 骨架）
├── configs/                   # 内置配置（模板、技能、提示词、工作流、插件、MCP）
├── examples/                  # 示例（actant-hub 组件源仓库）
├── scripts/                   # 安装脚本 + 自更新脚本
├── docs/                      # 文档
│   ├── guides/                # 使用教程与操作指南
│   ├── design/                # 功能设计文档
│   ├── decisions/             # 架构决策记录（ADR）
│   ├── stage/                 # 版本快照存档（v0.1.0, v0.1.2）
│   ├── reports/               # 技术报告
│   ├── human/                 # 人类手写笔记（AI 禁止自动写入）
│   ├── agent/                 # Agent 生成的分析报告
│   └── site/                  # GitHub Pages 静态站点
├── .trellis/                  # Trellis AI 开发框架
│   ├── workflow.md            # 开发流程
│   ├── spec/                  # 规范文档（配置、API、生命周期、指南）
│   ├── issues/                # GitHub Issue 本地缓存（open 在根目录，closed 在 archive/）
│   ├── tasks/                 # 当前任务
│   ├── workspace/             # 开发者工作区和日志
│   └── scripts/               # 自动化脚本
├── .agents/                   # Agent 技能定义
│   └── skills/                # QA、Issue 管理、项目审查、Git Commit
├── .cursor/                   # Cursor IDE 规则和命令
├── .claude/                   # Claude 命令
├── package.json               # 根工作区配置 (v0.1.2)
├── pnpm-workspace.yaml        # pnpm workspace: packages/*
├── tsconfig.base.json         # 基础 TypeScript 配置
├── vitest.config.ts           # 测试配置
├── vitest.endurance.config.ts # 耐久测试配置
├── eslint.config.js           # ESLint 配置
├── AGENTS.md                  # Trellis AI 入口指引
└── README.md                  # 项目自述
```

---

## 2. 包架构与依赖

### 依赖关系图

```
shared ← core ← api ← cli
              ← acp
              ← mcp-server
```

### 各包职责

| 包 | 路径 | 职责 |
|----|------|------|
| **@actant/shared** | `packages/shared/` | 公共类型定义、错误体系、日志工具、平台适配（IPC/信号处理） |
| **@actant/core** | `packages/core/` | 核心引擎：模板管理、Agent 生命周期、工作区构建、组件管理、调度器、Source、版本管理 |
| **@actant/api** | `packages/api/` | Daemon 服务层：Socket Server、RPC Handler 注册表、AppContext 依赖注入 |
| **@actant/acp** | `packages/acp/` | ACP 协议集成：连接管理、网关、回调路由、ACP 通信器 |
| **@actant/cli** | `packages/cli/` | CLI 前端：14 组 61 命令、RPC Client、输出格式化、REPL |
| **@actant/mcp-server** | `packages/mcp-server/` | MCP 协议服务端（Phase 4 骨架，尚未完整实现） |

### 构建系统

- **工具**: tsup（每个包独立构建）
- **格式**: ESM，输出到 `dist/`，含 sourcemaps 和 `.d.ts`
- **入口**: 每个包 `src/index.ts`
- **TypeScript**: 各包 tsconfig 继承 `../../tsconfig.base.json`，启用 `composite`

---

## 3. 核心模块详解

### 3.1 @actant/shared

```
shared/src/
├── types/
│   ├── agent.types.ts           # AgentInstanceMeta, AgentStatus, LaunchMode, WorkspacePolicy
│   ├── template.types.ts        # AgentTemplate, AgentBackendConfig, ModelProviderConfig
│   ├── domain-component.types.ts # VersionedComponent, SkillDefinition, PromptDefinition, ...
│   ├── domain-context.types.ts  # DomainContextConfig, McpServerRef
│   ├── rpc.types.ts             # RpcMethodMap（全部方法签名）, RPC_ERROR_CODES
│   ├── source.types.ts          # SourceConfig, PackageManifest, PresetDefinition
│   └── validation.types.ts      # ValidationIssue, ConfigValidationResult
├── errors/
│   ├── base-error.ts            # ActantError, ErrorCategory
│   ├── config-errors.ts         # ConfigValidationError, TemplateNotFoundError, ...
│   └── lifecycle-errors.ts      # AgentNotFoundError, AgentLaunchError, ...
├── platform/
│   └── platform.ts              # getDefaultIpcPath(), onShutdownSignal() — 跨平台适配
└── logger/
    └── logger.ts                # createLogger() — Pino 封装
```

### 3.2 @actant/core

```
core/src/
├── template/
│   ├── registry/template-registry.ts    # TemplateRegistry — 内存注册表
│   ├── loader/template-loader.ts        # TemplateLoader — 文件加载 + toAgentTemplate()
│   └── schema/template-schema.ts        # AgentTemplateSchema — Zod 校验
├── manager/
│   ├── agent-manager.ts                 # AgentManager — create/start/stop/destroy/runPrompt/adopt/resolve
│   ├── launcher/
│   │   ├── agent-launcher.ts            # AgentLauncher, AgentProcess 接口
│   │   ├── process-launcher.ts          # ProcessLauncher — 进程启动
│   │   ├── process-watcher.ts           # ProcessWatcher — PID 监控
│   │   └── backend-resolver.ts          # resolveBackend() — 后端命令解析
│   ├── launch-mode-handler.ts           # LaunchModeHandler — 按模式处理退出/恢复
│   └── restart-tracker.ts               # RestartTracker — acp-service 指数退避重启
├── builder/
│   ├── workspace-builder.ts             # WorkspaceBuilder — 6 步构建流水线
│   ├── backend-builder.ts               # BackendBuilder 抽象基类, VerifyResult
│   ├── cursor-builder.ts               # CursorBuilder — .cursor/rules, AGENTS.md
│   ├── claude-code-builder.ts          # ClaudeCodeBuilder — Claude Code 布局
│   ├── custom-builder.ts               # CustomBuilder — 自定义后端
│   └── handlers/                        # ComponentTypeHandler 注册模式
│       ├── skills-handler.ts
│       ├── prompts-handler.ts
│       ├── mcp-handler.ts
│       ├── workflow-handler.ts
│       └── plugin-handler.ts
├── domain/
│   ├── base-component-manager.ts        # BaseComponentManager — CRUD 基类
│   ├── skill/skill-manager.ts           # SkillManager
│   ├── prompt/prompt-manager.ts         # PromptManager
│   ├── mcp/mcp-config-manager.ts        # McpConfigManager
│   ├── workflow/workflow-manager.ts      # WorkflowManager
│   └── plugin/plugin-manager.ts         # PluginManager
├── scheduler/
│   ├── employee-scheduler.ts            # EmployeeScheduler — 编排 InputRouter + TaskDispatcher
│   ├── task-queue.ts                    # TaskQueue — 优先级队列
│   ├── task-dispatcher.ts               # TaskDispatcher — 消费队列，调用 promptAgent
│   └── inputs/
│       ├── heartbeat-input.ts           # HeartbeatInput — setInterval 触发
│       ├── cron-input.ts                # CronInput — croner 定时触发
│       └── hook-input.ts               # HookInput — EventEmitter 触发
├── initializer/
│   ├── agent-initializer.ts             # AgentInitializer — 创建实例的入口
│   └── pipeline/
│       ├── initialization-pipeline.ts   # InitializationPipeline — 步骤编排 + 超时 + 回滚
│       └── step-registry.ts             # StepRegistry — mkdir/exec/file-copy/git-clone/npm-install
├── communicator/
│   ├── agent-communicator.ts            # AgentCommunicator 接口, PromptResult, StreamChunk
│   ├── cursor-communicator.ts           # CursorCommunicator
│   └── claude-code-communicator.ts      # ClaudeCodeCommunicator
├── source/
│   ├── source-manager.ts               # SourceManager — 组件源管理
│   ├── github-source.ts                # GitHubSource — GitHub API 拉取
│   └── local-source.ts                 # LocalSource — 本地路径加载
├── state/
│   ├── instance-registry.ts             # InstanceRegistry — 外部工作区注册表
│   └── instance-meta-io.ts              # readInstanceMeta/writeInstanceMeta/scanInstances
├── permissions/                         # 权限预设解析
├── session/
│   └── session-registry.ts              # SessionRegistry — ACP Session 租约追踪
└── version/                             # ComponentRef + SyncReport
```

### 3.3 @actant/api

```
api/src/
├── daemon/
│   └── socket-server.ts         # SocketServer — IPC 监听，JSON-RPC 解析
├── handlers/                    # RPC Handler 注册表
│   └── (template/agent/skill/prompt/... handlers)
└── app-context.ts               # AppContext — 依赖注入容器
```

### 3.4 @actant/acp

```
acp/src/
├── acp-connection.ts            # AcpConnection — 单个 ACP 连接
├── acp-connection-manager.ts    # AcpConnectionManager — 连接池
├── acp-communicator.ts          # AcpCommunicator — 通过 ACP 执行 prompt
├── acp-gateway.ts               # AcpGateway — IDE ↔ Agent 桥接
├── client-callback-router.ts    # ClientCallbackRouter — 终端回调路由
└── local-terminal-manager.ts    # LocalTerminalManager — 本地终端管理
```

### 3.5 @actant/cli

```
cli/src/
├── bin/actant.ts                # 入口（shebang）
├── program.ts                   # createProgram(), run() — Commander.js
├── daemon-entry.ts              # Daemon 进程入口
├── client/rpc-client.ts         # RpcClient — JSON-RPC IPC 客户端
├── commands/                    # 14 组命令定义
│   ├── template/                # list, show, validate, load, install
│   ├── agent/                   # create, start, stop, status, list, ...
│   ├── skill/                   # list, show, add, remove, export
│   ├── prompt/                  # ...
│   ├── mcp/                     # ...
│   ├── workflow/                # ...
│   ├── plugin/                  # ...
│   ├── source/                  # list, add, remove, sync
│   ├── preset/                  # list, show, apply
│   ├── schedule/                # list
│   ├── daemon/                  # start, stop, status
│   ├── proxy.ts                 # ACP 代理
│   ├── help.ts                  # 帮助
│   └── self-update.ts           # 自更新
├── output/
│   ├── formatter.ts             # Table/JSON/Quiet 格式
│   ├── printer.ts               # 输出打印
│   ├── stream-renderer.ts       # 流式输出渲染
│   └── error-presenter.ts       # 错误展示
└── repl/repl.ts                 # 交互式 REPL
```

---

## 4. 开发流程（Trellis Workflow）

本项目使用 **Trellis** 框架管理 AI 协作开发。

### 4.1 核心原则

1. **先读后写** — 修改前先阅读相关规范和现有代码
2. **遵循规范** — `.trellis/spec/` 中的规范优先于实现代码
3. **增量开发** — 小步前进，频繁提交
4. **及时记录** — 每次 session 结束时记录工作日志

### 4.2 Session 流程

**启动**:
1. 运行 `/trellis:start` 初始化开发者身份和上下文
2. 阅读 `.trellis/spec/` 中相关规范
3. 通过 `.trellis/scripts/task.sh` 选择或创建任务

**开发中**:
1. 选择/创建任务
2. 按规范编码
3. 自测（lint + test）
4. 提交（Conventional Commits）

**结束**:
- 运行 `/trellis:finish-work` 执行提交前检查
- 运行 `.trellis/scripts/add-session.sh` 记录 session

### 4.3 可用命令

| Cursor 命令 | 功能 |
|------------|------|
| `trellis-start` | 初始化 session，获取上下文 |
| `trellis-finish-work` | 提交前检查清单 |
| `trellis-ship` | Phase 1 审查（增量测试） |
| `trellis-stage-version` | 生成版本快照存档 |
| `trellis-break-loop` | 调试后分析（打破循环） |
| `trellis-check-cross-layer` | 跨层一致性检查 |
| `trellis-issue` | Issue 管理 |
| `qa` | QA 测试 |

### 4.4 可用技能

| 技能 | 触发词 | 功能 |
|------|-------|------|
| **QA Engineer** | `/qa` | 黑盒 CLI 测试，场景执行，自动创建 Issue |
| **Issue Manager** | `/issue` | GitHub-first Issue 管理 |
| **Project Reviewer** | `/review` | 只读审查项目进度/质量/路线图 |
| **Git Commit** | `/commit` | 分析 diff，生成 Conventional Commit |

### 4.5 Cursor 规则

| 规则 | 作用域 | 要求 |
|------|-------|------|
| `ship-testing.mdc` | 全局 | `/trellis-ship` 时使用 `pnpm test:changed` |
| `qa-loop.mdc` | `/qa-loop` | QA 循环验证直到 100% pass |

---

## 5. 代码规范

### 5.1 语言与模块

| 规范项 | 要求 |
|-------|------|
| 语言 | TypeScript strict 模式, ESM only |
| 导入 | 包间使用 `@actant/*`，包内相对导入加 `.js` 后缀 |
| 构建 | tsup，入口 `src/index.ts`，输出 `dist/` |

### 5.2 命名规范

| 类型 | 风格 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `agent-manager.ts` |
| 类名 | PascalCase | `AgentManager` |
| 函数/变量 | camelCase | `createAgent()` |
| 常量 | UPPER_SNAKE | `RPC_ERROR_CODES` |
| 类型/接口 | PascalCase | `AgentInstanceMeta` |

### 5.3 错误处理

- 使用 `ActantError` 体系，不抛裸 `Error`
- 错误分类：`ErrorCategory`（config / lifecycle / runtime / ...）
- 自定义错误继承 `ActantError`，放在 `packages/shared/src/errors/`

### 5.4 日志

- 使用 `createLogger(name)` (基于 pino)，不用 `console.log`
- CLI 层 `LOG_LEVEL=silent`（通过 formatter 输出）

### 5.5 校验

- 所有外部输入（模板、组件、RPC 参数）使用 Zod Schema 校验
- 校验结果统一为 `ConfigValidationResult`，含结构化的 errors 和 warnings

### 5.6 提交规范

Conventional Commits 格式：

```
type(scope): description
```

| type | 适用场景 |
|------|---------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档变更 |
| `refactor` | 重构（不改变行为） |
| `test` | 测试 |
| `chore` | 构建、工具、杂项 |

scope 通常为包名：`core`, `cli`, `api`, `shared`, `acp`。

### 5.7 Issue 管理

GitHub 为唯一真实来源，本地 `.trellis/issues/` 为 Obsidian 兼容缓存。  
**已关闭 Issue 自动归档到 `issues/archive/`**，仅保留 open Issue 在根目录以减少上下文污染。

```bash
.trellis/scripts/issue.sh list              # 列出活跃 Issue（仅 open）
.trellis/scripts/issue.sh pull <number>     # 拉取 GitHub Issue
.trellis/scripts/issue.sh create "标题"     # 创建新 Issue
.trellis/scripts/issue.sh close <id>        # 关闭并自动归档
.trellis/scripts/issue.sh reopen <id>       # 重开并自动恢复
.trellis/scripts/issue.sh archive --all     # 批量归档所有已关闭 Issue
.trellis/scripts/issue.sh sync --all        # 推送所有未同步变更
.trellis/scripts/issue.sh check-dirty       # 检查本地是否有未同步变更
```

---

## 6. 测试

### 6.1 测试命令

| 命令 | 用途 | 场景 |
|------|------|------|
| `pnpm test:changed` | 仅运行受变更影响的测试 | **日常开发首选** |
| `pnpm test` | 运行全部测试（579+ tests） | 发版前/CI |
| `pnpm test:endurance` | 耐久测试（15 min 超时） | 生命周期/进程管理变更 |
| `pnpm test:watch` | 监听模式 | 持续开发 |

### 6.2 测试文件约定

- 单元测试：与源码同目录，命名 `*.test.ts`
- 耐久测试：命名 `*.endurance.test.ts`（单独配置，不在日常测试中运行）
- E2E 测试：`packages/cli/src/__tests__/e2e-cli.test.ts`
- 命令测试：`packages/cli/src/commands/__tests__/commands.test.ts`

### 6.3 测试框架

- Vitest（全局 API）
- 路径别名与源码一致：`@actant/core` → `packages/core/src`
- `passWithNoTests: true`

### 6.4 构建与检查

```bash
pnpm install            # 安装依赖
pnpm build              # 构建所有包
pnpm test:changed       # 运行受影响的测试
pnpm test               # 运行全部测试
pnpm lint               # ESLint 检查
pnpm type-check         # TypeScript 类型检查（6 packages）
pnpm clean              # 清理构建产物
```

---

## 7. 关键文件定位索引

### 7.1 类型定义

| 关注点 | 文件路径 |
|-------|---------|
| Agent 实例类型 | `packages/shared/src/types/agent.types.ts` |
| 模板类型 | `packages/shared/src/types/template.types.ts` |
| 领域组件类型 | `packages/shared/src/types/domain-component.types.ts` |
| 领域上下文类型 | `packages/shared/src/types/domain-context.types.ts` |
| RPC 方法签名（全部 74 个） | `packages/shared/src/types/rpc.types.ts` |
| Source 类型 | `packages/shared/src/types/source.types.ts` |
| 校验类型 | `packages/shared/src/types/validation.types.ts` |
| 错误体系 | `packages/shared/src/errors/` |

### 7.2 核心逻辑

| 关注点 | 入口文件 | 关键类 |
|-------|---------|-------|
| Agent 生命周期 | `packages/core/src/manager/agent-manager.ts` | `AgentManager` |
| 进程启动 | `packages/core/src/manager/launcher/process-launcher.ts` | `ProcessLauncher` |
| 进程监控 | `packages/core/src/manager/launcher/process-watcher.ts` | `ProcessWatcher` |
| 启动模式 | `packages/core/src/manager/launch-mode-handler.ts` | `LaunchModeHandler` |
| 重启策略 | `packages/core/src/manager/restart-tracker.ts` | `RestartTracker` |
| 模板注册 | `packages/core/src/template/registry/template-registry.ts` | `TemplateRegistry` |
| 模板加载 | `packages/core/src/template/loader/template-loader.ts` | `TemplateLoader` |
| 模板校验 | `packages/core/src/template/schema/template-schema.ts` | `AgentTemplateSchema` |
| 工作区构建 | `packages/core/src/builder/workspace-builder.ts` | `WorkspaceBuilder` |
| Cursor 后端 | `packages/core/src/builder/cursor-builder.ts` | `CursorBuilder` |
| Claude Code 后端 | `packages/core/src/builder/claude-code-builder.ts` | `ClaudeCodeBuilder` |
| 组件管理基类 | `packages/core/src/domain/base-component-manager.ts` | `BaseComponentManager` |
| 调度器 | `packages/core/src/scheduler/employee-scheduler.ts` | `EmployeeScheduler` |
| 任务队列 | `packages/core/src/scheduler/task-queue.ts` | `TaskQueue` |
| 初始化器 | `packages/core/src/initializer/agent-initializer.ts` | `AgentInitializer` |
| 初始化流水线 | `packages/core/src/initializer/pipeline/initialization-pipeline.ts` | `InitializationPipeline` |
| 通信器接口 | `packages/core/src/communicator/agent-communicator.ts` | `AgentCommunicator` |
| 组件源管理 | `packages/core/src/source/source-manager.ts` | `SourceManager` |
| 实例注册表 | `packages/core/src/state/instance-registry.ts` | `InstanceRegistry` |
| 实例元数据 I/O | `packages/core/src/state/instance-meta-io.ts` | `readInstanceMeta()` |

### 7.3 API / Daemon

| 关注点 | 入口文件 |
|-------|---------|
| Socket Server | `packages/api/src/daemon/socket-server.ts` |
| RPC Handler 注册 | `packages/api/src/handlers/` |
| 依赖注入 | `packages/api/src/app-context.ts` |

### 7.4 ACP

| 关注点 | 入口文件 |
|-------|---------|
| ACP 连接 | `packages/acp/src/acp-connection.ts` |
| 连接管理 | `packages/acp/src/acp-connection-manager.ts` |
| ACP 网关 | `packages/acp/src/acp-gateway.ts` |
| 回调路由 | `packages/acp/src/client-callback-router.ts` |

### 7.5 CLI

| 关注点 | 入口文件 |
|-------|---------|
| 程序入口 | `packages/cli/src/program.ts` |
| RPC 客户端 | `packages/cli/src/client/rpc-client.ts` |
| 命令定义 | `packages/cli/src/commands/` |
| 输出格式化 | `packages/cli/src/output/` |

### 7.6 内置配置

| 类型 | 路径 |
|------|------|
| 模板 | `configs/templates/` |
| 技能 | `configs/skills/` |
| 提示词 | `configs/prompts/` |
| 工作流 | `configs/workflows/` |
| 插件 | `configs/plugins/` |
| MCP 服务 | `configs/mcp/` |

---

## 8. 规范文档导航

**规范优先级高于代码**。若代码与规范冲突，以规范为准。

| 你想了解... | 阅读文档 |
|------------|---------|
| 配置体系（Template/Schema/环境变量） | `.trellis/spec/config-spec.md` |
| API 接口契约（RPC/CLI/ACP/MCP） | `.trellis/spec/api-contracts.md` |
| Agent 生命周期和状态机 | `.trellis/spec/agent-lifecycle.md` |
| 耐久测试矩阵和不变量 | `.trellis/spec/endurance-testing.md` |
| 后端代码指南 | `.trellis/spec/backend/index.md` |
| 错误处理规范 | `.trellis/spec/backend/error-handling.md` |
| 日志规范 | `.trellis/spec/backend/logging-guidelines.md` |
| 目录结构规范 | `.trellis/spec/backend/directory-structure.md` |
| 质量规范 | `.trellis/spec/backend/quality-guidelines.md` |
| 前端代码指南 | `.trellis/spec/frontend/index.md` |
| 跨层思考检查清单 | `.trellis/spec/guides/cross-layer-thinking-guide.md` |
| 跨平台兼容指南 | `.trellis/spec/guides/cross-platform-guide.md` |
| 代码复用指南 | `.trellis/spec/guides/code-reuse-thinking-guide.md` |
| 产品路线图 | `docs/planning/roadmap.md` |
| 文档目录规范（各目录职责和写入权限） | `docs/README.md` |
| 目录结构 ADR | `docs/decisions/002-directory-structure.md` |
| 完整架构文档 | `docs/stage/v0.1.2/architecture.md` |
| API 表面快照（74 RPC + 61 CLI） | `docs/stage/v0.1.2/api-surface.md` |
| 配置 Schema 快照 | `docs/stage/v0.1.2/config-schemas.md` |
| DomainContext 扩展指南 | `docs/design/domain-context-extension-guide.md` |

---

## 9. 常见开发任务

### 9.1 新增一个 CLI 命令

涉及的层：`shared` → `core` → `api` → `cli`

1. **定义 RPC 类型** — 在 `packages/shared/src/types/rpc.types.ts` 的 `RpcMethodMap` 中添加方法签名（Params + Result）
2. **实现业务逻辑** — 在 `packages/core/` 相应模块中添加方法
3. **实现 RPC Handler** — 在 `packages/api/src/handlers/` 中创建 handler，注册到 `HandlerRegistry`
4. **创建 CLI 命令** — 在 `packages/cli/src/commands/<group>/` 下创建命令文件，调用 `RpcClient.call()`
5. **编写测试** — 在对应模块旁创建 `*.test.ts`
6. **更新规范** — 修改 `.trellis/spec/api-contracts.md`

### 9.2 新增一个领域组件类型

参考 `docs/design/domain-context-extension-guide.md`：

1. 在 `packages/shared/src/types/domain-component.types.ts` 中定义组件类型（继承 `VersionedComponent`）
2. 在 `packages/shared/src/types/domain-context.types.ts` 中添加引用字段
3. 在 `packages/core/src/domain/` 中创建组件管理器（继承 `BaseComponentManager`）
4. 在 `packages/core/src/builder/handlers/` 中创建 `ComponentTypeHandler`
5. 注册到 `WorkspaceBuilder`
6. 添加 Zod Schema 校验
7. 添加 RPC handler 和 CLI 命令（参考 9.1）

### 9.3 修改 Agent 生命周期

1. **先读规范** — `.trellis/spec/agent-lifecycle.md`（优先级最高）
2. 修改 `packages/core/src/manager/agent-manager.ts`
3. 检查是否影响 `launch-mode-handler.ts`、`restart-tracker.ts`
4. 检查是否影响 `process-watcher.ts`
5. **更新耐久测试** — 参考 `.trellis/spec/endurance-testing.md`
6. 运行 `pnpm test:endurance` 验证

### 9.4 修改模板 Schema

1. **先读规范** — `.trellis/spec/config-spec.md`
2. 修改 Zod Schema: `packages/core/src/template/schema/template-schema.ts`
3. 同步 TypeScript 类型: `packages/shared/src/types/template.types.ts`
4. 确保 `configs/templates/*.json` 仍然通过校验
5. 更新规范文档

### 9.5 修改 RPC 接口

1. **先读规范** — `.trellis/spec/api-contracts.md`
2. 修改 `packages/shared/src/types/rpc.types.ts` 中的 `RpcMethodMap`
3. 修改对应的 API handler（`packages/api/src/handlers/`）
4. 修改对应的 CLI 命令（`packages/cli/src/commands/`）
5. 使用跨层检查清单确认一致性

### 9.6 添加后端构建器

1. 在 `packages/core/src/builder/` 中创建新的 Builder（继承 `BackendBuilder`）
2. 实现 `scaffold()`、`materialize()`、`inject()`、`verify()` 方法
3. 在 `AgentBackendType` 枚举中添加新类型
4. 在 `WorkspaceBuilder` 中注册
5. 添加对应的 `Communicator`（`packages/core/src/communicator/`）

---

## 10. 注意事项

### 必须遵守

- **规范优先**: `.trellis/spec/` 中的规范高于代码实现。若冲突以规范为准。
- **禁止写入 `docs/human/`**: 这是人类专属区域，AI 不得自动写入。
- **禁止修改 `docs/stage/`**: 版本快照只读，由 stage-version 命令生成。
- **文档放对目录**: 教程→`guides/`、规划→`planning/`、设计→`design/`、报告→`reports/`。详见 `docs/README.md`。
- **GitHub-first Issue**: Issue 以 GitHub 为唯一真实来源，本地仅为缓存。已关闭 Issue 自动归档到 `archive/`。
- **跨平台兼容**: 代码必须同时支持 Unix 和 Windows（IPC 路径、信号处理、进程管理）。
- **使用 ActantError**: 不要抛出裸 `Error`，使用项目的错误体系。
- **使用 createLogger**: 不要使用 `console.log`，使用 pino 日志。
- **Zod 校验**: 所有外部输入必须经过 Zod Schema 校验。

### 推荐做法

- 修改前先搜索现有代码，理解上下文和约定
- 改动涉及多层时使用 `.trellis/spec/guides/cross-layer-thinking-guide.md` 检查清单
- 提交前运行 `pnpm test:changed` 确保无回归
- 大型变更拆分为多个小步提交
- 新增模块参考现有模块的结构和模式

### 文档维护规则

| 目录 | 作者 | 可靠性 |
|------|------|--------|
| `docs/human/` | 仅人类 | 权威 |
| `docs/agent/` | AI 生成 | 需人类验证 |
| `docs/decisions/` | 协作 | Status: Accepted 后权威 |
| `docs/design/` | 协作 | 活文档 |
| `docs/stage/` | 脚本 + AI | 版本快照，只读 |

---

## 11. 快速参考卡片

```
┌──────────────────── Actant 开发速查 ────────────────────┐
│                                                          │
│  构建: pnpm build                                        │
│  测试: pnpm test:changed  (日常) / pnpm test (全量)       │
│  检查: pnpm lint && pnpm type-check                      │
│  清理: pnpm clean                                        │
│                                                          │
│  规范: .trellis/spec/ (配置/API/生命周期/指南)              │
│  路线: docs/planning/roadmap.md                           │
│  Issue: .trellis/scripts/issue.sh                        │
│  任务: .trellis/scripts/task.sh                          │
│                                                          │
│  包结构: shared → core → api → cli                       │
│          core → acp / mcp-server                         │
│                                                          │
│  类型: packages/shared/src/types/                        │
│  引擎: packages/core/src/                                │
│  API:  packages/api/src/handlers/                        │
│  CLI:  packages/cli/src/commands/                        │
│                                                          │
│  提交: type(scope): description                          │
│  Session: /trellis:start → 编码 → /trellis:finish-work   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 延伸阅读

| 文档 | 说明 |
|------|------|
| [使用手册](ai-agent-usage-guide.md) | Actant 平台使用指南（CLI、配置、Agent 管理） |
| [架构文档](../stage/v0.1.2/architecture.md) | v0.1.2 完整系统架构 |
| [API 接口](../stage/v0.1.2/api-surface.md) | 74 个 RPC 方法 + 全部 CLI 命令 |
| [配置 Schema](../stage/v0.1.2/config-schemas.md) | Zod Schema + TypeScript 接口详情 |
| [DomainContext 扩展指南](../design/domain-context-extension-guide.md) | 添加自定义组件类型 |
| [ADR-001: 技术栈](../decisions/001-tech-stack.md) | TypeScript + pnpm monorepo 选型 |
| [ADR-002: 目录结构](../decisions/002-directory-structure.md) | 项目目录规范 |
