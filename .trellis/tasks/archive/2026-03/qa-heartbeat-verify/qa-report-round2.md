# QA Report — HeartbeatPlugin 事件日志验证 — Round 2

**范围**: 输出 plugin:heartbeat:* 事件日志，验证 EventBus 事件链路  
**环境**: real daemon (mock launcher)  
**时间**: 2026-02-27  
**结果**: ✅ **PASS — 100%（7/7）**

---

## 完整事件日志（真实 Daemon 采集）

连接 daemon 运行约 150 秒后，`events.recent` RPC 返回：

```json
[
  {
    "ts": 1772202606869,
    "event": "actant:start",
    "caller": "system:Daemon",
    "payload": { "version": "0.1.0" }
  },
  {
    "ts": 1772202636876,
    "event": "plugin:heartbeat:healthy",
    "caller": "system:HeartbeatPlugin",
    "payload": { "totalTicks": 1 }
  },
  {
    "ts": 1772202666886,
    "event": "plugin:heartbeat:healthy",
    "caller": "system:HeartbeatPlugin",
    "payload": { "totalTicks": 2 }
  },
  {
    "ts": 1772202696887,
    "event": "plugin:heartbeat:healthy",
    "caller": "system:HeartbeatPlugin",
    "payload": { "totalTicks": 3 }
  },
  {
    "ts": 1772202726889,
    "event": "plugin:heartbeat:healthy",
    "caller": "system:HeartbeatPlugin",
    "payload": { "totalTicks": 4 }
  },
  {
    "ts": 1772202756902,
    "event": "plugin:heartbeat:healthy",
    "caller": "system:HeartbeatPlugin",
    "payload": { "totalTicks": 5 }
  }
]
```

---

## Tick 精确计时分析

| 轮次 | 事件 | timestamp | 与上次间隔 |
|------|------|-----------|-----------|
| — | `actant:start` | 14:30:06.869 | — |
| Tick 1 | `plugin:heartbeat:healthy` | 14:30:36.876 | +30007ms（首次）|
| Tick 2 | `plugin:heartbeat:healthy` | 14:31:06.886 | **+30010ms** |
| Tick 3 | `plugin:heartbeat:healthy` | 14:31:36.887 | **+30001ms** |
| Tick 4 | `plugin:heartbeat:healthy` | 14:31:06.889 | **+30002ms** |
| Tick 5 | `plugin:heartbeat:healthy` | 14:32:36.902 | **+30013ms** |

**setInterval(30000ms) 精度**：偏差 1–13ms（< 0.05%），极其稳定

---

## 事件字段说明

| 字段 | 值 | 含义 |
|------|----|------|
| `event` | `plugin:heartbeat:healthy` | HeartbeatPlugin tick 成功 |
| `caller` | `system:HeartbeatPlugin` | 由系统组件 HeartbeatPlugin 发出 |
| `payload.totalTicks` | 1, 2, 3, 4, 5 | 累计 tick 次数，单调递增 |
| `agentName` | 无 | actant 作用域插件，无绑定 agent |

---

## unhealthy 路径（单元测试验证）

真实 Daemon 中未发生 `process:crash`（环境隔离，无 agent 运行），因此无 `plugin:heartbeat:unhealthy` 事件记录。

通过单元测试验证该路径：

```
✓ emits plugin:heartbeat:unhealthy when a crash is detected
✓ increments consecutiveFailures on each process:crash event
✓ resets consecutiveFailures to 0 on a clean tick
```

当 `process:crash` 事件触发时，HeartbeatPlugin 会发出：
```json
{
  "event": "plugin:heartbeat:unhealthy",
  "caller": "system:HeartbeatPlugin",
  "payload": { "consecutiveFailures": N }
}
```

---

## 通过率趋势

| 轮次 | 单元测试 | 黑盒场景 | 事件日志 | 新建 Issue |
|------|---------|---------|---------|-----------|
| R1   | 787/787 | 14/14 | 未采集 | — |
| R2   | 15/15 (heartbeat) | 7/7 | 6 事件正确 | — |

**最终结论**: ✅ HeartbeatPlugin 事件链路完全正确。EventBus 实时记录每次 tick 事件，`caller`/`event`/`payload` 字段完整，30s 间隔精度 < 0.05%。
