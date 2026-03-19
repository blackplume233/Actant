# QA Alpha Round 2 - 回归验证日志

**开始时间**: 2026-02-28T17:59:00+08:00
**环境**: QA Alpha 持久化 (mock launcher)
**修复**: random-walk-comprehensive.json 的 start/stop 步骤改用 rw-claude-tpl

---

## Group A: Agent 生命周期 (claude-code 后端) — 30 steps

全部 PASS。关键验证点：
- create → status=created, interactionModes 包含 start ✅
- start → exit 0, "Started" ✅
- status → running, pid 存在 ✅
- double-start → exit 1, "already running" ✅
- stop → exit 0, "Stopped" ✅
- status → stopped ✅
- stop (idempotent) → exit 0 ✅
- restart → exit 0, running again ✅
- destroy(no-force) → exit 1, "needs --force" ✅
- destroy(--force) → exit 0 ✅
- 并发 create × 3 → 全部成功 ✅
- 并发 start × 2 → running, 1 个 created ✅
- 全部清理 → list 为空 ✅

## Group B: 错误处理 + 模板 + 域组件回归 — 20 steps

全部 PASS。
- daemon status: running ✅
- 6 个错误路径: exit 1 + 正确错误信息 ✅
- destroy --force 幂等: exit 0 ✅
- 模板列表: 3 个模板持久化 ✅
- 域组件 show nonexistent: 全部 exit 1 ✅
- 域组件 list: 全部 exit 0 空数组 ✅

---

**日志结束时间**: 2026-02-28T18:02:00+08:00
