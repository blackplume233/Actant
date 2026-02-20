# Journal - cursor-agent (Part 1)

> AI development session journal
> Started: 2026-02-19

---


## Session 1: Phase 0-2: Build Infra, Shared Types, Template Schema

**Date**: 2026-02-19
**Task**: Phase 0-2: Build Infra, Shared Types, Template Schema

### Summary

(Add summary)

### Main Changes

## 完成内容

| 阶段 | 交付物 | 说明 |
|------|--------|------|
| Phase 0 | 构建基础设施 | vitest, tsup, zod v4, pino v10; 所有 6 包配置完成 |
| Phase 1 | 共享类型与错误体系 | AgentCraftError 层级 (10 错误类), 核心类型 (Agent/Template/DomainContext), Logger |
| Phase 2 | Agent Template Schema | Zod v4 完整 schema, 21 个验证测试 + 6 个类型对齐测试 |

## 里程碑

达成 **M1: Template 可定义可验证** — 用 Zod schema 验证 JSON 模板，40 个测试全部通过。

## 关键决策

- Node.js 升级至 v22 (项目要求 >=22)
- zod v4 的 `z.record()` 需显式双参数 `z.record(keySchema, valueSchema)`
- tsconfig 增加 `composite: true` 以支持 project references

## 新增文件

- `packages/shared/src/errors/` — base-error, config-errors, lifecycle-errors
- `packages/shared/src/types/` — agent.types, template.types, domain-context.types
- `packages/shared/src/logger/` — pino-based logger factory
- `packages/core/src/template/schema/` — template-schema (Zod), tests
- `*/tsup.config.ts`, `*/vitest.config.ts` — 构建与测试配置

## 测试统计

4 个测试文件，40 个测试用例，全部通过。

### Git Commits

| Hash | Message |
|------|---------|
| `d81a644` | (see git log) |
| `43c17b9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 2: Core Agent Phase 3-8 + Import Refactor

**Date**: 2026-02-20
**Task**: Core Agent Phase 3-8 + Import Refactor

### Summary

(Add summary)

### Main Changes

## 完成内容

| 模块 | 说明 |
|------|------|
| Domain Managers | Skill/Prompt/MCP/Workflow 四大领域组件管理器，含 BaseComponentManager 抽象 |
| Initializer | Agent 实例初始化器 + ContextMaterializer 上下文物化 |
| State | 实例元数据持久化（atomic write）、scanInstances、状态纠偏 |
| Manager | AgentManager 生命周期管理 + Launcher 策略模式（MockLauncher） |
| Template | TemplateLoader 文件加载 + TemplateRegistry 注册表 |
| API Daemon | Daemon + SocketServer（JSON-RPC 2.0 / Unix Socket / NDJSON） |
| RPC Handlers | template.* / agent.* / daemon.* 全套 handler |
| CLI | commander.js 命令集 + RpcClient 薄客户端 + REPL 交互模式 |
| E2E Tests | 19 个测试文件，197 个用例全部通过（含 12 个 CLI E2E） |
| Import Refactor | 移除 85 个文件的 .js 扩展名，删除 12 个单文件转发 barrel |

## 架构决策

- **Daemon + Thin Client**: CLI 不直接依赖 @agentcraft/core，通过 @agentcraft/api daemon 中转
- **JSON-RPC 2.0 over Unix Socket**: 进程间通信协议，NDJSON 分帧
- **Docker 类比**: Template=Dockerfile, Instance=Container, Daemon=dockerd, CLI=docker
- **Import 规范**: 无 .js 扩展名 + 仅保留有意义的聚合 barrel

## 关键文件

- `packages/core/src/domain/` — 四大领域管理器
- `packages/core/src/initializer/` — 实例初始化 + 上下文物化
- `packages/core/src/manager/` — 生命周期管理
- `packages/core/src/state/` — 元数据持久化
- `packages/api/src/daemon/` — Daemon + SocketServer
- `packages/api/src/handlers/` — RPC handler 注册
- `packages/cli/src/commands/` — CLI 命令集
- `packages/cli/src/client/rpc-client.ts` — RPC 客户端
- `packages/cli/src/__tests__/e2e-cli.test.ts` — E2E 测试

### Git Commits

| Hash | Message |
|------|---------|
| `c8ac88b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 3: Cross-platform compatibility (Linux/macOS/Windows)

**Date**: 2026-02-20
**Task**: Cross-platform compatibility (Linux/macOS/Windows)

### Summary

(Add summary)

### Main Changes

## Changes

| Area | Description |
|------|-------------|
| shared/platform | New platform utilities module: IPC path, signal handling, platform detection |
| api/daemon | Socket cleanup guarded by `ipcRequiresFileCleanup()` |
| api/app-context | Hardcoded `.sock` → `getIpcPath()` for Windows named pipe support |
| cli/program | Hardcoded `.sock` → `getDefaultIpcPath()` |
| cli/daemon-entry | SIGINT/SIGTERM → cross-platform `onShutdownSignal()` |
| cli/daemon/start | SIGINT/SIGTERM → cross-platform `onShutdownSignal()` |
| api/tests | Socket test uses `getIpcPath()` instead of hardcoded `.sock` |
| spec/guides | New cross-platform-guide.md added |

## Key Decisions

- Windows IPC uses named pipes (`\\.\pipe\agentcraft`) instead of Unix sockets
- `onShutdownSignal()` listens SIGINT+SIGTERM on Unix, SIGINT+SIGBREAK on Windows
- Shell scripts (.trellis/scripts/) remain bash-only; Windows users use Git Bash or WSL

### Git Commits

| Hash | Message |
|------|---------|
| `3a307ec` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 4: Issue 管理系统 + Memory Layer 设计 + GitHub MCP 同步

