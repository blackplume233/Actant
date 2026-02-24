# Handle PR — 验证、合并、交付一站式流程

以 PR Gatekeeper 身份，自动验证 Multi-Agent Pipeline 产出的 Draft PR，验证通过后本地合并、更新 Spec、Ship 交付。

## 前置准备

读取 PR Handler Skill：

```
@.agents/skills/pr-handler/SKILL.md
```

按照 Skill 中定义的五阶段流程执行。

## 用户指令

{{input}}

## 快速参考

- `/handle-pr <N>` — 处理指定编号的 PR
- `/handle-pr <URL>` — 处理指定 URL 的 PR
- `/handle-pr` — 自动检测当前 task 关联的 PR

## 阶段概览

1. **Discovery** — 获取 PR 信息和 diff
2. **Validation Gate** — lint / type-check / test / 模式扫描 / Code Review
3. **Local Merge** — `git merge --no-ff` 到目标分支
4. **Update Spec** — 按需更新 config-spec.md / api-contracts.md
5. **Ship** — Push + 关闭 PR + Issue Sync
