# Appendix

**副标题**：术语、RFD 映射与参考表

---

## Appendix A: Terminology Mapping

| ACP-EX 术语 | ACP 术语 | 描述 |
|-------------|----------|------|
| Host | Client | 主控方，发起 prompt，提供 callback |
| Backend | Agent | 执行方，处理 prompt，请求服务 |
| ActantChannel | ClientSideConnection | Host 与 Backend 的接口（Host 调用 Backend） |
| ChannelHostServices | Client callbacks | Backend 与 Host 的接口（Backend 回调 Host） |
| ChannelEvent | SessionNotification + SessionUpdate | 事件类型体系 |
| ChannelCapabilities | ClientCapabilities（单向） | 能力协商（ACP-EX 为双向） |
| Core Profile | ACP standard | ACP 兼容层 |
| Extended Profile | （无） | Actant 扩展 |
| External Profile | （无） | 外部客户端接口 |
| `x_` prefix | （无） | 扩展事件/内容类型的命名空间 |
| hostTools | （无） | Host 提供的工具 |
| executeTool | （无） | Host 工具执行回调 |
| adapterOptions | （无） | 适配器特有选项透传 |
| backendOptions | （无） | prompt 级别的后端特有选项透传 |

---

## Appendix B: ACP RFD Mapping

| ACP RFD | ACP-EX 对应 | 状态 |
|---------|-------------|------|
| Proxy Chains | External Profile — Gateway Bridge | Actant 本身即 Proxy |
| MCP-over-ACP | `mcpServers` in ChannelConnectOptions + `setMcpServers()` | 已原生支持 |
| Remote Agents | `adapterOptions.spawnClaudeCodeProcess`（SDK） | SDK 已支持 |
| Session Fork | `resumeSession()` + `adapterOptions.forkSession` | 按需实现 |
| Session Info / Usage Update | `x_result_success.usage`、`x_budget_update` | Extended Profile |
| Request Cancellation | `cancel()` | Core Profile |
| Session Config Options | `configure()` | Core Profile |
| Session List | 尚未规划 | 未来 |
| Elicitation | ChannelHostServices 可扩展 | 未来 via `invoke()` |

---

## Appendix C: Full Capability Matrix

| Capability | AcpChannelAdapter | ClaudeChannelAdapter | PiChannelAdapter | CustomChannelAdapter 最低 |
|------------|:-----------------:|:--------------------:|:----------------:|:------------------------:|
| streaming | true | true | true | false |
| cancel | true | true | false | false |
| resume | partial | true | false | false |
| multiSession | true | false | false | false |
| configurable | true | true | false | false |
| callbacks | true | false | true | false |
| needsFileIO | true | false | true | false |
| needsTerminal | true | false | true | false |
| needsPermission | true | true | true | false |
| structuredOutput | false | true | false | false |
| thinking | false | true | false | false |
| dynamicMcp | false | true | false | false |
| dynamicTools | false | true | false | false |
| contentTypes | ["text"] | ["text","image","resource"] | ["text"] | ["text"] |
| extensions | [] | ["hooks","agents","effort"] | [] | [] |

**说明**：CustomChannelAdapter 最低要求为仅实现 `prompt()`，其余 capabilities 均为 false。实现者可根据需要提升各项能力。
