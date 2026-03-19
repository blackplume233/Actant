# ACP 协议未来发展分析与 Actant 战略定位

> **日期**：2026-03-14
> **参与者**：human, cursor-agent
> **影响 Issue**：#279（统一通信层与 Runtime Facade 收敛）
> **数据来源**：[ACP 官方站点](https://agentclientprotocol.com)、RFD 管道、SDK 版本、生态新闻
> **结论**：ACP 会成为 IDE↔Agent 的事实标准，但不会成为通用 agent 管理/平台协议。Actant 应站在 ACP **之上**（作为 Proxy）和**之下**（作为 runtime platform），而不是被 ACP 包裹在内部。

---

## 1. ACP 的本质定位

ACP 的自我定位始终清晰：**"Agent 版的 LSP"**——标准化代码编辑器与 AI 编码助手之间的通信。

核心假设：
- 一个**人类用户**坐在**编辑器**前
- 想要与一个**受信任的 coding agent** 交互
- 编辑器授予 agent 文件访问和工具权限

设计哲学三原则（引自官方 Architecture 文档）：
1. **Trusted**：用户在编辑器中与受信任的 model 交互，agent 获得本地文件和 MCP 访问
2. **UX-first**：解决 agent 交互的 UX 挑战，enough flexibility to render agent intent
3. **MCP-friendly**：基于 JSON-RPC，尽可能复用 MCP 类型

治理结构：Zed Industries（Ben Brandt, Lead Maintainer）+ JetBrains（Sergey Ignatov, Lead Maintainer）。多语言 SDK：TypeScript、Python、Rust、Kotlin、Java。

**关键判断：ACP 到目前为止没有任何偏离 "IDE↔Agent" 定位的迹象。**

---

## 2. ACP 活跃演进的六个方向

### 2.1 Session 生命周期完善

已完成或 Draft 中的 RFD：

| RFD | 状态 | 说明 |
|-----|------|------|
| session/list | ✅ Completed | 发现已有 session |
| session/close | Draft | Agent 主动关闭 session |
| session/delete | Draft | Client 删除 session |
| session/fork | Draft | 分叉已有 session |
| session/resume | Draft | 恢复已有 session |
| session_info_update | ✅ Completed | Session 状态通知 |
| Session Config Options | ✅ Completed | 灵活配置选择器 |
| Session Usage | Draft | 用量与 context 状态 |

Session 模型正在变得足够丰富，能支撑"多会话并行、分叉、恢复"的复杂场景。

### 2.2 Proxy Chains — 中间件化（架构层面最重大）

允许在 Client 和 Agent 之间插入代理层：

```
IDE (Client) ←→ Proxy A ←→ Proxy B ←→ Agent
```

Proxy 可以：
- 拦截、转换、增强消息
- 注入 MCP 工具（通过 MCP-over-ACP）
- 管理认证和路由
- 添加 context-aware 上下文

**本质上定义了一个"中间件市场"**——平台型产品可以作为 ACP Proxy，在 IDE 和原始 Agent 之间增加价值。

### 2.3 MCP-over-ACP — 协议融合

由 Niko Matsakis 提出的 RFD。允许 MCP 工具通过 ACP 通道传输，不需要独立进程：

```
之前: IDE → ACP → Agent → stdio → MCP Server (独立进程)
之后: IDE → ACP → Agent → ACP channel → MCP (同一连接)
```

Client 可以在 `session/new` 中声明 `"transport": "acp"` 的 MCP server，tool invocations 通过 `mcp/connect` / `mcp/message` / `mcp/disconnect` 在 ACP 通道内完成。

对不支持 ACP transport 的 Agent，可通过 Bridge 层透明转换为 stdio/HTTP。

### 2.4 更丰富的 UX 能力

| 能力 | 说明 |
|------|------|
| Elicitation | Agent 向用户请求结构化输入 |
| Next Edit Suggestions | Agent 主动建议代码编辑 |
| Agent Plan | Agent 展示执行计划 |
| Session Modes | 不同操作模式（coding / reviewing / debugging） |

ACP 正在深入 IDE 体验层——这是通用 agent 协议不会做的事。

### 2.5 远程 Agent 支持

当前 ACP 主要是本地 stdio，但 HTTP/WebSocket 远程传输在积极推进。这会把 ACP 从"本地 IDE 插件协议"扩展为"可以连接云端 Agent 的协议"。

### 2.6 生态基建

| 基建 | 状态 | 说明 |
|------|------|------|
| ACP Registry | ✅ Completed | Agent 发现与安装 |
| Authentication Methods | Draft | 远程 Agent 身份认证 |
| Agent Telemetry Export | Draft | 标准化遥测输出 |
| Message ID | Draft | 消息追踪 |

---

## 3. ACP 不会覆盖的领域

| 能力 | ACP 是否覆盖 | Actant 是否需要 |
|------|:------------:|:---------------:|
| Agent 生命周期管理（启停、健康、崩溃恢复） | 否 | 核心能力 |
| 多客户端共享一个 Agent runtime（lease 模型） | 否 | 核心能力 |
| Agent-to-Agent 通信（Email / 协作） | 否 | Phase 4 计划 |
| 无人值守 / 自治运行（employee 模式） | 否 | 核心差异化 |
| Workspace 组装与物化 | 否 | 核心能力 |
| Agent 模板 / 技能 / 插件管理 | 否 | 核心能力 |
| 平台级调度与编排 | 否 | Phase 4 计划 |
| Communication Policy / readiness 管理 | 否 | #279 范围 |
| Backend 抽象（多 provider 平等接入） | 否 | #279 范围 |

---

## 4. ACP 生态格局中的位置

ACP 处于一个多协议并存的 Agent 通信生态中：

| 协议 | 定位 | 关系 |
|------|------|------|
| **ACP** | IDE ↔ Agent（编辑器前端） | Actant 的外部接入标准之一 |
| **MCP** | Agent ↔ Tools（工具后端） | Actant 的工具暴露标准 |
| **A2A** (Google) | Agent ↔ Agent（跨 agent 协作） | 与 Actant Email 范式互补 |
| **ANP** | Agent Network Protocol（网络发现） | 长期参考 |

ACP 和 MCP 正在通过 MCP-over-ACP 趋向融合；A2A 解决 agent-to-agent 的问题，与 ACP 互补不竞争。

---

## 5. 对 Actant 的战略启示

### 5.1 #279 方向被 ACP 演进验证

| 决策 | 判断 | 依据 |
|------|------|------|
| `ActantChannel` 作为内部骨架 | ✅ 正确 | ACP 不解决 daemon↔agent 内部通信、multi-client sharing、lifecycle |
| ACP 作为外部协议适配器 | ✅ 正确 | ACP 正在成为 IDE↔Agent 事实标准，应拥抱而非竞争 |
| Claude Agent SDK 直接封装 | ✅ 正确 | Proxy Chains 意味着 Actant↔backend 不需要多走一层 ACP |
| `@actant/acp` 退化为外部适配器 | ✅ 正确 | 与 ACP 生态方向一致 |

### 5.2 战略机会：Actant 作为 ACP Proxy

Proxy Chains 方向对 Actant 是**天然的定位**。Actant 的 `AcpGateway` 已经在做这件事：

```
IDE ←(ACP)→ Actant Gateway ←(内部 ActantChannel)→ Agent Backend
```

Actant 作为 ACP Proxy 可以增加的价值：
- **Context 注入**：skills、prompts、domain context 在 proxy 层注入
- **Session 管理**：lease、conversation、multi-client 在 proxy 层处理
- **监控与录制**：activity recording、telemetry 在 proxy 层截获
- **路由**：multiple agents、archetype-aware routing 在 proxy 层决策
- **工具增强**：通过 MCP-over-ACP 在 proxy 层注入 ToolRegistry 工具

### 5.3 MCP-over-ACP 的未来收益

当 MCP-over-ACP 稳定后，Actant 的 ToolRegistry 注入可以完全通过 ACP 通道完成，不需要为每个 IDE session 启动独立的 MCP Server 进程。这会大幅简化 IDE 集成架构。

### 5.4 远程 Agent 机会

ACP 的 HTTP/WebSocket 传输成熟后，Actant 可以作为远程 Agent 的 ACP facade：

```
Remote IDE ←(ACP over HTTP)→ Actant Daemon ←(ActantChannel)→ Local Agent
```

这使得 Actant 管理的 Agent 可以被远程 IDE 无缝访问。

---

## 6. Actant 的双层定位

```
┌─────────────────────────────────────────┐
│  IDE / External Client                  │
│  (Zed, JetBrains, VS Code, Cursor...) │
└────────────────┬────────────────────────┘
                 │ ACP (标准协议)
                 ▼
┌─────────────────────────────────────────┐
│  Actant — ACP Proxy + Runtime Platform  │
│                                         │
│  Protocol Adapters:                     │
│    AcpProxyAdapter / RestApi / CLI      │
│                                         │
│  Communication Router:                  │
│    target / route / lease / readiness   │
│                                         │
│  ActantChannel (Actant-owned):          │
│    session / prompt / stream / cancel   │
│    context injection / recording        │
│                                         │
│  Backend Adapters:                      │
│    ClaudeAgentSdk / Pi / Custom         │
└────────────────┬────────────────────────┘
                 │ SDK / native protocol
                 ▼
┌─────────────────────────────────────────┐
│  Agent Backend Process                  │
│  (claude runtime / pi / custom)         │
└─────────────────────────────────────────┘
```

**Actant 站在 ACP 之上（作为 Proxy）和之下（作为 runtime platform），而不是被 ACP 包裹在内部。**

---

## 7. 预测与风险

### 预测

1. **ACP 会像 LSP 一样成为事实标准**——主要 IDE 厂商（Zed、JetBrains）已深度参与，SDK 生态完整
2. **Proxy Chains 会创建中间件市场**——平台型产品在 IDE 和 Agent 之间增值
3. **MCP-over-ACP 会简化工具注入**——减少独立进程管理的复杂度
4. **远程 Agent 支持会扩展 ACP 的适用范围**——从本地 IDE 扩展到云端
5. **ACP 和 A2A 会保持互补**——分别解决 client-to-agent 和 agent-to-agent

### 风险

1. **ACP 标准演进速度**：如果 ACP 核心 break change 频繁，adapter 维护成本高。缓解：capability negotiation + 版本适配
2. **Proxy Chains 可能不被广泛采用**：如果 IDE 厂商不支持 proxy 模式。缓解：Actant 也支持 direct ACP agent 模式
3. **竞争协议出现**：Google A2A 或其他厂商可能推出自己的 IDE-Agent 协议。缓解：Actant 的 Protocol Adapter 层可以适配多协议
4. **ACP 范围扩张**：如果 ACP 试图覆盖 lifecycle/platform 领域。缓解：目前无此迹象，且 Actant 的执行领先优势

---

## 8. 行动项

| 优先级 | 行动 | 关联 |
|--------|------|------|
| P0 | 完成 #279 ActantChannel 定义 + Claude Agent SDK 迁移 | #279 Phase 1 |
| P1 | 重构 AcpGateway 为符合 Proxy Chains 理念的 ACP Proxy | #279 Phase 3 |
| P2 | 跟踪 MCP-over-ACP RFD 进展，评估 ToolRegistry 注入路径简化 | 长期 |
| P2 | 跟踪 ACP Remote Agent 支持，评估 HTTP/WS 传输适配 | 长期 |
| P3 | 评估 ACP Registry 集成，让 Actant Agent 可被 IDE 发现 | 生态 |

---

## 附录：ACP RFD 管道完整状态（截至 2026-03-14）

| RFD | 状态 | 与 Actant 相关度 |
|-----|------|:----------------:|
| ACP Registry | Completed | 中 |
| session/list | Completed | 高 |
| session_info_update | Completed | 高 |
| Session Config Options | Completed | 高 |
| Next Edit Suggestions | Draft | 低 |
| session/close | Draft | 高 |
| session/delete | Draft | 中 |
| session/fork | Draft | 高（对应 Actant conversation fork） |
| session/resume | Draft | 高（对应 Actant conversation resume） |
| Elicitation | Draft | 中 |
| Boolean Config Option | Draft | 低 |
| Delete in Diff | Draft | 低 |
| Message ID | Draft | 中 |
| Proxy Chains | Draft | **极高** |
| MCP-over-ACP | Draft | **极高** |
| Authentication Methods | Draft | 高（远程场景） |
| Session Usage | Draft | 中 |
| Agent Telemetry Export | Draft | 中 |
| Request Cancellation | Draft | 高 |
| Logout Method | Draft | 中 |
| Meta Propagation | Draft | 低 |
| Rust SDK (SACP) | Draft | 低 |
