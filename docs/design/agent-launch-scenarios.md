# Agent 启动场景与 ACP 架构

> 定义 AgentCraft 的 7 种 Agent 启动/交互场景，以及核心架构原则。
> **本文档是 [接口契约](../../.trellis/spec/api-contracts.md) 和 [Agent 生命周期](../../.trellis/spec/agent-lifecycle.md) 的补充设计文档。**

---

## 核心架构原则

### ACP Gateway：极简 Session 路由器

ACP Gateway 的唯一职责是**按 sessionId 做消息转发**，不理解也不修改 ACP 消息内容：

- 上游 Client 发消息 → Gateway 根据消息中的 sessionId 转发到下游 Agent
- 下游 Agent 发通知 → Gateway 根据 sessionId 路由回对应的上游 Client
- Gateway 本身**无状态处理逻辑**，只维护 `sessionId → upstream Client` 的映射表

### 多 ACP Client 并行结构

所有 ACP Client 是**并行的 peers**，地位平等，独立连接 Gateway：

```
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ IDE          │  │ Claude       │  │ Terminal     │  │ Web UI       │
  │ (外部ACP     │  │ Desktop      │  │ (agent chat  │  │ (WebSocket   │
  │  Client      │  │ (外部ACP     │  │  内置ACP     │  │  ACP Client) │
  │  via Proxy)  │  │  Client      │  │  Client)     │  │              │
  └──────┬───────┘  │  via Proxy)  │  └──────┬───────┘  └──────┬───────┘
         │          └──────┬───────┘         │                 │
         │                 │                 │                 │
         │ ACP             │ ACP             │ ACP             │ ACP
         │                 │                 │                 │
         └────────┬────────┴────────┬────────┴────────┬────────┘
                  │                                   │
                  ▼                                   ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                    ACP Gateway                                │
  │                                                               │
  │   sessionId → upstream Client 映射表                          │
  │                                                               │
  │   上行: Client msg (含 sessionId) ──→ 转发到 Agent            │
  │   下行: Agent notification (含 sessionId) ──→ 路由回 Client   │
  │                                                               │
  │   不解析消息内容，不做业务逻辑，只做路由                          │
  └──────────────────────────┬───────────────────────────────────┘
                             │ ACP / stdio（唯一连接）
                             ▼
                      ┌──────────────┐
                      │ Agent 子进程  │
                      │ (claude-     │
                      │  agent-acp)  │
                      └──────────────┘
```

**关键设计约束**：

1. **Gateway 极简**：只做 session 路由，不做消息解析/转换/拦截
2. **Client 并行**：Proxy(IDE)、Chat、Web UI、IM Adapter 都是独立的 ACP Client，互不依赖
3. **Proxy 是 Client 的 transport**：Proxy 不是 Gateway 的一部分，它是外部 ACP Client 的 transport 层（stdio ↔ socket）
4. **Chat 与 Proxy 同级**：agent chat 内置的 ACP Client 和 Proxy 转发来的外部 ACP Client 地位完全平等

### 两层协议分工

| 协议层 | 传输 | 用途 | 场景 |
|--------|------|------|------|
| **JSON-RPC** | Unix socket, request/response | 管理操作：create/start/stop/list/resolve/attach/detach | 所有场景 |
| **ACP** | Unix socket (上游) / stdio (下游), streaming | 实时交互：prompt/stream/cancel/notifications | 场景 2-5, 8-9 |

RPC 层处理管理操作，ACP Gateway 层处理实时交互。**不存在"用 RPC 传 ACP 消息"的错位。**

---

## 启动模式（LaunchMode）

| LaunchMode | 进程退出时 | Daemon 重启恢复 | 典型场景 |
|---|---|---|---|
| `direct` | mark-stopped | mark-stopped | 打开 IDE（如 Cursor） |
| `acp-background` | mark-stopped | mark-stopped | 后台 ACP agent |
| `acp-service` | **restart**（按 RestartPolicy） | **restart** | 长期运行的服务 agent |
| `one-shot` | destroy（如 autoDestroy） | mark-stopped | 一次性任务 |

