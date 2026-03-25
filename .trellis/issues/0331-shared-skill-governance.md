---
id: 331
title: 多仓 shared skill governance 里程碑与架构收敛
status: open
labels:
  - discussion
  - "priority:P1"
  - architecture
  - roadmap
  - context
  - vfs
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#331"
closedAs: null
createdAt: "2026-03-25T06:58:50"
updatedAt: "2026-03-25T06:58:50"
closedAt: null
---

## 背景

当前仓库已经完成 ContextFS V1 freeze baseline、单仓 stack boundary freeze 与活跃文档收口，但还没有把“多仓 shared skill governance”明确提升为下一阶段的主线规划入口。

目标场景是：

- shared skills 通过 Git/GitHub 进行版本化管理
- 4-5 个项目仓库可复用同一套 shared skills
- 每个项目仍保留自己的 project-local skills/context，并随仓库版本演进
- Actant 统一处理 shared/project skill 的挂载、解析、来源追踪、冲突治理与升级路径
- 全流程先以 CLI 为最小权威操作面，UI 后置为治理面板

这条能力是 Actant 进入渐进式自举开发阶段的第一个真实 dogfooding 目标。

## 问题

当前主线已经有 `ContextFS` / `VFS` / `mountfs` 的基础收口，但还缺少把 shared skill 治理做成可交付里程碑的关键拼图：

- 缺少 Git-backed shared skill source / `githubfs`
- 缺少正式的 `skill consumer` 解释层与稳定输出 contract
- 缺少 `resolved skill` / provenance / conflict 的对象模型
- 缺少面向 shared skill 治理的 CLI 命令面
- 缺少 project-local 与 shared skill 的 precedence / override 规则
- 缺少 4-5 个仓库复用同一 shared source 的真实 dogfooding 验证场景

如果这条主线不被明确 intake，当前工作会继续停留在基础设施收口，而不能进入“Actant 实际提升 agent 开发效率，并在使用中迭代自身”的阶段。

## 设计方向

设计草案已整理为：

- source tree: `/skills/project/*`、`/skills/shared/<source-id>/*`
- resolved tree: `/skills/resolved/*`
- meta tree: `/skills/meta/provenance/*`、`/skills/meta/conflicts/*`

推荐分层：

`VFS / mount namespace / mount table -> mountfs implementations -> skill consumer -> governance services -> CLI / API / UI`

关键约束：

- `VFS` 不承载 skill 解释逻辑
- shared skill 首先是 Git-backed mount source，再由 `skill consumer` 解释为 skill 集合
- CLI 是最小权威治理面，UI 后置
- 覆盖基于逻辑 `skillId`，而不是简单文件路径

## 最小里程碑

### Phase 0: Contract Freeze

- 冻结 shared skill source、resolved tree、provenance/conflict tree 设计
- 明确 `skill consumer` 的 stack 放置与边界
- 冻结 shared/project precedence 与 conflict 规则
- 冻结最小 CLI contract

### Phase 1: Git Source MVP

- 实现 Git-backed source，优先落地为 `@actant/mountfs-github` 或等价 `githubfs`
- 支持 `repo + ref -> local cache/materialization`
- 支持挂载到 `/skills/shared/<source-id>/*`

### Phase 2: Skill Consumer MVP

- 扫描 `/skills/project/*` 与 `/skills/shared/*` 候选节点
- 只把 `regular node` 解释为 skill 候选
- 生成统一 `skillId`、resolved result、provenance 与 conflicts

### Phase 3: Governance CLI

- `actant skill source add/list/update/remove`
- `actant skill list/inspect/resolve/doctor`
- 查询命令支持 `--json`

### Phase 4: Multi-Repo Dogfooding

- 准备 1 个 shared skill repo 与 4-5 个消费仓库
- 验证 shared repo 升级、project override、冲突诊断与回滚

### Phase 5: UI Governance Surface

- 在 CLI/API contract 稳定后提供 shared/project/version/provenance/conflict 可视化治理面

## 验收标准

- 能接入至少 1 个 Git/GitHub shared skill repo，并锁定明确版本
- 项目本地 skills 与 shared skills 能进入同一 `mount namespace`
- 同名 skill 能按固定规则生成唯一 winner 或显式 conflict
- `actant skill inspect <skill-id>` 能解释来源、版本与 shadowed candidates
- shared skill 升级后，resolved 结果与 provenance 能稳定更新
- 4-5 个仓库能复用同一 shared source，而无需重复维护 skill 基础设施
- 全流程不依赖 UI 即可完成接入、解析、排障与升级

## 相关文档

- `docs/planning/shared-skill-governance-plan.md`
- `docs/design/shared-skill-governance-architecture.md`
- `docs/planning/mountfs-execution-plan.md`
