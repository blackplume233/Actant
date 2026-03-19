## QA 集成测试报告

**场景**: loop 循环测试修复
**测试工程师**: QA SubAgent
**时间**: 2026-03-14
**结果**: FAILED (8/16 步骤通过, 3 警告, 5 失败)

### 摘要
| # | 步骤 | 命令 | 判定 | 耗时 |
|---|------|------|------|------|
| 1 | Verify CLI build entry | `ls packages/cli/dist/bin/actant.js` | PASS | 短 |
| 2 | Start daemon in isolated QA environment | `actant daemon start --foreground` | INFO | 短 |
| 3 | Verify daemon reachability | `actant daemon status` | FAIL | 短 |
| 4 | Diagnose IPC normalization | `node --input-type=module -e ...normalizeIpcPath...` | WARN | 短 |
| 5 | Attempt shared AgentService creation | `actant agent create shared-svc -t code-review-agent --archetype service` | FAIL | 短 |
| 6 | Attempt ACP proxy interaction | `actant proxy shared-svc` | FAIL | 短 |
| 7 | Attempt CLI interaction | `actant agent run shared-svc --prompt "ping"` | FAIL | 短 |
| 8 | Assess Dashboard interaction preconditions | `ls packages/dashboard && ls packages/dashboard/client` | WARN | 短 |
| 9 | Verify daemon connectivity fix | `actant daemon status -f json` | PASS | 短 |
| 10 | Load code-review template after fix | `actant template load configs/templates/code-review-agent.json` | PASS | 短 |
| 11 | Observe intermediate initializer failure | `actant agent create shared-svc -t code-review-agent --archetype service` | FAIL | 短 |
| 12 | Create shared AgentService successfully | `actant agent create shared-svc -t code-review-agent --archetype service` | PASS | 短 |
| 13 | Start shared AgentService and inspect status | `actant agent start shared-svc` + `status -f json` | PASS | 短 |
| 14 | Validate CLI run path | `actant agent run shared-svc --prompt "ping"` | WARN | 短 |
| 15 | Validate ACP proxy path | `actant proxy shared-svc` | FAIL | 短 |
| 16 | Validate Dashboard surface availability | `actant dashboard --help` + `curl http://127.0.0.1:3320/` | PASS | 短 |

### 失败/警告分析
**步骤 3 - Verify daemon reachability [FAIL]**:
- 期望: daemon 前台启动后，同环境下 `daemon status` 可连接。
- 实际观察: 前台输出曾打印 PID，但随后 `daemon status` 返回 “Daemon is not running”。
- 分析: 旧构建中 CLI 与 daemon 的 socket 规范化路径分裂，已在后续修复中解决。

**步骤 4 - Diagnose IPC normalization [WARN]**:
- 期望: Windows 上 `ACTANT_SOCKET` 与 `ACTANT_HOME` 归一化后路径一致可达。
- 实际观察: `normalizeIpcPath()` 结果一致。
- 分析: 说明问题不在 shared 层算法本身，而在 CLI 构建产物对 socket override 的处理分裂。

**步骤 5/6/7 - Early runtime flow [FAIL]**:
- 期望: shared service 创建与交互场景能够开始执行。
- 实际观察: 全部卡在 daemon 不可达阶段。
- 分析: 已被后续修复覆盖，不再是当前主阻塞。

**步骤 8 - Dashboard preconditions [WARN]**:
- 期望: 验证 Dashboard 场景前提。
- 实际观察: 当时仅能确认前端存在。
- 分析: 后续已成功启动 dashboard 服务并访问页面。

**步骤 11 - Intermediate initializer failure [FAIL]**:
- 期望: 共享 AgentService 可在修复模板后直接创建成功。
- 实际观察: 出现 `paths is not iterable`。
- 分析: 第一次模板修正仍有 mkdir step config 结构错误，随后已修正为 `paths` 数组。

**步骤 14 - Validate CLI run path [WARN]**:
- 期望: 通过 CLI 直接向共享 AgentService 发起 `run`。
- 实际观察: `service + claude-code` 仅支持 `start, proxy`，不支持 `run`。
- 分析: 这是当前能力边界与预期不一致，不一定是实现 bug，需产品层确认 service 是否应支持 `run/chat`。

**步骤 15 - Validate ACP proxy path [FAIL]**:
- 期望: 通过 `actant proxy shared-svc` 建立 ACP 交互。
- 实际观察: 已进入 occupied → ephemeral fallback，但随后 `spawn EINVAL`。
- 分析: 当前剩余主阻塞点已收敛为 proxy/direct bridge 在 Windows 上的 spawn 参数或进程启动兼容问题。

### 完整执行日志
见 `.trellis/tasks/03-14-qa-loop/qa-log-round1.md`

### 创建的 Issue（如有）
| Issue | 标题 | 类型 | 优先级 |
|-------|------|------|--------|
| (未创建) | 本轮先完成证据收集，当前建议为 ACP proxy `spawn EINVAL` 创建 P1 QA bug | bug | P1 |
