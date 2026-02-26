# Frontend Development Guidelines

> Guidelines for Actant's user-facing interfaces.

---

## Overview

Actant follows a **CLI-First** strategy. The primary interface is an interactive command-line environment (similar to Python REPL). A web-based management UI is planned for future phases.

### Interface Layers

| Layer | Priority | Description | Status |
|-------|----------|-------------|--------|
| **CLI (REPL)** | P0 | Interactive command-line, the primary interface | Active |
| **REST API** | P0 | HTTP endpoints for all operations (enables Docker deployment) | Active |
| **Web UI** | P1 | Management dashboard for agent monitoring and configuration | Planned |
| **ACP Client** | P2 | Protocol adapter for external Agent Clients (Unreal/Unity) | Planned |

---

## CLI-First Principle

All features must be fully operational via CLI before any UI work begins. This means:

1. **Business logic lives in Core** — CLI and UI are thin presentation layers
2. **CLI commands map 1:1 to API endpoints** — same underlying operations
3. **Output formats are structured** — JSON output mode for programmatic consumption
4. **Interactive prompts have non-interactive equivalents** — all params passable as flags

### CLI Design Considerations for Future UI

When designing CLI commands, keep future UI integration in mind:

| CLI Pattern | UI Equivalent |
|-------------|--------------|
| `agent list` | Agent list page with table |
| `agent create --template X` | "New Agent" form with template selector |
| `agent status <id>` | Agent detail panel with live status |
| `agent logs <id> --follow` | Log viewer with streaming |
| `template edit <name>` | Template editor with validation |

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | CLI and future UI file organization | Initial |
| [Component Guidelines](./component-guidelines.md) | CLI output components, future UI components | Template |
| [Hook Guidelines](./hook-guidelines.md) | CLI lifecycle hooks, future React hooks | Template |
| [State Management](./state-management.md) | CLI session state, future UI state | Template |
| [Quality Guidelines](./quality-guidelines.md) | Code standards for frontend layers | Template |
| [Type Safety](./type-safety.md) | Type patterns for CLI and UI | Template |

> **Note**: "Template" status means the file contains placeholder content from Trellis. It will be filled when the corresponding feature is actively developed.

---

## Current Phase: CLI Development

### CLI Architecture

```
CLI Layer
├── Command Parser       # Parse user input into commands
├── Command Registry     # Available commands and their handlers
├── REPL Loop           # Interactive session management
├── Output Formatter    # Render results (table, JSON, text)
└── Error Presenter     # User-friendly error display
```

### CLI Output Modes

Support multiple output formats for different consumers:

| Mode | Flag | Consumer | Example |
|------|------|----------|---------|
| Table | `--format table` (default) | Human users | Formatted ASCII tables |
| JSON | `--format json` | Scripts, CI tools | Machine-parseable JSON |
| Quiet | `--quiet` | Pipelines | Minimal output (IDs only) |

---

## Site & Wiki

GitHub Pages 主页（`docs/site/`）和 VitePress 文档站（`docs/wiki/`）的开发约定：

- 统一配色体系、字体、暗色模式
- Wiki 构建与部署流程
- 关键 Gotcha（ESM 兼容、workspace 隔离、构建产物 gitignore）

详见 [Site & Wiki 开发规范](./site-and-wiki.md)。

---

## Dashboard (Web UI) — Active ✅

Dashboard 已进入实现阶段（Phase 4 Step 7）。

### Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 19 + TypeScript | Vite dev/build |
| Styling | Tailwind CSS v4 + shadcn/ui | Dark theme preferred |
| Routing | react-router-dom v7 | Client-side SPA |
| Real-time | SSE (Server-Sent Events) | Via `Transport` abstraction |
| Backend | `@actant/rest-api` (RESTful HTTP) | Dashboard 挂载 rest-api handler + 静态文件 |
| Rendering | iframe sandbox | For Live Canvas (agent-generated HTML) |

### Transport Abstraction Layer

Dashboard 通信通过 `Transport` 接口抽象，为未来 Tauri 桌面应用做准备：

```typescript
interface Transport {
  fetch<T>(endpoint: string): Promise<T>;
  subscribe(onData: (event: string, data: unknown) => void): () => void;
}
```

| 实现 | 传输方式 | 场景 |
|------|---------|------|
| `WebTransport` | HTTP fetch + EventSource (SSE) | 当前 Web 模式 |
| `TauriTransport` | Tauri IPC Commands + Events | 未来桌面模式（尚未实现） |

代码中统一使用 `useRealtimeContext()` hook 消费实时数据，不直接依赖具体传输实现。旧兼容别名 `useSSEContext` / `SSEProvider` 已在 v0.2.4+ 清除，所有消费者已迁移至 `useRealtimeContext` / `RealtimeProvider`。

> 实现参考：`packages/dashboard/client/src/lib/transport.ts`，`packages/dashboard/client/src/hooks/use-realtime.tsx`

### Dashboard Pages

