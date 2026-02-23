---
id: 121
title: "集成 Pi Agent 作为默认无外部依赖的 Agent Backend"
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
  - packages/core/src/builder/
  - packages/core/src/communicator/
taskRef: null
githubRef: "blackplume233/Actant#121"
closedAs: null
createdAt: "2026-02-23T08:57:09"
updatedAt: "2026-02-23T08:57:09"
closedAt: null
---

**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/manager/launcher/backend-resolver.ts`, `packages/core/src/builder/`, `packages/core/src/communicator/`

---

## 目标

将 [Pi Agent](https://github.com/anthropics/pi-agent)（Anthropic 开源的轻量级 Agent 框架）集成到 Actant 项目中，作为**默认的、零外部依赖**的 Agent Backend。

当前 Actant 的 backend 体系依赖外部工具（Cursor IDE 或 Claude Code CLI），用户必须先安装这些工具才能运行 Agent。集成 Pi Agent 后，Actant 将具备**开箱即用**的 Agent 执行能力，无需任何第三方 IDE 或 CLI。

## 背景

### 当前 Backend 体系

| Backend | 类型 | 依赖 | 可编程通信 |
|---------|------|------|-----------|
| Cursor IDE | `cursor` | 需安装 Cursor | ✗ 不支持 |
| Claude Code CLI | `claude-code` | 需安装 Claude CLI | ✓ ACP / stdio |
| Custom | `custom` | 用户自行提供 | 取决于实现 |
| **Pi Agent (新)** | `pi-agent` | **无外部依赖** | ✓ 内嵌进程 |

### 为什么选择 Pi Agent

- Anthropic 官方开源，与 Claude API 深度集成
- 轻量级纯 TypeScript 实现，可直接嵌入 Node.js 进程
- 支持工具调用、文件操作、Shell 执行等核心 Agent 能力
- 开源许可（MIT/Apache），适合二次开发

## 方案

### 集成方式决策

需要在两种集成方式中选择：

#### 方案 A：NPM 包依赖（推荐起步方案）

```json
// packages/core/package.json
{
  "dependencies": {
    "@anthropic/pi-agent": "^x.y.z"
  }
}
```

- ✅ 维护简单，版本可控
- ✅ 自动获得上游更新
- ❌ 二次开发不方便，需 fork + 发 patch 包

#### 方案 B：源码集成（Monorepo 子包）

```
packages/
  pi-agent/          # 从 pi-agent 仓库 fork 或 subtree
    src/
    package.json     # @actant/pi-agent
```

- ✅ 完全掌控，可深度定制（工具注册、沙箱策略、通信协议等）
- ✅ 可以与 Actant 的 Domain/Template 体系深度集成
- ❌ 需要手动跟踪上游更新
- ❌ 增加仓库体积和维护成本

#### 建议：分阶段推进

1. **Phase 1**：先用 NPM 包依赖快速集成，验证可行性
2. **Phase 2**：如需深度定制（如自定义工具注入、Agent 生命周期钩子），再迁移为源码集成

### 核心实现点

1. **新增 Backend 类型** — 在 `AgentBackendType` 中添加 `pi-agent`
2. **Backend Resolver** — `backend-resolver.ts` 中添加 Pi Agent 的启动逻辑（进程内启动，非 spawn 外部进程）
3. **Builder** — 新建 `PiAgentBuilder`，负责准备 Pi Agent 的工作区配置
4. **Communicator** — 新建 `PiAgentCommunicator`，实现 `prompt()` / `streamPrompt()` 接口
5. **配置 Schema** — 扩展 `backendConfig` 支持 Pi Agent 特有配置（API Key、model、tools 等）
6. **默认 Backend** — 当用户未指定 backend 时，自动使用 `pi-agent`（需要用户提供 Anthropic API Key）

### 配置示例

```yaml
backend:
  type: pi-agent
  config:
    model: claude-sonnet-4-20250514
    apiKey: ${ANTHROPIC_API_KEY}    # 环境变量引用
    maxTokens: 8192
    tools:
      - file_editor
      - shell
      - web_search
```

## 验收标准

- [ ] `AgentBackendType` 新增 `pi-agent` 枚举值
- [ ] `PiAgentBuilder` 能生成正确的工作区配置
- [ ] `PiAgentCommunicator` 支持 `prompt()` 和 `streamPrompt()`
- [ ] `actant agent run --backend pi-agent` 能正确执行 Agent 任务
- [ ] 无 `cursor` / `claude` CLI 环境下仍可运行（零外部依赖验证）
- [ ] 默认 backend fallback 逻辑：未指定 backend + 有 API Key → 使用 pi-agent
- [ ] 单元测试覆盖 Builder、Communicator、Resolver
- [ ] 文档更新：README 和 CLI help 中说明 pi-agent backend

## 影响范围

- `packages/shared/` — 类型定义（`AgentBackendType`、`BackendConfig`）
- `packages/core/` — Builder、Communicator、Launcher、Resolver
- `packages/cli/` — 命令参数扩展
- `packages/api/` — RPC handler 兼容
- 文档和模板
