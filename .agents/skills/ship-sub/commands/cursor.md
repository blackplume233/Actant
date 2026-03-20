# Ship Sub — 子分支提交 PR，主分支 handle-pr 交付

以 `ship-sub` 技能完成一次标准的子分支交付：

1. 在当前子分支执行 `ship` 级质量门
2. 提交并推送当前子分支
3. 创建或复用 Draft PR
4. 切回主分支执行 `handle-pr`

## 前置准备

读取技能定义：

```
@.agents/skills/ship-sub/SKILL.md
```

同时读取主分支交付技能：

```
@.agents/skills/pr-handler/SKILL.md
```

按照技能中的完整流程执行。

## 用户指令

{{input}}
