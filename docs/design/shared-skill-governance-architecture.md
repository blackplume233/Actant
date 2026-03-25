# Shared Skill Governance Architecture

> Status: Draft
> Date: 2026-03-25
> Scope: 多仓 shared skill 与 project-local skill/context 的统一治理设计
> Related: [ContextFS Architecture](./contextfs-architecture.md), [Actant VFS Reference Architecture](./actant-vfs-reference-architecture.md), [Shared Skill Governance Plan](../planning/shared-skill-governance-plan.md), [MountFS Execution Plan](../planning/mountfs-execution-plan.md)

---

## 1. Positioning

本设计解决的不是“skill 文件下载”问题，而是：

> 如何让 Git/GitHub 版本化 shared skills 与项目本地 skills/context 在同一 `mount namespace` 中稳定共存、解析、追踪与治理。

这里的核心约束是：

- `VFS` 只负责路径、挂载、节点与操作
- `mountfs` 负责具体来源的挂载实现
- `skill consumer` 负责把若干节点解释成 skill 集合
- CLI / API / UI 只负责治理和可视化，不重新定义 skill 对象模型

---

## 2. Core Claims

### 2.1 Shared Skill 必须首先是 mount source

Git/GitHub shared skills 在架构上应先被视为 Git-backed context source，再被 `skill consumer` 解释为 skills。

这意味着：

- shared skill repo 不应直接写进独立数据库或 manager 真相源
- 同一套 source 机制未来也可承载 prompts、templates、MCP configs
- `githubfs` / Git-backed mount 是活跃扩展方向，而不是 UI 附属功能

### 2.2 Skill Identity 由解析结果决定，不由文件来源自声明

shared/project 区别不应依赖 frontmatter 中的 `scope=shared` 之类自声明字段，而应由：

- 来源 mount
- 节点路径
- 解析规则
- precedence policy

共同决定。

### 2.3 Source Tree、Resolved Tree、Meta Tree 必须同时存在

如果只保留一个扁平 `/skills/*` 逻辑视图，会丢失来源和冲突信息。

因此必须同时有：

- source tree：真实来源面
- resolved tree：统一消费面
- meta tree：来源与冲突审计面

### 2.4 CLI 是最小权威治理面

UI 可后置，但 CLI 必须先存在。

用户必须能通过 CLI 完成：

- source 接入与版本锁定
- skill resolve / inspect / doctor
- provenance 查看
- conflict 排障

---

## 3. Layering

推荐分层如下：

```text
VFS / mount namespace / mount table
  -> mountfs implementations
    -> skill consumer
      -> governance services
        -> CLI / API / UI
```

边界说明：

- `@actant/vfs`
  - 只提供统一文件系统内核
- `@actant/mountfs-*`
  - 提供不同来源的挂载实现
- `skill consumer`
  - 解释节点为 skill 集合
- governance services
  - 提供 source、resolve、inspect、doctor 等稳定 service contract
- CLI / API / UI
  - 只调用 governance services，不直接二次实现解析逻辑

---

## 4. Namespace Shape

推荐的最小稳定树形如下：

```text
/
  skills/
    project/
      *
    shared/
      <source-id>/
        *
    resolved/
      *
    meta/
      provenance/
        <skill-id>.json
      conflicts/
        <skill-id>.json
```

### 4.1 `project`

`/skills/project/*` 表示当前仓库本地 skills。

特征：

- 跟项目仓库一起版本化
- 默认代表项目定制与本地覆盖
- 可作为 shared skill 的 override 来源

### 4.2 `shared`

`/skills/shared/<source-id>/*` 表示来自 Git/GitHub 的 shared skill source。

特征：

- 必须可追溯到 `repo`、`ref`、`commit`
- 同一项目可接入多个 shared source
- 不同 shared source 间可能产生同名 skill 冲突

### 4.3 `resolved`

`/skills/resolved/*` 是统一消费面。

特征：

- 每个逻辑 `skillId` 只暴露一个 winner
- 不是原始真相源
- 不应承担 provenance 与 conflict 的全部信息

