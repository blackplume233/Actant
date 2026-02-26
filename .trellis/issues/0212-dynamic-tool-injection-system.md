---
id: 212
title: "feat(core): Dynamic Tool Injection System — runtime tool set evolution based on SessionContextInjector"
status: open
labels:
  - feature
  - architecture
  - core
  - context
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 210
  - 211
  - 178
relatedFiles:
  - packages/core/src/context-injector/session-context-injector.ts
  - packages/mcp-server/src/index.ts
  - packages/acp/src/connection-manager.ts
  - packages/core/src/manager/agent-manager.ts
githubRef: "blackplume233/Actant#218"
---

**Related Issues**: [[0210-session-context-injector]], [[0211-actant-mcp-server-canvas]]
**Related Files**: `packages/core/src/context-injector/session-context-injector.ts`, `packages/mcp-server/src/index.ts`

---

## 目标

基于已实现的 `SessionContextInjector` (#210) 构建**动态工具注入系统**，使 Actant 能够在 Agent 运行期间根据上下文条件动态增减可用工具集，而非仅在 session 创建时一次性注入。

## 背景

当前 `SessionContextInjector` 在 ACP `session/new` 阶段完成 MCP Server 注入——这是**静态注入**，Agent 在整个 session 生命周期内可用工具不变。

实际场景中，工具集需要**动态演化**：

| 场景 | 触发条件 | 动态行为 |
|------|---------|---------|
| 权限升降级 | 管理员审批 / 超时收回 | 注入/移除高权限工具 |
| 任务阶段切换 | 从"分析"进入"执行" | 替换分析工具为执行工具 |
| 资源可用性 | 外部 API 恢复/中断 | 热插拔对应工具 |
| 协作上下文 | 进入多 Agent 协作流程 | 注入通信/协调工具 |
| Skill 动态加载 | 用户运行时指派新 Skill | 注入 Skill 对应的工具集 |

## 方案

### 层级架构

```
Layer 1: SessionContextInjector (已实现 #210)
  └─ 静态注入：session 创建时一次性收集 MCP Servers

Layer 2: DynamicToolInjector (本 Issue)
  └─ 动态注入：session 运行期间增减工具
  └─ 基于 EventBus 事件触发工具集变更
  └─ 通过 ACP 协议的 session/update 或 MCP server 热重载实现
```

### 核心接口设计（草案）

```typescript
interface DynamicToolProvider {
  name: string;
  evaluate(agentName: string, context: DynamicContext): ToolDelta | null;
  watchEvents: HookEventName[];
}

interface ToolDelta {
  add?: AcpMcpServerStdio[];
  remove?: string[];
  reason: string;
}
```

### 实现路径

1. 探索 ACP 协议能力：确认 ACP 是否支持 session 中途的 MCP server 热插拔
2. 如果 ACP 不支持热插拔：通过内置 MCP Server 的工具启用/禁用机制模拟
3. EventBus 集成：DynamicToolProvider 注册关注的事件，事件触发时重新评估工具集
4. 安全审计：所有工具变更需记录审计日志

## 验收标准

- [ ] DynamicToolProvider 接口定义
- [ ] 至少一个参考实现
- [ ] EventBus 驱动的重新评估机制
- [ ] 工具变更审计日志
- [ ] 单元测试覆盖核心流程

## 依赖

- #210 SessionContextInjector（已实现）
- #211 Actant MCP Server（已实现）
- ACP 协议 session 中途能力探索
