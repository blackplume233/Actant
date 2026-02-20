# AgentCraft

一个用于构建、管理和编排 AI Agent 的平台。面向游戏开发等复杂业务场景，让用户能够快速拼装、复用合适的 Agent，零成本地将 AI 嵌入工作流。

> **项目阶段**: 早期开发中 — 架构设计已完成，核心功能开发中

---

## 功能概览

### 核心能力

| 功能 | 说明 | 状态 |
|------|------|------|
| **自定义业务 Agent** | 通过 Domain Context（Skills、MCP、Prompt、记忆）动态拼装 Agent | ✅ 已完成 |
| **Agent Template 系统** | JSON 配置文件定义 Agent 模板，引用式组合而非嵌入 | ✅ 已完成 |
| **Agent 生命周期管理** | 创建、启动、监控、停止 Agent Instance | ✅ 已完成 |
| **交互式 CLI (REPL)** | 类似 Python 交互环境的命令行界面，主要操作入口 | ✅ 已完成 |
| **Agent 通信** | 通过 claude-code CLI 与 Agent 进行 prompt/response 交互 | ✅ 已完成 |
| **CI 集成** | Agent 可通过 CLI 被 TeamCity 等 CI 工具调用 | 🔲 规划中 |
| **持久化 Agent** | 长期运行的 Agent，具备心跳、自我成长、长期记忆、定时任务 | 🔲 规划中 |
| **Agent as Service** | 持续运行的 Agent 接入 IM / Email，作为虚拟雇员 | 🔲 规划中 |
| **ACP 协议集成** | 通过 Agent Client Protocol 接入 Unreal/Unity 等引擎 | 🔲 规划中 |
| **MCP 协议集成** | Agent 通过 MCP 调用其他 Agent 或访问平台功能 | 🔲 规划中 |
| **RESTful API** | 所有 CLI 操作暴露为 HTTP 接口，支持 Docker 部署 | 🔲 规划中 |
| **Web 管理界面** | Agent 监控和配置的可视化管理面板 | 🔲 未来阶段 |

### 已完成

- ✅ 项目架构设计（pnpm monorepo，6 个包）
- ✅ 技术栈选型确定（[ADR-001](docs/decisions/001-tech-stack.md)）
- ✅ 目录结构规范（[ADR-002](docs/decisions/002-directory-structure.md)）
- ✅ 开发规范文档（后端指南、前端指南、跨层思维指南）
- ✅ 项目脚手架搭建（包结构、TypeScript 配置、Vitest 配置）
- ✅ Phase 1: 核心运行时（进程管理、LaunchMode 分化、崩溃重启、外部 Spawn）
- ✅ Phase 2 MVP: Agent 拼装与交互（Domain Context 全链路、CLI 管理、Agent 通信）

---

## Quick Start

### 环境要求

