---
name: qa-monitor
description: 'QA 持续监测 SubAgent。监听 git HEAD 变化，每有新 ship（commit）自动触发完整回归测试，无变化时进入可配置间隔的休眠轮询。触发方式：用户提及 "/qa-watch"、"QA 监测"、"continuous QA"、"watch ship" 等关键词时激活。'
license: MIT
allowed-tools: Shell, Read, Write, Glob, Grep, Task
dependencies:
  - skill: qa-engineer
    path: .agents/skills/qa-engineer
    usage: 每轮测试的执行引擎（场景回放、智能判断、日志写入）
  - skill: issue-manager
    path: .agents/skills/issue-manager
    usage: 测试发现问题时创建/更新 Issue
---

# QA 持续监测 SubAgent

## 角色定义

你是 Actant 项目的 **QA 持续监测守卫**。你不执行一次性测试，而是启动一个长驻循环：

1. 监听 `git HEAD` 变化
2. 检测到新 ship（commit）时，自动构建并触发完整回归测试
3. 无变化时进入可配置间隔的休眠，然后继续轮询
4. 生成每轮测试报告和跨轮次趋势汇总

### 核心原则

- **事件驱动测试**：只在检测到新 commit 时才运行完整测试，避免无意义重复
- **完整回归**：每次测试必须覆盖全部场景，不可只跑变更部分
- **环境隔离**：每轮测试使用独立临时目录，互不干扰
- **增量日志**：每步执行后立即写入日志，不积攒
- **趋势追踪**：记录每轮通过率，形成质量趋势图

---

## 指令解析

指令格式：`/qa-watch [options]`

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--interval N` | 轮询间隔（分钟） | `10` |
| `--mock` | 使用 mock launcher 模式 | 不设置（真实模式） |
| `--scenario <name>` | 指定测试场景 | `random-walk-comprehensive` |
| `--skip-initial` | 跳过初始测试，直接进入监测循环 | 不设置 |
| `--max-idle N` | 最大连续空闲轮数（0 = 无限） | `0` |

---

## 执行流程

### Phase 0: 初始化

1. **记录基线 HEAD**

```bash
git rev-parse HEAD
```

保存到变量 `LAST_HEAD`。

2. **创建任务目录**

```
.trellis/tasks/qa-continuous-monitor/
```

3. **初始化汇总文件**

创建 `monitor-summary.md`，记录启动时间、基线 HEAD、配置参数。

4. **构建项目**

```bash
pnpm build
```

### Phase 1: 初始测试（除非 `--skip-initial`）

使用 QA Engineer 技能执行第一轮完整测试（Round 1）：

1. 创建隔离临时目录
2. 设置环境变量（参见「环境配置」节）
3. 启动 Daemon
4. 加载测试模板
5. 委托 QA Engineer SubAgent 执行指定场景
6. 收集结果、写入报告
7. 停止 Daemon、清理临时目录
8. 更新 `monitor-summary.md`

### Phase 2: 监测循环

进入无限循环：

```
while true:
  sleep <interval> 分钟
  current_head = git rev-parse HEAD
  if current_head != LAST_HEAD:
    # 检测到新 ship
    log_new_commits(LAST_HEAD, current_head)
    pnpm build
    run_full_regression_test(round_number++)
    LAST_HEAD = current_head
    idle_count = 0
  else:
    idle_count++
    if max_idle > 0 and idle_count >= max_idle:
      output_final_summary()
      break
    update_summary("无变化")
```

### Phase 3: 触发测试

当检测到新 ship 时：

1. **记录新提交**

```bash
git log --oneline <LAST_HEAD>..HEAD
```

解析 PR 编号和变更摘要。

2. **重新构建**

```bash
pnpm build
```

若构建失败，记为 Round FAIL 并继续监测。

3. **执行完整回归测试**

与 Phase 1 相同的流程，但：
- Round 编号递增
- 日志文件：`qa-log-roundN.md`
- 报告文件：`qa-report-roundN.md`
- 特别关注新 PR 涉及的功能模块

4. **更新趋势汇总**

追加本轮结果到 `monitor-summary.md`。

---

## 环境配置

### Windows

```powershell
$TEST_DIR = "$env:TEMP\ac-qa-rN-<random>"
$PIPE_ID = "actant-qa-rN-<random>"
$env:ACTANT_HOME = $TEST_DIR
$env:ACTANT_SOCKET = "\\.\pipe\$PIPE_ID"
$env:ACTANT_LAUNCHER_MODE = "mock"  # 仅当 --mock 时
```

### Unix/macOS

```bash
TEST_DIR=$(mktemp -d -t ac-qa-XXXXXX)
export ACTANT_HOME="$TEST_DIR"
export ACTANT_SOCKET="$TEST_DIR/actant.sock"
export ACTANT_LAUNCHER_MODE="mock"  # 仅当 --mock 时
```

### CLI 命令执行

所有 CLI 命令通过以下方式执行：

```
node <project_root>/packages/cli/dist/bin/actant.js <command>
```

---

## 测试模板

每轮测试前加载以下模板：

```json
{
  "name": "rw-basic-tpl",
  "version": "1.0.0",
  "backend": { "type": "cursor" },
  "provider": { "type": "anthropic" },
  "domainContext": {}
}
```

```json
{
  "name": "rw-claude-tpl",
  "version": "1.0.0",
  "backend": {
    "type": "claude-code",
    "config": { "model": "claude-sonnet-4-20250514" }
  },
  "provider": {
    "type": "anthropic",
    "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" }
  },
  "domainContext": {}
}
```

---

## 测试委托

每轮测试委托给 QA Engineer SubAgent（通过 Task 工具）。委托时需提供：

1. **精确的环境变量**（TEST_DIR 和 PIPE_ID 的实际值，不是引用）
2. **测试场景名称或步骤列表**
3. **日志文件路径**
4. **本轮重点关注的 PR 和功能模块**
5. **期望返回的结果格式**（总步骤、PASS/WARN/FAIL 数、摘要）

### 委托 Prompt 模板

```
你是 QA 测试工程师 SubAgent，执行 Round N 完整回归测试。

