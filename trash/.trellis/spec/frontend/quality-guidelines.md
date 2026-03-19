# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Dashboard 前端代码遵循以下质量标准，确保可维护性、可扩展性和一致性。

---

## Forbidden Patterns

### 1. 硬编码用户可见文案

所有面向用户的文本（标题、按钮标签、描述、占位符、错误消息）必须通过 `t()` 引用翻译键，不得硬编码英文或中文字符串。

```tsx
// Bad
<p>No agents found.</p>

// Good
<p>{t("agents.noMatch")}</p>
```

### 2. 单数据源过滤

当页面使用多个 SSE 数据源（agents + canvas、agents + events 等）时，所有数据源必须应用相同的 archetype/状态过滤。仅过滤 agent 列表而不过滤关联数据会导致空状态判断错误。

### 3. 向未运行 Agent 发送后端请求

前端必须在发起 prompt/session 请求前检查 agent 是否为 `running` 状态。不得依赖后端错误消息来告知用户 agent 未启动。

### 4. 直接使用 fetch 或 EventSource

见 [Component Guidelines > Common Mistakes](./component-guidelines.md)。

### 5. 在 Canvas iframe 中使用 allow-same-origin

见 [Component Guidelines > Common Mistakes](./component-guidelines.md)。

---

## Required Patterns

### 1. i18n Hook

每个含用户可见文案的组件必须：
1. `import { useTranslation } from "react-i18next"`
2. 在函数体内 `const { t } = useTranslation()`
3. 用 `t("key")` 替代所有硬编码文案

### 2. Archetype 前后端双重校验

archetype 限制功能（如 LiveCanvas 仅限 employee）必须在前端（UI 不渲染/disable）和后端（RPC handler 拒绝）同时实施。

### 3. Agent 状态感知 UI

与 agent 交互的页面（Chat、Detail）必须根据 `agent.status` 动态调整 UI：
- `running` → 启用全部交互控件
- 非 `running` → disable 输入、显示引导文案、不发起后端请求

### 4. 翻译键同步

修改页面文案时，必须同时更新 `en.json` 和 `zh-CN.json`（及其他已支持语言）。新增翻译键后应验证所有语言文件都有对应条目。

---

## Testing Requirements

### 黑盒测试（Playwright）

Dashboard 功能通过 Playwright 进行黑盒测试，测试脚本位于 `.trellis/tasks/qa-restapi-blackbox/`。

**测试覆盖要求**：
- 页面基本渲染（标题、导航、空状态）
- 状态过滤和搜索功能
- Agent 操作（start/stop/destroy）
- Chat 会话管理（历史加载、新对话、发送）
- i18n 语言切换（切换后所有可见文案变化）
- archetype feature gating（非 employee 不显示 canvas slot）

### 构建验证

每次修改 Dashboard 代码后应执行 `pnpm build`，确保 TypeScript 编译和 Vite 构建通过。

---

## Code Review Checklist

- [ ] 所有用户可见文案是否通过 `t()` 引用？
- [ ] 新增翻译键是否同时出现在 en.json 和 zh-CN.json 中？
- [ ] archetype 过滤是否同时应用于所有相关数据源？
- [ ] Agent 交互是否在前端做了 `isRunning` 检查？
- [ ] 后端 RPC handler 是否做了对应的 archetype/状态校验？
- [ ] 是否使用了项目中已有的 UI 组件（而非引入未安装的 shadcn/ui 组件）？
- [ ] 构建（`pnpm build`）是否通过？
