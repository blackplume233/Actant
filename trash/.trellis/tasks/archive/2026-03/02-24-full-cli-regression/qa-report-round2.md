# QA 集成测试报告 - Round 2

**场景**: full-cli-regression (post-fix)
**测试工程师**: QA SubAgent
**时间**: 2026-02-24T10:05 ~ 10:07 (约 2 分钟)
**环境**: real mode, global binary (actant 0.2.0 rebuilt with fixes)
**ACTANT_HOME**: C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999
**结果**: **PASSED** (86/86 步骤全部通过, 0 FAIL, 0 WARN)

## 摘要

| # | Phase | 步骤数 | PASS | FAIL |
|---|-------|--------|------|------|
| 1 | 基础设施 | 3 | 3 | 0 |
| 2 | 模板管理 | 5 | 5 | 0 |
| 3 | Skill CRUD | 7 | 7 | 0 |
| 3 | Prompt CRUD | 7 | 7 | 0 |
| 3 | MCP CRUD | 7 | 7 | 0 |
| 3 | Workflow CRUD | 7 | 7 | 0 |
| 3 | Plugin CRUD | 7 | 7 | 0 |
| 4 | Source 管理 | 4 | 4 | 0 |
| 5 | Preset 管理 | 2 | 2 | 0 |
| 6 | Agent 生命周期 | 8 | 8 | 0 |
| 7 | Agent 高级操作 | 8 | 8 | 0 |
| 8 | Proxy | 2 | 2 | 0 |
| 9 | Schedule | 1 | 1 | 0 |
| 10 | 错误处理 | 15 | 15 | 0 |
| 11 | 清理验证 | 3 | 3 | 0 |
| **Total** | | **86** | **86** | **0** |

## Round 1 → Round 2 修复总结

### 场景设计修复 (3 项)

1. **source add 添加 --name 参数** — `source add` 命令要求必须指定 `--name`，已补充
2. **Agent 生命周期改用 resolve 模式** — cursor 后端不支持 ACP 的 `agent start`，改用 `agent resolve`
3. **destroy --force 期望值修正** — `--force` 为幂等操作，不存在的资源返回 exit=0 是正确行为

### 代码修复 (3 项)

1. **agent attach PID 验证** (#139) — `attachAgent` 新增 `process.kill(pid, 0)` 检查 PID 存活性，不存在时抛出 `AgentLaunchError`
2. **agent dispatch 退出码** (#140) — 操作未完成（无 scheduler）时设置 `process.exitCode = 1`
3. **schedule list 退出码** (#140) — 无 scheduler 时设置 `process.exitCode = 1`

### 单元测试更新

- 更新 `agent-manager.test.ts`: 使用 `process.pid` 替代假 PID (55555)，新增 PID 不存在的测试用例
- 更新 `agent-lifecycle-scenarios.test.ts`: 使用 `process.pid` 替代假 PID (99001, 99002)
- 全部 144/144 单元测试通过

## CLI 命令覆盖率

| 命令组 | 覆盖的子命令 | 状态 |
|--------|------------|------|
| --version / --help | 2/2 | 完整 |
| daemon | start, stop, status (3/3) | 完整 |
| template | validate, load, list, show (4/5, 缺 install) | 接近完整 |
| agent | create, status, list, destroy, resolve, tasks, logs, dispatch, attach, detach (10/17) | 大部分覆盖 |
| skill | list, show, add, remove, export (5/5) | 完整 |
| prompt | list, show, add, remove, export (5/5) | 完整 |
| mcp | list, show, add, remove, export (5/5) | 完整 |
| workflow | list, show, add, remove, export (5/5) | 完整 |
| plugin | list, show, add, remove, export (5/5) | 完整 |
| source | list, add, remove (3/4, 缺 sync) | 接近完整 |
| preset | list, show (2/3, 缺 apply) | 部分 |
| schedule | list (1/1) | 完整 |
| proxy | --help, error path (2/2) | 完整 |

## 完整执行日志

参见 [qa-log-round2.md](qa-log-round2.md)（86 步骤完整原始 I/O 记录）
