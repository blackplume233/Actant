## QA 集成测试报告 — Round 1 (Short Loop)

**场景**: QA Loop — 定时 web 搜索 Agent, 20s 间隔, 6 次随机网页检索
**测试工程师**: QA SubAgent (Cursor)
**时间**: 2026-02-22T23:47 ~ 00:03 (+08:00)
**结果**: PASSED with WARN (3/6 搜索成功, 3 WARN, 0 FAIL, 前置步骤全 PASS)

### 摘要

| # | 步骤 | 命令 | 判定 | 耗时 | 费用 |
|---|------|------|------|------|------|
| 0 | 前置检查+构建 | pnpm build | PASS | 14s | — |
| 1 | Daemon + 隔离环境 | daemon start | PASS | 3s | — |
| 2 | 模板加载 + Agent 创建 | template load + agent create | PASS | 2s | — |
| 3 | Schedule roundtrip | template show + schedule list | WARN | 1s | — |
| 4 | R1: quantum computing | agent run | WARN | 47.5s | $0.153 |
| 5 | R2: AI chip market | agent run | PASS | 16.6s | $0.090 |
| 6 | R3: CRISPR gene therapy | agent run | WARN | 28.9s | $0.087 |
| 7 | R4: nuclear fusion | agent run | PASS | 32.8s | $0.117 |
| 8 | R5: autonomous driving | agent run | PASS | 90.9s | $0.118 |
| 9 | R6: SpaceX Starship | agent run | WARN | 59.1s | ~$0.11 |

**总费用**: ~$0.675
**20s 间隔遵守**: 全部 6 轮均正确等待 20s ✓

### 关键改进 (vs 上次 QA)

1. **WebSearch 权限通过**: 显式 `allow: ["WebSearch","WebFetch"]` 解决了上次的 permission_denial
2. **无超时失败**: 120s 超时足够，6/6 轮均在超时内完成（上次 45s 导致 5/6 超时）
3. **schedule 字段保留**: Issue #118 修复确认，模板 load → show → persist 完整保留 schedule

### 警告分析

#### WARN-1: WebSearch API 400 错误 (影响: R1/R3/R6)

**现象**: WebSearch 工具被成功调用（无 permission_denial），但 API 返回 400:
```
"thinking is enabled but reasoning_content is missing in assistant tool call message at index 2"
```

**分析**:
- 错误发生在 Claude Code 的 kimi-for-coding 模型路由中
- 模板配置 `claude-sonnet-4-6`，实际路由到 `kimi-for-coding`（用户本地 Claude Code 配置覆盖）
- kimi-for-coding 的 thinking 模式与 WebSearch API 的 tool call 格式不兼容
- 这不是 Actant 层面的 bug，而是 Claude Code 模型路由 + API 兼容性问题

**影响**: 当 max_turns 较低 (3) 时 Agent 无法在 API 错误后回退产出回答；增加到 5 后成功率提升。

#### WARN-2: WebFetch 域名安全检查失败

**现象**: Agent 回退尝试 WebFetch 时，所有域名均被拒绝:
- reuters.com, clinicaltrials.gov, pubmed.ncbi.nlm.nih.gov, iter.org
- 错误: "Unable to verify if domain is safe to fetch"

**分析**: Claude Code 的域名安全白名单限制，与 Actant 无关。

#### WARN-3: Scheduler 未集成 (Issue #103)

**现象**: `schedule list qa-web-searcher` → `{ sources: [], running: false }`
**分析**: 已知缺口，`EmployeeScheduler` 未在 `startAgent()` 中创建和配置。

### 创建的 Issue

无新增 Issue。所有 WARN 均为已知问题或非 Actant 层面的外部因素:
- Schedule 未集成 → 已有 Issue #103
- WebSearch API 400 → Claude Code 模型路由兼容性，非 Actant bug
- WebFetch 域名限制 → Claude Code 安全策略，非 Actant bug

### 完整执行日志

详见: `qa-log-round1.md`
