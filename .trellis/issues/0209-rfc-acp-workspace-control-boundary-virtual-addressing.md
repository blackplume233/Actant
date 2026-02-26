---
id: 209
title: "RFC: ACP Workspace Control Boundary - Virtual Addressing at ACP Layer"
status: open
labels:
  - rfc
  - architecture
  - acp
  - "priority:P2"
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 204
relatedFiles:
  - packages/acp/src/connection-manager.ts
  - packages/acp/src/connection.ts
  - docs/design/memory-layer-agent-evolution.md
taskRef: null
githubRef: "blackplume233/Actant#209"
closedAs: null
createdAt: 2026-02-26T15:00:00
updatedAt: 2026-02-26T15:00:00
closedAt: null
---

**Related Issues**: [[0204-actant-hub-default-employee-agent-templates]]
**Related Files**: `packages/acp/src/connection-manager.ts`, `packages/acp/src/connection.ts`, `docs/design/memory-layer-agent-evolution.md`

---

## 背景

当前 ACP 层对「工作空间」的理解非常轻量：`workspace = agent instance cwd`。在 `AcpConnection.newSession(cwd)` 时传入工作目录，此后所有会话操作都在这个 cwd 上下文中进行。`AcpCommunicator` 接收 `workspaceDir` 参数但实际忽略它（`_workspaceDir`），因为 session 的 cwd 已经在创建时绑定。

与此同时，`docs/design/memory-layer-agent-evolution.md` 附录 A 设计了 `ac://` 统一寻址协议，覆盖五大命名空间：

- `ac://components/` — Hub 组件（skills, prompts, workflows, mcp-servers）
- `ac://memory/` — 分层记忆系统
- `ac://assets/` — 人类委托资产（workspace, docker, repo, process...）
- `ac://records/` — 执行记录
- `ac://artifacts/` — Agent 产物

设计文档明确指出：在 Phase 5 之前，name-based resolution 是更简单正确的选择。

## 问题

需要明确 ACP 层在「工作空间控制」和「虚拟寻址」中的职责边界：

1. **ACP 层当前的工作空间控制能力**：仅在 session 创建时绑定 cwd + `ClientCallbackHandler` 拦截 fs/terminal 操作 + `PermissionPolicyEnforcer` 做 Layer 2 权限检查。这是否足够？
2. **虚拟寻址应放在哪一层**：`ac://` URI 的解析（resolve）和路由（route）应该发生在 ACP 层、Core 层、还是独立的 Resolver 服务？
3. **ACP 是否应该感知 `ac://` 协议**：当 Agent 通过 ACP 协议请求读取 `ac://memory/learnings/commit-style` 时，是 ACP 层拦截并解析，还是透传给上层？

## 分析

### 当前 ACP 层的角色定位

| 职责 | 实现位置 |
|------|---------|
| 协议传输 (stdio/socket) | `AcpConnection` |
| 会话生命周期 | `AcpConnection.newSession/closeSession` |
| 客户端回调 (fs/terminal/permissions) | `ClientCallbackRouter`, `ClientCallbackHandler` |
| 网关模式 (IDE ↔ Agent) | `AcpGateway` |
| 连接池管理 | `AcpConnectionManager` (name → connection) |

ACP 层本质是一个 **协议传输 + 回调拦截** 层，不涉及业务语义。

### 虚拟寻址放在 ACP 层的利弊

**赞成**：
- ACP 的 `ClientCallbackHandler` 已经拦截所有 Agent 的 fs 操作，是天然的拦截点
- 虚拟地址透明解析不需要 Agent 感知物理路径，安全性更好
- 与 `PermissionPolicyEnforcer` 可以深度集成（某些 namespace 需要权限检查）

**反对**：
- ACP 是传输层，加入资源解析逻辑会 **混淆关注点**
- `ac://` 的解析需要了解 Memory Store、Asset Registry、Hub 组件索引等上层状态
- 设计文档已将管理者定义为 Memory Store / Promoter / Curator，均在 Core 层
- ACP 应保持瘦协议的定位，便于未来替换底层协议实现

### 建议方案

```
Agent Process
    │
    │ ACP Protocol (stdio/socket)
    ▼
AcpConnection (传输层 — 保持不变)
    │
    │ ClientCallback
    ▼
ClientCallbackRouter
    │
    │ fs.read("ac://memory/...")  ← 识别 ac:// 前缀
    ▼
AcUriResolver (新增 — 轻量 resolver 接口)
    │
    │ delegate to registered namespace handlers
    ▼
MemoryStore / AssetRegistry / HubIndex (Core 层实现)
```

关键设计决策：
- **ACP 层只增加一个薄 resolver 分发口**：在 `ClientCallbackRouter` 中识别 `ac://` 前缀，委托给注册的 namespace handler
- **实际解析逻辑在 Core 层**：Memory Store 处理 `ac://memory/`，Asset Registry 处理 `ac://assets/` 等
- **Resolver 接口在 ACP 包定义，实现在 Core 包注入**：保持依赖方向 Core → ACP

## 验收标准

- [ ] 明确 ACP 层与 Core 层在虚拟寻址中的职责分工
- [ ] 确认是否在 `ClientCallbackRouter` 中增加 URI 前缀识别
- [ ] 确认 `AcUriResolver` 接口的归属包（acp vs core vs shared）
- [ ] 与 Memory Layer 设计文档的 Phase 5 计划保持一致
- [ ] 不破坏当前 name-based resolution 的简单性

---

## Comments

### cursor-agent — 2026-02-26T15:10:00

**注入点确认：`ClientCallbackRouter.readTextFile` / `writeTextFile`**

经代码走读确认最佳注入点是 `ClientCallbackRouter`（`packages/acp/src/callback-router.ts`），在路由决策之前拦截 `ac://` 前缀。

- 覆盖全模式（lease + local），不遗漏 IDE 路径
- `AcpConnection` 和 `localReadTextFile` 零改动
- Resolver 接口 (`AcUriResolver`) 从 Core 层注入，`ClientCallbackRouter` 通过 `setResolver()` 持有引用
- 未注入 resolver 时行为与当前完全一致（向后兼容）

详见 [GitHub Comment](https://github.com/blackplume233/Actant/issues/209#issuecomment-3966198821)
