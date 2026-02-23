## QA 集成测试报告

**场景**: 即兴探索 — 创建定时 web 搜索 Agent，20 秒间隔执行 5+ 次随机网页检索
**测试工程师**: QA SubAgent (Cursor)
**时间**: 2026-02-22T22:35:00 ~ 22:49:00 (+08:00)
**结果**: FAILED (3/6 步骤通过, 2 警告, 1 失败)

### 摘要

| # | 步骤 | 命令 | 判定 | 说明 |
|---|------|------|------|------|
| 0 | 前置条件检查 | — | PASS | claude CLI 已安装，CLI 已构建 |
| 1 | 启动 Daemon | `daemon start --foreground` | WARN | Socket 路径不匹配需手动修正 |
| 2 | 加载 web-search 模板 | `template load` | **FAIL** | schedule 字段被 toAgentTemplate() 丢弃 |
| 3 | 创建 Agent | `agent create` | PASS | 正常创建 |
| 4 | 首次 agent run | `agent run` | WARN | WebSearch 权限被拒 |
| 5 | 6 轮 web 搜索 (20s间隔) | `agent run` x6 | WARN | 5/6 超时，1/6 成功 |
| 6 | 环境清理 | `daemon stop` + rm | PASS | 正常清理 |

### 失败/警告分析

**Step 2 - 加载模板 [FAIL]**:
- 期望: 模板的 `schedule.heartbeat` 配置被保留，Agent 启动后自动激活 EmployeeScheduler
- 实际: `toAgentTemplate()` 手动映射函数遗漏 `schedule`、`permissions`、`domainContext.plugins` 字段
- 根因: `packages/core/src/template/loader/template-loader.ts` 第 103-125 行的映射函数不完整
- 影响: 所有依赖 schedule 配置的功能（Heartbeat/Cron/Hook）均无法通过模板激活

**Step 1 - Daemon socket 路径 [WARN]**:
- 期望: 设置 `ACTANT_HOME` 后 Daemon 和 CLI 自动使用一致的 socket 路径
- 实际: Daemon 从 `ACTANT_HOME` 派生 socket 路径 (`getIpcPath`)，但 CLI 使用 `ACTANT_SOCKET` 或 `getDefaultIpcPath()`
- 分析: 当自定义 `ACTANT_HOME` 时，用户需要同时设置 `ACTANT_SOCKET` 才能保证路径一致。这是一个可用性问题。

**Step 4 - WebSearch 权限 [WARN]**:
- 期望: `effectivePermissions.allow: ["*"]` 应涵盖所有工具
- 实际: Claude Code 的 `-p` 模式不接受通配符 `*` 来授权 WebSearch 等特殊工具
- 分析: Actant 的 Layer 1 权限写入 `settings.local.json {"allow":["*"]}`，但 Claude Code 对 WebSearch 要求显式命名

**Step 5 - 超时 [WARN]**:
- 期望: 45s 内完成 web 搜索并返回摘要
- 实际: 5/6 轮超时，1/6 成功
- 分析: 非 Actant 问题，Claude Code 在 `-p` 模式下首次加载/搜索需更长时间

### 创建的 Issue

| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| #118 | Template loader drops schedule, permissions, and plugins fields during Zod-to-type mapping | bug | P1 |

### 完整执行日志

详见 `qa-log-round1.md`

### 额外发现

1. **模型使用**: agent run 实际使用的是 `kimi-for-coding` 模型（通过 Claude Code 的模型路由），而非模板中配置的 `claude-sonnet-4-20250514`。这可能是用户本地的 Claude Code 配置覆盖了模板设置。
2. **费用**: 单次 agent run 费用约 $0.14（即使工具被拒绝仍会产生 token 费用）。
