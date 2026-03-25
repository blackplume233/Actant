# Shared Skill Governance Plan

> Owner: this file
> Scope: 通过 Git/GitHub 版本化 shared skills 与项目本地 skills/context 的统一治理，把 Actant 推进到可实际用于多仓协作开发的阶段。
> Related: [Product Roadmap](./roadmap.md), [MountFS Execution Plan](./mountfs-execution-plan.md), [Shared Skill Governance Architecture](../design/shared-skill-governance-architecture.md), [ContextFS Architecture](../design/contextfs-architecture.md), [Actant VFS Reference Architecture](../design/actant-vfs-reference-architecture.md)

## Milestone Goal

- [ ] 一个用户可在 4-5 个仓库中复用同一套版本化 shared skills
- [ ] 每个仓库仍保留 project-local skills/context，并随项目版本演进
- [ ] Actant 统一管理 shared/project skill 的挂载、解析、来源追踪与冲突治理
- [ ] 全部核心治理流程可通过 CLI 完成；UI 仅作为后续可视化入口

## Validation Goals

- [ ] 支持接入至少 1 个 Git/GitHub shared skill repo，并锁定明确版本
- [ ] 项目本地 skills 与 shared skills 能同时进入同一 `mount namespace`
- [ ] 同名 skill 能按固定规则生成唯一 winner 或显式 conflict
- [ ] 用户可通过 CLI 查看某个 skill 的来源、版本、命中规则与 shadowed candidates
- [ ] shared skill 升级后可重新解析并得到可预期结果
- [ ] 同一 shared repo 可被 4-5 个仓库复用，而无需重复维护 skill 基础设施
- [ ] 全流程不依赖 UI 即可完成接入、解析、排障与升级

## Missing Capabilities

- [ ] 缺少 Git-backed shared skill source / `githubfs`
- [ ] 缺少正式的 `skill consumer` 解释层与稳定输出 contract
- [ ] 缺少 `resolved skill` / provenance / conflict 的对象模型
- [ ] 缺少面向 shared skill 治理的 CLI 命令面
- [ ] 缺少 project-local 与 shared skill 的 precedence / override 规则
- [ ] 缺少可复用的多仓 dogfooding 验证场景
- [ ] 缺少在 active docs 中明确承认这条 planning intake 的 owner 文件

## Phase 0: Contract Freeze

- [ ] 在 design/spec 中明确 shared skill source、resolved tree、provenance tree 与 conflict tree
- [ ] 明确 `skill consumer` 的 stack 放置与边界，不回流到 `VFS core`
- [ ] 冻结 shared/project precedence 与 conflict 规则
- [ ] 冻结 CLI contract 的最小命令面
- [ ] 在 roadmap 中把该里程碑作为当前 planning intake 明确挂出

## Phase 1: Git Source MVP

- [ ] 实现 Git-backed source，优先落地为 `@actant/mountfs-github` 或等价 `githubfs`
- [ ] 支持 `repo + ref -> local cache/materialization`
- [ ] 支持把 shared repo 子树挂载到 `/skills/shared/<source-id>/*`
- [ ] 保留 `repo`、`ref`、`commit`、`source-id` 等最小 metadata

## Phase 2: Skill Consumer MVP

- [ ] 扫描 `/skills/project/*` 与 `/skills/shared/*` 候选节点
- [ ] 只把 `regular node` 解释为 skill 候选；其他 node type 直接跳过
- [ ] 构建统一 `skillId`、normalized metadata、provenance 与 diagnostics
- [ ] 生成 `resolved skill` 逻辑视图与 conflict 输出
- [ ] 提供 inspectable 的来源追踪结果，而不是只返回扁平列表

## Phase 3: Governance CLI

- [ ] `actant skill source add/list/update/remove`
- [ ] `actant skill list/inspect/resolve/doctor`
- [ ] 默认输出 human-readable；所有查询命令支持 `--json`
- [ ] CLI 只消费稳定 service contract，不直接依赖前端状态或 ad hoc 文件结构

## Phase 4: Multi-Repo Dogfooding

- [ ] 准备一个 shared skill repo 与 4-5 个消费仓库
- [ ] 复用同一 shared source 配置，验证不同项目的本地覆盖策略
- [ ] 演练 shared repo 升级、project override、冲突诊断与回滚
- [ ] 固化一个真实开发链路，而不只是 demo 脚本

## Phase 5: UI Governance Surface

- [ ] 在 CLI/API 稳定后提供 shared/project/version/provenance/conflict 的可视化页面
- [ ] UI 只作为治理面板，不引入新的真相源
- [ ] UI 的所有关键操作都能映射回 CLI/API contract

## Acceptance Plan

### Functional Acceptance

- [ ] 能添加 Git/GitHub shared skill source
- [ ] 能查看 source 的 `repo`、`ref`、`commit`
- [ ] 能把 shared source 挂载进 namespace
- [ ] 能解析 project 与 shared skill 的合并结果
- [ ] 同名 skill 按固定优先级决议，不静默选错 winner
- [ ] `actant skill inspect <skill-id>` 能解释命中来源与 shadowed candidates
- [ ] 升级 shared source 后，resolved 结果与 provenance 可更新

### Multi-Repo Acceptance

- [ ] 准备 `shared-skills` 仓库与 4-5 个项目仓库
- [ ] 多个仓库能复用同一 shared source，而不复制相同 skills
- [ ] 至少一个项目仓库能覆盖 shared skill，且 provenance 可见
- [ ] shared repo 升级后，不同项目的解析结果符合预期

### Regression Acceptance

- [ ] `skill consumer` 不渗入 `@actant/vfs` kernel
- [ ] UI 不绕过 CLI/API contract 直接读写内部状态
- [ ] source cache 损坏时 `doctor` 能给出明确诊断
- [ ] conflict 不静默吞掉，必须可见且可排障
- [ ] 删除 source 后 resolved registry 能正确收敛

### Documentation Acceptance

- [ ] 提供用户可执行的 CLI 文档
- [ ] 提供 source / precedence / provenance 设计文档
- [ ] 提供多仓 dogfooding 场景与验收记录

## Non-Goals

- [ ] 本里程碑不做多用户权限系统
- [ ] 本里程碑不做实时远程协同同步
- [ ] 本里程碑不先做 UI-first 操作流
- [ ] 本里程碑不把所有资产类型一次性纳入完整治理台

## Exit Criteria

- [ ] shared skills 可通过 Git/GitHub 做版本化治理
- [ ] project-local skills/context 可随项目仓库一起演进
- [ ] shared/project 两类来源能在统一 namespace 中被稳定消费
- [ ] precedence、provenance、conflict 都有稳定 contract
- [ ] CLI 成为最小权威治理入口
- [ ] 4-5 个仓库的真实 dogfooding 场景成立
