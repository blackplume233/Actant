# QA 集成测试报告 - Round 2 (回归验证)

**场景**: REST API 全功能黑盒测试 (修复后回归)
**测试工程师**: QA SubAgent
**时间**: 2026-02-26 21:07 ~ 21:10
**结果**: **ALL PASS** (19/19 步骤通过, 0 FAIL, 0 WARN)

## 修复验证

| 原始步骤 | 问题 | 修复后 HTTP | 判定 |
|----------|------|-------------|------|
| Step 54 (prompt stopped) | 500→409 | **409** | ✅ PASS |
| Step 61 (session missing param) | 500→400 | **400** | ✅ PASS |
| Step 65 (detach no process) | 500→409 | **409** | ✅ PASS |
| Step 39 (event no agentName) | 502 "undefined" | **400** 清晰消息 | ✅ PASS |

## 回归步骤摘要

| # | 测试 | HTTP | 判定 |
|---|------|------|------|
| R2-1 | Auth no key | 401 | PASS |
| R2-2 | Auth correct | 200 | PASS |
| R2-3 | CORS preflight | 204 | PASS |
| R2-4 | OpenAPI | 200 | PASS |
| R2-5 | Agents empty | 200 | PASS |
| R2-6 | Templates | 200 | PASS |
| R2-7 | Events | 200 | PASS |
| R2-8 | Agent create | 201 | PASS |
| R2-9 | Prompt stopped (fix) | 409 | PASS |
| R2-10 | Session missing param (fix) | 400 | PASS |
| R2-11 | Detach no process (fix) | 409 | PASS |
| R2-12 | Event no agentName (fix) | 400 | PASS |
| R2-13 | Event stopped agent | 502 | PASS |
| R2-14 | Canvas CRUD (3 ops) | 200 | PASS |
| R2-15 | SSE stream | 4 events | PASS |
| R2-16 | 404 route | 404 | PASS |
| R2-17 | Duplicate agent | 400 | PASS |
| R2-18 | 404 agent | 404 | PASS |
| R2-19 | Domain endpoints (3) | 200 | PASS |

## 结论

Round 1 发现的 3 个 FAIL 和 2 个 WARN（非平台相关）已全部修复并验证通过。
