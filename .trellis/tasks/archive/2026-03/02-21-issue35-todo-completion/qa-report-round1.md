# QA 随机漫步测试报告 — Issue #35 全功能验证 (Round 1)

**场景**: Issue #35 ACP Proxy + Session Lease 随机漫步测试
**测试工程师**: QA SubAgent
**时间**: 2026-02-21 18:11:12 ~ 18:20:02 (约 9 分钟)
**结果**: FAILED (34/40 步骤通过, 3 FAIL, 3 WARN)

## 摘要

| # | 步骤 | 命令 | 判定 | 说明 |
|---|------|------|------|------|
| 1.1 | 模板列表空 | `template list -f json` | PASS | 返回 `[]` |
| 1.2 | Agent 列表空 | `agent list -f json` | PASS | 返回 `[]` |
| 1.3 | 加载模板 | `template load` | PASS | 加载成功 |
| 1.4 | 模板列表有值 | `template list -f json` | PASS | 包含 qa-test-tpl |
| 1.5 | 创建 Agent | `agent create test-agent` | PASS | 状态 created |
| 1.6 | Agent 列表 | `agent list -f json` | PASS | 包含 1 个 agent |
| 1.7 | Agent 状态 created | `agent status -f json` | PASS | status=created |
| 1.8 | 启动 Agent | `agent start` | PASS | exit 0 |
| 1.9 | Agent 状态 running | `agent status -f json` | PASS | status=running, pid=10000 |
| 1.10 | 停止 Agent | `agent stop` | PASS | exit 0 |
| 1.11 | Agent 状态 stopped | `agent status -f json` | PASS | status=stopped |
| 1.12 | 销毁无 --force | `agent destroy` | PASS | exit 1, 提示需要 --force |
| 1.13 | 销毁有 --force | `agent destroy --force` | PASS | exit 0 |
| 1.14 | Agent 列表空 | `agent list -f json` | PASS | 返回 `[]` |
| 2.2 | session.create 停止态 | RPC session.create | PASS | 正确报错 "not running" |
| 2.3 | session.list 空 | RPC session.list | PASS | 返回 `[]` |
| 2.4 | session.create 不存在 | RPC session.create | PASS | "not found" |
| 2.5 | session.create 无 ACP | RPC session.create | **FAIL** | Agent running 但无 ACP 连接 |
| 2.9 | session.create ACP 模板 | RPC session.create | **FAIL** | claude-code 模板仍无法在 mock 模式创建 session |
| 2.11 | session.cancel 不存在 | RPC session.cancel | PASS | "not found" |
| 2.12 | session.close 不存在 | RPC session.close | PASS | "not found" |
| 2.13 | session.prompt 不存在 | RPC session.prompt | PASS | "not found" |
| 2.14 | session.list 无过滤 | RPC session.list | PASS | 返回 `[]` |
| 2.15 | session.list 不存在 agent | RPC session.list | PASS | 返回 `[]` |
| 3.1 | proxy --help | `proxy --help` | PASS | 显示 --lease, -t 选项 |
| 3.2 | proxy 不存在 agent | `proxy ghost-agent` | PASS | "not found" |
| 3.3 | proxy 停止态 agent | `proxy sess-agent` | WARN | `spawn EINVAL`，错误信息不够友好 |
| 3.4 | proxy --lease 非运行 | `proxy --lease` | PASS | 正确提示 agent not running |
| 3.5 | proxy --lease --template | `proxy --lease -t tpl` | WARN | `--template` 被静默忽略，应警告或阻止 |
| 3.6 | 自动创建 agent | `proxy -t qa-test-tpl` | PASS | auto-agent 被正确创建 |
| 4.1 | proxy --lease 不存在 | `proxy nonexist --lease` | PASS | "not found" |
| 5.1 | 重名创建 | `agent create` 重名 | PASS | exit 1, "already exists" |
| 5.4 | 重复停止 | `agent stop` 已停止 | WARN | exit 0 且输出 "Stopped"，应提示已停止 |
| 5.5 | 无效 JSON 模板 | `template load invalid` | PASS | "Invalid JSON" |
| 5.6 | 不存在的文件 | `template load nonexist` | PASS | "not found" |
| 5.7 | 缺少 --template | `agent create` 无选项 | PASS | "not specified" |
| 5.8 | 不存在的模板 | `agent create -t nonexist` | PASS | "not found" |
| 5.9 | session.create 空参数 | RPC session.create `{}` | WARN | 返回 `Agent "undefined" not found` |
| 5.10 | session.cancel 空 ID | RPC session.cancel `""` | PASS | "not found" |
| 6.3 | 完整测试套件 | `pnpm test` | **FAIL** | 411/412 pass, 1 fail (daemon stop test) |

