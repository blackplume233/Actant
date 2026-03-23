# Add qa-loop skill entrypoint

## 变更摘要

- 将项目内历史 `/qa-loop` 编排规则收敛为正式技能 `qa-loop`，新增技能入口、UI metadata 和 source map。
- 将 QA 活跃文档中的主入口引用切换到新技能，仅保留 `.cursor/rules/qa-loop.mdc` 作为兼容 stub。
- 明确 `qa-loop` 与 `qa-engineer`、`qa-monitor` 的职责边界，避免继续维护双份真相源。

## 用户可见影响

- 现在可以直接通过项目技能 `qa-loop` 来触发 QA 循环验证编排。
- QA 文档不再把 `/qa-loop` slash rule 当作唯一主入口。

## 破坏性变更/迁移说明

- `.cursor/rules/qa-loop.mdc` 不再承载完整实现，只保留兼容说明。
- 后续若要更新 `qa-loop` 行为，应修改 `.agents/skills/qa-loop/` 下的技能文件，而不是继续扩展旧 rule。

## 验证结果

- 使用 `skill-creator` 的 `quick_validate.py` 对 `.agents/skills/qa-loop` 做结构校验，结果通过。
- 仓库内活跃引用 grep 已切到新技能入口。

## 关联 PR / Commit / Issue

- Issue: #321