---

## 七种启动/交互场景

### 场景 1: One-shot 任务（脚本/CI 调用）

```
命令：agentcraft agent run my-agent --prompt "review this PR"
```

```
┌──────────┐     ┌───────────────────────────────────────┐     ┌──────────────┐
│  CLI     │─RPC→│  Core                                 │     │ Agent 子进程  │
│ (agent   │     │                                       │     │ (临时)       │
│  run)    │     │  spawn agent → prompt → collect → kill│────→│ claude -p    │
└──────────┘     └───────────────────────────────────────┘     └──────────────┘
```

| 属性 | 值 |
|------|---|
| LaunchMode | `one-shot` |
| 需要 ACP Gateway | 否（走 RPC request/response 即可） |
| ACP 连接 owner | Core（临时，任务结束即销毁） |
| 流式输出 | 否（等完整结果） |
| 复用运行中 agent | 可选（如 agent 已 start，优先走 ACP 连接） |

**适用场景**：CI/CD 集成、脚本批量调用、一次性代码审查。

---

### 场景 2: 长驻服务（agent start）

```
命令：agentcraft agent start my-agent
```

```
┌───────────────────────────────────────────────────┐
│  Core (Daemon)                                    │
│                                                   │
│  spawn(claude-agent-acp) → initialize → newSession│
│                                                   │
│  AcpConnection ────ACP/stdio────→ Agent 子进程     │
│     ↑                              (长驻运行)      │
│  ACP Gateway (等待 Client 接入)                     │
│     ↑                                             │
│  [目前无人连接，agent 就绪等待]                       │
└───────────────────────────────────────────────────┘
```

| 属性 | 值 |
|------|---|
| LaunchMode | `acp-service`（自动重启）或 `acp-background`（不重启） |
| 需要 ACP Gateway | 是（建立，等待 Client 接入） |
| ACP 连接 owner | **Core** |
| Core 角色 | 持有 AcpConnection，管理 Agent 生命周期 |

**适用场景**：需要持续在线的 agent（监控、客服、内容生成等）。这是场景 3、4、5 的前提。

---

### 场景 3: 交互式聊天（agent chat）

```
命令：agentcraft agent chat my-agent
```

```
┌────────────────┐
│   Terminal     │
│                │
│  you> ...      │  readline 输入
│  agent> ...    │  流式 chunk 输出
│  [tool: ...]   │  实时通知渲染
│  ^C            │  cancel 支持
└───────┬────────┘
        │
┌───────▼────────┐
│ 内置 ACP Client│  (agent chat 进程内)
└───────┬────────┘
        │ ACP / Unix socket (streaming)
        ▼
┌───────────────────────────────┐
│  Core (ACP Gateway)           │
│                               │
│  Session N (chat) ──┐         │
│                     ├ 多路复用 │
│  (其他 Session) ────┘         │
│         │                     │
│  AcpConnection                │
└─────────┬─────────────────────┘
          │ ACP / stdio
          ▼
┌──────────────────┐
│  Agent 子进程     │
└──────────────────┘
```

| 属性 | 值 |
|------|---|
| 前提 | Agent 已通过 `agent start` 运行（或 chat 自动触发 start） |
| 需要 ACP Gateway | 是（接入） |
| ACP 连接 owner | Core |
| Client 类型 | 内置简易 ACP Client |
| 流式输出 | 是（逐 chunk 渲染） |
| 取消支持 | Ctrl+C → `cancel(sessionId)` |
| 实时通知 | tool_call、agent_message_chunk 等 |

**适用场景**：开发调试、人机对话、手动任务分派。

**终端交互效果**：

