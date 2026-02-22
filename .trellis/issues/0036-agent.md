---
id: 36
title: Agent 工具权限管理机制设计
status: open
labels:
  - architecture
  - feature
  - "priority:P2"
  - security
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#40"
closedAs: null
createdAt: "2026-02-20T19:32:19"
updatedAt: "2026-02-20T19:32:19"
closedAt: null
---

## 背景

当前在 Agent workspace 物化时，`ContextMaterializer` 会为 claude-code 后端生成 `.claude/settings.local.json`，预授权所有配置的 MCP 工具以及一组内置工具（Bash、Read、Write、Edit、MultiEdit、WebFetch、WebSearch）。这是一个粗粒度的"全部允许"策略，使 Agent 能在非交互模式下自主运行，但缺乏精细化控制。

## 当前实现

```typescript
// context-materializer.ts
const allowedTools = [
  "Bash", "Read", "Write", "Edit", "MultiEdit", "WebFetch", "WebSearch",
];
for (const server of servers) {
  allowedTools.push(\`mcp__\${server.name}\`);
}
```

## 需求

设计一套完备的权限管理机制，支持：

### 1. 模板级权限声明
- 在 AgentTemplate 中增加 `permissions` 字段
- 支持 `allow` / `deny` 列表
- 支持 glob 模式匹配（如 `Bash(npm run *)`, `Write(./src/**)`）

### 2. 实例级权限覆盖
- 创建实例时可以覆盖模板的默认权限
- 支持运行时动态调整（通过 RPC）

### 3. 安全级别预设
- `permissive`：允许所有工具（当前行为，适合受信任环境）
- `standard`：允许读操作和配置的 MCP，限制写操作和 Bash
- `restricted`：最小权限，仅允许明确授权的工具

### 4. 后端适配
- claude-code：映射到 `.claude/settings.local.json` 的 `permissions.allow/deny`
- cursor：映射到 `.cursor/settings.json` 的对应配置
- custom：提供通用权限接口

### 5. 审计与日志
- 记录工具使用日志
- 权限拒绝事件追踪

## 参考

- Claude Code permissions: `Bash(pattern)`, `Read`, `Write(pattern)`, `mcp__server__tool`
- 当前 MCP 物化：`packages/core/src/initializer/context/context-materializer.ts`
- 模板 Schema：`packages/shared/src/types/template.types.ts`

## 关联

- Phase 3 ACP Proxy (#16, #35)
- Agent 生命周期管理
