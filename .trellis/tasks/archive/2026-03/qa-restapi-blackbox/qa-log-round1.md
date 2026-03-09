# QA Log - Round 1: REST API 全功能黑盒测试

**开始时间**: 2026-02-26T20:54:00+08:00
**结束时间**: 2026-02-26T21:02:00+08:00
**环境**: Real mode (no ACTANT_LAUNCHER_MODE)
**Daemon PID**: 37148
**REST API**: http://localhost:3210 (with API Key)
**Dashboard**: http://localhost:3211 (no API Key)
**ACTANT_HOME**: C:\Users\black\AppData\Local\Temp\ac-qa-restapi-20260226205354
**ACTANT_SOCKET**: \\.\pipe\actant-qa-restapi-test

---

### [Step 1] Auth - no key
**输入**: `curl http://localhost:3210/v1/status`
**输出**: `{"error":"Missing API key. Set Authorization: Bearer <key> or X-API-Key header.","status":401}` HTTP:401
**判断: PASS** — 无认证时正确拒绝，返回 401 和清晰的错误消息。

### [Step 2] Auth - wrong key
**输入**: `curl -H "Authorization: Bearer wrong-key" http://localhost:3210/v1/status`
**输出**: `{"error":"Invalid API key.","status":401}` HTTP:401
**判断: PASS** — 错误密钥正确拒绝。

### [Step 3] Auth - Bearer correct
**输入**: `curl -H "Authorization: Bearer qa-test-secret-key" http://localhost:3210/v1/status`
**输出**: `{"version":"0.2.3","uptime":57,"agents":0}` HTTP:200
**判断: PASS** — Bearer token 认证成功，返回有效的 daemon 状态。

### [Step 4] Auth - X-API-Key header
**输入**: `curl -H "X-API-Key: qa-test-secret-key" http://localhost:3210/v1/status`
**输出**: `{"version":"0.2.3","uptime":58,"agents":0}` HTTP:200
**判断: PASS** — X-API-Key header 认证方式同样有效。

### [Step 5] CORS preflight
**输入**: `curl -X OPTIONS -H "Origin: http://example.com" -H "Access-Control-Request-Method: POST" http://localhost:3210/v1/agents`
**输出**: HTTP:204
**判断: PASS** — OPTIONS 预检请求返回 204，不要求认证。

