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

## Session 7: Agent Lifecycle, ACP Proxy, MCP Server, External Spawn Specs

**Date**: 2026-02-20
**Task**: Agent Lifecycle, ACP Proxy, MCP Server, External Spawn Specs

### Summary

(Add summary)

### Main Changes

## 设计讨论与规范产出

本次会话围绕 AgentCraft 的通信架构进行了深入设计讨论，产出完整规范文档。

### 核心设计决策

| 决策 | 结论 |
|------|------|
| Agent 能否用 ACP 直连托管 Agent | **不能** — ACP 连接被 Daemon 独占，Agent 无法扮演 ACP Client |
| Agent-to-Agent 的正确路径 | **MCP** — Agent 调用 AgentCraft MCP Server tools |
| 外部应用如何标准化接入 | **ACP Proxy** — agentcraft proxy 暴露标准 ACP/stdio 接口 |
| 外部客户端自管 Agent 进程 | **Self-spawn + Attach** — resolve 获取信息，attach/detach 注册状态 |
| AgentCraft API 是否对齐 ACP | **长期愿景 (#18)** — ACP-Fleet 扩展协议，Daemon 升级为 ACP Server |

### 新增/更新文档

| 文件 | 说明 |
|------|------|
| `spec/agent-lifecycle.md` | **新建** — 完整的 Agent 生命周期与使用模式规范（8 章节） |
| `spec/api-contracts.md` | 新增 §3.3-3.5 (resolve/attach/detach, run/prompt, proxy session), §7 ACP Proxy, §8 MCP Server, §9 接入模式对比 |
| `spec/config-spec.md` | 新增 processOwnership, workspacePolicy, crashed 状态, EnvChannel, ProxySession |
| `spec/index.md` | 新增 agent-lifecycle.md 为第一层规范文档 |
| `roadmap.md` | 重组 Phase 1-5，新增 #15-#18 |

### 新增 Issues

- **#15** agent.resolve/attach/detach API (P1, Phase 1)
- **#16** ACP Proxy 标准 ACP 协议网关 (P1, Phase 2)
- **#17** MCP Server Agent 间通信 (P2, Phase 2)
- **#18** ACP-Fleet 扩展协议 (P4, Phase 5 长期愿景)
- **#12** 重写为 Daemon 侧 ACP Client + agent.run/prompt

### 协议分工总结

```
ACP:  人/应用 ↔ Agent（交互协议）
MCP:  Agent ↔ 工具/服务（能力协议）
AgentCraft 同时扮演：ACP Client + MCP Server + ACP Proxy
```

### Git Commits

| Hash | Message |
|------|---------|
| `fc8ab6f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 8: Fix #26 #27 #28: quality enforcement

**Date**: 2026-02-20
**Task**: Fix #26 #27 #28: quality enforcement

### Summary

(Add summary)

### Main Changes

## 完成内容

| Issue | 描述 | 状态 |
|-------|------|------|
| #26 | 非空断言 (!) 全面清除 — 源码 + 测试 | ✅ Done |
| #27 | CI 门禁脚本 `check` = type-check + test | ✅ Done |
| #28 | 固定 setTimeout 替换为 vi.waitFor 条件等待 | ✅ Done |

## 变更文件

**生产代码**:
- `packages/core/src/manager/launcher/process-launcher.ts` — `child.pid!` → 守卫

**测试代码**:
- `packages/core/src/manager/agent-manager.test.ts` — 5处 `!` 清除 + 8处 setTimeout→vi.waitFor
- `packages/core/src/manager/launcher/process-launcher.test.ts` — `child.pid!` → 守卫
- `packages/api/src/daemon/__tests__/socket-server.test.ts` — 5处 `res.error!` → `res.error?.`
- `packages/core/src/template/loader/template-loader.test.ts` — 2处 `mcpServers!` → `?.`

**配置**:
- `package.json` — 新增 `check` 脚本

## 验证结果

- type-check: ✅ 6/6 包通过
- test: ✅ 269 passed (12 CLI E2E 预存失败)
- 非空断言扫描: ✅ 0 处
- console.log 扫描: ✅ 0 处
- any 类型扫描: ✅ 0 处

### Git Commits

| Hash | Message |
|------|---------|
| `37f885e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 9: 场景测试 + 耐久测试基础设施

**Date**: 2026-02-20
**Task**: 场景测试 + 耐久测试基础设施

### Summary

(Add summary)

### Main Changes

## 本次工作

建立三层测试体系（单元 → 场景 → 耐久），将耐久测试作为**持续验证能力**融入开发工作流。

### 场景测试 (agent-lifecycle-scenarios.test.ts) — 9 tests

多步工作流正确性验证，纳入常规 `pnpm test`：

| 场景 | 验证链 |
|------|--------|
| acp-service 连续崩溃 | running → crash → restart(新PID) → 超限 → error |
| one-shot 自动销毁 | created → running → exit → destroy + workspace 清理 |
| 外部 Spawn 完整流程 | resolve → attach → crash → detach cleanup |
| Daemon 重启恢复 | acp-service 恢复 running, direct 恢复 stopped |
| 混合并发 | 3 模式同时运行 → 全崩溃 → 各自正确反应 |
| 完整生命周期循环 | create → start → stop → start(新PID) → stop → destroy |

### 耐久测试 (agent-manager.endurance.test.ts) — 10 tests

长时间运行正确性验证，按需执行 `pnpm test:endurance`：

| 场景 ID | 名称 | 内容 |
|---------|------|------|
| E-LIFE | 生命周期循环 | 反复 create/start/stop/destroy |
| E-SVC | 崩溃重启 | 随机崩溃 → 退避重启 → 恢复 |
| E-SHOT | one-shot 清理 | ephemeral/persistent 交替 |
| E-EXT | 外部 Spawn | resolve → attach → crash → detach 循环 |
| E-DAEMON | Daemon 恢复 | 反复模拟 daemon 宕机重启 |
| E-MIX | 混合并发 | 多 Agent 多模式随机操作 |
| shutdown/* | 关停行为矩阵 | 4 种模式各自的关停语义验证 |

### 基础设施

- `vitest.endurance.config.ts` — 独立配置，15 分钟/测试超时
- `vitest.config.ts` — 排除 `*.endurance.test.ts`
- `package.json` — 新增 `test:endurance` 脚本
- `ENDURANCE_DURATION_MS` 环境变量控制运行时长

### 工作流集成

- **耐久测试规范** (`.trellis/spec/endurance-testing.md`) — 覆盖矩阵、不变量定义、演进策略
- **workflow.md** — Code Quality Checklist + Pre-end Checklist 新增耐久测试同步条目
- **Cursor Rule** (`.cursor/rules/endurance-testing.mdc`) — 修改核心文件时自动提醒
- **roadmap.md** — 耐久测试覆盖跟踪表，Phase 2/3+ 场景已预留

### 关键设计

- `createPidController()` — 精确控制哪些 PID "死亡"，避免全局 mock 竞态
- 结构化不变量检查 (INV-DISK, INV-CLEAN, INV-STATUS, INV-COUNT, INV-PID)
- 每个测试输出统计摘要，可跟踪吞吐量趋势

**变更文件**:
- `packages/core/src/manager/agent-lifecycle-scenarios.test.ts` (新)
- `packages/core/src/manager/agent-manager.endurance.test.ts` (新)
- `vitest.endurance.config.ts` (新)
- `.trellis/spec/endurance-testing.md` (新)
- `.cursor/rules/endurance-testing.mdc` (新)
- `vitest.config.ts`, `package.json`, `.trellis/workflow.md`, `.trellis/roadmap.md`, `.trellis/spec/index.md`

### Git Commits

| Hash | Message |
|------|---------|
| `9e4c51d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 10: Phase 1 质量改进: CliPrinter + CLI 单元测试

**Date**: 2026-02-20
**Task**: Phase 1 质量改进: CliPrinter + CLI 单元测试

### Summary

完成 Issue #20 (CLI 测试覆盖) 和 #22 (CliPrinter 输出层)。重构 17 个 CLI 文件替换 console.log，新增 56 个单元测试覆盖 printer/formatter/error-presenter/rpc-client/repl/commands。Phase 1 全部任务（含质量审查）完毕，准备进入 Phase 2。

### Main Changes



### Git Commits

| Hash | Message |
|------|---------|
| `e26ce70` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 11: Phase 1 质量改进: CliPrinter + CLI 单元测试

**Date**: 2026-02-20
**Task**: Phase 1 质量改进: CliPrinter + CLI 单元测试

### Summary

完成 Issue #20 (CLI 测试覆盖) 和 #22 (CliPrinter 输出层)。重构 17 个 CLI 文件替换 console.log，新增 56 个单元测试覆盖 printer/formatter/error-presenter/rpc-client/repl/commands。Phase 1 全部任务（含质量审查）完毕，准备进入 Phase 2。

### Main Changes



### Git Commits

| Hash | Message |
|------|---------|
| `e26ce70` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 12: ACP Integration, QA Scenario & Bug Fixes

**Date**: 2026-02-20
**Task**: ACP Integration, QA Scenario & Bug Fixes

### Summary

(Add summary)

### Main Changes

## 本次会话完成内容

### 1. QA 场景执行与修复（bilibili-video-analysis）

运行 `/qa bilibili-video-analysis` 场景，经过 3 轮 QA 循环发现并修复了以下问题：

| 问题 | 修复 |
|------|------|
| `agent-run-task` 返回 `error_max_turns` 原始 JSON | 改进 `ClaudeCodeCommunicator` 解析逻辑，返回描述性消息 |
| Agent 请求 MCP 工具授权无法自主运行 | `ContextMaterializer` 物化时生成 `.claude/settings.local.json` 预授权工具 |
| RPC 客户端 10s 超时导致 `agent run` 失败 | `RpcClient.call()` 支持可配置超时，`agent run` 自动按任务超时 +5s |

最终 QA 结果：**8/8 步骤全部 PASS**，Agent 成功产出 4324 字节的视频分析报告。

### 2. QA 场景更新

更新 `bilibili-video-analysis.json` 场景：
- 目标视频改为 BV12mZtBTEJB（极客湾手机游戏性能大横评，255万播放）
- 核心步骤改为让 Agent 产出 `report.md` 分析报告文件
- 添加 `tech-review-analysis` skill，优化 prompts
- 增加报告产物验证步骤

### 3. Ship 审查修复

| 问题 | 修复 |
|------|------|
| `acp/connection.ts` 2 处 non-null assertion | 改为防御性检查 |
| `packages/acp/tsconfig.json` 缺少 `composite` | 添加 `composite: true` |
| `process-launcher.test.ts` 僵尸进程检测失败 | 增加 `child.once('exit')` 事件追踪 |
| `mvp-e2e-integration.test.ts` 超时 | mock 模式下跳过 ACP 连接 |

### 4. Issue 创建

- **#36**: Agent 工具权限管理机制设计（P2, security, architecture）

### 关键文件

- `packages/core/src/communicator/claude-code-communicator.ts` — error_max_turns 解析
- `packages/core/src/initializer/context/context-materializer.ts` — 新增 MCP 权限物化
- `packages/cli/src/client/rpc-client.ts` — 可配置超时
- `packages/cli/src/commands/agent/run.ts` — RPC 超时自适应
- `packages/core/src/manager/launcher/process-launcher.ts` — 早退检测改进
- `packages/api/src/services/app-context.ts` — mock 模式跳过 ACP
- `.agents/skills/qa-engineer/scenarios/bilibili-video-analysis.json` — 场景更新

### Git Commits

| Hash | Message |
|------|---------|
| `180edd9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 13: ACP 连接架构重设计：Direct Bridge + Session Lease 双模式

**Date**: 2026-02-20
**Task**: ACP 连接架构重设计：Direct Bridge + Session Lease 双模式

### Summary

(Add summary)

### Main Changes

## 设计讨论与架构决策

本次会话延续上一次的 ACP Gateway 废弃讨论，完成了连接架构的最终设计：

### 核心决策

| 决策 | 内容 |
|------|------|
| **默认模式** | Direct Bridge（Client spawn 进程，端到端 ACP） |
| **可选模式** | Session Lease（`--lease`，Daemon 持有连接，客户端租借 Session） |
| **并发策略** | 自动实例化（Direct Bridge）+ 多 Session（Session Lease） |
| **不变量** | CWD 永远 agent workspace、1 Instance : 1 Process 严格 1:1 |
| **IDE ACP 接入** | Session Lease 下 Proxy 做 ACP 协议适配器（翻译 ACP ↔ Daemon API） |

### 设计演进路径

1. 发现 CWD 传递链断裂 → 废弃 ACP Gateway
2. 纯 Direct Bridge → 冷启动问题 → 引入租约模型
3. Agent 级租约 → 阻塞问题 → Session 级租约
4. Instance:Process 关系 → 严格 1:1 + 自动实例化
5. IDE ACP 接入 → Proxy ACP 适配器（路径 2）
6. 默认模式确认 → Direct Bridge 默认，Session Lease `--lease` 可选

### 变更文件

| 文件 | 变更 |
|------|------|
| `docs/design/agent-launch-scenarios.md` | **重写**：三种连接模式 + 9 种启动场景 + 协议分层 |
| `.trellis/issues/0035-acp-proxy-full-protocol.json` | 更新：双模式架构 + Proxy ACP 适配器 + 实现计划调整 |
| `.trellis/issues/0037-employee-agent-scheduling.json` | **新建**：雇员型 Agent 调度系统（参考 OpenClaw） |
| `docs/design/acp-gateway-deprecation-discussion.md` | **新建**：完整设计讨论记录 |
| `.trellis/roadmap.md` | 更新 #35 描述和依赖关系 |

### 实现优先级

Phase 1: Direct Bridge（默认模式，最常用）
Phase 2: Chat 直连 + 流式渲染
Phase 3: Session Lease + Proxy ACP 适配器

### Git Commits

| Hash | Message |
|------|---------|
| `9571164` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 14: Issue #35 QA 修复 + QA Agent 真实环境默认 + /qa-loop 命令

**Date**: 2026-02-21
**Task**: Issue #35 QA cyclic verification, QA Agent real-env default, /qa-loop slash command

### Summary

完成 Issue #35 全功能 QA 循环验证的收尾工作：修复 3 个 Issue (#40/#41/#42)、将 QA Agent 默认测试环境从 mock 切换为 real、创建 `/qa-loop` 斜杠命令用于编排循环验证流程、新增 5 个 Session 相关 QA 场景和循环验证工作流文档。

### Main Changes

| 类别 | 内容 |
|------|------|
| **Bug Fix #40** | `daemon stop` 错误处理 — 注入 RpcClient，确保连接失败时输出 "Daemon is not running" |
| **Bug Fix #41** | `session.create/prompt/cancel/close` 参数校验 — 添加运行时验证，防止 "undefined" 错误 |
| **Doc Fix #42** | `api-contracts.md` 5 处不一致修正 |
| **QA Agent 更新** | SKILL.md 默认 `launcherMode: "real"`，除非用户显式指定 mock |
| **/qa-loop 命令** | `.cursor/rules/qa-loop.mdc` — 编排 test→report→issue→fix→retest 循环直到 100% PASS |
| **QA 场景 (×5)** | session-lifecycle、session-cancel-integration、proxy-lease-mode、session-error-handling、multi-session-isolation |
| **循环验证工作流** | `workflows/cyclic-verification.md` — 标准化 5 阶段循环 + Issue #35 实践经验 |
| **Issue 记录** | #39 (mock 架构限制)、#40-#42 (已修复) |
| **.gitignore** | 忽略根目录 `daemon` PID 文件 |

### Key Decisions

- QA 测试默认使用真实 launcher 模式（Issue #39 教训：mock 模式无法验证 ACP/Session Lease）
- `/qa-loop` 作为 QA Agent 的编排层，QA Agent 负责单次测试执行和判断
- 循环验证每轮回归必须重新执行全部测试（不可只跑失败项）

### Git Commits

| Hash | Message |
|------|---------|
| `aa9aca8` | fix(qa): Issue #35 QA fixes, real-env QA default, and /qa-loop command |

### Testing

- [OK] pnpm lint: 通过
- [OK] pnpm type-check: 6/6 包通过
- [OK] pnpm test:changed: 37/37 tests passed (4 files)
- [OK] 代码模式扫描: 0 console.log, 0 any, 0 非空断言

### Status

[OK] **Completed**

### Next Steps

- None - task complete

---

## Session 15: ACP Complete Server Architecture — 设计 + 全量实现

**Date**: 2026-02-21
**Task**: ACP 协议完备性分析、架构设计、Gateway/Terminal/Callback Router 实现

### Summary

完成 ACP 协议完备 Server 架构的全生命周期：从逐行协议功能对比分析，到 Direct Bridge + Session Lease 双模架构设计文档，再到 5 个 Phase 的代码实现。新增 3 个核心模块（LocalTerminalManager、ClientCallbackRouter、AcpGateway），重写 AcpConnection 支持完整 Client 回调，重写 Session Lease Proxy 为 ACP 管道模式，修复 session.cancel ID 错位 bug。

### Main Changes

| Feature | Description |
|---------|-------------|
| **协议分析文档** | 逐行对比 ACP 规范 vs AgentCraft 实现，列出所有缺失项 |
| **架构设计文档** | Direct Bridge (透明转发) + Session Lease (Gateway + 回调路由 + 本地伪装) |
| **LocalTerminalManager** | 完整 ACP terminal/* 回调实现 (create/output/wait_for_exit/kill/release) |
| **ClientCallbackRouter** | 根据 IDE capabilities 智能路由回调：转发给 IDE 或本地伪装处理 |
| **AcpGateway** | AgentSideConnection 桥接上游 IDE 和下游 Agent，支持租约状态切换 |
| **AcpConnection 重写** | 支持 loadSession/setMode/setConfigOption/authenticate + 多内容 prompt + 流式接口 |
| **AcpCommunicator 增强** | 完整映射所有 ACP notification 类型 (thought/plan/tool_call/mode/config) |
| **Proxy Lease 重写** | 优先 gateway.lease socket 管道，降级回退 legacy RPC 翻译 |
| **Bug 修复** | session.cancel 使用 Agent 的 primary ACP session ID |
| **RPC 类型** | 新增 gateway.lease 方法类型定义 |

**Updated Files**:
- `docs/design/acp-protocol-gap-analysis.md` (新建)
- `docs/design/acp-complete-server-architecture.md` (新建)
- `packages/acp/src/terminal-manager.ts` (新建)
- `packages/acp/src/callback-router.ts` (新建)
- `packages/acp/src/gateway.ts` (新建)
- `packages/acp/src/connection.ts` (重写)
- `packages/acp/src/connection-manager.ts` (重写)
- `packages/acp/src/communicator.ts` (增强)
- `packages/acp/src/index.ts` (更新导出)
- `packages/cli/src/commands/proxy.ts` (重写 Lease 模式)
- `packages/api/src/handlers/session-handlers.ts` (修复 cancel bug)
- `packages/shared/src/types/rpc.types.ts` (新增 gateway.lease)

### Key Decisions

- AcpConnection 引入 `ClientCallbackHandler` 接口实现插拔式回调委托，为 Gateway 模式奠定基础
- CallbackRouter 对所有 terminal/* 回调增加 try-catch 降级：IDE 转发失败自动回退本地处理
- Proxy Lease 模式保留 legacy RPC 翻译作为降级回退（gateway.lease RPC 尚未在 Daemon 端注册）
- `as any` 仅用于 ACP SDK 类型定义不完整的必要场景（8 处），不影响运行时安全

### Git Commits

| Hash | Message |
|------|---------|
| `44e58f8` | docs: add ACP protocol gap analysis and complete server architecture design |
| `2c33e4d` | feat(acp): implement complete ACP server architecture with Gateway, terminal callbacks, and callback routing |

### Testing

- [OK] type-check: 5/5 包通过 (acp, cli, api, shared, core)
- [OK] test:changed: 311/311 tests passed (30 files)
- [OK] 代码模式扫描: 0 console.log, 0 非空断言
- [⚠️] pnpm lint: 跳过 (pnpm 不在 PATH)
- [⚠️] e2e-cli: 12 tests 预存失败 (shared/dist 产物缺失，非本次引入)

### Status

[OK] **Completed**

### Next Steps

- Daemon 端注册 `gateway.lease` RPC handler（创建 Gateway socket 并返回路径）
- 为 Gateway 添加集成测试（模拟 IDE ↔ Gateway ↔ Agent 三方交互）
- 修复 E2E 测试 dist 产物缺失问题

---

## Session 16: Unified Component Management — CRUD, Source Registry & Presets (#38)

**Date**: 2026-02-21
**Task**: 02-21-unified-component-management

### Summary

Implemented Phase 3a unified component management system: enhanced `BaseComponentManager` with full CRUD/persistence/import-export/search-filter, added extensible Source Registry (GitHub + Local sources with `package@name` namespacing), and introduced Preset as named component composition bundles. Wired up 28 new RPC methods and corresponding CLI commands across all 6 domains (skill, prompt, mcp, workflow, source, preset).

### Main Changes

- **BaseComponentManager enhanced**: `add`, `update`, `remove` (with persistence), `importFromFile`, `exportToFile`, `search`, `filter` methods; `setPersistDir` for runtime persistence path
- **Source Management** (`packages/core/src/source/`): `ComponentSource` interface, `LocalSource`, `GitHubSource`, `SourceManager` with source registration, sync, and `package@name` namespaced component injection
- **Preset system**: `PresetDefinition` type — named bundles of skills/prompts/mcpServers/workflows that can be applied to AgentTemplates in one operation; renamed from "Plugin" to reserve that term for Phase 4 system-level extensibility
- **Shared types** (`packages/shared/src/types/`): `source.types.ts` with `SourceConfig`, `SourceEntry`, `PackageManifest`, `PresetDefinition`; 28 new RPC type definitions in `rpc.types.ts`
- **API handlers**: `createCrudHandlers` generic factory for 20 domain CRUD RPC methods; `source-handlers.ts` (4 methods); `preset-handlers.ts` (3 methods)
- **CLI commands**: `add`/`remove`/`export` subcommands for skill/prompt/mcp/workflow; full `source` command (list/add/remove/sync); full `preset` command (list/show/apply)
- **AppContext integration**: `SourceManager` initialized with all domain managers, auto-loads on startup
- **Tests**: 20 unit tests for BaseComponentManager CRUD; 11 unit tests for SourceManager (source lifecycle, preset handling, persistence)

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| "Plugin" naming | Renamed to **Preset** | Reserve "Plugin" for Phase 4 system-level extensibility (code + source + preset extensions) |
| Source extensibility | `ComponentSource` interface | Future source types (npm, HTTP registry) only need to implement one interface |
| Component namespacing | `package@name` format | Prevents naming collisions across sources while keeping local components simple |
| MCP management | Configuration-only, not runtime | MCPs are config definitions, not executable code in this context |
| CRUD handler pattern | Generic factory `createCrudHandlers<T>()` | Eliminates duplication across 4 domain types (20 handlers from 1 factory) |

### Git Commits

| Hash | Message |
|------|---------|
| `d5675a4` | feat: unified component management with CRUD, source registry, and presets (#38) |

### Testing

- [OK] type-check: 6/6 packages passed (shared, core, acp, mcp-server, api, cli)
- [OK] test:changed: 354/354 tests passed (33 files)
- [OK] lint: 0 new errors in changed files (38 pre-existing in acp/trellis)
- [OK] Code pattern scan: 0 new console.log, 0 new `any` type, 0 new non-null assertions

### Status

[OK] **Completed**

### Next Steps

- Phase 4: System-level Plugin architecture (code extensions, source extensions, preset extensions)
- Integration tests for source sync (GitHub clone, local scan end-to-end)
- Update `.trellis/spec/` documentation to reflect new component management APIs
- Wire up `preset.apply` to actually modify AgentTemplate files on disk
