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
