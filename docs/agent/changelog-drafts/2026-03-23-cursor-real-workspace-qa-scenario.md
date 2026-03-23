# Real Workspace QA Scenario

## 变更摘要

- 为 QA Engineer 技能新增 `real-workspace-context-collaboration` 场景。
- 将“用户创建工作目录 -> 准备 Git 仓库与 AGENTS.md -> 接入本地 shared catalog -> 安装共享 template -> 让 Actant 接管现有仓库 -> 用外部 Codex CLI 消费上下文”的真实链路固化为持续测试资产。
- 更新 QA 场景汇总表，使该场景可被持续回归流程发现和复用。

## 用户可见影响

- QA 技能现在具备一个更贴近真实使用的持续测试场景，不再只覆盖空目录初始化或纯命令面 smoke。
- 后续可以反复用该场景验证 ContextFS、catalog、Agent workspace 接管、AGENTS.md 上下文消费和外部 Codex 协作链路。

## 破坏性变更/迁移说明

- 无公开接口破坏性变更。
- 这是 QA 资产补充，不改变产品运行时行为。

## 验证结果

- `node -e "JSON.parse(require('fs').readFileSync('.agents/skills/qa-engineer/scenarios/real-workspace-context-collaboration.json','utf8')); console.log('ok')"`
- `rg -n 'real-workspace-context-collaboration' .agents/skills/qa-engineer/workflows/cyclic-verification.md .agents/skills/qa-engineer/scenarios/real-workspace-context-collaboration.json`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: related to QA findings #319, #320
