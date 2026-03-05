## QA 集成测试报告

**场景**: 即兴探索（CLI + Dashboard 深度测试）
**测试工程师**: QA SubAgent
**时间**: 2026-03-01 00:37-00:54 (UTC+8)
**结果**: FAILED (14/17 步骤通过, 3 警告, 1 失败)

### 摘要
| # | 步骤 | 命令 | 判定 | 耗时 |
|---|------|------|------|------|
| 1 | 构建产物检查 | `ls packages/cli/dist/bin/actant.js && ls packages/dashboard/dist/client/index.html` | PASS | 快速 |
| 2 | Daemon 启动前状态检查 | `actant daemon status -f json` | PASS | 快速 |
| 3 | Daemon 首次启动（相对 ACTANT_SOCKET） | `actant daemon start` | FAIL | 快速 |
| 4 | Daemon 启动修复（绝对 ACTANT_HOME） | `actant daemon start` | PASS | 快速 |
| 5 | Daemon 健康确认 | `actant daemon status -f json` | PASS | 快速 |
| 6 | 模板检查 | `actant template list -f quiet` | PASS | 快速 |
| 7 | 创建 qa-dash-a/b/c | `actant agent create ...` | PASS | 快速 |
| 8 | Agent 列表核验 | `actant agent list -f json` | PASS | 快速 |
| 9 | 启动 qa-dash-a | `actant agent start qa-dash-a` | WARN | 快速 |
| 10 | 启动失败后状态回读 | `actant agent status qa-dash-a -f json` | PASS | 快速 |
| 11 | 启动 Dashboard + API 验证 | `actant dashboard --port 3212 --no-open` + `curl /v1/status` | PASS | 快速 |
| 12 | Playwright MCP 通道验证 | `skill_mcp(playwright.*)` | WARN | 快速 |
| 13 | Dashboard 深度输入回归 | `python dash-input-deep.py` | WARN | 中等 |
| 14 | Service 聊天输入专项复测 | `agent create qa-svc-chat` + `python dash-chat-service-probe.py` | PASS | 快速 |
| 15 | 白盒产物校验 | `ls/read .actant.json/registry.json` | PASS | 快速 |
| 16 | 问题追踪 | `issue.sh search/create` | PASS | 快速 |
| 17 | 完整清理 | `daemon stop` + kill + 删除目录 + 端口检查 | PASS | 快速 |

### 失败/警告分析
**步骤 3 [FAIL] — Daemon 启动失败（相对 ACTANT_SOCKET）**:
- 期望: Daemon 在隔离目录中可正常启动
- 实际观察: `listen EACCES`，无法绑定 `.trellis/tmp/.../actant.sock`
- 分析: 相对 socket 地址在当前环境不兼容；改为仅设置绝对 `ACTANT_HOME` 后恢复

**步骤 9 [WARN] — Agent 启动错误可观测性不足**:
- 期望: 启动失败时给出可诊断根因
- 实际观察: `cause: "[object Object]"`
- 分析: 错误上下文对象被字符串化，丢失结构化细节；已创建 Issue #258 跟踪

**步骤 12 [WARN] — Playwright MCP 不可用**:
- 期望: Skill 内 Playwright MCP 可直接执行浏览器自动化
- 实际观察: 缺失 Chrome 且安装失败（权限限制）
- 分析: 环境能力限制；已切换本地 Python Playwright 继续完成测试

**步骤 13 [WARN] — Employee 聊天输入受状态约束**:
- 期望: 通过 dashboard 直接提交聊天输入
- 实际观察: employee agent 在 `error` 状态下 textarea disabled（D4）
- 分析: 与 `employee.autoStartOnChat=false` 设计一致；后续对 service archetype 复测通过（步骤 14）

### Dashboard 输入模拟结论（重点）
- Agents 页面搜索输入可用：`qa-dash` 过滤命中
- Events 页面搜索输入可用：关键词过滤生效
- Service Agent Chat 输入提交可用：输入回显成功，且有系统反馈
- Employee Agent Chat 在 `error` 状态下禁用输入（符合当前产品策略）

### 创建的 Issue
| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| #258 | cli: agent start launch error context collapses to [object Object] | bug | P1 |

### 完整执行日志
详见：`.trellis/tasks/qa-dashboard-deep-20260301-003731/qa-log-round1.md`

### 证据产物
- 主结果: `.trellis/tasks/qa-dashboard-deep-20260301-003731/dash-input-results.json`
- 聊天专项: `.trellis/tasks/qa-dashboard-deep-20260301-003731/dash-chat-service-probe.py`
- 截图目录: `.trellis/tasks/qa-dashboard-deep-20260301-003731/screenshots`
