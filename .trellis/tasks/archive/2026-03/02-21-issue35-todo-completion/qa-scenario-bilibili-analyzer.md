# QA 测试场景：Bilibili 视频分析 Agent

> 用于检验 Issue #35 (ACP Proxy + Session Lease) 功能的端到端测试场景

## 场景概述

创建一个 **Bilibili 视频分析 Agent**，用于分析 Bilibili 视频内容并生成摘要。该场景将验证 Issue #35 的以下核心功能：

- **Direct Bridge 模式**: Proxy 直接 spawn Agent，支持并发连接
- **Session Lease 模式**: Daemon 管理 Agent 进程，多客户端共享
- **Session 生命周期**: create/prompt/cancel/close/list 完整流程
- **自动实例化**: Instance 被占用时自动创建 ephemeral 副本

---

## 测试环境准备

### 1. 创建 Agent Template

```json
// configs/templates/bilibili-analyzer.json
{
  "name": "bilibili-analyzer",
  "version": "1.0.0",
  "description": "分析 Bilibili 视频内容并生成摘要",
  "backend": {
    "type": "claude-code",
    "command": "claude"
  },
  "launchMode": "acp-background",
  "workspacePolicy": "persistent",
  "prompt": {
    "system": "你是一个 Bilibili 视频分析专家。你的任务是：\n1. 分析视频标题、描述和标签\n2. 提取视频核心主题和关键信息\n3. 生成简洁的内容摘要\n4. 识别视频的目标受众\n\n请用中文回复。"
  },
  "mcpServers": [
    {
      "name": "bilibili-api",
      "command": "npx",
      "args": ["-y", "@mcp/bilibili-api"],
      "env": {}
    }
  ]
}
```

### 2. 初始化测试环境

```bash
# 启动 Daemon
actant daemon start

# 加载模板
actant template load configs/templates/bilibili-analyzer.json

# 创建 Agent 实例
actant agent create bv-analyzer -t bilibili-analyzer
```

---

## 测试用例

### TC-01: Direct Bridge 模式基础流程

**目标**: 验证 Direct Bridge 模式下 proxy 命令能正确 spawn Agent 并建立 stdio 桥接

**前置条件**:
- Daemon 正在运行
- bilibili-analyzer 模板已加载
- bv-analyzer 实例已创建

**测试步骤**:

```bash
# 1. 在终端 A 启动 Proxy（Direct Bridge 模式）
actant proxy bv-analyzer

# 2. 在另一个终端发送 ACP 消息
# 模拟 IDE 发送 initialize
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}

# 3. 发送 session/new
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{}}

# 4. 发送 session/prompt
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"<session-id>","prompt":[{"type":"text","text":"请分析这个视频: https://www.bilibili.com/video/BV1xx411c7mD"}]}}
```

**预期结果**:
- [x] Proxy 成功 spawn Agent 进程
- [x] ACP 消息能正确往返
- [x] Agent 返回视频分析结果
- [x] Proxy 退出时 Agent 进程终止

---

### TC-02: Session Lease 模式基础流程

**目标**: 验证 Session Lease 模式下 Daemon 能管理 Agent 进程，客户端租借 Session

**前置条件**:
- Daemon 正在运行
- bv-analyzer 实例已创建

**测试步骤**:

```bash
# 1. 先启动 Agent（Daemon 管理）
actant agent start bv-analyzer

# 2. 获取 Agent 状态，确认 running
actant agent status bv-analyzer

# 3. 在终端 A 使用 Session Lease 模式启动 Proxy
actant proxy bv-analyzer --lease

# 4. 发送 ACP 消息进行视频分析
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{}}
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"<session-id>","prompt":[{"type":"text","text":"分析视频 BV1xx411c7mD"}]}}

# 5. 断开 Proxy（Ctrl+C 或关闭终端）

# 6. 检查 Agent 状态，确认仍在运行
actant agent status bv-analyzer

# 7. 重新连接 Proxy
actant proxy bv-analyzer --lease
```

**预期结果**:
- [x] Proxy 成功连接到 Daemon 管理的 Agent
- [x] Session 创建成功
- [x] Prompt 返回视频分析结果
- [x] Proxy 断开后 Agent 进程保持运行
- [x] 重新连接后能恢复 session

---

### TC-03: Session 生命周期管理

**目标**: 验证 session.create/prompt/cancel/close/list RPC 方法

**前置条件**:
- Daemon 正在运行
- bv-analyzer Agent 已启动 (`actant agent start bv-analyzer`)

**测试步骤**:

```bash
# 1. 创建 Session
curl -X POST unix://$ACTANT_SOCKET \
  -d '{"jsonrpc":"2.0","id":1,"method":"session.create","params":{"agentName":"bv-analyzer","clientId":"client-1"}}'

# 预期: 返回 sessionId, agentName, state: "active"

# 2. 列出 Session
curl -X POST unix://$ACTANT_SOCKET \
  -d '{"jsonrpc":"2.0","id":2,"method":"session.list","params":{"agentName":"bv-analyzer"}}'

# 预期: 返回 session 列表，包含刚创建的 session

# 3. 发送 Prompt（同步）
curl -X POST unix://$ACTANT_SOCKET \
  -d '{"jsonrpc":"2.0","id":3,"method":"session.prompt","params":{"sessionId":"<session-id>","text":"分析 BV1xx411c7mD"}}'

# 预期: 返回 stopReason 和 text

# 4. 取消 Session
curl -X POST unix://$ACTANT_SOCKET \
  -d '{"jsonrpc":"2.0","id":4,"method":"session.cancel","params":{"sessionId":"<session-id>"}}'

# 预期: 返回 { ok: true }

# 5. 关闭 Session
curl -X POST unix://$ACTANT_SOCKET \
  -d '{"jsonrpc":"2.0","id":5,"method":"session.close","params":{"sessionId":"<session-id>"}}'

# 预期: 返回 { ok: true }

# 6. 再次列出 Session，确认已关闭
curl -X POST unix://$ACTANT_SOCKET \
  -d '{"jsonrpc":"2.0","id":6,"method":"session.list","params":{"agentName":"bv-analyzer"}}'

# 预期: session 列表为空或不包含已关闭的 session
```

**预期结果**:
- [x] session.create 成功创建 session
- [x] session.list 正确列出 session
- [x] session.prompt 返回视频分析结果
- [x] session.cancel 成功调用 ACP cancel
- [x] session.close 成功关闭 session

---

### TC-04: 自动实例化（并发连接）

**目标**: 验证 Direct Bridge 模式下，Instance 被占用时自动创建 ephemeral 副本

**前置条件**:
- Daemon 正在运行
- bv-analyzer 实例已创建

**测试步骤**:

```bash
# 1. 在终端 A 启动第一个 Proxy
actant proxy bv-analyzer
# 保持运行

# 2. 在终端 B 同时启动第二个 Proxy
actant proxy bv-analyzer

# 3. 观察终端 B 的输出
```

**预期结果**:
- [x] 终端 A 的 Proxy 正常连接到 bv-analyzer
- [x] 终端 B 的 Proxy 检测到 bv-analyzer 被占用
- [x] 自动从 bilibili-analyzer 模板创建 ephemeral 实例（如 bv-analyzer-proxy-1234567890）
- [x] 终端 B 显示提示："Instance "bv-analyzer" occupied → created ephemeral "bv-analyzer-proxy-1234567890""
- [x] 两个 Proxy 都能独立工作

**验证 ephemeral 实例**:

```bash
# 列出所有 agent，应该看到 ephemeral 实例
actant agent list

# 预期: 看到 bv-analyzer-proxy-1234567890 状态为 running
```

---

### TC-05: Agent Chat 双模式切换

**目标**: 验证 agent chat 根据 Agent 状态自动选择 Direct Bridge 或 Daemon-managed 模式

**前置条件**:
- Daemon 正在运行
- bv-analyzer 实例已创建

**测试步骤**:

**场景 A: Agent 未运行（Direct Bridge 模式）**

```bash
# 1. 确保 Agent 未运行
actant agent stop bv-analyzer

# 2. 启动 chat
actant agent chat bv-analyzer

# 3. 输入视频分析请求
you> 分析 BV1xx411c7mD

# 4. 观察输出，应该看到:
# - "direct bridge" 字样
# - 流式输出分析结果
# - 退出时自动清理

# 5. 退出 chat (输入 exit 或 Ctrl+C)
```

**场景 B: Agent 已运行（Daemon-managed 模式）**

```bash
# 1. 启动 Agent
actant agent start bv-analyzer

# 2. 启动 chat
actant agent chat bv-analyzer

# 3. 输入视频分析请求
you> 分析 BV1xx411c7mD

# 4. 观察输出，应该看到:
# - "daemon-managed" 字样
# - 同步输出分析结果
# - 保持 session 上下文

# 5. 继续对话，验证上下文保持
you> 这个视频的时长是多少？
# 应该能引用之前的视频

# 6. 退出 chat
```

**预期结果**:
- [x] Agent 未运行时，chat 使用 Direct Bridge 模式（自行 spawn）
- [x] Agent 已运行时，chat 使用 Daemon-managed 模式（agent.prompt RPC）
- [x] Direct Bridge 模式支持流式输出
- [x] Daemon-managed 模式保持 session 上下文

---

### TC-06: Session Idle TTL 过期

**目标**: 验证 Session idle 状态超过 TTL 后自动过期

**前置条件**:
- Daemon 正在运行
- bv-analyzer Agent 已启动

**测试步骤**:

```bash
# 1. 创建一个短 TTL 的 Session（为了测试，使用 10 秒）
# 这需要直接调用 RPC，因为 CLI 不支持指定 TTL

# 2. 使用 Proxy --lease 模式连接
actant proxy bv-analyzer --lease

# 3. 创建 Session
{"jsonrpc":"2.0","id":1,"method":"session/new","params":{}}

# 4. 断开 Proxy（模拟客户端断开）
# Ctrl+C

# 5. 等待 30 分钟（或修改代码使用短 TTL 测试）

# 6. 重新连接 Proxy，尝试恢复 Session
actant proxy bv-analyzer --lease
{"jsonrpc":"2.0","id":1,"method":"session/new","params":{"resumeSessionId":"<old-session-id>"}}
```

**预期结果**:
- [x] 客户端断开时，session 进入 idle 状态
- [x] idle 超过 TTL（默认 30 分钟）后 session 过期
- [x] 尝试恢复过期 session 失败
- [x] SessionRegistry 自动清理过期 session

**快速验证方式**（修改测试代码）：

```typescript
// 使用短 TTL 进行测试
const registry = new SessionRegistry({
  defaultIdleTtlMs: 5000, // 5 秒
  ttlCheckIntervalMs: 1000, // 1 秒检查
});
```

---

### TC-07: 多客户端 Session 隔离

**目标**: 验证多个客户端使用同一 Agent 时 session 完全隔离

**前置条件**:
- Daemon 正在运行
- bv-analyzer Agent 已启动

**测试步骤**:

```bash
# 1. 客户端 A 连接
actant proxy bv-analyzer --lease
{"jsonrpc":"2.0","id":1,"method":"session/new","params":{}}
# 假设返回 sessionId: "session-a"
{"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"sessionId":"session-a","prompt":[{"type":"text","text":"记住：我在分析 BV1xx411c7mD"}]}}

# 2. 客户端 B 同时连接
actant proxy bv-analyzer --lease
{"jsonrpc":"2.0","id":1,"method":"session/new","params":{}}
# 假设返回 sessionId: "session-b"
{"jsonrpc":"2.0","id":2,"method":"session/prompt","params":{"sessionId":"session-b","prompt":[{"type":"text","text":"记住：我在分析 BV1yy411c7mE"}]}}

# 3. 客户端 A 查询
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"session-a","prompt":[{"type":"text","text":"我刚才让你分析的是哪个视频？"}]}}

# 4. 客户端 B 查询
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"session-b","prompt":[{"type":"text","text":"我刚才让你分析的是哪个视频？"}]}}
```

**预期结果**:
- [x] 客户端 A 和 B 获得不同的 sessionId
- [x] 客户端 A 的上下文（BV1xx411c7mD）不影响客户端 B
- [x] 客户端 B 的上下文（BV1yy411c7mE）不影响客户端 A
- [x] sessionUpdate 通知按 sessionId 正确路由

---

## 自动化测试建议

### 单元测试

```typescript
// packages/api/src/handlers/__tests__/session-handlers.test.ts
describe("session.cancel", () => {
  it("should call ACP cancel when session exists", async () => {
    // 验证 Issue #35 的 session.cancel 实现
  });
});
```

### 集成测试

```typescript
// packages/cli/src/commands/__tests__/proxy-mode.test.ts
describe("Proxy modes", () => {
  it("should use Direct Bridge by default", async () => {});
  it("should use Session Lease with --lease flag", async () => {});
  it("should auto-instantiate when instance is occupied", async () => {});
});
```

### End-to-End 测试

```bash
# tests/e2e/issue-35-acp-proxy.sh
#!/bin/bash
set -e

echo "=== Issue #35 E2E Test ==="

# Setup
actant daemon start
actant template load configs/templates/bilibili-analyzer.json
actant agent create test-bv -t bilibili-analyzer

# Test Direct Bridge
echo "Test 1: Direct Bridge mode"
actant proxy test-bv &
PROXY_PID=$!
sleep 2
kill $PROXY_PID

# Test Session Lease
echo "Test 2: Session Lease mode"
actant agent start test-bv
actant proxy test-bv --lease &
PROXY_PID=$!
sleep 2
kill $PROXY_PID
actant agent stop test-bv

# Cleanup
actant agent destroy test-bv

echo "=== All tests passed ==="
```

---

## 测试 checklist

- [ ] TC-01: Direct Bridge 模式基础流程
- [ ] TC-02: Session Lease 模式基础流程
- [ ] TC-03: Session 生命周期管理
- [ ] TC-04: 自动实例化（并发连接）
- [ ] TC-05: Agent Chat 双模式切换
- [ ] TC-06: Session Idle TTL 过期
- [ ] TC-07: 多客户端 Session 隔离

---

## 参考资料

- Issue #35: `.trellis/issues/0035-acp-proxy-full-protocol.json`
- API 契约: `.trellis/spec/api-contracts.md` §7
- 实现文件:
  - `packages/cli/src/commands/proxy.ts`
  - `packages/cli/src/commands/agent/chat.ts`
  - `packages/api/src/handlers/session-handlers.ts`
  - `packages/core/src/session/session-registry.ts`
  - `packages/api/src/daemon/acp-relay-server.ts`