```
you> 分析这个视频的内容
agent> [tool: fetch_video_info]        ← sessionUpdate 实时通知
agent> [tool: analyze_transcript]
agent> 这个视频讲了...                  ← 逐 chunk 流式输出
       内容涵盖了...
       总结来说...
you> ^C                                ← cancel 当前 prompt
```

---

### 场景 4: 外部 UE 通过 Proxy 连接

```
命令（MCP/ACP config 或手动）：agentcraft proxy my-agent
```

```
┌──────────────────┐
│  IDE (Cursor /   │
│  Claude Desktop) │
│  自带 ACP Client │
└───────┬──────────┘
        │ ACP / stdio
┌───────▼──────────┐
│  Proxy           │  薄层：stdio ↔ socket 转发
└───────┬──────────┘
        │ ACP / Unix socket
        ▼
┌───────────────────────────────┐
│  Core (ACP Gateway)           │
│                               │
│  Session M (IDE) ───┐         │
│                     ├ 多路复用 │
│  (其他 Session) ────┘         │
│         │                     │
│  AcpConnection                │
└─────────┬─────────────────────┘
          │ ACP / stdio
          ▼
┌──────────────────┐
│  Agent 子进程     │
└──────────────────┘
```

| 属性 | 值 |
|------|---|
| 前提 | 同场景 3，Agent 需已运行 |
| Proxy 角色 | 纯 transport 转换（stdio ↔ Unix socket），不理解 ACP 消息内容 |
| ACP 能力 | IDE 自带完整 ACP Client，拥有全部能力 |
| 与场景 3 关系 | 可共存（同一 agent 的不同 session） |

**适用场景**：IDE 集成、Claude Desktop 连接、第三方 ACP Client。

---

### 场景 5: 多 Client 同时连接

多个 ACP Client 作为 **并行 peers** 同时接入 Gateway，互不依赖：

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Cursor IDE   │  │ Claude       │  │ Terminal     │
│ 外部ACP Client│  │ Desktop      │  │ agent chat   │
│ (via Proxy)  │  │ 外部ACP Client│  │ 内置ACP Client│
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │ ACP/socket      │ ACP/socket      │ ACP/socket
       │                 │                 │
       ▼                 ▼                 ▼         ← 三个并行 peer
┌──────────────────────────────────────────┐
│  ACP Gateway (极简 session 路由器)        │
│                                          │
│  Session 1 → Client A (Cursor)           │
│  Session 2 → Client B (Desktop)          │  ← 只维护 sessionId 映射
│  Session 3 → Client C (chat)             │
│                                          │
└────────────────┬─────────────────────────┘
                 │ ACP / stdio
                 ▼
