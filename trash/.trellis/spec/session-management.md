# Session 概念与管理机制

> Actant 中有四种名称相近但语义完全不同的"session"概念。本文档用四个不同名词加以区分，以消除歧义。
> **涉及 Chat / Session 相关代码时必读。**
>
> **录制架构说明**：对话档案的写入当前由 `ActivityRecorder`（磁盘 JSONL）和 `EventJournal`（租约持久化）承担，但统一录制架构正在向 `RecordSystem`（`packages/core/src/record/`）收敛。`RecordSystem` 通过 `RecordingChannelDecorator` 在 `ActantChannel` 层拦截事件，统一处理所有录制逻辑。Phase B 重构后，`ActivityRecorder` 将作为 `RecordSystem` 的内部实现之一被收编。

---

## 四个核心名词

| 名词 | 代码对应 | 一句话定义 |
|------|---------|-----------|
| **ACP Session** | `AcpConnectionManager.getPrimarySessionId()` | Agent 进程与 Daemon 之间的 ACP 协议运行时 Session（标准 ACP 术语） |
| **对话 ID**（Conversation ID） | `conversationId` | 跨重启持久的稳定对话线索 ID，是对话档案文件的实际键名 |
| **对话档案**（Conversation Record） | `ActivityRecorder` / `agentApi.sessions()` | 写到磁盘的对话记录文件，以 `conversationId` 命名 |
| **聊天租约**（Chat Lease） | `SessionRegistry` / `sessionApi` | Dashboard/IDE 客户端申请的访问凭据，用于消息路由 |

> 四者 ID 格式相同（UUID），但含义完全不同，**不可互换**。

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
- **不再是对话档案的 ID**：过去 ACP Session ID 兼做对话档案 ID，现已由 `conversationId` 取代

---

## 对话 ID（Conversation ID）

### 是什么

跨 Agent 进程重启保持稳定的逻辑对话线索 ID（UUID）。它是 `ActivityRecorder` 写磁盘时实际使用的文件 key，决定了多次 Agent 重启后的交互记录写入同一个档案文件，而不是分裂成多个碎片。

### 两种 Archetype 的分配策略

| Archetype | 分配时机 | 存储位置 | 重启后是否变化 |
|-----------|---------|---------|-------------|
| **employee** | 首次 prompt 时由 Daemon 自动生成 | `~/.actant/instances/{name}/.actant.json` → `metadata.conversationId` | **不变**（永久唯一） |
| **service** | 创建聊天租约时生成（或由客户端指定以续接旧对话） | 内存（`SessionLease.conversationId`）+ EventJournal | 租约续接时可指定相同 ID |

### Employee 的 conversationId 持久化

```typescript
// agent-manager.ts 内部（getOrCreateEmployeeConversation）
private async getOrCreateEmployeeConversation(name: string): Promise<string> {
  const meta = this.requireAgent(name);
  if (meta.metadata?.conversationId) {
    return meta.metadata.conversationId; // 重启后复用同一 ID
  }
  const id = randomUUID();
  await updateInstanceMeta(dir, { metadata: { ...meta.metadata, conversationId: id } });
  return id;
}
```

### Service 的 conversationId 续接

```typescript
// 客户端创建新对话（不传 conversationId → 自动生成新 ID）
const lease = await sessionApi.create(agentName, clientId);
// lease.conversationId = 自动生成的 UUID

// 客户端续接旧对话（传入已有 conversationId）
const lease = await sessionApi.create(agentName, clientId, { conversationId: oldConversationId });
// lease.conversationId = oldConversationId → 历史记录续接
```

### 关键特征

- **稳定性**：employee 的 `conversationId` 跨 Agent 进程重启、Daemon 重启保持不变
- **与 ACP Session ID 无关**：每次 Agent 重启 ACP Session ID 都变，但 `conversationId` 不变
- **与聊天租约 ID 无关**：租约是临时访问凭据，`conversationId` 是对话内容的持久键
- **前端可见**：`sessionApi.prompt()` 返回值包含 `conversationId`，前端据此做历史展示

---

## 对话档案（Conversation Record）

### 是什么

以 `conversationId` 为文件名，将一次或多次 Agent 运行期间的所有交互（prompt、工具调用、文件操作）持久化到磁盘的记录。**它是"档案"，不是活跃连接。**

### 存储路径

```
~/.actant/instances/{agentName}/activity/
  {conversationId}.jsonl     ← 一个逻辑对话 = 一个档案文件（可跨多次 ACP Session）
  blobs/{prefix}/{sha256}    ← 大内容（>4KB）内容寻址存储
```

> ⚠️ **变更说明**：旧版本以 `{acp-session-id}.jsonl` 命名，每次进程重启产生新文件（对话碎片化）。现版本改用 `{conversationId}.jsonl`，实现跨重启连续。

### 谁写入

