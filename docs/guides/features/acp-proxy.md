# 功能：ACP 连接与代理（ACP Proxy）

> ACP（Agent Client Protocol）是 Agent 与外部客户端通信的标准协议。Actant 提供两种连接模式——Direct Bridge 和 Session Lease，适配不同的使用场景。

---

## 这个功能做什么

ACP 代理解决的核心问题是：**如何让 IDE、CLI、Web UI 等不同客户端统一接入 Agent**。

无论使用什么前端（Cursor、Claude Desktop、自定义脚本），都通过 ACP 协议与 Agent 通信，Actant 负责连接的建立、会话的管理和生命周期的控制。

**一句话总结**：让任何 ACP 兼容的客户端都能连接到 Actant 管理的 Agent。

---

## 两种连接模式

### 模式 A：Direct Bridge（直连桥接）— 默认

客户端自己 spawn Agent 进程，端到端直连。进程随连接走。

```
┌───────────────┐
│  ACP Client   │  IDE / Claude Desktop
└───────┬───────┘
        │ ACP / stdio
┌───────▼───────┐
│  Proxy Bridge │  stdin ↔ Agent stdin, stdout ↔ Agent stdout
└───────┬───────┘
        │ ACP / stdio
┌───────▼───────┐
│  Agent 进程    │  进程随 Proxy 退出而终止
└───────────────┘
```

| 属性 | 值 |
|------|---|
| 进程生命周期 | 跟随连接：客户端断开 → 进程终止 |
| 冷启动 | 每次连接都有 |
| 并发策略 | 自动实例化——Instance 已占用时自动创建临时 Instance |
| 适用场景 | IDE 连接（最常见）、需要完全隔离的场景 |

### 模式 B：Session Lease（会话租约）

Daemon 持有 Agent 进程，客户端向 Daemon 租借 Session。进程独立于客户端存活。

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  IDE     │  │  Chat    │  │  Web UI  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
┌────▼──────────────▼──────────────▼────┐
│  Daemon                                │
│  Session Registry: A→Client1, B→CLI   │
│  AcpConnection (Daemon 始终持有)       │
└──────────────────┬─────────────────────┘
                   │ ACP / stdio
                   ▼
            Agent 子进程（warm，长驻）
```

| 属性 | 值 |
|------|---|
| 进程生命周期 | 独立于客户端，客户端断开后进程继续运行 |
| 冷启动 | 仅首次启动 |
| 并发策略 | 多 Session——多个客户端通过独立 Session 并发交互 |
| Session 恢复 | 客户端断开后 Session 保留（idle），重连可恢复 |
| 适用场景 | 长期使用的 Agent、需要 Session 恢复、多客户端并发 |

---

## 使用场景

### 场景 1：IDE 连接 Agent（默认 Direct Bridge）

最常见的使用方式。Cursor 或 Claude Desktop 通过 ACP 连接 Agent。

```bash
# 启动代理（默认 Direct Bridge）
actant proxy my-agent

# 等效于
actant proxy my-agent --direct
```

Proxy 进程作为 ACP 服务端运行，IDE 连接后直接与 Agent 交互。

### 场景 2：多客户端共享一个 Agent（Session Lease）

先启动 Agent，然后多个客户端通过 Session Lease 接入。

```bash
# 1. 先启动 Agent（Daemon 管理进程）
actant agent start my-agent

# 2. IDE 通过 Session Lease 接入
actant proxy my-agent --lease

# 3. CLI 也可以同时交互（自动走 Session Lease）
actant agent chat my-agent

# 4. 或发送单次提示
actant agent prompt my-agent --prompt "分析代码"
```

### 场景 3：并发连接的自动实例化

当使用 Direct Bridge 模式且 Agent 已被占用时，系统自动创建临时实例：

```
Client A 连接 my-agent → 成功
Client B 连接 my-agent → 发现已占用
  → 自动从同一 Template 创建 my-agent-eph-<uuid>
  → 独立工作区，独立进程
Client B 断开 → 临时 Instance 自动销毁
```

### 场景 4：外部系统集成

外部系统（CI 工具、IM 机器人）通过 resolve + attach 机制接入：

```bash
# 获取 Agent 的启动信息
actant agent resolve my-agent
# 返回: { command, args, cwd }

# 外部系统自己 spawn 进程
# 外部系统调用 attach 注册
actant agent attach my-agent

# 使用完毕后解除
actant agent detach my-agent
```

---

## 操作方式

```bash
# Direct Bridge（默认）
actant proxy <name>
actant proxy <name> --direct

# Session Lease
actant proxy <name> --lease

# 指定模板启动代理
actant proxy <name> -t <template>

# 交互式对话（Agent 已运行时走 Session Lease，否则走 Direct Bridge）
actant agent chat <name>
```

---

## 选择指南

```
大多数情况（IDE 接入、一般使用）：
  └─ Direct Bridge（默认）— 最简单

需要长期运行 + 自动调度？
  └─ Daemon Managed（acp-service 模式）

Agent 已通过 start 运行，需要 Session 恢复或避免冷启动？
  └─ Session Lease — 通过 --lease 选项启用
```

两种模式可以共存：`agent start` 启动后，`proxy --lease` 走 Session Lease，`proxy`（默认）仍然走 Direct Bridge。

---

## 通信架构

```
┌─────────┐  JSON-RPC/IPC  ┌─────────────┐  ACP  ┌───────────────┐
│   CLI   │ ◄────────────► │   Daemon    │ ◄───► │ Agent Process │
└─────────┘                └─────────────┘       └───────────────┘
```

| 协议层 | 传输 | 用途 |
|--------|------|------|
| **JSON-RPC** | Unix socket / Windows named pipe | 管理操作：create / start / stop / list |
| **ACP Session Relay** | 同上（流式） | 实时交互：prompt / stream / cancel |
| **ACP Direct** | stdio（Proxy ↔ Agent） | Direct Bridge 模式 |
| **HTTP** | TCP（未来） | Web UI / Webhook / IM 接入 |

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 创建 Agent
actant agent create proxy-test -t code-review-agent

# --- Direct Bridge 测试 ---

# 3. 启动 Direct Bridge 代理（会在前台运行）
# actant proxy proxy-test
# 此时 IDE 可以通过 ACP 连接到该 Agent
# Ctrl+C 退出后 Agent 进程自动终止

# --- Session Lease 测试 ---

# 4. 先启动 Agent
actant agent start proxy-test

# 5. 使用 chat 交互（走 Session Lease）
actant agent chat proxy-test
# 交互完毕后退出 chat，Agent 进程仍在运行

# 6. 确认 Agent 仍在运行
actant agent status proxy-test
# 预期: status = "running"

# 7. 清理
actant agent stop proxy-test
actant agent destroy proxy-test --force
actant daemon stop
```

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 生命周期管理](agent-lifecycle.md) | 不同启动模式对应不同的连接行为 |
| [雇员调度器](employee-scheduler.md) | 雇员模式使用 Daemon Managed 连接 |
| [CLI 交互模式](cli-interaction.md) | `chat` 和 `proxy` 命令的使用 |