┌──────────────────────────────────────────┐
│  Agent 子进程 (claude-agent-acp)          │
│  Session 1, 2, 3 并行处理                 │
└──────────────────────────────────────────┘
```

| 属性 | 值 |
|------|---|
| 前提 | Agent 已运行，Core 持有 AcpConnection |
| Gateway 行为 | 只做 sessionId 路由，不解析消息内容 |
| Client 关系 | **并行 peers**，互不依赖，任一 Client 断开不影响其他 |
| 隔离性 | 每个 Client 独立 Session，互不干扰 |
| 限制 | 取决于 Agent 子进程的多 Session 并发能力 |

**适用场景**：IDE 保持连接的同时在终端快速发指令、多人协作使用同一 agent。

---

### 场景 6: Direct 模式（打开 IDE，无 ACP）

```
命令：agentcraft agent start my-agent  (template backendType: "cursor")
```

```
┌───────────────────────────────────┐
│  Core                             │
│                                   │
│  spawn("cursor", [workspaceDir])  │──→  Cursor IDE 窗口打开
│  watch(pid)                       │     用户直接在 IDE 里操作
│                                   │
│  无 AcpConnection                 │
└───────────────────────────────────┘
```

| 属性 | 值 |
|------|---|
| LaunchMode | `direct` |
| ACP 连接 | 无 |
| Core 角色 | 仅进程监控（watch pid，退出处理） |
| 可用交互 | 无 chat/proxy 可能 |

**适用场景**：用户想让 AgentCraft 管理 Cursor IDE 的启停。

---

### 场景 7: 外部自管理（resolve + attach）

```
调用方：IDE 插件 / 编排器 / 第三方平台
```

**步骤 1: resolve — 获取 spawn 信息**

```
┌──────────────────┐         ┌───────────────┐
│  外部调用方       │──RPC──→│  Core          │
│                  │  agent  │               │
│                  │ .resolve│  返回:        │
│                  │←────────│  { command,   │
│                  │         │    args,      │
│                  │         │    cwd,       │
│                  │         │    env }      │
└──────────────────┘         └───────────────┘
```

**步骤 2: 外部自己 spawn + 自己持有 ACP 连接**

```
┌──────────────────────────────────────────────┐
│  外部调用方                                   │
│                                              │
│  child = spawn(command, args, { cwd })       │
│  conn = new ClientSideConnection(...)        │
│  conn.initialize() → conn.newSession()       │
│  conn.prompt(sessionId, "...")               │
│                                              │
│  ↕ ACP / stdio                               │
│  ┌──────────────────────┐                    │
│  │  Agent 子进程         │                    │
│  │  (claude-agent-acp)  │                    │
│  └──────────────────────┘                    │
└──────────────────────────────────────────────┘
```

**步骤 3: attach — 注册到 Core**

```
┌──────────────────┐         ┌───────────────────────┐
│  外部调用方       │──RPC──→│  Core                  │
│                  │  agent  │  记录 pid             │
│                  │ .attach │  processOwnership:    │
│                  │ (name,  │    "external"         │
│                  │  pid)   │  watch(pid) 监控存活   │
└──────────────────┘         └───────────────────────┘
```

**步骤 4: detach — 退出清理**

```
┌──────────────────┐         ┌───────────────────────┐
│  外部调用方       │──RPC──→│  Core                  │
│  (终止 agent,    │  agent  │  unwatch(pid)         │
│   关闭 ACP 连接) │ .detach │  status → stopped     │
└──────────────────┘         └───────────────────────┘
```

| 属性 | 值 |
|------|---|
| LaunchMode | 由外部决定 |
| ACP 连接 owner | **外部调用方**（Core 不在 ACP 路径中） |
| Core 角色 | 仅 pid 监控（attach/detach/watch） |
| processOwnership | `external` |
| 进程意外退出 | 标记为 `crashed`，**不重启**（Core 不拥有进程） |
| Core 可观测性 | 最低：只知道 pid 是否存活 |

**适用场景**：IDE 插件自管理 ACP 生命周期、编排平台管理 agent 进程、测试框架需要完全控制。

---

## 场景对比总结

### 按架构层映射

```
                  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
                  │ RPC 层  │  │ACP Gateway│  │ 外部直连  │  │ 无连接   │
                  │(req/res)│  │(streaming)│  │ACP(自管理)│  │(仅进程)  │
                  └────┬────┘  └────┬──────┘  └────┬─────┘  └────┬─────┘
                       │           │              │              │
1. one-shot run   ─────●           │              │              │
2. agent start    ─────────────────●              │              │
3. agent chat     ─────────────────●              │              │
4. proxy          ─────────────────●              │              │
5. 多 Client      ─────────────────●              │              │
6. direct IDE     ─────────────────────────────────────────────────●
7. external spawn ─────●───────────────────────────●              │
                  (resolve/                   (外部自持
                   attach/                    AcpConnection)
                   detach)
