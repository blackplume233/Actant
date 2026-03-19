---
generated: true
---

<!-- GENERATED -->

# ACP 连接

> 让任何 ACP 客户端接入 Actant 管理的 Agent。

ACP（Agent Client Protocol）是 Agent 与外部客户端通信的标准协议。Actant 提供两种连接模式。

## 模式 A：Direct Bridge（默认）

客户端 spawn Agent 进程，端到端直连。进程随连接走。

```
IDE ──ACP/stdio──▶ Proxy ──stdio──▶ Agent 进程
```

- 每次连接都冷启动
- 并发时自动创建临时实例
- 最简单，适合大多数场景

## 模式 B：Session Lease

Daemon 持有 Agent 进程，客户端向 Daemon 租借 Session。进程独立于客户端。

```
IDE ──▶ Proxy ──Daemon API──▶ Daemon ──ACP──▶ Agent（常驻）
```

- 零冷启动（warm process）
- 多客户端并发（各持独立 Session）
- Session 可恢复

## 怎么选

| 场景 | 推荐 |
|------|------|
| IDE 接入、一般使用 | Direct Bridge（默认） |
| 需要 Session 恢复 / 避免冷启动 | Session Lease |
| 7×24 自动调度 | Daemon Managed（acp-service） |

## 命令

```bash
actant proxy my-agent              # Direct Bridge（默认）
actant proxy my-agent --lease      # Session Lease
actant agent chat my-agent         # Agent 已运行→Session Lease，否则→Direct Bridge
```
