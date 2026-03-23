# QA Loop Source Map

`qa-loop` 的主逻辑不是从零发明的，它来自以下现有真相源：

- 旧 slash-command 规则：
  - [/Users/muyuli/Workspace/AgentCraft/.cursor/rules/qa-loop.mdc](/Users/muyuli/Workspace/AgentCraft/.cursor/rules/qa-loop.mdc)
- QA 执行技能：
  - [/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-engineer/SKILL.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-engineer/SKILL.md)
- QA 循环验证流程：
  - [/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-engineer/workflows/cyclic-verification.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-engineer/workflows/cyclic-verification.md)
- 持续监测的对照技能：
  - [/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-monitor/SKILL.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/qa-monitor/SKILL.md)
- Issue 管理：
  - [/Users/muyuli/Workspace/AgentCraft/.agents/skills/issue-manager/SKILL.md](/Users/muyuli/Workspace/AgentCraft/.agents/skills/issue-manager/SKILL.md)

## 迁移原则

- `qa-loop` 现在是技能，不再把 `.cursor/rules/qa-loop.mdc` 当作唯一实现
- 旧 rule 只保留兼容入口和来源说明
- 场景清单、日志规范、Issue 规则继续以 `qa-engineer` 为准

## 使用时优先读取什么

按需要读取：

1. `SKILL.md`
2. 目标场景 JSON
3. `qa-engineer/workflows/cyclic-verification.md`
4. 如需兼容旧 slash-command 语义，再读 `.cursor/rules/qa-loop.mdc`