```

### 属性对比表

| 场景 | LaunchMode | ACP 连接 owner | Core 角色 | 流式 | 多 Client |
|------|-----------|:---:|---|:---:|:---:|
| 1. one-shot | `one-shot` | Core (临时) | 执行+销毁 | 否 | N/A |
| 2. start | `acp-service/background` | **Core** | 持有连接，等待 Client | — | — |
| 3. chat | 依赖 2 | Core | ACP Gateway, session 路由 | **是** | **是** |
| 4. proxy | 依赖 2 | Core | ACP Gateway, session 路由 | **是** | **是** |
| 5. 多 Client | 依赖 2 | Core | ACP Gateway, 多路复用 | **是** | **是** |
| 6. direct | `direct` | 无 | 仅进程监控 | N/A | N/A |
| 7. external | 由外部决定 | **外部调用方** | 仅 pid 监控 | 外部决定 | 外部决定 |

### 控制权谱系

```
AgentCraft 全权 ◄─────────────────────────────────────────► 调用方全权

  agent.run      ACP Gateway       Self-spawn+Attach       纯 resolve
  (Core全管)     (Core管连接,      (调用方管进程+ACP,       (只要workspace
                  Client管交互)     attach注册状态)          信息,不注册)
```

---

### 场景 8: AgentCraft Web UI（前端管理+交互界面）

```
未来：AgentCraft 提供专有 Web UI
```

```
┌──────────────────────────────────────┐
│  浏览器 (AgentCraft Web UI)          │
│                                      │
│  ┌─────────────────┐  ┌───────────┐ │
│  │ 管理面板         │  │ 聊天窗口  │ │
│  │ Agent 列表/启停  │  │ 流式对话  │ │
│  │ Template 管理    │  │ 工具状态  │ │
│  │ 日志/监控        │  │ 取消操作  │ │
│  └────────┬────────┘  └─────┬─────┘ │
│           │                 │        │
│      REST API          WebSocket     │
│      (管理操作)        (实时交互)     │
└───────────┬─────────────────┬────────┘
            │                 │
            │ HTTP            │ WebSocket
            ▼                 ▼
┌───────────────────────────────────────┐
│  AgentCraft Core                      │
│                                       │
│  ┌──────────────┐  ┌───────────────┐ │
│  │ HTTP API     │  │ WebSocket     │ │
│  │ Server       │  │ Server        │ │
│  │ (REST)       │  │ (ACP-like)    │ │
│  └──────┬───────┘  └───────┬───────┘ │
│         │                  │          │
│         │    ┌─────────────┘          │
│         ▼    ▼                        │
│  ┌────────────────┐                   │
│  │ ACP Gateway    │                   │
│  │ Session N (UI) │                   │
│  └────────┬───────┘                   │
│           │                           │
│     AcpConnection                     │
└───────────┬───────────────────────────┘
            │ ACP / stdio
            ▼
     Agent 子进程