`AgentManager` 在每次 prompt 前后、`RecordingCallbackHandler` 在工具调用/流式输出时自动写入：

```typescript
// agent-manager.ts 内部：写入前先设置当前 conversationId
this.acpManager.setCurrentActivitySession(name, conversationId);
activityRecorder.record(name, conversationId, { type: "prompt_sent", ... });
// ... prompt 执行 ...
activityRecorder.record(name, conversationId, { type: "prompt_complete", ... });
this.acpManager.setCurrentActivitySession(name, null); // service 用后清除
```

### 前端读取方式

```typescript
// 列出 Agent 的所有对话档案（按 conversationId）
agentApi.sessions(name)
// → SessionSummary[] { sessionId（= conversationId）, startTs, messageCount, ... }

// 读取某个档案的对话内容
agentApi.conversation(name, conversationId)
// → ConversationTurn[]
```

### 关键特征

- **只读，仅供展示**：只能读取历史，不能向 Agent 发消息
- **永久保存**：Agent 停止后仍然存在，历史不丢失
- **`sessionId` 字段 = `conversationId`**：API 返回的 `sessionId` 实际就是 `conversationId`

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
// 申请租约（新对话）
const lease = await sessionApi.create(agentName, clientId);
// → { sessionId: "lease-uuid", conversationId: "conv-uuid", state: "active", ... }

// 申请租约（续接旧对话）
const lease = await sessionApi.create(agentName, clientId, { conversationId: "old-conv-uuid" });

// 用租约发消息
const result = await sessionApi.prompt(lease.sessionId, text);
// → { text: "...", conversationId: "conv-uuid" }
```

### 内部路由链路

```
sessionApi.prompt(leaseId, text)
    ↓
session-handlers.ts
    ├─ SessionRegistry.get(leaseId)          → 找到 agentName + conversationId
    ├─ SessionRegistry.touch(leaseId)
    └─ AgentManager.promptAgent(agentName, text, undefined, lease.conversationId)
           ├─ setCurrentActivitySession(name, conversationId)   ← 路由 recording
           └─ AcpConnectionManager.prompt(channelId, text)      ← 真正发消息
```

**租约只是路由层**：`leaseId → agentName + conversationId → ACP Session ID`。

### 关键特征

- **仅用于 `service` archetype**：`employee` 不使用租约
- **Daemon 重启后恢复**：通过 `EventJournal` 持久化，启动时重建
- **多客户端同享一个 ACP 通道**：不同客户端的租约都最终落到同一 Agent 的 primary channel
- **Agent 停止时租约自动清理**：`process:stop` / `process:crash` 事件触发 `sessionRegistry.closeByAgent()`

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
                  └─ AgentManager.promptAgent(name, text)
                         ├─ getOrCreateEmployeeConversation(name) → conversationId（持久）
                         ├─ setCurrentActivitySession(name, conversationId)
                         └─ ACP Session

返回值 result.sessionId = conversationId（用于前端历史展示）
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
           ├─ 有 active 租约 → leaseId（+ conversationId）
           └─ 无租约 → sessionApi.create() → 新 leaseId + 新 conversationId
    │         （续接旧对话：传 conversationId → 相同 conversationId → 历史续接）
    │
    └─ sessionApi.prompt(leaseId, text)   ← 通过租约路由
           └─ session.prompt RPC
                  └─ SessionRegistry 验证租约 + 取 conversationId
                         └─ AgentManager.promptAgent(name, text, _, conversationId)
                                └─ ACP Session

返回值 result.conversationId 供前端更新状态
canCreateSession = true

[租约过期自动恢复]
sessionApi.prompt 报 "not found"
→ sessionApi.create() 重建租约（保持相同 conversationId）→ 透明重试 → 用户无感知
```

---

## 四者对比

| 维度 | **ACP Session** | **对话 ID** | **对话档案** | **聊天租约** |
|------|----------------|-----------|------------|------------|
| **本质** | ACP 协议运行时 Session | 稳定逻辑对话线索 | 磁盘对话记录 | 访问凭据 |
| **谁创建** | AcpConnectionManager（自动） | AgentManager / SessionRegistry（自动） | ActivityRecorder（自动） | 前端显式申请 |
| **生命周期** | Agent 进程存活期 | **永久**（employee）/ 租约绑定（service） | 永久 | ≤30 分钟 idle |
| **存储** | 内存 | 内存 + 磁盘（employee）/ 内存 + Journal（service） | 磁盘 JSONL | 内存 + EventJournal |
| **前端可见** | 否 | 是（包含在 prompt 返回值） | 是（只读） | 是（读写） |
| **用于发消息** | 是（内部） | 否 | 否 | 是（service） |
| **Archetype** | 全部 | 全部 | 全部 | 仅 service |
| **重启后** | 变化 | **不变**（employee）/ 可续接（service） | 不变 | 重建 |

---

## ID 速查：这个 UUID 是什么？