## 失败/警告分析

### FAIL-1: Session Lease API 在 Mock 模式下完全不可测试 [步骤 2.5, 2.9]

- **期望**: `session.create` 能在 mock 模式下创建 session lease
- **实际**: `cursor` 后端返回 "has no ACP connection"；`claude-code` 后端的 mock PID 被 ProcessWatcher 检测为死亡，agent 立即变为 stopped
- **根因**: Mock launcher 返回假 PID (10000+)，不对应任何真实进程。ProcessWatcher 在 5 秒内标记 agent 为 stopped。即使 agent 暂时 running，non-ACP 后端（cursor）不建立 ACP 连接，session.create 的 `hasAcpConnection` 检查失败
- **影响**: Issue #35 的核心功能（session.cancel ACP 集成）在 mock 模式下**完全无法端到端测试**
- **建议**: 需要为 Session Lease API 添加 mock ACP 支持，或创建专门的集成测试基础设施

### FAIL-2: daemon stop 测试失败 [步骤 6.3]

- **期望**: `createDaemonStopCommand > connection fails: prints Daemon is not running` 测试通过
- **实际**: `expected false to be true`，断言 `output.logs.some((l) => l.includes("Daemon is not running"))` 失败
- **根因**: `daemon stop` 连接失败时的错误处理可能未正确输出 "Daemon is not running" 消息
- **文件**: `packages/cli/src/commands/__tests__/commands.test.ts:318`

### WARN-1: proxy Direct Bridge `spawn EINVAL` [步骤 3.3]

- **期望**: proxy 连接到停止态 agent 时给出清晰错误信息
- **实际**: 输出 `Error: spawn EINVAL`，对用户不友好
- **建议**: 应在尝试 spawn 前检查 agent 状态，或捕获 EINVAL 提供更好的错误信息

### WARN-2: `proxy --lease --template` 静默忽略 [步骤 3.5]

- **期望**: `--lease` 与 `--template` 组合使用时，应给出警告或错误
- **实际**: `--template` 被静默忽略，仅执行 `--lease` 逻辑
- **建议**: 互斥选项应有明确提示

### WARN-3: `agent stop` 已停止 agent 返回成功 [步骤 5.4]

- **期望**: 对已停止的 agent 执行 stop 应返回警告或不同消息
- **实际**: 返回 exit 0 和 "Stopped sess-agent"，与正常停止无区别

### WARN-4: session.create 空参数显示 "undefined" [步骤 5.9]

- **期望**: 空参数调用 `session.create` 应返回参数验证错误
- **实际**: 返回 `Agent "undefined" not found`，暴露内部实现细节
- **建议**: 添加参数验证，在访问 params 前检查必填字段

## 文档一致性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Session Lease API 5 个 RPC 方法 | PASS | 全部已实现且参数一致 |
| SessionLeaseInfo 结构 | PASS | 7 个字段完全匹配 |
| Direct Bridge 架构描述 | PASS | 代码实现与文档一致 |
| Session Lease 架构描述 | PASS | 代码实现与文档一致 |
| deprecated proxy handlers | PASS | 正确标记 |
| `proxy.envCallback` | **FAIL** | 文档有但未实现 |
| `--env-passthrough` 选项 | **FAIL** | 文档有但未实现 |
| ResolveResult `name` vs `instanceName` | **WARN** | 文档说 `name`，代码用 `instanceName` |
| agent.resolve `overrides` 参数 | **WARN** | 代码有但文档未记录 |
| Proxy session/prompt 响应 | **WARN** | 仅发送 `stopReason`，`text` 未转发给 IDE |

## 测试覆盖缺口

1. **无 session-handlers.test.ts**: Session handlers 没有单元测试
2. **无 session-registry.test.ts**: SessionRegistry 没有单元测试
3. **Mock 模式无法测试 Session Lease**: 需要 mock ACP 或集成测试支持
4. **未测试 agent chat 双模式切换**: 需要交互式终端
5. **未测试 Session TTL 过期**: 需要时间控制或短 TTL 配置
6. **未测试多客户端 Session 隔离**: 无法在 mock 模式创建 session

## 创建的 Issue

（待 Phase 2 创建）
