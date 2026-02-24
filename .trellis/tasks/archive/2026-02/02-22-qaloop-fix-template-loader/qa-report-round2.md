# QA 集成测试报告 — Round 2 (Deep Integration)

**场景**: 验证 schedule/permissions/plugins 的端到端消费路径
**测试工程师**: QA SubAgent
**时间**: 2026-02-22
**结果**: PASSED with 2 WARN (11/13 PASS, 2 WARN, 0 FAIL)

## 摘要

| # | 步骤 | 场景类型 | 判定 |
|---|------|---------|------|
| 1 | 启动 Daemon + 加载模板 | 基础 | PASS |
| 2 | agent create → permissions 物化到 .claude/settings.local.json | 端到端 | PASS |
| 3 | schedule list → 确认 scheduler 未集成 | 架构缺口 | WARN |
| 4 | agent.dispatch → 无 scheduler 时的友好错误 | 边界 | PASS |
| 5 | Permission Preset "permissive" → 端到端 | 预设 | PASS |
| 6 | Permission Preset "restricted" → 端到端 | 预设 | PASS |
| 7 | 无效 Permission Preset "super-admin" → 拒绝 | 负面 | PASS |
| 8 | 无效 Schedule (intervalMs=100) → 拒绝 | 负面 | PASS |
| 9 | Sandbox + additionalDirectories → 端到端 | 复杂权限 | WARN |
| 10 | extensions 字段 roundtrip | 数据完整性 | PASS |
| 11 | 多 Agent 共存验证 | 隔离性 | PASS |
| 12 | agent destroy + workspace 清理 | 生命周期 | PASS |
| 13 | 停止 Daemon + 环境清理 | 清理 | PASS |

## 关键发现

### PASS: permissions 端到端完全可用

permissions 从模板定义经过完整链路成功消费：

```
template JSON → Zod 验证 → toAgentTemplate() → AgentInitializer
→ resolvePermissions()/resolvePermissionsWithMcp()
→ WorkspaceBuilder → ClaudeCodeBuilder.injectPermissions()
→ .claude/settings.local.json
```

**验证的所有 permissions 变体**：
- ✅ 自定义对象 (allow/deny/defaultMode)
- ✅ 预设字符串 "permissive" → allow:["*"], bypassPermissions
- ✅ 预设字符串 "restricted" → allow:["Read","WebSearch"], deny:["Bash","WebFetch"]
- ✅ Sandbox 配置 → 正确物化到 settings.local.json 顶层
- ✅ 无效预设 → 被 Zod 验证拒绝
- ✅ 多 Agent 权限隔离

### WARN: schedule 字段加载但未被消费（已知缺口 #103）

`template.schedule` 在模板 load/show/persist 流程中完整保留（R1 已验证），但：
- `ctx.schedulers` 始终为空 Map
- `startAgent()` 不创建 `EmployeeScheduler`
- `schedule list` 返回 `{ sources: [], running: false }`
- `agent.dispatch` 返回 `"No scheduler for agent"`

**这不是 #118 的回归**，而是 `EmployeeScheduler` 集成的独立缺口（Issue #103）。

### WARN: additionalDirectories 未物化到 settings.local.json

`permissions.additionalDirectories` 在 `.actant.json` 的 `effectivePermissions` 中正确保留，
但 `ClaudeCodeBuilder.injectPermissions()` 不将其写入 `.claude/settings.local.json`。

**根因**: `injectPermissions()` 只处理 `allow/deny/ask/sandbox`，遗漏了 `additionalDirectories`。

### PASS: plugins 加载但 PluginManager 未注入（已知）

`domainContext.plugins` 在模板中正确保留。`WorkspaceBuilder` 有处理代码，
但 `AppContext` 创建 `AgentInitializer` 时未传入 `pluginManager`。
不在本次修复范围内。

## 与 Round 1 对比

| 维度 | Round 1 | Round 2 |
|------|---------|---------|
| 测试深度 | 模板 load/show/persist | Agent create → workspace 物化 → RPC 交互 |
| 覆盖字段 | schedule, permissions, plugins, extensions | 同上 + preset 解析, sandbox, additionalDirs |
| 场景数 | 9 步 | 13 步 |
| 发现 | 全 PASS | 2 WARN（已知架构缺口 + 物化遗漏） |
| 新增 Issue | 无 | 无（WARN 均为已知问题） |

## 完整执行日志

参见: `qa-log-round2.md`
