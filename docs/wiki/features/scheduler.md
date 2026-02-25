---
generated: true
---

<!-- GENERATED -->

# 雇员调度器

> 给 Agent 装上闹钟，让它自动干活。

传统 Agent 需要人类主动发指令。雇员调度器让 Agent 像一个"数字雇员"一样 7×24 自动运行。

## 三种输入源

| 输入 | 触发方式 | 场景 |
|------|---------|------|
| **Heartbeat** | 固定间隔 | 定期巡检 |
| **Cron** | Cron 表达式 | 每天 9 点生成日报 |
| **Hook** | 事件触发 | PR 创建时自动审查 |

## 配置示例

```json
{
  "schedule": {
    "heartbeat": { "intervalMs": 3600000, "prompt": "检查系统状态" },
    "cron": [
      { "pattern": "0 9 * * 1-5", "prompt": "生成日报", "timezone": "Asia/Shanghai" }
    ],
    "hooks": [
      { "eventName": "pr.created", "prompt": "审查新 PR", "priority": 10 }
    ]
  }
}
```

每个输入产生一个带优先级的任务，进入队列按优先级串行执行。

## 使用

```bash
# 以 acp-service 模式创建（支持自动重启）
actant agent create employee -t scheduled-agent --launch-mode acp-service
actant agent start employee

# 查看调度状态
actant schedule list employee

# 手动触发
actant agent dispatch employee --prompt "立即执行"
```
