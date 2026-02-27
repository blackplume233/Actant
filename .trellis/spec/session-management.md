# Session 概念与管理机制

> Actant 中有三种名称相近但语义完全不同的"session"概念。本文档用三个不同名词加以区分，以消除歧义。
> **涉及 Chat / Session 相关代码时必读。**

---

## 三个核心名词

| 名词 | 代码对应 | 一句话定义 |
|------|---------|-----------|
| **ACP Session** | `AcpConnectionManager.getPrimarySessionId()` | Agent 进程与 Daemon 之间的 ACP 协议运行时 Session（标准 ACP 术语） |
| **对话档案**（Conversation Record） | `ActivityRecorder` / `agentApi.sessions()` | 写到磁盘的对话记录文件，一次 Agent 启动对应一个 |
| **聊天租约**（Chat Lease） | `SessionRegistry` / `sessionApi` | Dashboard/IDE 客户端申请的访问凭据，用于消息路由 |

> 三者 ID 格式相同（UUID），但含义完全不同，**不可互换**。

---

## ACP Session

### 是什么

Agent 子进程通过 ACP bridge 连接到 Daemon 时建立的 ACP 协议 Session。每个运行中的 Agent 有一个 **primary session ID**，由 `AcpConnectionManager` 持有。这是 ACP 协议的标准概念，与 ACP 规范文档中的 session 术语对应。

### 生命周期

- **创建**：`agent start` 后，ACP bridge 子进程与 Daemon 完成握手
- **销毁**：Agent 进程退出或被 stop
- **Agent 重启即换新 ID**

### 如何使用（内部）

```typescript
// AgentManager 内部，不对外暴露
const conn = this.acpManager.getConnection(name);
const sessionId = this.acpManager.getPrimarySessionId(name);  // ACP primary session ID
await conn.prompt(sessionId, message);  // 向 Agent 发消息
```

### 关键特征

- **不暴露给前端**：纯 Daemon 内部概念
- **同时也是对话档案的 ID**：`ActivityRecorder` 用这个 ID 命名 JSONL 文件

---

## 对话档案（Conversation Record）

### 是什么

以 ACP 通道 ID 为文件名，将一次 Agent 运行期间的所有交互（prompt、工具调用、文件操作）持久化到磁盘的记录。**它是"档案"，不是活跃连接。**

### 存储路径

```
~/.actant/instances/{agentName}/activity/
  {acp-session-id}.jsonl     ← 一个 ACP Session = 一个档案文件
  blobs/{prefix}/{sha256}    ← 大内容（>4KB）内容寻址存储
```

### 谁写入

`AgentManager` 在每次 prompt 前后自动写入：

```typescript
// agent-manager.ts 内部，无需手动调用
activityRecorder.record(name, acpSessionId, { type: "prompt_sent", ... });
activityRecorder.record(name, acpSessionId, { type: "prompt_complete", ... });
```

### 前端读取方式

```typescript
// 列出 Agent 的所有对话档案
agentApi.sessions(name)
// → SessionSummary[] { sessionId（= channelId）, startTs, messageCount, ... }

// 读取某个档案的对话内容
agentApi.conversation(name, sessionId)
// → ConversationTurn[]
```

### 关键特征

- **只读，仅供展示**：只能读取历史，不能向 Agent 发消息
- **永久保存**：Agent 停止后仍然存在，历史不丢失
- **`sessionId` 字段 = ACP Session ID**：两者是同一个值，但角色不同（一个是运行时 ACP Session，一个是磁盘档案的 key）

---

## 聊天租约（Chat Lease）

### 是什么

Dashboard 或 IDE 客户端向 Daemon 申请的访问凭据。**租约本身不是对话，而是"谁有权向哪个 Agent 发消息"的授权记录。** `SessionRegistry` 管理所有租约。

### 生命周期