### [Step 6] GET /v1/openapi
**输入**: `curl -H "Authorization: Bearer <key>" http://localhost:3210/v1/openapi`
**输出**: 完整 OpenAPI 3.0.3 JSON，包含所有路径定义（/status, /agents, /templates, /events, /canvas, /skills, /prompts, /mcp-servers, /workflows, /plugins, /sources, /presets, /sessions, /webhooks/*, /sse）。HTTP:200
**判断: PASS** — 自描述端点完整，覆盖所有注册的路由。

### [Step 7] GET /v1/agents (empty)
**输入**: `curl -H "Authorization: Bearer <key>" http://localhost:3210/v1/agents`
**输出**: `[]` HTTP:200
**判断: PASS** — 初始状态无 agent，返回空数组。

### [Step 8] GET /v1/templates
**输入**: `curl -H "Authorization: Bearer <key>" http://localhost:3210/v1/templates`
**输出**: 3 个内置模板 (code-reviewer, qa-engineer, doc-writer)。HTTP:200
**判断: PASS** — Daemon 自动加载 actant-hub 模板。

### [Step 9] GET /v1/events
**输入**: `curl -H "Authorization: Bearer <key>" http://localhost:3210/v1/events`
**输出**: `{"events":[{"ts":...,"event":"actant:start",...}]}` HTTP:200
**判断: PASS** — 返回 daemon 启动事件。

### [Step 10] POST /v1/agents (create)
**输入**: `curl -X POST -d '{"name":"qa-test-bot","template":"actant-hub@code-reviewer"}' http://localhost:3210/v1/agents`
**输出**: Agent 对象，status:"created"，包含 id、name、template 信息。HTTP:201
**判断: PASS** — 返回 201 Created，包含完整的 agent 元数据。

### [Step 11] GET /v1/agents (should have 1)
**输入**: `curl http://localhost:3210/v1/agents`
**输出**: 包含 1 个 agent 的数组。HTTP:200
**判断: PASS** — 创建后列表正确反映。

### [Step 12] GET /v1/agents/qa-test-bot
**输入**: `curl http://localhost:3210/v1/agents/qa-test-bot`
**输出**: 完整 agent 对象。HTTP:200
**判断: PASS** — 路径参数 `:name` 正确解析。

### [Step 13] POST /v1/agents/qa-test-bot/start
**输入**: `curl --max-time 15 -X POST http://localhost:3210/v1/agents/qa-test-bot/start`
**输出**: 连接超时 (HTTP:000, curl exit 28)
**判断: WARN** — RPC 超时已知问题。agent.start 涉及后端进程启动，可能超过 HTTP 超时。REST API 层应考虑返回 202 Accepted 并异步通知。

### [Step 14] GET /v1/agents/qa-test-bot (after start timeout)
**输入**: `curl http://localhost:3210/v1/agents/qa-test-bot`
**输出**: status:"starting"。HTTP:200
**判断: PASS** — Agent 确实进入了 starting 状态，说明 start RPC 在后台执行。

### [Step 15] POST /v1/agents/qa-test-bot/stop
**输入**: `curl -X POST http://localhost:3210/v1/agents/qa-test-bot/stop`
**输出**: status:"stopped"。HTTP:200
**判断: PASS** — 停止操作正常完成。

### [Step 16] GET /v1/agents/qa-test-bot (after stop)
**输入**: `curl http://localhost:3210/v1/agents/qa-test-bot`
**输出**: status:"stopped"。HTTP:200
**判断: PASS** — 状态一致。

### [Step 17] GET /v1/agents/qa-test-bot/sessions
**输入**: `curl http://localhost:3210/v1/agents/qa-test-bot/sessions`
**输出**: 1 个 session 记录。HTTP:200
**判断: PASS** — start 尝试产生了 session 记录。

### [Step 18] GET /v1/agents/qa-test-bot/logs
**输入**: `curl http://localhost:3210/v1/agents/qa-test-bot/logs`
**输出**: `{"lines":[],"stream":"stdout","logDir":"..."}` HTTP:200
**判断: PASS** — 结构正确，日志目录路径存在。

### [Step 19] DELETE /v1/agents/qa-test-bot
**输入**: `curl -X DELETE http://localhost:3210/v1/agents/qa-test-bot`
**输出**: `{"error":"EBUSY: resource busy or locked, rmdir '...'","status":500}` HTTP:500
**判断: WARN** — Windows EBUSY 已知问题 (P3)。非 REST API 层 bug，是底层 OS 文件锁。

### [Step 21] DELETE /v1/agents/qa-test-bot?force=true
**输入**: `curl -X DELETE "http://localhost:3210/v1/agents/qa-test-bot?force=true"`
**输出**: 同上 EBUSY。HTTP:500
**判断: WARN** — 即使 force 模式也无法解决 Windows EBUSY。底层需要重试/延迟删除机制。

### [Step 23] GET /v1/templates/actant-hub@code-reviewer
**输入**: `curl http://localhost:3210/v1/templates/actant-hub@code-reviewer`
**输出**: 完整模板定义。HTTP:200
**判断: PASS** — 路径含 `@` 符号的参数正确解析。

### [Step 24-28] Domain 端点 (skills, prompts, mcp-servers, workflows, plugins)
**输入**: GET 各端点
**输出**: skills 3 项，prompts 2 项，mcp-servers 2 项，workflows []，plugins []。全部 HTTP:200
**判断: PASS** — 所有域组件端点正常工作。

### [Step 29] GET /v1/canvas
**输入**: `curl http://localhost:3210/v1/canvas`
**输出**: `{"entries":[]}` HTTP:200
**判断: PASS** — 初始状态无 canvas。

### [Step 30c] POST /v1/canvas/qa-test-bot
**输入**: `curl -X POST -d '{"html":"<p>Hello from QA</p>","title":"QA Test"}' http://localhost:3210/v1/canvas/qa-test-bot`
**输出**: `{"ok":true}` HTTP:200
**判断: PASS** — Canvas 更新成功。

### [Step 31b] GET /v1/canvas/qa-test-bot (after update)
**输入**: `curl http://localhost:3210/v1/canvas/qa-test-bot`
**输出**: `{"agentName":"qa-test-bot","html":"<p>Hello from QA</p>","title":"QA Test","updatedAt":...}` HTTP:200
**判断: PASS** — Canvas 数据持久化且可读取。

### [Step 32] DELETE /v1/canvas/qa-test-bot
**输入**: `curl -X DELETE http://localhost:3210/v1/canvas/qa-test-bot`
**输出**: `{"ok":true}` HTTP:200
**判断: PASS** — Canvas 清除成功。

### [Step 33] GET /v1/canvas/qa-test-bot (after clear)
**输入**: `curl http://localhost:3210/v1/canvas/qa-test-bot`
**输出**: `{"error":"No canvas for agent \"qa-test-bot\"","status":404}` HTTP:404
**判断: PASS** — 清除后正确返回 404。

### [Step 34] GET /v1/sources
**输入**: `curl http://localhost:3210/v1/sources`
**输出**: 1 个 source (actant-hub)。HTTP:200
**判断: PASS**

### [Step 35] GET /v1/presets
**输入**: `curl http://localhost:3210/v1/presets`
**输出**: 2 个 preset (web-dev, devops)。HTTP:200
**判断: PASS**

### [Step 36] GET /v1/sessions
**输入**: `curl http://localhost:3210/v1/sessions`
**输出**: `[]` HTTP:200
**判断: PASS**

### [Step 37] POST /v1/webhooks/message (agent stopped)
**输入**: `curl -X POST -d '{"agent":"qa-test-bot","message":"Hello"}' http://localhost:3210/v1/webhooks/message`
**输出**: `{"error":"Agent \"qa-test-bot\" error: Agent \"qa-test-bot\" has no ACP connection...","status":502}` HTTP:502
**判断: PASS** — Agent 未启动时 webhook 正确返回 502 并给出清晰指引。

### [Step 38] POST /v1/webhooks/run (missing prompt)
**输入**: `curl -X POST -d '{"agent":"qa-test-bot","message":"Hello"}' http://localhost:3210/v1/webhooks/run`
**输出**: `{"error":"agent and prompt are required","status":400}` HTTP:400
**判断: PASS** — 参数验证正确（需要 `prompt` 而非 `message`）。

### [Step 38b] POST /v1/webhooks/run (correct but agent stopped)
**输入**: `curl --max-time 10 -X POST -d '{"agent":"qa-test-bot","prompt":"Hello"}' http://localhost:3210/v1/webhooks/run`
**输出**: 连接超时 HTTP:000
**判断: WARN** — agent.run RPC 在 agent 未运行时挂起而非快速失败。应在 agent.run handler 中先检查 agent 状态。

### [Step 39] POST /v1/webhooks/event (no agentName)
**输入**: `curl -X POST -d '{"event":"test:webhook","payload":{"key":"value"}}' http://localhost:3210/v1/webhooks/event`
**输出**: `{"error":"Agent \"undefined\" not found","status":502}` HTTP:502
**判断: WARN** — 错误消息包含 "undefined"，说明 gateway.lease 要求 agentName 但未做前置校验。应改进错误消息或在 webhook route 中校验 agentName。

### [Step 39b] POST /v1/webhooks/event (with agentName, stopped)
**输入**: `curl -X POST -d '{"event":"test:webhook","agentName":"qa-test-bot","payload":{...}}' http://localhost:3210/v1/webhooks/event`
**输出**: `{"error":"Agent \"qa-test-bot\" is not running (status: stopped). Session Lease requires a running agent.","status":502}` HTTP:502
**判断: PASS** — 清晰的错误消息。

### [Step 40] GET /v1/nonexistent
**输入**: `curl http://localhost:3210/v1/nonexistent`
**输出**: `{"error":"GET /v1/nonexistent not found","status":404}` HTTP:404
**判断: PASS** — 未注册路由正确返回 404。

### [Step 41] POST /v1/agents (duplicate name)
**输入**: `curl -X POST -d '{"name":"qa-test-bot","template":"..."}' http://localhost:3210/v1/agents`
**输出**: `{"error":"Instance directory \"qa-test-bot\" already exists","status":400}` HTTP:400
**判断: PASS** — 重复创建正确拒绝。

### [Step 42] GET /v1/agents/nonexistent-agent
**输入**: `curl http://localhost:3210/v1/agents/nonexistent-agent`
**输出**: `{"error":"Agent instance \"nonexistent-agent\" not found","status":404}` HTTP:404
**判断: PASS** — 不存在的 agent 正确返回 404。

### [Step 43] SSE stream
**输入**: `curl --max-time 2 -H "Accept: text/event-stream" http://localhost:3210/v1/sse`
**输出**: 4 个 SSE 事件：status (daemon 信息), agents (列表), events (事件历史), canvas (画布数据)
**判断: PASS** — SSE 流完整，数据实时推送，格式标准 (event: xxx\ndata: json\n\n)。

### [Step 44] CORS response headers
**输入**: `curl -D - -H "Origin: http://example.com" http://localhost:3210/v1/status`
**输出**: Access-Control-Allow-Origin: *, Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, Access-Control-Max-Age: 86400
**判断: PASS** — CORS 头完整，支持跨域访问。

### [Step 45] GET /v1/templates/nonexistent
**输出**: `{"error":"Template \"nonexistent-template\" not found in registry","status":404}` HTTP:404
**判断: PASS**

### [Step 46-47] POST /v1/agents (missing fields)
**输出**: `{"error":"name and template are required","status":400}` HTTP:400
**判断: PASS** — 空 body 和缺少字段均正确验证。

### [Step 48] Dashboard index.html
**输入**: `curl http://localhost:3211/`
**输出**: 完整 HTML，含 `<div id="root"></div>` 和 Vite 构建的 JS/CSS 引用。HTTP:200
**判断: PASS** — SPA 静态文件正确服务。

### [Step 49-50] Dashboard API proxy
**输入**: `curl http://localhost:3211/v1/status`, `curl http://localhost:3211/v1/agents`
**输出**: 与 REST API 服务器相同的响应。HTTP:200
**判断: PASS** — Dashboard 无需 API Key 即可代理 /v1/* 请求（内部集成模式）。

### [Step 51] Dashboard SSE
**输入**: `curl --max-time 2 http://localhost:3211/v1/sse`
**输出**: 完整 SSE 流，包含 status/agents/events/canvas
**判断: PASS**

### [Step 52] Create second agent
**输出**: HTTP:201, status:"created"
**判断: PASS** — 多 agent 创建正常。

### [Step 53] GET /v1/agents (2 agents)
**输出**: 数组包含 qa-test-bot 和 qa-bot-2。HTTP:200
**判断: PASS**

### [Step 54] POST /v1/agents/qa-bot-2/prompt (stopped agent)
**输入**: `curl -X POST -d '{"message":"Hello"}' http://localhost:3210/v1/agents/qa-bot-2/prompt`
**输出**: `{"error":"Agent \"qa-bot-2\" has no ACP connection. Start it first with `agent start`.","status":500}` HTTP:500
**判断: FAIL** — 错误消息正确但 HTTP 状态码应为 409 (Conflict) 或 422，不应是 500。根因：RPC 错误缺少标准错误码，REST API 层默认映射到 500。

### [Step 55] POST /v1/agents/nonexistent/start
**输出**: `{"error":"Agent instance \"nonexistent\" not found","status":404}` HTTP:404
**判断: PASS**

### [Step 56b] PUT /v1/agents/qa-bot-2/permissions
**输入**: `curl -X PUT -d '{"permissions":{"allow":["Read","Write"],"deny":["Shell"]}}' ...`
**输出**: `{"effectivePermissions":{"allow":["Read","Write","mcp__..."],"deny":["Shell"]}}` HTTP:200
**判断: PASS** — 权限更新正常，合并了 MCP 服务器权限。

### [Step 57-58] Dashboard SPA fallback routing
**输入**: `curl http://localhost:3211/agents/qa-test-bot`, `curl http://localhost:3211/agents/qa-test-bot/chat`
**输出**: 均返回 `index.html`（含 `<div id="root"></div>`）。HTTP:200
**判断: PASS** — SPA 客户端路由回退正确工作。

### [Step 59] Dashboard CSS assets
**输入**: `curl http://localhost:3211/assets/index-CoTVsIdA.css`
**输出**: HTTP:200
**判断: PASS** — 静态资源正确服务。

### [Step 60] POST /v1/agents/qa-test-bot/dispatch
**输入**: `curl -X POST -d '{"task":"review code","prompt":"Review the main module"}' ...`
**输出**: `{"queued":false}` HTTP:200
**判断: PASS** — dispatch 端点正常响应。

### [Step 61] POST /v1/sessions (missing clientId)
**输出**: `{"error":"Required parameter \"clientId\" is missing or invalid","status":500}` HTTP:500
**判断: FAIL** — 参数校验错误应返回 400，而非 500。同 Step 54 的根因。

### [Step 62] GET /v1/agents/qa-bot-2/tasks
**输出**: `{"queued":0,"processing":false,"tasks":[]}` HTTP:200
**判断: PASS**

### [Step 63] GET /v1/agents/qa-bot-2/schedule
**输出**: `{"sources":[],"running":false}` HTTP:200
**判断: PASS**

### [Step 64] POST /v1/agents/qa-bot-2/attach (no pid)
**输出**: `{"error":"pid is required","status":400}` HTTP:400
**判断: PASS** — 参数验证正确。

### [Step 65] POST /v1/agents/qa-bot-2/detach
**输出**: `{"error":"Agent \"qa-bot-2\" has no attached process","status":500}` HTTP:500
**判断: FAIL** — 应返回 409，而非 500。同类根因。

### [Step 66] GET /v1/skills/actant-hub@code-review
**输出**: HTTP:200
**判断: PASS** — 带 `@` 的路径参数在 domain 端点也正确解析。

### [Step 67] Large payload body (500 char name)
**输出**: `{"error":"Failed to initialize workspace at \"...aaa...\"","status":500}` HTTP:500
**判断: WARN** — 超长名称导致路径过长失败。500 可接受（服务端未预料的输入），但理想情况应在 agent.create 中校验名称长度。

### [Step 68] Invalid JSON body
**输出**: `{"error":"name and template are required","status":400}` HTTP:400
**判断: PASS** — 无效 JSON 被优雅降级处理（body 解析为空 → 触发必填字段校验）。

### [Step 69] Wrong HTTP method
**输出**: `{"error":"PUT /v1/agents not found","status":404}` HTTP:404
**判断: PASS** — 未注册的 method+path 组合正确返回 404。

### [Step 70] Empty Authorization header
**输出**: `{"error":"Missing API key...","status":401}` HTTP:401
**判断: PASS**

### [Step 71] POST /v1/shutdown
**输出**: `{"success":true}` HTTP:200
**判断: PASS** — Shutdown 端点正常工作。（注意：这导致了 daemon 关闭）
