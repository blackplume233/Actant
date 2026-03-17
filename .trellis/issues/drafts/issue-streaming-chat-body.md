## 目标

为 REST API 和 Dashboard 增加流式聊天（Streaming Chat）能力，使 Agent 的回复内容能实时逐 token 推送到前端，而非等待完整响应后一次性返回。同时确保 API 层面各请求之间不会过度排队阻塞。

## 背景

当前架构中 `POST /v1/agents/:name/prompt` 是完全同步的 request-response 模式：

```
Dashboard → fetch(POST /v1/agents/:name/prompt) → RPC bridge → Daemon → Agent → 完整响应 → JSON 一次返回
```

**问题**：
1. Agent 回复可能需要 10-60s（尤其 tool-calling 场景），期间 HTTP 连接空闲等待，Dashboard 只能显示 "Thinking..." 空白
2. RPC bridge 当前串行处理请求，一个长时间运行的 prompt 会阻塞后续请求（status 查询、其他 agent 的操作等）
3. 用户体验差——没有打字机效果，无法看到 Agent 的思考过程

## 方案

### 1. API 层：流式 Prompt 端点

新增 `POST /v1/agents/:name/prompt/stream` 或在现有端点通过 `Accept: text/event-stream` / `?stream=true` 切换为 SSE 流：

```
SSE 事件序列:
  event: token        data: {"delta": "你好"}
  event: token        data: {"delta": "，我"}
  event: tool_call    data: {"toolCallId": "xxx", "title": "Read file"}
  event: tool_result  data: {"toolCallId": "xxx", "status": "done"}
  event: token        data: {"delta": "根据代码..."}
  event: done         data: {"sessionId": "...", "response": "<full text>"}
  event: error        data: {"message": "..."}
```

### 2. RPC Bridge：并发支持

当前 `RpcBridge.call()` 应确保多个并发请求可以同时挂起（multiplexing），不互相阻塞。具体：

- 每个 RPC 调用分配唯一 `id`，通过 `id` 匹配请求和响应
- 长时间运行的请求（prompt/run）不阻塞短请求（status/list/stop）
- 对 streaming 场景，RPC 层面可能需要支持 `notification` 模式——Daemon 主动推送 partial result

### 3. Dashboard Chat：流式渲染

- 使用 `EventSource` 或 `fetch` + `ReadableStream` 消费流式端点
- 逐 token 追加渲染到消息气泡
- 显示 tool call 进度条
- 保留手动中断（Cancel）能力

### 4. Webhook 层面

`/v1/webhooks/message` 保持同步模式（适配 n8n/IM bot 等不支持 SSE 的场景），但应增加超时参数（默认 120s）和异步回调选项。

## 涉及模块

| 模块 | 变更内容 |
|------|---------|
| `packages/rest-api/src/routes/agents.ts` | 新增流式 prompt 端点 |
| `packages/rest-api/src/rpc-bridge.ts` | 并发 multiplexing + streaming notification |
| `packages/rest-api/src/routes/webhooks.ts` | 超时参数 |
| `packages/dashboard/client/src/pages/agent-chat.tsx` | 流式消费 + 打字机渲染 |
| `packages/dashboard/client/src/lib/api.ts` | 新增 stream prompt 方法 |
| `packages/daemon/src/rpc/` | 支持 streaming response / notification |
| `packages/shared/src/types/` | 新增 streaming event types |

## 验收标准

- [ ] `POST /v1/agents/:name/prompt` 支持 `?stream=true` 参数，返回 SSE 流
- [ ] Dashboard 聊天页可以看到 Agent 回复的打字机效果（逐 token 显示）
- [ ] Dashboard 聊天页显示 tool_call 进度
- [ ] 发送 prompt 期间，其他 API 请求（GET /v1/agents, GET /v1/status 等）不被阻塞
- [ ] 非流式模式（JSON 一次性返回）继续正常工作（向后兼容）
- [ ] Webhook 端点保持同步模式兼容