```
申请（active）
    │
    ├── 持续交互 → touch() → 维持 active
    │
    ├── 客户端离开 → release() → idle
    │       │
    │       ├── 30 分钟内重连 → resume() → active
    │       └── 30 分钟无活动 → sweepExpired() → 自动删除
    │
    └── 显式关闭 → close() → 从 Registry 删除
```

### 前端使用方式（service archetype）

```typescript
// 申请租约
const lease = await sessionApi.create(agentName, clientId);
// → { sessionId: "lease-uuid", state: "active", idleTtlMs: 1800000, ... }

// 用租约发消息
await sessionApi.prompt(lease.sessionId, text);
```

### 内部路由链路

```
sessionApi.prompt(leaseId, text)
    ↓
session-handlers.ts
    ├─ SessionRegistry.get(leaseId)     → 找到 agentName
    ├─ SessionRegistry.touch(leaseId)
    └─ AgentManager.promptAgent(agentName, text)
           └─ AcpConnectionManager.prompt(channelId, text)  ← 真正发消息
```

**租约只是路由层**：`leaseId → agentName → ACP Session ID`。最终还是走 ACP Session。

### 关键特征

- **仅用于 `service` archetype**：`employee` 不使用租约
- **Daemon 重启后恢复**：通过 `EventJournal` 持久化，启动时重建
- **多客户端同享一个 ACP 通道**：不同客户端的租约都最终落到同一 Agent 的 primary channel（当前无 per-client 隔离）
- **Agent 停止时租约自动清理**：`process:stop` / `process:crash` 事件触发 `sessionRegistry.closeByAgent()`，覆盖手动 stop、进程崩溃、Budget KeepAlive 到期三种路径

### 聊天租约何时失效

| 原因 | 触发方 | 前端是否可自动恢复 |
|------|--------|-----------------|
| 30 分钟 idle TTL | SessionRegistry 定时扫描 | ✅ 是（Agent 仍运行 → 创建新租约重试） |
| Agent 手动 stop | `handleAgentStop` + `process:stop` 事件 | ❌ 否（`isRunning=false` → 直接报错） |
| Agent 进程崩溃 | `process:crash` 事件 | ❌ 否（需等 Agent 重启后用户重发） |
| Budget keepAlive 到期（1h/24h） | `SystemBudgetManager` | ❌ 否（需用户手动重启 Agent） |
| Daemon 重启 | Journal 重建，但 ACP Session 已断 | ❌ 否（所有租约陈旧） |

**前端 recovery 判断逻辑**：`sessionApi.prompt` 返回 "not found" 时：
- `isRunning = true` → 创建新租约重试（idle TTL 过期场景）
- `isRunning = false` → 抛出错误，提示用户先启动 Agent

---

## 按 Archetype 的消息路由

### employee

```
前端 handleSend()
    │
    └─ agentApi.prompt(name, text)        ← 直接路由，无租约
           └─ agent.prompt RPC
                  └─ AgentManager.promptAgent()
                         └─ ACP Session

前端 sessionId 状态 = 对话档案 ID（仅用于历史展示，不参与路由）
canCreateSession = false
ensureSession() 始终返回 "" → 永远走 agentApi.prompt 路径
```

**为什么 employee 不用租约：**
- Employee 是长驻进程，ACP Session 由 Daemon 全权管理
- Dashboard 是"观察者 + 交互者"，无需独占控制权
- 直接 prompt 更简洁，不需要额外的访问控制层

### service

```
前端 handleSend()
    │
    └─ ensureSession()
           ├─ 有 active 租约 → leaseId
           └─ 无租约 → sessionApi.create() → 新 leaseId
    │
    └─ sessionApi.prompt(leaseId, text)   ← 通过租约路由
           └─ session.prompt RPC
                  └─ SessionRegistry 验证租约
                         └─ AgentManager.promptAgent()
                                └─ ACP Session

前端 sessionId 状态 = 聊天租约 ID（用于路由 + 展示）
canCreateSession = true

[租约过期自动恢复]
sessionApi.prompt 报 "not found"
→ sessionApi.create() 重建租约 → 透明重试 → 用户无感知
```