```

| 属性 | 值 |
|------|---|
| 管理操作 | HTTP REST API（映射到现有 RPC 方法） |
| 实时交互 | WebSocket，承载 ACP-like 消息（sessionUpdate 推送、流式 chunk） |
| 本质 | Web UI 是另一种 ACP Client，只是 transport 从 Unix socket 变为 WebSocket |
| 前提 | Agent 已运行（`agent start`） |

**与其他场景的关系**：Web UI 和 Terminal chat、IDE proxy 可以同时连接同一 Agent——它们都是 Core ACP Gateway 的不同上游 Client，分配不同 Session。

**适用场景**：
- 可视化 Agent 管理面板（启停、状态监控、日志查看）
- Web 端 Agent 聊天界面（带流式输出和工具调用可视化）
- 团队协作管理多个 Agent

---

### 场景 9: Docker 部署 + IM 通过 HTTP 接入

```
生产部署：AgentCraft Core 运行在 Docker 容器中，外部 IM 通过 HTTP API 交互
```

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  企业微信         │  │  Slack           │  │  Telegram        │
│  Webhook Bot     │  │  Bot             │  │  Bot             │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         │ HTTP POST           │ HTTP POST            │ HTTP POST
         │ (消息回调)           │ (消息回调)            │ (消息回调)
         └─────────┬───────────┴──────────┬───────────┘
                   ▼                      ▼
┌──────────────────────────────────────────────────────┐
│  Docker Container                                     │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  AgentCraft Core                                 │ │
│  │                                                  │ │
│  │  ┌──────────────────┐  ┌──────────────────────┐ │ │
│  │  │ HTTP API Server  │  │ IM Adapter Layer     │ │ │
│  │  │ (REST + Webhook) │  │                      │ │ │
│  │  │                  │  │ 企业微信 adapter     │ │ │
│  │  │ POST /message    │→│ Slack adapter        │ │ │
│  │  │ GET  /agents     │  │ Telegram adapter     │ │ │
│  │  │ POST /agents/:id │  │ (消息格式转换)       │ │ │
│  │  │      /prompt     │  │                      │ │ │
│  │  └──────────────────┘  └──────────┬───────────┘ │ │
│  │                                   │              │ │
│  │                        ┌──────────▼───────────┐ │ │
│  │                        │ ACP Gateway           │ │ │
│  │                        │ Session per IM user   │ │ │
│  │                        └──────────┬───────────┘ │ │
│  │                                   │              │ │
│  │                             AcpConnection        │ │
│  │                                   │              │ │
│  └───────────────────────────────────┼──────────────┘ │
│                                      │                 │
│                               Agent 子进程              │
│                               (claude-agent-acp)       │
└──────────────────────────────────────────────────────┘
```

| 属性 | 值 |
|------|---|
| 部署方式 | Docker 容器（Core + Agent 子进程同容器或编排） |
| 外部接入 | HTTP API（REST 接收消息 + Webhook 回调） |
| 消息模型 | IM 消息 → IM Adapter 转换 → ACP prompt；ACP response → Adapter 转换 → IM 回复 |
| Session 映射 | 每个 IM 用户/群映射一个 ACP Session，支持多轮上下文 |
| 流式输出 | 取决于 IM 平台能力（部分支持分段发送，部分只能完整回复） |

**HTTP API 设计要点**：

```
管理类（同步 REST）:
  GET    /api/agents              → agent.list
  POST   /api/agents              → agent.create
  POST   /api/agents/:name/start  → agent.start
  POST   /api/agents/:name/stop   → agent.stop
  GET    /api/agents/:name        → agent.status

交互类（异步/Webhook）:
  POST   /api/agents/:name/prompt → 发送消息，返回 requestId
  GET    /api/agents/:name/prompt/:requestId → 轮询结果
  或
  POST   /api/agents/:name/prompt?callback=<url> → 完成后 POST 回调到 IM
  或
  POST   /api/agents/:name/stream → SSE 流式响应
```

**IM Adapter 层**负责：
- 接收各平台 Webhook（企业微信/Slack/Telegram 格式各异）
- 提取消息内容，转换为统一的 prompt 格式
- Agent 回复后，转换为各平台的消息格式并回调
- 维护 IM user/group → ACP Session 的映射

**适用场景**：
- 企业内部 AI 助手（企业微信/飞书 Bot）
- 客服系统集成（Slack/Discord Channel）
- Telegram Bot 作为 Agent 前端
- 任何有 HTTP Webhook 能力的平台接入

---

## 场景总览（9 种）

### 按 transport 分类

```
                  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
                  │Unix socket│  │ACP Gateway│  │ HTTP/WS  │  │ 外部直连  │  │ 无连接   │
                  │ RPC      │  │ACP stream │  │ Web/IM   │  │ACP(自管理)│  │(仅进程)  │
                  └────┬─────┘  └────┬──────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
                       │            │              │              │              │
1. one-shot run   ─────●            │              │              │              │
2. agent start    ──────────────────●              │              │              │
3. agent chat     ──────────────────●              │              │              │
4. proxy          ──────────────────●              │              │              │
5. 多 Client      ──────────────────●              │              │              │
6. direct IDE     ──────────────────────────────────────────────────────────────●
7. external spawn ─────●────────────────────────────────────────●              │
8. Web UI         ─────────────────────────────────●              │              │
9. Docker + IM    ─────────────────────────────────●              │              │
```

