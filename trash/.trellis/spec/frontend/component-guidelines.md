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
  const { agents, events } = useRealtimeContext();
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

**Instead**: 通过 `useRealtimeContext()` 获取实时数据，或通过 `transport.fetch()` 发起请求。

### Don't: 在 Canvas iframe 中使用 allow-same-origin

**Problem**: `<iframe sandbox="allow-scripts allow-same-origin" ...>`

**Why it's bad**: Agent 生成的 HTML 将能访问父窗口 DOM 和 cookies，构成安全风险。

**Instead**: 仅使用 `sandbox="allow-scripts"`，确保 iframe 与父窗口完全隔离。

### Don't: 仅按 Agent 列表过滤而忽略关联数据源

**Problem**:
```tsx
// 只过滤了 agent，没有过滤 canvas 数据
const employeeAgents = agents.filter(a => a.archetype === "employee");
// canvas 仍包含所有 agent 的条目，导致空状态判断失败
{employeeAgents.length === 0 && canvas.length === 0 ? <Empty /> : <Grid />}
```

**Why it's bad**: 非 employee agent 的 canvas 条目会使 `canvas.length > 0`，导致本应显示空状态的页面渲染一个空 grid。

**Instead**:
```tsx
const employeeNames = new Set(employeeAgents.map(a => a.name));
const filteredCanvas = canvas.filter(e => employeeNames.has(e.agentName));
{employeeAgents.length === 0 && filteredCanvas.length === 0 ? <Empty /> : <Grid />}
```

**防止方法**: 当页面同时使用多个数据源（agents、canvas、events）时，所有数据源都必须应用相同的过滤条件。

### Don't: 向未运行的 Agent 发送 prompt 请求

**Problem**: Chat 页面允许用户在 Agent 未运行时发送消息，后端返回 "No session found" 技术性错误。

**Why it's bad**: 用户看到的是后端内部错误而非可操作的提示。网络请求被浪费。

**Instead**: 在前端预先拦截——Agent 未运行时 disable 输入框和发送按钮，显示清晰的引导文案（如"请先启动 Agent"）。如果用户仍能触发发送（如键盘快捷键），在 `handleSend` 开头检查 `isRunning` 并直接显示本地化友好提示，不发起后端请求。

### Don't: 在组件中硬编码用户可见文案

**Problem**: `<p>No agents match the current filter.</p>`

**Why it's bad**: 无法支持多语言，切换语言后仍显示英文。

**Instead**: `<p>{t("agents.noMatch")}</p>` — 通过 `useTranslation()` hook 引用翻译键。

---

## i18n Patterns

### Pattern: 组件国际化

**Problem**: 需要在不同组件中显示翻译文本。

**Solution**: 每个含用户可见文案的函数组件都使用 `useTranslation` hook。

**Example**:
```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t("page.title")}</h1>;
}
```

**注意**: 子组件也需要独立调用 `useTranslation()`，不要通过 props 传递 `t` 函数。

### Pattern: 静态配置数组使用 labelKey

**Problem**: `navItems` 等模块级常量数组无法使用 hook。

**Solution**: 数组存储翻译键（`labelKey`），在组件渲染时调用 `t(item.labelKey)`。

**Example**:
```tsx
const navKeys = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { to: "/agents", icon: Bot, labelKey: "nav.agents" },
];

function Sidebar() {
  const { t } = useTranslation();
  return navKeys.map(item => <Link key={item.to}>{t(item.labelKey)}</Link>);
}
```

### Pattern: 带插值的翻译

**Problem**: 翻译文本中包含动态值（agent name、count 等）。

**Solution**: 使用 i18next 的 `{{variable}}` 插值语法。

**Example**:
```json
{ "chat.startPrompt": "Start a conversation with {{name}}" }
```
```tsx
{t("chat.startPrompt", { name: agentName })}
```

### Pattern: 复数形式

**Problem**: "1 agent" vs "3 agents" 需要根据数量变化。

**Solution**: 使用 i18next 的 `_one`/`_other` 后缀（英文）。中文不区分单复数，但仍需定义两个键。

**Example**:
```json
{
  "nav.agentCount_one": "{{count}} agent",
  "nav.agentCount_other": "{{count}} agents"
}
```
```tsx
{t("nav.agentCount", { count: n })}
```
