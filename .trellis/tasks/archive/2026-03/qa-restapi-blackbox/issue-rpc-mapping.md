## 测试发现

**场景**: REST API 全功能黑盒测试
**步骤**: Steps 54, 61, 65

## 复现方式

```bash
# Start daemon + REST API server
actant daemon start --foreground &
actant api --port 3210 --api-key test

# Create agent but don't start it
curl -X POST -H 'Authorization: Bearer test' -H 'Content-Type: application/json' \
  -d '{"name":"bot","template":"actant-hub@code-reviewer"}' \
  http://localhost:3210/v1/agents

# Prompt stopped agent: expect 409, gets 500
curl -X POST -H 'Authorization: Bearer test' -H 'Content-Type: application/json' \
  -d '{"message":"Hello"}' \
  http://localhost:3210/v1/agents/bot/prompt

# Create session without clientId: expect 400, gets 500
curl -X POST -H 'Authorization: Bearer test' -H 'Content-Type: application/json' \
  -d '{"agentName":"bot"}' \
  http://localhost:3210/v1/sessions

# Detach agent without attached process: expect 409, gets 500
curl -X POST -H 'Authorization: Bearer test' \
  http://localhost:3210/v1/agents/bot/detach
```

## 期望行为

- Prompt stopped agent: HTTP 409 (Conflict)
- Missing required param: HTTP 400 (Bad Request)
- Detach without process: HTTP 409 (Conflict)

## 实际行为

All three return HTTP 500 (Internal Server Error) with correct error messages.

## 分析

`packages/rest-api/src/server.ts` catch block only maps 6 RPC error codes (-32001 to -32009). Daemon handlers throw Error without setting `.code`, falling through to default 500.

## 修复方案

Two-layer fix:
1. **REST API layer** (quick): Add message-pattern matching in catch block. Map 'not found' to 404, 'not running'/'no connection' to 409, 'required'/'missing'/'invalid' to 400
2. **Daemon layer** (long-term): Set standard RPC error codes in all handlers
