# Changelog — v0.1.0

> **日期**: 2026-02-22
> **变更范围**: 初始版本

---

## ✨ 新功能 (Features)

- feat: implement template permissions, component versioning, extensible architecture, and instance registry (#51-#56, #58, #59) (f00dad5)
- feat(trellis): migrate issue system to Obsidian Markdown format with skill and slash commands (acd9bf3)
- feat: add version staging system, QA tooling, and CI issue sync (8f6d420)
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

- fix(trellis): full GitHub sync and fix body upload in sync script (e58b2c0)
- fix: patch remaining AgentCraft references found by QA verification (ab97737)
- fix: show plugins in template detail and create default AGENTS.md on scaffold (762645f)
- fix: resolve all ACP lint errors and update spec docs for Phase 3 (6fa2d71)
- fix(qa): Issue #35 QA fixes, real-env QA default, and /qa-loop command (aa9aca8)
- fix: use platform-agnostic eslint target for Windows compatibility (cfe9a1a)
- fix: Windows compatibility for symlinks and IPC socket tests (ac5614f)
- fix(quality): resolve bug/enhancement issues, sync Zod schema, and align GitHub issues (8db1184)
- fix(quality): eliminate non-null assertions, add CI check script, and remove flaky setTimeout delays (37f885e)

## ♻️ 重构 (Refactoring)

- refactor: rename AgentCraft to Actant across entire codebase (e0cc156)
- refactor(cli): introduce CliPrinter output layer and add unit tests (e26ce70)

## 📝 文档 (Documentation)

- docs(trellis): add issue #59 -- official default Source repo with Agent Skills compatibility (e539e15)
- docs: add issues #56-#58, bilibili QA log, and domain context design doc (bc2de57)
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

- chore: sync issue githubRef links from CI (d000789)
- chore: close issue #38 after repo rename on GitHub (7551046)
- chore: add issue #34 (AGENTCRAFT_HOME) and QA test scenario (c31bef3)
- chore: add incremental test script for faster ship reviews (a595d8c)
- chore: add ESLint with typescript-eslint flat config and fix all lint errors (c476695)
- chore: fix trellis script permissions (d81a644)
- chore: add trellis-ship command for review-commit-push workflow (6d23406)
- chore: initialize project with Trellis development framework (b7f91d9)

---

## 📋 Issue 变更

### 已完成的功能 (v0.1.0)

- #51 Template Permission Control — 权限预设与沙箱配置
- #52 Shareable Agent Template via Source — 模板通过 Source 共享
- #53 Shareable Component Versioning — 组件版本管理
- #54 Domain Context Extensibility Guide — ComponentTypeHandler 可扩展架构
- #55 Installation, Help, and Update Mechanism — 安装/帮助/自更新
- #56 Actant and Instance Working Directory Design — Home 目录与实例注册表
- #58 Domain Config Format Redesign — VersionedComponent 公共信封
- #59 Create Official Default Source Repo — actant-hub 示例与 SKILL.md 解析

### 待处理 (Open Issues)

23 个 open issue（包含 Phase 4-6 规划），详见 issue-snapshot.json

---

## 统计

| 指标 | 数量 |
|------|------|
| 提交总数 | 61 |
| 变更文件 | 616 |
| 已关闭 Issue | 35 |
| 待处理 Issue | 23 |
| 测试用例 | 579 (100% pass) |
