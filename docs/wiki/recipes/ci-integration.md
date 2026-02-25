---
generated: true
---

<!-- GENERATED -->

# CI/CD 集成

在 CI 流水线中使用 Actant 自动执行 Agent 任务。

## 基本模式

```bash
# 1. 安装
npm install -g actant

# 2. 启动 Daemon
actant daemon start

# 3. 创建 Agent → 执行任务 → 获取结果
actant agent create ci-reviewer -t code-review-agent
RESULT=$(actant agent run ci-reviewer --prompt "审查最近的提交" -f json)
EXIT_CODE=$?

# 4. 清理
actant agent destroy ci-reviewer --force
actant daemon stop

# 5. 根据结果决定 CI 结果
exit $EXIT_CODE
```

## GitHub Actions 示例

```yaml
name: AI Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm install -g actant
      - run: actant daemon start
      - run: |
          actant agent create pr-review -t code-review-agent
          actant agent run pr-review --prompt "审查本次 PR 的全部变更"
          actant agent destroy pr-review --force
      - run: actant daemon stop
```

## 要点

- 使用 `-f json` 输出便于脚本解析
- 退出码 `0` = 成功，非 `0` = 失败
- Agent 执行完毕后务必 `destroy --force` 清理
- 通过环境变量传递 API Key（`ANTHROPIC_API_KEY`）
