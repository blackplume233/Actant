# Trellis 治理修复与交付规范升级

## 变更摘要

- 统一 `task.json` 最小 schema，并在 task/start/create-pr/get-context 增加共享校验与 warning 输出
- 修复 PR base branch 回退逻辑，优先使用 `task.json.base_branch`，缺失时回退到 `origin/HEAD` / `master` / `main`
- 将 issue-manager 改为 GitHub-first 创建流程，补充重复 issue 检测、本地缓存身份对齐与恢复逻辑
- 固化 changelog draft 与 roadmap checklist 规则，并让 `create-pr` / `stage-version changelog` 使用统一 draft 契约

## 用户可见影响

- `task list` 和 `/trellis:start` 现在会直接暴露 task schema 漂移与活跃状态异常
- 后续 ship / create-pr 需要先准备合法的 changelog draft
- issue 本地缓存文件名、frontmatter `id`、`githubRef` 会与真实 GitHub issue number 对齐

## 破坏性变更/迁移说明

- `docs/planning/` 下活跃 roadmap 改为 checklist/todolist 主格式，旧的叙事式状态段落不再是允许格式
- 以后 merge / ship 级交付如果没有 changelog draft，会被流程阻断

## 验证结果

- `bash -n` 校验通过：`task.sh`、`create-pr.sh`、`start.sh`、`git-context.sh`
- `task.sh validate-task` 能区分完整 schema 与缩水 task schema
- issue-manager 重复创建验证通过：同一请求第二次创建时复用既有本地/GitHub issue

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #311, #313, #314
