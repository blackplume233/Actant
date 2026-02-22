# Changelog — v0.1.0

> **日期**: 2026-02-22
> **变更范围**: 初始版本

---

## ✨ 新功能 (Features)

- feat: complete Phase 3 -- workspace builder, plugin management, and employee scheduler (4d7373c)
- feat: unified component management with CRUD, source registry, and presets (#38) (d5675a4)
- feat(acp): implement complete ACP server architecture with Gateway, terminal callbacks, and callback routing (2c33e4d)
- feat(acp): complete Issue #35 - session.cancel integration and docs (2dcf440)
- feat: add initial configuration files and update session tracking (bdaafe7)
- feat: implement ACP Proxy dual-mode (Direct Bridge + Session Lease) (300bad6)
- feat: integrate ACP protocol for claude-code backend and add workDir support (180edd9)
- feat(qa): add QA engineer SubAgent for CLI integration testing (15009fd)
- feat: implement Phase 2 MVP — agent assembly, communication, and CLI interaction (3fddebe)
- feat(core): complete Phase 1 — WorkspacePolicy, external spawn API handlers, and CLI commands (832552e)
- feat(core): implement Phase 1 core runtime — ProcessWatcher, LaunchMode differentiation, restart policy, and external spawn API (2a85f82)
- feat(core): implement real agent launcher with backend-aware initialization (e7a0ea2)
- feat(trellis): add GitHub-style issue tracker with MCP sync support (227f84e)
- feat: add cross-platform compatibility for Linux/macOS/Windows (3a307ec)
- feat: implement core agent runtime, CLI daemon architecture, and import cleanup (c8ac88b)
- feat(core): implement Phase 0-2 — build infra, shared types, and template schema (43c17b9)
- feat: scaffold monorepo structure with spec docs and ADRs (9f64e85)

## 🐛 修复 (Fixes)

- fix: show plugins in template detail and create default AGENTS.md on scaffold (762645f)
- fix: resolve all ACP lint errors and update spec docs for Phase 3 (6fa2d71)
- fix(qa): Issue #35 QA fixes, real-env QA default, and /qa-loop command (aa9aca8)
- fix: use platform-agnostic eslint target for Windows compatibility (cfe9a1a)
- fix: Windows compatibility for symlinks and IPC socket tests (ac5614f)
- fix(quality): resolve bug/enhancement issues, sync Zod schema, and align GitHub issues (8db1184)
- fix(quality): eliminate non-null assertions, add CI check script, and remove flaky setTimeout delays (37f885e)

## ♻️ 重构 (Refactoring)

- refactor(cli): introduce CliPrinter output layer and add unit tests (e26ce70)

## 📝 文档 (Documentation)

- docs: Phase 3 planning - sub-issues, TODO tracker, and roadmap update (78b185e)
- docs: add QA round 3 verification report for ACP architecture (cb55aef)
- docs: require incremental log writing during QA execution (a9b299a)
- docs: enrich QA reports with full execution logs per step (33d2b8e)
- docs: QA verify acp-complete-server-architecture design vs code (d1ee0f6)
- docs(journal): record session 15 - ACP complete server architecture design and implementation (ccf105d)
- docs: add ACP protocol gap analysis and complete server architecture design (44e58f8)
- docs: design MVP next - component management, workspace builder, employee scheduler (1ff7cc0)
- docs(journal): record session 14 - Issue #35 QA fixes and /qa-loop command (ff46b87)
- docs: redesign landing page with Claude Code-inspired polished aesthetic (e0fb0c5)
- docs: redesign ACP connection architecture — Direct Bridge + Session Lease (9571164)
- docs: add landing page and GitHub Pages deployment workflow (6df7f17)
- docs: design ACP Gateway architecture and agent launch scenarios (0b167c6)
- docs: sync api-contracts.md with Phase 2 MVP implementation (303467b)
- docs: define agent lifecycle, ACP Proxy, MCP Server, and external spawn specs (fc8ab6f)
- docs: add spec-first config and API contract documentation (08d0f00)
- docs: add Core Agent config system roadmap and unify config format (48803a4)
- docs: rewrite README with Chinese docs, feature status, and quickstart (e0a2781)
- docs: add README, language conventions, and move human_start to docs/human (4e4eea2)

## 🧪 测试 (Tests)

- test(core): add scenario tests and endurance testing infrastructure (9e4c51d)

## 🔧 杂项 (Chores)

- chore: add issue #34 (ACTANT_HOME) and QA test scenario (c31bef3)
- chore: add incremental test script for faster ship reviews (a595d8c)
- chore: add ESLint with typescript-eslint flat config and fix all lint errors (c476695)
- chore: fix trellis script permissions (d81a644)
- chore: add trellis-ship command for review-commit-push workflow (6d23406)
- chore: initialize project with Trellis development framework (b7f91d9)

---

## 📋 Issue 变更

### 已完成的功能 (18)

- #4 Real Agent Launcher implementation
- #8 ProcessWatcher：进程退出检测与心跳监控
- #9 LaunchMode 行为分化
- #10 one-shot 模式完整实现
- #11 acp-service 崩溃重启策略
- #15 agent.resolve / agent.attach / agent.detach API — 外部 Spawn 支持
- #35 ACP Proxy + Agent Chat — Direct Bridge 与 Session Lease 双模式
- #38 统一组件管理体系 — Skill / Prompt / Plugin 完整 CRUD
- #39 Workspace 构造器 — 面向不同 Agent 后端的差异化构建
- #40 雇员型 Agent 实现 — 内置调度器 + N8N 集成
- #43 BaseComponentManager CRUD 增强 + 持久化
- #44 PluginManager + PluginDefinition Schema + 示例配置
- #45 组件管理 RPC Handlers + CLI 命令扩展
- #46 BackendBuilder 接口 + CursorBuilder + ClaudeCodeBuilder 实现
- #47 WorkspaceBuilder Pipeline + AgentInitializer 迁移
- #48 TaskQueue + TaskDispatcher + ExecutionLog 基础实现
- #49 InputRouter + InputSources (Heartbeat / Cron / Hook)
- #50 EmployeeScheduler + AgentManager 集成 + CLI 命令

### 已修复的缺陷 (2)

- #21 issue.sh .counter 自增脱节导致 ID 冲突
- #34 Daemon 未读取 ACTANT_HOME 环境变量

### 已完成的增强 (6)

- #19 Roadmap 与 Issue 元数据不一致
- #20 CLI 包测试覆盖率为零 — 需补充单元测试
- #22 CLI 包 console.log 违反质量规范 — 需引入结构化输出层
- #25 测试用例实现深度审查 — 类型安全、断言与配对缺口
- #28 测试中固定 setTimeout 延迟导致潜在 flaky
- #42 api-contracts.md 文档与实现不一致

### 待处理 (Open Issues — 23)

- #1 Instance Memory Layer (Phase 1) [long-term]
- #2 Memory Consolidation + Shared Memory (Phase 2) [long-term]
- #3 Context Layers + ContextBroker (Phase 3) [long-term]
- #5 Template hot-reload on file change [long-term]
- #12 ACP 协议集成 — Daemon 侧 ACP Client [mid-term]
- #13 Plugin 体系设计（heartbeat/scheduler/memory 可插拔）[mid-term]
- #14 Agent 进程 stdout/stderr 日志收集 [long-term]
- #16 ACP Proxy — 标准 ACP 协议网关 [mid-term]
- #17 MCP Server — Agent 间通信能力 [mid-term]
- #18 ACP-Fleet 扩展协议 [long-term]
- #32 Initializer: 可扩展的 Agent 初始化流程框架 [mid-term]
- #33 Template: 耐久测试专用 Agent 配置 [near-term]
- #36 Agent 工具权限管理机制设计
- #37 雇员型 Agent — 持续调度与主动行为系统 [mid-term]
- #38 项目重命名：AgentCraft → Actant [mid-term]
- #39 Session Lease API 在 mock launcher 模式下无法端到端测试
- #40 daemon stop 连接失败时未输出消息
- #41 session.create 缺少参数验证
- #43 ACP Gateway: Terminal 回调 IDE 转发未实现 [mid-term]
- #44 E2E CLI 测试: ESM 模块解析失败 [short-term]
- #51 AgentTemplate 权限控制 [phase-3]
- #52 AgentTemplate 应当可通过 Source 分享 [phase-3]
- #53 可共享内容缺少版本控制能力 [phase-3]

---

## 统计

| 指标 | 数量 |
|------|------|
| 提交总数 | 51 |
| 变更文件 | 527 |
| Issue 总数 | 58 |
| 已关闭 Issue | 35 |
| 待处理 Issue | 23 |
