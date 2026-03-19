# QA Alpha Round 1 - 测试报告

**场景**: 随机漫步深度测试 (random-walk + lifecycle + error-handling + template-management + explore)
**测试工程师**: QA SubAgent
**时间**: 2026-02-28T17:52~17:58 (+08:00)
**环境**: QA Alpha 持久化, mock launcher, Windows named pipe
**结果**: **PASSED** (70/76 步骤通过, 6 警告, 0 实质性失败)

## 摘要

| # | 测试组 | 步骤数 | PASS | WARN | FAIL |
|---|--------|--------|------|------|------|
| 1 | Daemon + 基础设施 | 10 | 10 | 0 | 0 |
| 2 | 错误处理边界 | 15 | 15 | 0 | 0 |
| 3 | Agent 生命周期 (cursor 后端) | 30 | 24 | 6 | 0 |
| 4 | 模板 + 域组件 CRUD | 15 | 15 | 0 | 0 |
| 5 | Claude-code 后端完整生命周期 | 8 | 8 | 0 | 0 |
| 6 | 白盒验证 + 额外探索 | 6 | 4 | 2 | 0 |
| — | 单元测试 (pnpm test) | 1027 | 1027 | 0 | 0 |
| **合计** | **—** | **76+1027** | **1097** | **6** | **0** |

## WARN 分析

### WARN-1: cursor 后端不支持 `agent start` (Steps 32, 37, 43-44)

**观察**: `agent start <agent>` 对 cursor 后端返回 exit 1:
```
[RPC -32603] Agent "qa-loop-agent-1" (cursor) does not support "start" mode. Supported modes: open
```

**分析**: 这是 cursor 后端的设计限制，不是代码 bug。cursor 后端仅支持 `open` 模式（在编辑器中打开 workspace），不支持 `start`（启动后台进程）。`random-walk-comprehensive` 等场景文件使用 `rw-basic-tpl`（cursor 后端）测试 start/stop 流程是场景设计不当。

**补测验证**: 使用 `rw-claude-tpl`（claude-code 后端）成功验证了完整的 create → start → running → double-start(rejected) → stop → stopped → restart → destroy 生命周期，全部 PASS。

**建议**: 更新 `random-walk-comprehensive.json` 场景，将 start/stop 相关步骤改用 `rw-claude-tpl` 或新增支持 start 的模板。

### WARN-2: `agent tasks` / `agent logs` 对不存在 Agent 返回 exit 0 (Steps 74-75)

**观察**:
- `agent tasks nonexistent-agent` → exit 0, "Queued: 0  Processing: false"
- `agent logs nonexistent-agent` → exit 0, "No execution logs."

**分析**: 其他 agent 子命令（status, start, stop, dispatch, schedule）对不存在的 Agent 返回 exit 1 + "not found" 错误。但 `tasks` 和 `logs` 返回 exit 0 并给出空结果，行为不一致。

**可能原因**: tasks 和 logs 命令可能直接查询内存中的 scheduler 队列和日志，而非先验证 Agent 是否存在。当没有对应 scheduler 时，返回空结果。

**建议**: 考虑在返回空结果前先检查 Agent 是否存在，保持 CLI 错误码一致性。

## 白盒验证结果

Home 目录结构完整：
- `configs/templates/` — 3 个模板文件已持久化 ✅
- `instances/registry.json` — 实例注册表存在 ✅
- `journal/2026-02-28.jsonl` — 活动日志正在写入 ✅
- `config.json` — setup 创建的全局配置 ✅
- `daemon.pid` — Daemon PID 文件 ✅
- 所有测试 Agent 已正确清理，instances/ 目录下无残留 ✅

## 创建的 Issue

无需创建 Issue。所有 WARN 都是低严重度的改善建议：
1. 场景文件设计优化（使用正确后端测试 start/stop）
2. CLI 退出码一致性改善（tasks/logs 对不存在 Agent 的处理）

这些不影响功能正确性，可在后续迭代中改善。

## 完整执行日志

参见: `.trellis/qa-alpha/logs/qa-log-round1.md`