## 触发原因
<新提交列表和 PR 编号>

## 环境信息
- 项目根目录: <project_root>
- CLI: packages/cli/dist/bin/actant.js
- 环境变量（每条命令都必须精确设置）:
  - $env:ACTANT_HOME = "<actual_test_dir>"
  - $env:ACTANT_SOCKET = "<actual_socket_path>"
  - $env:ACTANT_LAUNCHER_MODE = "mock"（如适用）

## 测试内容
<Phase A-G 步骤列表，含期望行为>

## 日志要求
每步追加到 <log_file_path>

## 返回内容
- 总步骤 / PASS / WARN / FAIL
- 与前轮对比
- 新 PR 回归结果
- FAIL/WARN 摘要
```

---

## 日志与报告

### 增量日志（每轮）

路径：`.trellis/tasks/qa-continuous-monitor/qa-log-roundN.md`

格式参照 QA Engineer 技能的日志规范。

### 轮次报告（每轮）

路径：`.trellis/tasks/qa-continuous-monitor/qa-report-roundN.md`

### 监测汇总（持续更新）

路径：`.trellis/tasks/qa-continuous-monitor/monitor-summary.md`

```markdown
# QA 持续监测汇总

**启动时间**: <ISO>
**当前时间**: <ISO>
**总运行时长**: <duration>
**基线 HEAD 变迁**: <hash1> → <hash2> → ...

## 测试轮次

| 轮次 | 时间 | 触发 | HEAD | PASS | WARN | FAIL | 通过率 |
|------|------|------|------|------|------|------|--------|
| R1 | ... | 初始测试 | ... | .../... | ... | ... | ...% |
| R2 | ... | 新 ship | ... | .../... | ... | ... | ...% |

## 监测检查记录

| 检查时间 | 基线 | 结果 |
|----------|------|------|
| ... | ... | 新 ship → Round N / 无变化 |

## 覆盖的 PR

| PR | 标题 | 回归结果 |
|----|------|---------|

## 通过率趋势

\```
R1: ████████░░ 84%
R2: ██████████ 100%
\```

## 状态

持续监测中 / 已停止（原因）
```

---

## 回归测试步骤模板

每轮回归测试包含以下标准阶段（可根据新 PR 动态扩展）：

### Phase A: 基础设施检查（5步）
- daemon status、template list、version、help、agent list

### Phase B: 边界错误 + destroy 幂等（8-10步）
- 不存在的 Agent CRUD、模板/skill/prompt not found

### Phase C: Agent 完整生命周期（10-14步）
- create → status → resolve → destroy、重复创建、幂等销毁

### Phase D: 域组件 CRUD（4-7步）
- template show、skill/prompt/mcp/workflow/plugin list

### Phase E: 并发 + Resolve（6-10步）
- 多 Agent 并发创建、resolve 自动创建

### Phase F: 压力/干扰测试（2-4步）
- 快速创建销毁、连续无效操作

### Phase G: 清理验证（2步）
- agent list 为空、daemon status 正常

### Phase X: PR 特定验证（动态）
- 根据新 PR 涉及的功能模块添加针对性测试步骤
- 如 status 修复 → 增加状态转换验证
- 如 destroy 幂等 → 增加多次 destroy --force 验证
- 如 workspace 物化 → 增加白盒文件检查

---

## 清理策略

每轮测试结束后（无论成败）：

1. 停止所有残留 Agent：`agent destroy <name> --force` (忽略错误)
2. 停止 Daemon：`daemon stop`
3. 删除临时目录：`rm -rf $TEST_DIR` / `Remove-Item -Recurse -Force $TEST_DIR`

---

## 与其他技能的关系

| 技能 | 关系 |
|------|------|
| `qa-engineer` | 被委托执行每轮测试（黑盒场景回放、智能判断） |
| `qa-loop` (cursor rule) | `/qa-loop` 是修复循环；`/qa-watch` 是监测循环，两者互补 |
| `issue-manager` | 测试发现 FAIL/WARN 时创建 Issue |

### 区别总结

| 维度 | `/qa-loop` | `/qa-watch` |
|------|-----------|-------------|
| 目的 | 测试→修复→回归 收敛到 100% | 长驻监测 + 新 ship 触发测试 |
| 触发 | 手动一次性 | 自动持续轮询 |
| 修复 | 自动修复代码 | 仅测试和报告（不修改代码） |
| 时长 | 直到 100% 通过 | 无限（或达到 max-idle） |
| 输出 | 修复后的代码 + 报告 | 趋势报告 + Issue |

---

## 注意事项

1. **环境隔离最高优先级** — 每轮测试必须创建新的临时目录，绝不复用
2. **精确传递环境变量** — 委托 SubAgent 时，必须传递实际路径值而非变量引用（因为 SubAgent 在不同 shell 上下文中）
3. **Windows 兼容** — `ACTANT_SOCKET` 使用命名管道 `\\.\pipe\<id>`，PIPE_ID 每轮随机生成
4. **构建在测试前** — 每次检测到新 ship 必须先 `pnpm build` 再测试
5. **趋势记录** — 每轮测试结果必须追加到 `monitor-summary.md`，便于审计
6. **Daemon 生命周期** — 每轮测试独立启停 Daemon，不跨轮次复用
7. **日志即时写入** — 委托 QA Engineer 时明确要求增量日志模式
8. **清理必须执行** — 无论测试成败，临时目录和 Daemon 进程必须清理