- [Node.js](https://nodejs.org/) >= 22.0.0
- [pnpm](https://pnpm.io/) >= 9.0.0
- [Claude Code CLI](https://docs.claude.com/) (用于 Agent 通信)

### 安装与构建

```bash
# 克隆仓库
git clone https://github.com/blackplume233/AgentCraft.git
cd AgentCraft

# 安装依赖
pnpm install

# 构建所有包
pnpm build
```

### MVP 使用流程

```bash
# 1. 启动 Daemon（后台进程管理器）
agentcraft daemon start

# 2. 查看可用模板和组件
agentcraft template list
agentcraft skill list
agentcraft prompt list

# 3. 从模板创建 Agent（技能和提示词会自动物化到 workspace）
agentcraft agent create my-agent --template code-review-agent

# 4. 查看 Agent 状态
agentcraft agent status my-agent

# 5. 以 Service 模式启动 Agent
agentcraft agent start my-agent

# 6. 向 Agent 发送单次任务
agentcraft agent run my-agent --prompt "Review the error handling in src/index.ts"

# 7. 进入交互式对话模式
agentcraft agent chat my-agent

# 8. 停止 Agent
agentcraft agent stop my-agent

# 9. 销毁 Agent（删除 workspace）
agentcraft agent destroy my-agent --force

# 10. 关闭 Daemon
agentcraft daemon stop
```

> **`agent run/chat` 与 `agent start` 的关系**
>
> - `agent run` / `agent chat` 使用 claude-code CLI 的 print 模式（`claude -p`），每次交互是一次独立的进程调用，**不依赖** `agent start`。即使未执行 `agent start`，也可以直接使用 `agent run` 和 `agent chat` 与 Agent 交互。
> - `agent start` 将 Agent 作为长驻 Service 启动，用于后续 ACP Proxy 集成等场景（Phase 3）。
> - `agent chat` 的 `--session-id` 选项通过 claude-code 的 session 机制实现跨消息的上下文延续。

### 自定义组件

将组件定义文件放入 `~/.agentcraft/configs/` 目录：

```
~/.agentcraft/configs/
├── skills/          # 技能定义 (JSON)
├── prompts/         # 提示词定义 (JSON)
├── mcp/             # MCP Server 配置 (JSON)
├── workflows/       # 工作流定义 (JSON)
└── templates/       # Agent 模板 (JSON)
```

项目内置了示例配置，位于 `configs/` 目录。

### 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式启动 CLI |
| `pnpm build` | 构建所有包 |
| `pnpm test` | 运行全部测试 |
| `pnpm test:changed` | 仅运行受变更影响的测试 |
| `pnpm test:watch` | 测试监听模式 |
| `pnpm lint` | 代码检查 |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm clean` | 清理构建产物 |

---

## 架构

### 模块结构

```
AgentCraft
├── @agentcraft/shared       公共类型、错误、配置、日志、工具
├── @agentcraft/core         模板、初始化器、管理器、领域上下文
├── @agentcraft/cli          交互式 CLI（REPL）— 主要操作界面
├── @agentcraft/api          RESTful API（Hono）— 支持 Docker 部署
├── @agentcraft/acp          Agent Client Protocol 服务端
└── @agentcraft/mcp-server   Model Context Protocol 服务端
```

### 依赖关系

```
shared ← core ← cli
              ← api
              ← acp
              ← mcp-server
```

> `cli`、`api`、`acp`、`mcp-server` 之间不互相依赖，全部通过 `core` 交互。

### 技术栈

| 层面 | 技术 |
|------|------|
| 运行时 | Node.js 22 LTS |
| 语言 | TypeScript 5.7+（strict 模式）|
| 包管理 | pnpm 9+（workspace monorepo）|
| 构建 | tsup |
| 测试 | Vitest |
| HTTP 框架 | Hono |
| Schema 校验 | Zod |
| 配置格式 | JSON |
| 日志 | pino |
| 状态存储 | JSON 文件（per-instance）|
| MCP SDK | @modelcontextprotocol/sdk |

详细选型理由见 [ADR-001](docs/decisions/001-tech-stack.md)。

---

## 项目结构

```
AgentCraft/
├── packages/              源码（pnpm workspace）
│   ├── shared/            公共类型、错误、工具
│   ├── core/              核心业务逻辑
│   ├── cli/               CLI 前端（REPL）
│   ├── api/               RESTful API
│   ├── acp/               ACP 协议服务端
│   └── mcp-server/        MCP 协议服务端
├── configs/               内置配置（模板、技能、工作流）
├── docs/                  项目文档
│   ├── decisions/         架构决策记录（ADR）
│   ├── design/            功能设计文档
│   ├── human/             人工编写的笔记和评审
│   └── agent/             Agent 生成的分析和日志
├── tests/                 跨包集成测试 & E2E 测试
├── scripts/               构建和开发脚本
└── .trellis/              AI 开发框架
```

详细目录说明见 [ADR-002](docs/decisions/002-directory-structure.md)。

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Model Provider** | 基础模型 API（如 OpenAI、Anthropic）|
| **Agent Client** | Agent 前端 — TUI、IDE 插件、专用应用（如 Claude Desktop）|
| **Agent Backend** | Agent 的功能实现（如 Claude Code、Cursor 核心），不含交互界面 |
| **Domain Context** | 领域上下文 — 由 Workflow、Prompt、MCP/Tools、Skills、SubAgent 组成 |
| **Agent Template** | Agent 配置文件，定义 Domain Context、初始化流程、默认后端和提供者 |
| **Agent Instance** | 可运行的 Agent 实例，拥有完整的运行环境和生命周期 |
| **Employee** | 持续运行的 Agent Instance，作为持久化工作者 |

### 启动模式

| 模式 | 生命周期管理方 | 典型场景 |
|------|---------------|---------|
| Direct | 用户 | 直接打开 IDE / TUI |
| ACP Background | 调用方 | 第三方 Client 通过 ACP 管理 |
| ACP Service | AgentCraft | 持久化雇员 Agent |
| One-Shot | AgentCraft | 执行任务后自动终止 |

---

## 文档

| 文档 | 说明 |
|------|------|
| [ADR-001: 技术栈](docs/decisions/001-tech-stack.md) | TypeScript + pnpm monorepo 选型理由 |
| [ADR-002: 目录结构](docs/decisions/002-directory-structure.md) | 项目目录规范和人机文档分离 |
| [后端开发指南](.trellis/spec/backend/index.md) | 后端架构、模块设计、开发原则 |
| [前端开发指南](.trellis/spec/frontend/index.md) | CLI 优先策略、界面层规划 |
| [跨层思维指南](.trellis/spec/guides/cross-layer-thinking-guide.md) | 数据流分析和层间边界处理 |

---

## 参考项目

| 项目 | 关联 |
|------|------|
| [PicoClaw](https://picoclaw.net/) | Agent 持续集成 |
| [pi-mono/ai](https://github.com/badlogic/pi-mono/tree/main/packages/ai) | Agent 后端实现参考 |
| [ACP](https://agentclientprotocol.com/) | Agent Client Protocol 框架 |
| [n8n](https://n8n.io/) | 工作流自动化模式 |
| [Trellis](https://github.com/mindfold-ai/Trellis) | 工程初始化及 Workflow 设计 |
| [UnrealFairy](https://github.com/blackplume233/UnrealFairy) | 关联项目 — AgentCraft 将取代其 Agent 子系统 |

## License

[MIT](LICENSE)