### 4.4 `meta`

`/skills/meta/provenance/*` 与 `/skills/meta/conflicts/*` 提供审计信息。

特征：

- provenance 记录 winner、来源 mount、repo/ref/commit 与 shadowed candidates
- conflict 记录未自动决议的冲突与 diagnostics

---

## 5. Source Model

最小 source contract：

```ts
type SkillSource = {
  id: string;
  kind: 'git';
  repo: string;
  ref: string;
  commit?: string;
  mountPath: string;
  enabled: boolean;
};
```

约束：

- `id` 必须稳定，作为 mount 与 provenance 的引用键
- 用户面可输入 `tag` 或 `branch`，内部最终应解析到固定 `commit`
- source 真相应可落在项目配置中，而不是只存在本地隐式状态

---

## 6. Skill Consumer

`skill consumer` 是独立解释层，不属于 `VFS core`，也不应退回旧式 `manager` 中心模型。

### 6.1 Responsibilities

- `discovery`
  - 从 `/skills/project/*` 与 `/skills/shared/*` 收集候选节点
- `classification`
  - 只把 `regular node` 识别为 skill 候选
- `normalization`
  - 构建统一 `skillId`、title、description、content、metadata
- `resolution`
  - 决定同名候选的 winner 或 conflict
- `provenance`
  - 生成来源追踪与 shadowed candidate 信息

### 6.2 Output Contract

```ts
type ResolvedSkill = {
  id: string;
  title: string;
  path: string;
  winnerSourceId: string;
  scope: 'project' | 'shared';
  overridden: boolean;
  enabled: boolean;
};

type SkillProvenance = {
  skillId: string;
  resolvedFrom: {
    sourceId: string;
    repo?: string;
    ref?: string;
    commit?: string;
    path: string;
    scope: 'project' | 'shared';
  };
  shadowed: Array<{
    sourceId: string;
    path: string;
    scope: 'project' | 'shared';
  }>;
};

type SkillConflict = {
  skillId: string;
  reason: 'duplicate' | 'invalid' | 'ambiguous';
  candidates: string[];
};

type SkillConsumerOutput = {
  skills: ResolvedSkill[];
  conflicts: SkillConflict[];
  provenance: Record<string, SkillProvenance>;
  diagnostics: string[];
};
```

---

## 7. Resolution Policy

MVP 先固定以下规则：

1. `project` 优先于 `shared`
2. `shared pinned` 优先于 `shared floating`
3. 同级同名冲突默认输出 conflict，不静默选 winner
4. 显式 `disabled` 规则优先级最高

补充约束：

- 覆盖基于逻辑 `skillId`，而不是仅基于文件名路径
- provenance 必须展示所有 shadowed candidates
- 冲突必须可通过 CLI/API inspect，而不是只写日志

---

## 8. CLI Contract

MVP 命令面建议如下：

```bash
actant skill source add <repo> --ref <ref>
actant skill source list
actant skill source update <source-id>
actant skill source remove <source-id>

actant skill list
actant skill inspect <skill-id>
actant skill resolve
actant skill doctor
```

要求：

- 默认输出 human-readable
- 查询命令支持 `--json`
- CLI 只消费稳定 governance service contract

---

## 9. Delivery Sequence

### 9.1 Contract Freeze

- shared skill source 与 namespace tree 文档冻结
- `skill consumer` 边界冻结
- precedence / conflict 规则冻结

### 9.2 Git Source MVP

- 实现 Git-backed source
- 支持 materialization、cache 与 mount metadata

### 9.3 Skill Consumer MVP

- 支持 resolve、inspect、provenance、conflict 输出

### 9.4 Governance CLI

- 提供完整 source / skill 管理命令

### 9.5 UI Surface

- 在 CLI/API contract 稳定后提供可视化治理面

---

## 10. Non-Goals

- 本设计不把 `skill consumer` 写回 `VFS core`
- 本设计不重新引入以 `manager` 为中心的聚合真相层
- 本设计不把 UI 作为第一权威入口
- 本设计不在首个里程碑同时覆盖所有上下文资产类型
