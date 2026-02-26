## 测试发现

**场景**: REST API 全功能黑盒测试
**步骤**: Step 39 (webhook event without agentName), Step 38b (webhook run hangs)

## 问题 1: Event webhook shows "Agent undefined"

POST `/v1/webhooks/event` with body `{"event":"test:webhook","payload":{}}` (no agentName)
returns `{"error":"Agent \"undefined\" not found","status":502}`.

The error message exposes the JavaScript `undefined` value, which is unhelpful for API consumers.

**Fix**: Add `agentName` validation in `packages/rest-api/src/routes/webhooks.ts` event handler, or handle missing agentName gracefully in `gateway.lease`.

## 问题 2: Webhook /run hangs when agent not running

POST `/v1/webhooks/run` with body `{"agent":"bot","prompt":"Hello"}` hangs indefinitely
when the agent is in "stopped" state, instead of returning a quick 502 error.

**Fix**: In `agent.run` RPC handler, check agent status before attempting to start the run. If stopped and auto-start fails, return an error immediately.
