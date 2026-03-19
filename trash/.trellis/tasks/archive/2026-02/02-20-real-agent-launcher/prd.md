# Real Agent Launcher — PRD

> 关联 Issue: #4 Real Agent Launcher implementation  
> 任务目录: `.trellis/tasks/02-20-real-agent-launcher/`

---

## 1. 背景与目标

### 1.1 现状

- `AgentLauncher` 接口已定义：`launch(workspaceDir, meta) → AgentProcess`、`terminate(process)`。
- 当前仅实现 `MockLauncher`（返回假 PID，不启动真实进程），用于测试与占位。
- `AgentManager` 通过策略注入 Launcher，start/stop 流程已打通；`AppContext` 中固定使用 `new MockLauncher()`。

### 1.2 目标

实现可真实启动/关停 Cursor、Claude Code 的 Launcher，使 `agent start <name>` 能打开对应 IDE Agent 并绑定到实例工作目录，并支持心跳检测与优雅关停。

### 1.3 非目标（本阶段不做）

- 不实现 ACP/one-shot 等其它 launch mode 的进程形态（仅聚焦 `direct` 模式）。
- 不实现自定义 backend（`custom`）的启动逻辑。
- 不负责安装/检测 Cursor 或 Claude Code 是否已安装（可约定由环境/文档保证）。

---

## 2. 功能需求

### 2.1 进程启动

- 根据实例的 **backend 类型**（来自 template：`cursor` | `claude-code`）决定启动哪个可执行程序。
- 启动时传入 **工作目录**（即 `workspaceDir`），使 IDE 在该目录下打开项目/会话。
- 返回真实的 **PID** 与 `AgentProcess`，供 Manager 写入 `.actant.json` 与内存缓存。

### 2.2 心跳与存活

- 能判断已启动进程是否仍然存活（例如通过 PID + 轮询或 OS 信号）。
- 若进程已退出而 Manager 仍认为 running，需在后续「状态修正」或「健康检查」中可被识别（可与现有 `initialize()` 中 stale 状态修正配合）。

### 2.3 优雅关停

- `terminate(process)` 应优先尝试优雅退出（如向进程发 SIGTERM），在超时后再 SIGKILL（可选）。
- 关停后确保不再持有该进程引用，避免重复 terminate。

### 2.4 多 backend 支持

- 支持至少两种 backend：**Cursor**、**Claude Code**。
- 可执行路径在 **template 或物化结果中配置**（见下节）。

---

## 3. 接口与集成约束（已落实）

- **不修改** `AgentLauncher` 接口签名，保持与现有 `MockLauncher` 及 `AgentManager` 的兼容。
- **AgentInstanceMeta 已包含 backend 信息**（已实现）：
  - `backendType`：创建实例时从 `template.backend.type` 写入，Launcher 可直接从 meta 读取。
  - `backendConfig`：从 `template.backend.config` 拷贝到 meta（如 `executablePath`），物化或 template 中配置的可执行路径会随实例持久化，Launcher 无需再查 TemplateRegistry。
- **按 backend 的差异化初始化**（已实现）：`ContextMaterializer.materialize(workspaceDir, domainContext, backendType)` 根据 backend 选择目录，例如 hook/MCP 写入 `.cursor/`（cursor）或 `.claude/`（claude-code）。

---

## 4. 验收标准

- [ ] **Cursor**：配置正确时，`agent start <name>`（对应 template 的 backend 为 cursor）能启动 Cursor 并打开目标工作目录；`agent stop <name>` 能关停该进程。
- [ ] **Claude Code**：同上，backend 为 claude-code 时能启动并关停 Claude Code 进程。
- [ ] **PID 与状态**：启动后 `meta.pid` 为真实 PID；stop 后 pid 清除、status 为 stopped。
- [ ] **Manager 行为不变**：现有 `AgentManager` 的 start/stop/initialize（含 stale 修正）逻辑无需改接口即可接入 Real Launcher；单元测试中 MockLauncher 仍可用，集成/手动测试使用 Real Launcher。
- [ ] **跨平台**：在 macOS/Windows/Linux 上可配置或可检测对应可执行路径（至少支持当前 CI 或主要开发环境）。

---

## 5. 实现清单（Implementation Checklist）

### 5.1 方案与依赖（已完成）

- [x] **backend 类型与配置**：meta 已含 `backendType`、`backendConfig`，创建实例时从 template 写入；Launcher 直接从 meta 读取即可。
- [x] **可执行路径**：在 template 的 `backend.config` 中配置（如 `executablePath`），物化时随实例写入 meta；也可在物化产物中提供配置文件供 Launcher 读取（按需）。

### 5.2 核心实现

- [ ] 新增 `RealLauncher`（或按 backend 拆成 `CursorLauncher` + `ClaudeCodeLauncher`，由工厂或配置选择）实现 `AgentLauncher`。
- [ ] 实现 `launch(workspaceDir, meta)`：从 `meta.backendType` 与 `meta.backendConfig`（如 `executablePath`）获知 backend 与可执行路径 → spawn 子进程，工作目录为 `workspaceDir`，返回真实 PID 与 `AgentProcess`。
- [ ] 实现 `terminate(process)`：发送 SIGTERM（或平台等价），可选超时后 SIGKILL；确保只对当前 process 生效。

### 5.3 心跳与健壮性

- [ ] 在 start 后能检测进程是否仍存活（例如 `process.kill(0)` 或等价 API）。
- [ ] 与现有 daemon `initialize()` 配合：重启后若之前 running 的进程已不存在，状态被修正为 stopped（已有逻辑，确认与真实 PID 行为一致）。

### 5.4 集成与配置

- [ ] `AppContext` 或上层根据配置选择 `MockLauncher` 或 Real Launcher（例如 NODE_ENV、或显式配置项），便于开发/测试继续用 Mock。
- [ ] 文档或注释说明：如何配置 Cursor/Claude Code 路径、环境变量及最低版本要求（若有）。

### 5.5 测试与质量

- [ ] 保留并通过现有 `AgentManager` + `MockLauncher` 单元测试。
- [ ] 为 Real Launcher 增加单元测试（可 mock 子进程 spawn），或集成测试（需本机安装对应 IDE）。
- [ ] Lint/typecheck 通过；符合 `.trellis/spec/backend/` 规范。

---

## 6. 参考

- 接口定义：`packages/core/src/manager/launcher/agent-launcher.ts`
- Mock 实现：`packages/core/src/manager/launcher/mock-launcher.ts`
- 使用方：`packages/core/src/manager/agent-manager.ts`（startAgent/stopAgent）
- 注入点：`packages/api/src/services/app-context.ts`（`new MockLauncher()`）
- 类型：`packages/shared/src/types/agent.types.ts`、`template.types.ts`（AgentBackendType）
- 设计：`docs/design/architecture-docker-analogy.md`、`docs/design/core-agent-progress-report.md`

---

## 7. 后续 Todo

1. **#7** 审查与文档化：配置结构与对外接口 + Workflow 约定（配置/接口变更须同步更新文档，纳入 workflow）