### 完整属性对比

| 场景 | Transport | ACP 连接 owner | Core 角色 | 流式 | 多 Client |
|------|-----------|:---:|---|:---:|:---:|
| 1. one-shot | Unix socket RPC | Core (临时) | 执行+销毁 | 否 | N/A |
| 2. start | — | **Core** | 持有连接，等待接入 | — | — |
| 3. chat | ACP/socket | Core | Gateway, session 路由 | **是** | **是** |
| 4. proxy | ACP/stdio→socket | Core | Gateway, session 路由 | **是** | **是** |
| 5. 多 Client | 混合 | Core | Gateway, 多路复用 | **是** | **是** |
| 6. direct | — | 无 | 仅进程监控 | N/A | N/A |
| 7. external | RPC (管理) | **外部** | 仅 pid 监控 | 外部决定 | 外部决定 |
| **8. Web UI** | **HTTP + WebSocket** | Core | Gateway + HTTP API | **是** | **是** |
| **9. Docker+IM** | **HTTP (Webhook)** | Core | Gateway + IM Adapter | 取决于 IM | **是** |

### Core 多接口能力

```
agentcraft CLI ──(Unix Socket RPC)──┐
                                     │
ACP Proxy ──(ACP / Unix socket)─────┤
                                     │
agent chat ──(ACP / Unix socket)────┤
                                     ├──▶ AgentCraft Core
Web UI ──(HTTP REST + WebSocket)────┤      (统一的 Service Layer)
                                     │
IM Bot ──(HTTP Webhook)─────────────┤
                                     │
External ──(RPC resolve/attach)─────┘
```

所有接口最终调用同一套 Core Services 和 ACP Gateway，保证行为一致。

---

## 共享基础设施

```
packages/acp/                              ← ACP 协议层
├── connection.ts                          AcpConnection: 完整 ACP Client
│                                           场景 2-5, 8-9: Core 持有
│                                           场景 7: 外部调用方持有
├── connection-manager.ts                  连接管理（Core 内部用）
├── gateway.ts                             ACP Gateway: 多 Client Session 多路复用
├── communicator.ts                        AcpCommunicator: 适配接口
└── index.ts

packages/api/                              ← Core 服务层
├── daemon/
│   ├── daemon.ts                          Daemon 主进程
│   ├── socket-server.ts                   RPC Unix socket（管理操作，场景 1/6/7）
│   └── acp-socket-server.ts              ACP Unix socket（实时交互，场景 3/4/5）
├── http/                                  ← HTTP 接口层（场景 8/9）
│   ├── http-server.ts                     HTTP REST API + WebSocket Server
│   └── im-adapter.ts                      IM 平台适配器（企业微信/Slack/Telegram）
└── handlers/                              RPC handlers（已有）

CLI 消费层:
├── proxy.ts   → 薄层 stdio↔socket 转发（场景 4）
├── chat.ts    → 内置 ACP Client + 终端流式渲染（场景 3）
└── run.ts     → RPC request/response（场景 1）
```

---

## 相关文档

| 文档 | 关系 |
|------|------|
| [接口契约](../../.trellis/spec/api-contracts.md) | 定义 RPC 方法、CLI 命令、Proxy 协议 |
| [Agent 生命周期](../../.trellis/spec/agent-lifecycle.md) | 定义状态转换、LaunchMode 行为 |
| [架构 Docker 类比](./architecture-docker-analogy.md) | CLI-Daemon 分层设计的思考基础 |
| [Issue #35](../../.trellis/issues/0035-acp-proxy-full-protocol.json) | ACP Gateway + agent chat 直连的实现计划 |
