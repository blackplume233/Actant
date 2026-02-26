# Component Guidelines

> How components are built in the Actant Dashboard.

---

## Overview

Dashboard 使用 React + Tailwind CSS + shadcn/ui 组件库。页面组件位于 `packages/dashboard/client/src/pages/`，UI 基础组件位于 `packages/dashboard/client/src/components/ui/`。

---

## Component Structure

### Page Components

每个页面是一个默认导出的函数组件，通常结构如下：

```typescript
export default function SomePage() {
  const { agents, events } = useSSEContext();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => /* filtering logic */, [data, filter, search]);

  return (
    <div className="space-y-6">
      <div> {/* Title + description */} </div>
      <div className="flex gap-2"> {/* Badge filters + Search input */} </div>
      <Card> {/* Content */} </Card>
    </div>
  );
}
```

### UI Components

基于 shadcn/ui 约定，每个 UI 组件是一个独立文件，使用 `React.forwardRef` + `cn()` 工具函数合并 className。

已有组件：`Badge`, `Button`, `Card`, `DropdownMenu`, `Input`, `ScrollArea`, `Separator`, `Skeleton`, `Table`, `Tooltip`。

---

## Agent Interaction Patterns

### Agent Card Actions

Agent 卡片的操作菜单通过 `DropdownMenu` 实现，菜单项根据 Agent 状态动态变化：

- **Running** → 显示 Stop、Chat、Details、Destroy
- **Stopped/Created** → 显示 Start、Chat、Details、Destroy

操作通过 `lib/api.ts` 的 `agentApi` 调用后端 REST API（`POST /v1/agents/:name/start` 等）。操作期间显示 Loader spinner，SSE 自动反映最新状态。

点击卡片本身导航到 Agent 详情页 (`/agents/:name`)，`stopPropagation()` 阻止菜单点击冒泡。

### Agent Detail Page (Tabs)

Agent 详情页使用手动 Tab 切换（非路由级 Tab），三个标签：

| Tab | 数据来源 | 用途 |
|-----|---------|------|
| Overview | SSE (agents) | 显示 Agent 属性表（name, status, PID, template, uptime...） |
| Sessions | REST (`/v1/agents/:name/sessions` + `/sessions/:id`) | 历史会话列表 → 选中查看对话记录 |
| Logs | REST (`/v1/agents/:name/logs`) | 进程 stdout 日志 |

### Agent Chat Page

全屏聊天界面，消息气泡式 UI：

- 用户消息右对齐（primary 色），助手消息左对齐（muted 色）
- 调用 `POST /v1/agents/:name/prompt` 发送，返回 `{ response, sessionId }`
- Enter 发送 / Shift+Enter 换行
- 发送中显示 "Thinking..." 动画
- 错误消息居中显示（destructive 色边框）

> 实现参考：`pages/agent-chat.tsx`, `pages/agent-detail.tsx`, `components/agents/agent-card.tsx`

---

## Props Conventions

- 使用 TypeScript interface 定义 props
- 继承 HTML 元素 props 时使用 `React.HTMLAttributes<HTMLElement>`
- 样式自定义通过 `className` prop + `cn()` merge

---

## Styling Patterns

| 模式 | 用途 |
|------|------|
| Tailwind utility classes | 所有布局和样式 |
| `cn()` (clsx + tailwind-merge) | 合并 className，避免冲突 |
| CSS variables | shadcn/ui 主题变量（`--primary`, `--muted`, etc.） |
| Dark mode | 默认暗色主题（`dark` class on body） |

**不要使用**：CSS modules、styled-components、内联 style 对象。

---

## Common Mistakes

### Don't: 使用项目中未安装的 shadcn/ui 组件

**Problem**: 引用 `Select`, `Dialog`, `Popover` 等组件但它们不在 `components/ui/` 中。

**Why it's bad**: 构建/类型检查将失败。

**Instead**: 用 `Badge` 做过滤器、用 `Card` 做容器。需要新组件时先通过 `npx shadcn@latest add <name>` 安装。

### Don't: 直接使用 fetch 或 EventSource

**Problem**: 页面中直接 `fetch("/api/...")` 或 `new EventSource(...)`。

**Why it's bad**: 破坏 `Transport` 抽象层，无法适配未来 Tauri IPC。

**Instead**: 通过 `useSSEContext()` / `useRealtimeContext()` 获取实时数据，或通过 `transport.fetch()` 发起请求。

### Don't: 在 Canvas iframe 中使用 allow-same-origin

**Problem**: `<iframe sandbox="allow-scripts allow-same-origin" ...>`

**Why it's bad**: Agent 生成的 HTML 将能访问父窗口 DOM 和 cookies，构成安全风险。

**Instead**: 仅使用 `sandbox="allow-scripts"`，确保 iframe 与父窗口完全隔离。
