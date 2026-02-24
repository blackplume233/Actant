---
id: 121
title: "集成 Pi (badlogic/pi-mono) 作为内置零外部依赖 Agent Backend"
status: open
labels:
  - feature
  - "priority:P1"
  - core
  - architecture
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/manager/launcher/backend-resolver.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/builder/
  - packages/core/src/communicator/
  - packages/pi/
taskRef: null
githubRef: "blackplume233/Actant#121"
closedAs: null
createdAt: "2026-02-23T08:57:09"
updatedAt: "2026-02-23T08:57:09"
closedAt: null
dirty: true
---

**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/manager/launcher/backend-resolver.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/core/src/builder/`, `packages/core/src/communicator/`, `packages/pi/`

---

## 目标

将 [Pi](https://github.com/badlogic/pi-mono)（社区顶级开源 AI Agent 工具包，14.9K stars，MIT 许可）集成到 Actant 项目中，作为**内置的、零外部依赖** Agent Backend。

当前 Actant 的 backend 体系依赖外部工具（Cursor IDE 或 Claude Code CLI），用户必须先安装这些工具才能运行 Agent。集成 Pi 后，Actant 将具备**开箱即用**的 Agent 执行能力，无需任何第三方 IDE 或 CLI，且支持**多 LLM Provider**。

## 背景

### 当前 Backend 体系

| Backend | 类型 | 依赖 | 可编程通信 |
|---------|------|------|-----------|
| Cursor IDE | `cursor` | 需安装 Cursor | ✗ 不支持 |
| Claude Code CLI | `claude-code` | 需安装 Claude CLI | ✓ ACP / stdio |
| Custom | `custom` | 用户自行提供 | 取决于实现 |
| **Pi (新)** | `pi` | **无外部依赖** | ✓ ACP + 进程内 SDK |

### 为什么选择 Pi

- [badlogic/pi-mono](https://github.com/badlogic/pi-mono) — 社区顶级项目 (14.9K+ stars)，MIT 许可
- 纯 TypeScript 实现，可直接嵌入 Node.js 进程
- **多 Provider 支持**：Anthropic, OpenAI, Google, Mistral, Groq, xAI, Amazon Bedrock 等 15+ LLM Provider
- 内置 coding tools：read, write, edit, bash, grep, find, ls
- 分层架构：`pi-ai` (统一 LLM API) + `pi-agent-core` (Agent 运行时) + `pi-coding-agent` (完整 coding agent)
- 支持工具调用、流式响应、thinking/reasoning、session 管理
- 活跃维护（v0.54.2，2983+ commits）

### NPM 包

| 包名 | 用途 | 依赖关系 |
|------|------|---------|
| `@mariozechner/pi-ai` | 统一多 Provider LLM API | 底层 |
| `@mariozechner/pi-agent-core` | Agent 运行时（工具调用、事件流、状态管理） | 依赖 pi-ai |
| `@mariozechner/pi-coding-agent` | 完整 coding agent (CLI + SDK + TUI) | 依赖 pi-agent-core |

## 方案

### 架构决策

| 决策 | 结论 | 理由 |
|------|------|------|
| Backend type | `"pi"` | 简洁明了 |
| 包结构 | 独立包 `@actant/pi` | 隔离重依赖（pi-ai 包含 15+ provider SDK），@actant/cli 自动依赖使其内置 |
| SDK 层级 | 底层 `pi-agent-core` + `pi-ai` | 完全掌控工具注册、ACP 桥接、事件映射；避免引入 pi-coding-agent 的 TUI/CLI 不需要的部分 |
| ACP 支持 | Phase 1 通过 `pi-acp-bridge` 子进程 | 复用现有 AcpConnection.spawn() 模式，无需修改 @actant/acp |
| 启动模式 | ACP-only（跳过 ProcessLauncher 双重 spawn） | 避免进程 #1 挂起的 bug |

### 整体架构

```
外部 IDE → ACP Client → Actant Gateway → AcpConnection.spawn("pi-acp-bridge")
    → AgentSideConnection ← stdio → pi-acp-bridge (ACP Server + Pi Agent)
    → pi-ai → Anthropic / OpenAI / Google / ...

Actant CLI → PiCommunicator → Pi Agent (in-process) → pi-ai → LLM
```

两条通信路径：
- **路径 A（Programmatic）**: `runPrompt/streamPrompt` → 进程内 Pi Agent（零子进程）
- **路径 B（ACP）**: 外部 IDE / `agent prompt` → `pi-acp-bridge` 子进程 → ACP 协议

### 核心实现点

1. **@actant/shared** — `AgentBackendType` 添加 `"pi"`
2. **@actant/core** — Zod schemas 同步 + `backend-resolver.ts` 添加 pi 解析 + `isAcpOnlyBackend()` + `agent-manager.ts` 修复双重 spawn + `streamPrompt` ACP 优先路径
3. **@actant/pi (新包)** — `PiBuilder` + `PiCommunicator` + `PiToolBridge` + `pi-acp-bridge` 可执行脚本
4. **@actant/api** — AppContext 装配 PiBuilder/PiCommunicator
5. **@actant/cli** — `package.json` 依赖 `@actant/pi`（内置）

### 配置示例

```yaml
backend:
  type: pi
  config:
    provider: anthropic            # 或 openai, google, mistral 等
    model: claude-sonnet-4-20250514
    apiKey: ${ANTHROPIC_API_KEY}   # 环境变量引用
    thinkingLevel: medium          # off/minimal/low/medium/high/xhigh
    tools:                         # read/write/edit/bash/grep/find/ls
      - read
      - write
      - edit
      - bash
```

## 验收标准

- [ ] `AgentBackendType` 新增 `"pi"` 枚举值
- [ ] `@actant/pi` 包创建完成，包含 PiBuilder, PiCommunicator, pi-acp-bridge
- [ ] `PiBuilder` 能生成正确的工作区配置（AGENTS.md, .pi/ 目录结构）
- [ ] `PiCommunicator` 支持 `runPrompt()` 和 `streamPrompt()`（进程内 Pi Agent）
- [ ] `pi-acp-bridge` 实现 ACP Agent 端协议，外部 IDE 可通过 ACP 连接
- [ ] `actant agent start --backend pi` 正确启动（ACP-only，无双重 spawn）
- [ ] `actant agent prompt` / session API 通过 ACP 工作
- [ ] `actant agent run --backend pi` 通过 PiCommunicator 工作
- [ ] 无 `cursor` / `claude` CLI 环境下仍可运行（零外部依赖验证）
- [ ] `streamPrompt` 在 ACP 可用时优先使用 ACP（与 runPrompt 一致）
- [ ] 单元测试覆盖 Builder、Communicator、Resolver
- [ ] `@actant/cli` 自动依赖 `@actant/pi`（内置体验）

## 影响范围

- `packages/shared/` — 类型定义（`AgentBackendType`）
- `packages/core/` — Zod schemas, backend-resolver, agent-manager, create-communicator
- `packages/pi/` — **新建包**（Builder, Communicator, ACP Bridge, Tool Bridge）
- `packages/api/` — AppContext 装配
- `packages/cli/` — package.json 依赖
- 文档和模板
