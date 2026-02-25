# 功能：雇员调度器（Employee Scheduler）

> 雇员调度器让 Agent 从"被动响应"变成"主动工作"——通过心跳、定时任务、事件钩子三种输入源，驱动 Agent 按计划自动执行任务。

---

## 这个功能做什么

传统的 Agent 需要人类主动发送指令才会工作。雇员调度器打破这个模式，让 Agent 像一个"数字雇员"一样 7x24 持续运行，按照预定的计划自动执行任务。

**一句话总结**：给 Agent 装上闹钟和事件监听器，让它自动干活。

---

## 三种输入源

| 输入源 | 触发方式 | 配置字段 | 典型场景 |
|-------|---------|---------|---------|
| **Heartbeat** | 固定间隔 | `schedule.heartbeat` | 定期检查状态、巡检 |
| **Cron** | Cron 表达式 | `schedule.cron[]` | 每日报告、定时任务 |
| **Hook** | 事件名触发 | `schedule.hooks[]` | PR 提交时审查、Issue 创建时分配 |

每个输入产生一个**带优先级的任务**，进入 `TaskQueue`，由 `TaskDispatcher` 按优先级顺序串行执行。

---

## 使用场景

### 场景 1：每小时巡检一次 PR

```json
{
  "name": "pr-patrol",
  "version": "1.0.0",
  "backend": { "type": "claude-code" },
  "provider": { "type": "anthropic" },
  "domainContext": {
    "skills": ["code-review"],
    "prompts": ["system-code-reviewer"]
  },
  "schedule": {
    "heartbeat": {
      "intervalMs": 3600000,
      "prompt": "检查所有 open 状态的 PR，如有新变更则执行代码审查",
      "priority": 5
    }
  }
}
```

### 场景 2：工作日每天早上生成日报

```json
{
  "schedule": {
    "cron": [
      {
        "pattern": "0 9 * * 1-5",
        "prompt": "生成昨天的项目进展日报，包括提交数、关闭的 Issue、合并的 PR",
        "timezone": "Asia/Shanghai",
        "priority": 3
      }
    ]
  }
}
```

### 场景 3：多种调度组合

同一个 Agent 可以同时配置心跳、Cron 和 Hook：

```json
{
  "schedule": {
    "heartbeat": {
      "intervalMs": 1800000,
      "prompt": "检查系统健康状态"
    },
    "cron": [
      { "pattern": "0 9 * * 1", "prompt": "生成周报", "timezone": "Asia/Shanghai" },
      { "pattern": "0 18 * * 5", "prompt": "执行代码质量分析", "timezone": "Asia/Shanghai" }
    ],
    "hooks": [
      { "eventName": "pr.created", "prompt": "对新 PR 执行代码审查", "priority": 10 },
      { "eventName": "issue.opened", "prompt": "分析新 Issue 并给出建议", "priority": 5 }
    ]
  }
}
```

---

## 操作方式

### 创建带调度的 Agent

```bash
# 1. 编写带 schedule 字段的模板
# 2. 加载模板
actant template load ./scheduled-agent-template.json

# 3. 以 acp-service 模式创建（支持自动重启）
actant agent create my-employee -t scheduled-agent --launch-mode acp-service

# 4. 启动 Agent（调度器随之启动）
actant agent start my-employee
```

### 查看调度状态

```bash
actant schedule list my-employee
```

输出包含：
- 各输入源的配置详情
- 下次触发时间
- 任务队列中待执行的任务

### 查看任务队列

```bash
actant agent tasks my-employee
```

### 手动触发任务

```bash
actant agent dispatch my-employee --prompt "立即执行一次代码审查"
```

---

## 任务优先级

任务按优先级数值排序（数值越大越优先），相同优先级按入队时间排序：

| 来源 | 默认优先级 | 说明 |
|------|-----------|------|
| 手动 dispatch | 10 | 最高优先，人工指令优先执行 |
| Hook 触发 | 由配置决定 | 通常设为中高优先级 |
| Cron 任务 | 由配置决定 | 通常设为中等优先级 |
| Heartbeat | 由配置决定 | 通常设为较低优先级 |

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 创建一个带心跳的模板文件 heartbeat-agent.json:
# {
#   "name": "heartbeat-test",
#   "version": "1.0.0",
#   "backend": { "type": "claude-code" },
#   "provider": { "type": "anthropic" },
#   "schedule": {
#     "heartbeat": { "intervalMs": 60000, "prompt": "报告当前时间" }
#   }
# }

# 3. 加载并创建
actant template load ./heartbeat-agent.json
actant agent create hb-test -t heartbeat-test --launch-mode acp-service

# 4. 启动
actant agent start hb-test

# 5. 查看调度状态
actant schedule list hb-test
# 预期: 显示 heartbeat 配置，intervalMs = 60000

# 6. 查看任务队列
actant agent tasks hb-test
# 预期: 可能显示已排队或正在执行的心跳任务

# 7. 手动调度一个任务
actant agent dispatch hb-test --prompt "手动触发测试"
# 预期: 任务入队

# 8. 清理
actant agent stop hb-test
actant agent destroy hb-test --force
actant daemon stop
```

---

## 架构细节

```
┌── Input Router ────────────────────────────────┐
│  Heartbeat │ Cron │ Webhook │ Hook │ Prompt    │
│            ↓      ↓         ↓      ↓          │
│  ┌─── Task Queue (按优先级串行) ────────────┐  │
│  │  [heartbeat] [cron:report] [hook:pr]     │  │
│  └────────────────┬─────────────────────────┘  │
└───────────────────┼────────────────────────────┘
                    ↓
              TaskDispatcher
                    ↓
              AcpConnection.prompt(task.prompt)
                    ↓
              Agent 执行任务 → 结果记录
```

- **Input Router**：接收各类输入源的事件
- **Task Queue**：优先级队列，确保任务按序执行
- **Task Dispatcher**：取出队首任务，通过 ACP 发送给 Agent
- **结果记录**：执行结果记录到 execution log

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 模板系统](agent-template.md) | 调度配置在模板的 `schedule` 字段中定义 |
| [Agent 生命周期管理](agent-lifecycle.md) | 调度器需要 `acp-service` 启动模式 |
| [ACP 连接与代理](acp-proxy.md) | 调度器通过 ACP 协议向 Agent 发送任务 |
