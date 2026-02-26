---
id: 178
title: "RFC: Actant 通过 ACP 向雇员 Agent 提供的工具与能力清单"
status: open
labels:
  - discussion
  - acp
  - architecture
  - "priority:P1"
milestone: null
author: human
assignees: []
relatedIssues:
  - 137
  - 16
  - 40
  - 14
  - 122
  - 136
  - 173
relatedFiles:
  - packages/acp/src/connection.ts
  - packages/mcp-server/src/index.ts
  - packages/core/src/domain/mcp/mcp-config-manager.ts
taskRef: null
githubRef: "blackplume233/Actant#178"
closedAs: null
createdAt: 2026-02-25T12:00:00
updatedAt: 2026-02-25T12:30:00
closedAt: null
---

**Related Issues**: [[0137-runtime-mcp-manager]], [[0016-mcp-server]], [[0040-agent-tool-permission]], [[0014-plugin-system]], [[0122-scheduler-enhancement]], [[0136-agent-to-agent-email]]
**Related Files**: `packages/acp/src/connection.ts`, `packages/mcp-server/src/index.ts`, `packages/core/src/domain/mcp/mcp-config-manager.ts`

---

## 背景

Employee（雇员）是 Actant 中持续运行的 Agent Instance，以 `acp-service` 模式由 Daemon 托管。在此模式下，**Actant Daemon 扮演 ACP Client 角色**，向雇员 Agent 提供环境能力。

当前 ACP 已实现连接、网关、会话复用等基础设施，但**Actant 作为 ACP Host 应该向雇员提供哪些具体工具和能力**尚未系统化讨论。本 Issue 旨在梳理和明确这一能力清单。

### 协议分工

| 协议 | 方向 | 角色 | 说明 |
|------|------|------|------|
| **ACP** | Actant → Agent | Actant 是 Host/Client，Agent 是 Server | 提供环境能力（文件、终端、权限） |
| **MCP** | Actant → Agent | Actant MCP Server 注入 Agent 的工具链 | 提供平台能力（调度、通信、记忆、管理） |

两者共同构成雇员的完整能力集。本 Issue 讨论二者的统一清单。

---

## 能力分层

### Layer 0: ACP 环境能力（Actant 作为 ACP Client 直接提供）

| 能力 | 当前状态 | 类型 | 说明 |
|------|---------|------|------|
| **文件系统访问** | ✅ 已有 | ACP 环境 | Agent 的隔离工作目录，读/写/搜索 |
| **Shell 执行** | ⚠️ 部分（#95） | **内置必选** | Daemon 直接提供 command execution，不依赖 IDE Terminal |
| **TS 沙盒执行** | ❌ 缺失 | **内置必选** | 动态执行 TypeScript 代码片段，vm/worker_threads 沙盒隔离 |
| **MCP Server 传递** | ⚠️ 空数组（#137） | ACP 环境 | 尚未实现 RuntimeMcpManager |
| **权限边界** | ⚠️ 粗粒度（#40） | ACP 环境 | 当前全部 allow |
| **浏览器 / WebSearch** | ❓ 待讨论 | ACP 环境 | headless 雇员是否需要 web 访问？ |

### Layer 1: Actant MCP Tools（平台能力层）

#### 1.1 自我调度（#122）
- `actant_schedule_wait` / `actant_schedule_cron` / `actant_schedule_cancel`

#### 1.2 Agent 间协作（#136, #16）
- `actant_send_email` / `actant_check_inbox` / `actant_reply_email`
- `actant_run_agent` / `actant_prompt_agent` / `actant_agent_status` / `actant_list_agents`

#### 1.3 记忆系统（#165）
- `memory_recall` / `memory_navigate` / `memory_browse`

#### 1.4 自我观测（建议新增）
- `actant_self_status` / `actant_execution_history` / `actant_task_queue`

### Layer 2: Domain Context（模板驱动层）
- 外部 MCP Server / Skills / Sub-Agents / System Prompt

---

## 8 个核心讨论点

详见 GitHub Issue body。

---

## Comments

### human — 2026-02-25T12:30:00

**补充：内置执行能力底线要求**

雇员必须具备两项内置执行能力，不依赖外部 MCP Server，作为 Layer 0 硬性底线：

1. **内置 Shell 执行能力** — 不依赖 IDE Terminal，Daemon 直接提供 command execution + stdout/stderr
2. **TS 沙盒执行能力** — 动态编写执行 TypeScript 代码片段，基于 vm/worker_threads 隔离，预注入 Actant SDK context，超时+内存限制保护。可考虑作为内置 MCP Tool: `actant_exec_ts` / `actant_eval`