| Page | Route | Data Source | Description |
|------|-------|-------------|-------------|
| Overview | `/` | SSE (agents, events) | Agent 总览 + 最近事件 |
| Live Canvas | `/canvas` | SSE (canvas) | 每个 Agent 的 HTML Canvas，iframe sandbox 渲染 |
| Agents | `/agents` | SSE (agents) | Agent 列表，支持搜索和按状态过滤 |
| Agent Detail | `/agents/:name` | SSE + REST | Agent 详情（Overview / Sessions / Logs 三 Tab） |
| Agent Chat | `/agents/:name/chat` | REST (prompt) | 与 Agent 实时对话，支持 session 管理 |
| Activity | `/activity` | SSE (agents, events) | 活动时间线 |
| Events | `/events` | SSE (events) | EventBus 事件流，支持层级过滤和搜索 |
| Settings | `/settings` | SSE (daemon) | Daemon 连接信息和 Dashboard 设置 |

### Dashboard Page Conventions

每个页面遵循统一布局模式：

1. **标题区**：`<h1>` 标题 + 简要描述
2. **过滤区**：使用 `Badge` 组件做 tab 式过滤（不要用 `Select` dropdown）
3. **搜索**：使用 `Input` 组件提供关键词搜索
4. **内容区**：`Card` 容器包裹列表/表格/网格内容
5. **空状态**：当无数据时显示友好的空状态文案

**为什么用 Badge 而不是 Select**：Badge 过滤器比 Select 下拉框在 dashboard 场景下更直观——用户可以一眼看到所有选项并快速切换，适合 2-6 个选项的过滤场景。

### Common Gotchas

**shadcn/ui 组件缺失**：并非所有 shadcn/ui 组件都已安装。新建页面前先检查 `packages/dashboard/client/src/components/ui/` 目录中已有哪些组件。缺失的组件可通过 `npx shadcn@latest add <component>` 安装或手动创建。

**Build Order**：Dashboard 依赖链为 `@actant/shared` → `@actant/rest-api` → `@actant/dashboard`。修改 shared 或 rest-api 包后，需按此顺序重新构建。

**API 路径前缀**：所有 REST API 端点使用 `/v1/` 前缀（如 `/v1/agents`）。Dashboard server 保留 `/api/` → `/v1/` 兼容重写，但新代码应直接使用 `/v1/`。前端 `lib/api.ts` 和 `lib/transport.ts` 已迁移至 `/v1/` 路径。

### iframe Canvas Security

Agent 生成的 HTML 通过 `<iframe srcDoc={html} sandbox="allow-scripts" />` 渲染。`sandbox` 属性限制了 iframe 的能力，防止 Agent 代码访问父窗口或发起导航。允许 `allow-scripts` 使 Agent 可使用 JS 构建交互式状态面板。

### Archetype Feature Gating

Dashboard 中某些功能仅对特定 archetype 的 Agent 开放：

| 功能 | 允许的 Archetype | 实现层 |
|------|-----------------|--------|
| **Live Canvas**（推送/显示 HTML widgets） | `employee` only | 前端过滤 + 后端 `canvas.update` handler 校验 |
| **Chat**（对话交互） | 所有（但需 running 状态） | 前端 disable + 后端错误提示 |
| **Agent Card / Detail** | 所有 | — |

**前后端双重校验原则**：archetype 限制必须在前端（UI 不渲染/disable）和后端（RPC handler 拒绝）同时实施。仅靠前端过滤不安全（API 可直接调用），仅靠后端拒绝则 UX 不友好。

### Internationalization (i18n)

Dashboard 使用 `react-i18next` 实现多语言支持。

**技术栈**：

| 库 | 用途 |
|----|------|
| `i18next` | 核心 i18n 引擎 |
| `react-i18next` | React 绑定（`useTranslation` hook） |
| `i18next-browser-languagedetector` | 自动检测浏览器语言 |

**文件结构**：

```
client/src/i18n/
├── index.ts              # 初始化配置（语言检测、fallback、持久化）
└── locales/
    ├── en.json           # 英文翻译
    └── zh-CN.json        # 中文翻译
```

**翻译键命名约定**：采用扁平 dot-notation，按模块分组：

| 命名空间 | 用途 | 示例 |
|----------|------|------|
| `common.*` | 跨页面共用标签 | `common.start`, `common.stop` |
| `status.*` | Agent 状态标签 | `status.running`, `status.stopped` |
| `nav.*` | 侧边栏导航 | `nav.dashboard`, `nav.agents` |
| `<pageName>.*` | 页面专属文案 | `chat.thinking`, `settings.title` |

**使用方式**：每个含硬编码文案的组件必须 `import { useTranslation } from "react-i18next"` 并在函数体内调用 `const { t } = useTranslation()`，然后用 `t("key")` 替换硬编码字符串。

**语言切换**：侧边栏底部内嵌 `LanguageSwitcher` 组件，选择自动持久化到 `localStorage`（key: `actant-lang`）。

**添加新语言**：(1) 在 `locales/` 下新建翻译文件；(2) 在 `i18n/index.ts` 的 `resources` 和 `supportedLanguages` 中注册。

---

**Language**: See [Language Conventions](../backend/quality-guidelines.md#language-conventions) in Quality Guidelines.
