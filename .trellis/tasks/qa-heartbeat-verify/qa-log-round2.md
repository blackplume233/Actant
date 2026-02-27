# QA Log — HeartbeatPlugin 事件日志验证 — Round 2

**范围**: 输出 plugin:heartbeat:* 事件日志，验证 EventBus 事件链路  
**环境**: real daemon (mock launcher)  
**时间**: 2026-02-27  

---

## 步骤 2 — 等待 32s 后查询，验证第 2/3 次 tick 积累

**输入**: sleep 32s → `node call-events.mjs 100`

**输出**:
```json
totalTicks:1 @ 14:30:36.876
totalTicks:2 @ 14:31:06.886   (+30010ms)
totalTicks:3 @ 14:31:36.887   (+30001ms)
```

**判断**: ✅ PASS — 事件持续积累，间隔精确

---

## 步骤 3 — 只过滤 plugin:heartbeat 事件

**输入**: `node call-events.mjs 200 "plugin:heartbeat"`

**输出**: 3条 `plugin:heartbeat:healthy`，Total: 3 events matching "plugin:heartbeat"

**判断**: ✅ PASS — 过滤机制正常，无杂音

---

## 步骤 4 — 精确计时分析

**输入**: 对4个 tick 时间戳计算差值

**输出**:
```
Tick 1 -> Tick 2: 30010ms
Tick 2 -> Tick 3: 30001ms
Tick 3 -> Tick 4: 30002ms
```

**判断**: ✅ PASS — 偏差仅 1-10ms，setInterval(30000ms) 极其稳定

---

## 步骤 5 — unhealthy 路径单元测试执行记录

**输入**: `pnpm --filter @actant/core test -- --reporter=verbose "heartbeat"`

**输出**: `15 tests passed` — 包含 "emits plugin:heartbeat:unhealthy when a crash is detected" 用例

**判断**: ✅ PASS — process:crash → consecutiveFailures++ → emit plugin:heartbeat:unhealthy 链路验证通过

---

## 步骤 6 — 最终完整事件日志（5次 tick）

**输入**: `node call-events.mjs 200`

**输出**: 6条事件：actant:start + 5×plugin:heartbeat:healthy (totalTicks 1-5)

**判断**: ✅ PASS — 5次 tick 全部正确记录到 EventBus in-memory buffer

---

## 步骤 7 — Daemon 停止

**输入**: `actant daemon stop`

**输出**: `Daemon stopping...` / exit 0

**判断**: ✅ PASS — 干净停止

---

## 步骤 1 — daemon 启动后立即查询全量事件

**输入**: `node call-events.mjs 100` (ACTANT_HOME=tmp)

**输出**:
```json
[
  {"ts":1772202606869,"event":"actant:start","caller":"system:Daemon","payload":{"version":"0.1.0"}},
  {"ts":1772202636876,"event":"plugin:heartbeat:healthy","caller":"system:HeartbeatPlugin","payload":{"totalTicks":1}}
]
Total: 2 events
```

**判断**: ✅ PASS — 
- `actant:start` 事件已记录（daemon 启动）
- `plugin:heartbeat:healthy` 事件已记录（totalTicks:1，首次 tick 在 ~30s 后触发）
- caller 正确显示为 `system:HeartbeatPlugin`

---