**Date**: 2026-02-20
**Task**: Issue 管理系统 + Memory Layer 设计 + GitHub MCP 同步

### Summary

(Add summary)

### Main Changes

## 本次会话完成内容

| 模块 | 内容 |
|------|------|
| Issue 管理系统 | 全新 GitHub-style 本地 issue tracker（`issue.sh`），支持 labels、milestone、markdown body、comments、promote → Task |
| Memory Layer 设计 | 完成 Agent 进化机制设计文档（`memory-layer-agent-evolution.md`），含 4 层演进模型、ContextBroker、分阶段实现计划 |
| GitHub MCP 同步 | issue.sh 新增 `export` / `import-github` / `link` / `unlink` 命令，通过 MCP 工具实现本地 ↔ GitHub 双向同步 |
| 架构文档 | 更新 Docker 类比文档，新增 Memory Layer / Union FS / docker commit 映射 |
| 工作流更新 | workflow.md 新增 Issue 章节、GitHub Sync 章节、命令速查 |
| Task 归档 | `02-20-cross-platform-compat` 已归档至 `archive/2026-02/` |

**关键设计决策**:
- Issue 采用二元状态（open/closed）+ labels 分类，而非刚性 type/priority 枚举
- GitHub 同步架构：AI Agent 作为 MCP 编排层，`issue.sh` 只负责数据准备/接收
- `githubRef` 字段追踪远程关联，import 含重复检测
- 无 MCP 时系统完全正常运作，sync 功能仅在主动调用时参与

**新增 6 个 Issues**: #1-#6 覆盖 Memory Layer 三阶段 + Launcher + Hot-reload + OpenViking 集成

### Git Commits

| Hash | Message |
|------|---------|
| `227f84e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 5: Implement Real Agent Launcher (ProcessLauncher + backend-aware init)

**Date**: 2026-02-20
**Task**: Implement Real Agent Launcher (ProcessLauncher + backend-aware init)

### Summary

(Add summary)

### Main Changes

## 完成内容

| 模块 | 说明 |
|------|------|
| ProcessLauncher | 实现真实进程启动器，支持 spawn + SIGTERM/SIGKILL 优雅关闭 |
| BackendResolver | 根据 backendType 解析可执行命令与参数（Cursor / Claude Code / Custom） |
| ProcessUtils | 进程存活检测 (isProcessAlive)、信号发送、延时工具 |
| CreateLauncher | 工厂函数，根据配置或环境变量切换 Mock/Real 模式 |
| AgentInstanceMeta | 新增 backendType + backendConfig 字段，创建实例时从模板写入 |
| ContextMaterializer | 根据 backendType 路由配置目录（.cursor/ vs .claude/） |
| AppContext | 集成 createLauncher 工厂，支持 launcherMode 配置 |
| 测试 | 全部 223 测试通过，新增 ProcessLauncher / BackendResolver / ProcessUtils / CreateLauncher 单元测试 |

**新增文件**:
- `packages/core/src/manager/launcher/backend-resolver.ts`
- `packages/core/src/manager/launcher/process-launcher.ts`
- `packages/core/src/manager/launcher/process-utils.ts`
- `packages/core/src/manager/launcher/create-launcher.ts`
- 对应 4 个测试文件

**修改文件**:
- `packages/shared/src/types/agent.types.ts` — AgentInstanceMeta 增加 backendType/backendConfig
- `packages/shared/src/types/template.types.ts` — AgentBackendConfig.config JSDoc
- `packages/core/src/state/instance-meta-schema.ts` — Zod schema 扩展
- `packages/core/src/state/instance-meta-io.ts` — 旧文件向后兼容默认值
- `packages/core/src/initializer/agent-initializer.ts` — 创建实例时写入 backendType
- `packages/core/src/initializer/context/context-materializer.ts` — 后端感知目录路由
- `packages/core/src/manager/index.ts` — 导出新模块
- `packages/api/src/services/app-context.ts` — 使用 createLauncher 工厂
- `vitest.config.ts` — 添加 @agentcraft/* 路径别名避免构建依赖
- 多个测试文件更新以适配新字段

### Git Commits

| Hash | Message |
|------|---------|
| `e7a0ea2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 6: Spec-first config & API contract documentation (Issue #7)

**Date**: 2026-02-20
**Task**: Spec-first config & API contract documentation (Issue #7)

### Summary

(Add summary)

### Main Changes

## 完成内容

| 产出 | 说明 |
|------|------|
| `spec/index.md` | 建立"规范 > 实现"的文档层次，明确协议和配置结构是项目主要产出 |
| `spec/config-spec.md` | 配置规范：AgentTemplate、AgentInstanceMeta、DomainContext 组件、AppConfig、平台 IPC、环境变量、后端解析规则 |
| `spec/api-contracts.md` | 接口契约：JSON-RPC 2.0 协议、错误码、13 个 RPC 方法、CLI 命令映射、内部契约（Launcher/Registry/Client） |
| `backend/index.md` 更新 | 将规范文档提升为独立引用，与实现指南分层展示 |
| `workflow.md` 更新 | 在 3 处关键位置加入"配置/接口变更必须同步规范文档"的约定 |
| Issue #7 关闭 | "审查与文档化：配置结构与对外接口 + Workflow 约定"标记为 completed |

**核心理念变更**：
- 之前：文档记录代码做了什么（code → docs）
- 之后：规范定义系统应该是什么，代码必须符合规范（spec → code）

**新文件**:
- `.trellis/spec/index.md`
- `.trellis/spec/config-spec.md`
- `.trellis/spec/api-contracts.md`

### Git Commits

| Hash | Message |
|------|---------|
| `08d0f00` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
