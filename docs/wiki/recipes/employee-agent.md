---
generated: true
---

<!-- GENERATED -->

# 打造雇员 Agent

让 Agent 作为 7×24 运行的"数字雇员"，按计划自动执行任务。

## 1. 编写模板

```json
{
  "name": "pr-patrol",
  "version": "1.0.0",
  "description": "每天巡检 PR 的雇员 Agent",
  "backend": { "type": "claude-code" },
  "provider": { "type": "anthropic" },
  "domainContext": {
    "skills": ["code-review"],
    "prompts": ["system-code-reviewer"]
  },
  "schedule": {
    "heartbeat": {
      "intervalMs": 3600000,
      "prompt": "检查所有 open 的 PR，如有新变更则执行审查"
    },
    "cron": [
      {
        "pattern": "0 9 * * 1-5",
        "prompt": "生成本周代码质量报告",
        "timezone": "Asia/Shanghai"
      }
    ]
  }
}
```

## 2. 加载并创建

```bash
actant template load ./pr-patrol.json
actant agent create patrol -t pr-patrol --launch-mode acp-service
```

`--launch-mode acp-service` 使 Agent 崩溃后自动重启。

## 3. 启动

```bash
actant agent start patrol
```

Agent 开始运行，每小时检查一次 PR，工作日每天 9 点生成报告。

## 4. 监控

```bash
actant agent status patrol     # 查看运行状态
actant schedule list patrol    # 查看调度配置
actant agent tasks patrol      # 查看任务队列
actant agent logs patrol       # 查看执行日志
```

## 5. 手动干预

```bash
# 手动触发一次任务（优先级最高）
actant agent dispatch patrol -m "立即审查 PR #42"
```

## 6. 停止

```bash
actant agent stop patrol
actant agent destroy patrol --force
```
