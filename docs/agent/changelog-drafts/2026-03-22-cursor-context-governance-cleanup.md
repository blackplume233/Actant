# Context Governance Cleanup

## 变更摘要

- 将 active 区域中的旧 context profile / setup 术语统一治理为 `context`、`setup`、`project-context discovery`
- 重命名示例、脚本、技能与 smoke test 入口，修复内部引用与测试路径
- 增加 `normalizeHostProfile()` 兼容层，保留旧 profile 输入到 `context` 的规范化，不再对外输出旧术语
- 扩展治理扫描脚本，新增废弃术语检测并排除 archive / workspace / template hash 等历史或派生路径
- 补充 `config-spec.md` 与 `api-contracts.md`，把 host profile 的新契约和 CLI / hub 暴露面写入 spec

## 用户可见影响

- CLI 与用户可见文案统一改为 `context` profile / project context hub
- 示例目录、smoke test 脚本、Actant Hub 自带 skill / prompt 命名不再暴露旧 profile 名称
- 治理扫描会把 active truth 中重新引入废弃 profile 术语视为告警

## 破坏性变更/迁移说明

- 对外推荐术语变更为 `context`
- 历史输入仍被兼容解析为 `context`，因此本轮无强制迁移阻断
- 若外部脚本硬编码了旧示例路径或旧脚本名，需要切换到 `project-context-discovery`、`self-setup`、`context-smoke.*`、`create-setup-task.sh`

## 验证结果

- `python3 /Users/muyuli/.codex/skills/governance-context-sync/scripts/scan_governance_context.py --root <worktree-root>`
- `PATH="/tmp/actant-node22-bin:$PATH" pnpm lint`
- `PATH="/tmp/actant-node22-bin:$PATH" pnpm type-check`
- `PATH="/tmp/actant-node22-bin:$PATH" pnpm test`
- 结果：`126` 个测试文件、`1378` 个测试全部通过；治理扫描无剩余 findings

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #278, #313, #315, #316