| 来源 | ID 类型 |
|------|--------|
| `agentApi.sessions(name)` → `[].sessionId` | **对话 ID**（= conversationId） |
| `agentApi.conversation(name, sid)` 的 `sid` | **对话 ID**（= conversationId） |
| `agentApi.prompt(name, text)` → `.sessionId` | **对话 ID**（= conversationId） |
| `sessionApi.create()` → `.sessionId` | **聊天租约 ID** |
| `sessionApi.create()` → `.conversationId` | **对话 ID** |
| `sessionApi.list()` → `[].sessionId` | **聊天租约 ID** |
| `sessionApi.list()` → `[].conversationId` | **对话 ID** |
| `sessionApi.prompt(sid)` 的 `sid` 参数 | **聊天租约 ID** |
| `sessionApi.prompt()` → `.conversationId` | **对话 ID** |
| `AcpConnectionManager.getPrimarySessionId(name)` | **ACP Session ID**（≠ 对话 ID）|

---

## 常见错误

### 错误 1：用对话档案 ID 当聊天租约发消息

```typescript
// ❌ agentApi.prompt() 返回的 sessionId 是对话 ID，不是租约 ID
const result = await agentApi.prompt(name, text);
setSessionId(result.sessionId);     // 这是对话 ID！
setSessionState("active");          // 错误地标记为"有活跃租约"

// 下次发消息：
const sid = await ensureSession();  // 返回了这个对话 ID
await sessionApi.prompt(sid, text); // 💥 "Session not found" — 没有这个租约
```

**根因**：`employee` 的 `ensureSession()` 必须永远返回 `""`，使消息路由走 `agentApi.prompt()`，永不触碰 `sessionApi`。

### 错误 2：用聊天租约 ID 查历史对话

```typescript
// ❌ agentApi.conversation() 查的是对话档案，租约 ID 不是 conversationId
const lease = await sessionApi.create(name, clientId);
await agentApi.conversation(name, lease.sessionId); // 💥 找不到档案

// ✅ 应使用 conversationId
await agentApi.conversation(name, lease.conversationId); // ✅
```

### 错误 3：租约过期后直接抛错给用户

```typescript
// ❌ 租约 30 分钟 idle 后自动过期，不应把错误直接暴露
await sessionApi.prompt(leaseId, text); // 报 "not found"
// → 用户看到 "Session xxx not found"

// ✅ service 类型应自动重建租约重试（并保持同一 conversationId）
try {
  result = await sessionApi.prompt(leaseId, text);
} catch (err) {
  if (err.message.includes("not found") && config.canCreateSession) {
    const fresh = await sessionApi.create(name, CLIENT_ID, { conversationId });
    result = await sessionApi.prompt(fresh.sessionId, text);
  }
}
```

### 错误 4：认为 employee 每次重启产生新对话记录

```typescript
// ❌ 旧版本行为（已修复）：ACP Session ID 每次重启都变 → 产生新 .jsonl 文件 → 对话碎片化
// ✅ 当前行为：conversationId 存在 .actant.json 中，跨重启不变 → 一个文件记录全部历史

// 验证方式：查看 .actant.json
// ~/.actant/instances/{name}/.actant.json → metadata.conversationId
```

### 错误 5：service 续接对话时忘记传 conversationId

```typescript
// ❌ 重连时未传 conversationId → 创建新对话，丢失上下文
const lease = await sessionApi.create(agentName, clientId);
// lease.conversationId = 全新 UUID → 前端展示空对话历史

// ✅ 续接时传入已有 conversationId
const lease = await sessionApi.create(agentName, clientId, { conversationId: prevConversationId });
// lease.conversationId = prevConversationId → 历史记录续接
```

---

## 参考实现

| 概念 | 核心实现 |
|------|---------|
| ACP 通道 | `packages/acp/src/acp-connection-manager.ts` |
| 对话 ID（employee 持久化） | `packages/core/src/manager/agent-manager.ts` → `getOrCreateEmployeeConversation()` |
| 对话 ID（service 分配） | `packages/core/src/session/session-registry.ts` → `create()` |
| 对话档案（Recording） | `packages/acp/src/recording-handler.ts` + `packages/core/src/activity/activity-recorder.ts` |
| Recording 路由切换 | `AcpConnectionManager.setCurrentActivitySession()` |
| 聊天租约 | `packages/core/src/session/session-registry.ts` |
| 租约 API Handlers | `packages/api/src/handlers/session-handlers.ts` |
| Agent Prompt Handler | `packages/api/src/handlers/agent-handlers.ts` |
| 对话档案 Handlers | `packages/api/src/handlers/activity-handlers.ts` |
| 前端 Session 逻辑 | `packages/dashboard/client/src/pages/agent-chat.tsx` |
| 前端 API 客户端 | `packages/dashboard/client/src/lib/api.ts` |