---

## 三者对比

| 维度 | **ACP Session** | **对话档案** | **聊天租约** |
|------|----------------|------------|------------|
| **本质** | ACP 协议运行时 Session | 磁盘对话记录 | 访问凭据 |
| **谁创建** | AcpConnectionManager（自动） | ActivityRecorder（自动） | 前端显式申请 |
| **生命周期** | Agent 进程存活期 | 永久 | ≤30 分钟 idle |
| **存储** | 内存 | 磁盘 JSONL | 内存 + EventJournal |
| **前端可见** | 否 | 是（只读） | 是（读写） |
| **用于发消息** | 是（内部） | 否 | 是（service） |
| **Archetype** | 全部 | 全部 | 仅 service |

---

## ID 速查：这个 UUID 是什么？

| 来源 | ID 类型 |
|------|--------|
| `agentApi.sessions(name)` → `[].sessionId` | **对话档案 ID** |
| `agentApi.conversation(name, sid)` 的 `sid` | **对话档案 ID** |
| `agentApi.prompt(name, text)` → `.sessionId` | **对话档案 ID**（= ACP 通道 ID） |
| `sessionApi.create()` → `.sessionId` | **聊天租约 ID** |
| `sessionApi.list()` → `[].sessionId` | **聊天租约 ID** |
| `sessionApi.prompt(sid)` 的 `sid` 参数 | **聊天租约 ID** |
| `AcpConnectionManager.getPrimarySessionId(name)` | **ACP Session ID**（= 对话档案 ID）|

---

## 常见错误

### 错误 1：用对话档案 ID 当聊天租约发消息

```typescript
// ❌ agentApi.prompt() 返回的是对话档案 ID，不是租约 ID
const result = await agentApi.prompt(name, text);
setSessionId(result.sessionId);     // 这是对话档案 ID！
setSessionState("active");          // 错误地标记为"有活跃租约"

// 下次发消息：
const sid = await ensureSession();  // 返回了这个档案 ID
await sessionApi.prompt(sid, text); // 💥 "Session not found" — 没有这个租约
```

**根因**：`employee` 的 `ensureSession()` 必须永远返回 `""`，使消息路由走 `agentApi.prompt()`，永不触碰 `sessionApi`。

### 错误 2：用聊天租约 ID 查历史对话

```typescript
// ❌ agentApi.conversation() 查的是对话档案，租约 ID 不是档案 key
const lease = await sessionApi.create(name, clientId);
await agentApi.conversation(name, lease.sessionId); // 💥 找不到档案
```

### 错误 3：租约过期后直接抛错给用户

```typescript
// ❌ 租约 30 分钟 idle 后自动过期，不应把错误直接暴露
await sessionApi.prompt(leaseId, text); // 报 "not found"
// → 用户看到 "Session xxx not found"

// ✅ service 类型应自动重建租约重试
try {
  result = await sessionApi.prompt(leaseId, text);
} catch (err) {
  if (err.message.includes("not found") && config.canCreateSession) {
    const fresh = await sessionApi.create(name, CLIENT_ID);
    result = await sessionApi.prompt(fresh.sessionId, text);
  }
}
```

---

## 参考实现

| 概念 | 核心实现 |
|------|---------|
| ACP 通道 | `packages/acp/src/acp-connection-manager.ts` |
| 对话档案 | `packages/core/src/activity/activity-recorder.ts` |
| 聊天租约 | `packages/core/src/session/session-registry.ts` |
| 租约 API Handlers | `packages/api/src/handlers/session-handlers.ts` |
| Agent Prompt Handler | `packages/api/src/handlers/agent-handlers.ts` |
| 对话档案 Handlers | `packages/api/src/handlers/activity-handlers.ts` |
| 前端 Session 逻辑 | `packages/dashboard/client/src/pages/agent-chat.tsx` |
| 前端 API 客户端 | `packages/dashboard/client/src/lib/api.ts` |
