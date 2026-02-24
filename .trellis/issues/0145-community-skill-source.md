---
id: 145
title: "feat(source): 兼容社区 Agent Skills 仓库作为 source 类型"
status: open
labels:
  - feature
  - enhancement
  - "priority:P1"
  - core
milestone: null
author: cursor-agent
assignees: []
relatedIssues:
  - 144
relatedFiles:
  - packages/shared/src/types/source.types.ts
  - packages/core/src/source/source-manager.ts
  - packages/core/src/source/component-source.ts
  - packages/core/src/source/source-validator.ts
  - packages/cli/src/commands/source/
taskRef: null
githubRef: "blackplume233/Actant#145"
closedAs: null
createdAt: 2026-02-24T18:00:00
updatedAt: 2026-02-24T18:00:00
closedAt: null
---

**Related Issues**: [[0144-hub-agentskills-compatibility]]
**Related Files**: `packages/shared/src/types/source.types.ts`, `packages/core/src/source/source-manager.ts`, `packages/core/src/source/component-source.ts`

---

## 目标

支持将遵循 [Agent Skills](https://agentskills.io/) 开放标准的社区仓库（如 `anthropics/skills`、用户自定义 skill 合集）直接注册为 ActantHub 的 **source**，无需 `actant.json` 清单即可自动发现和导入 SKILL.md 技能。

## 背景

当前 SourceManager 的 `SourceConfig` 联合类型只支持 `github`（需 actant.json）和 `local` 两种类型。社区中大量遵循 Agent Skills 标准的技能仓库（如 Anthropic 官方 `anthropics/skills`、Claude 社区 skill 合集等）无法直接作为 source 使用，需要手动将每个 skill 逐一复制到本地。

相关 Issue #144 关注的是 Hub **格式**与 Agent Skills 标准的双向兼容；本 Issue 关注的是在 source **架构**层面原生支持社区仓库作为可注册、可同步的数据源。

## 方案

### 1. 新增 `community` source 类型

```typescript
export interface CommunitySourceConfig {
  type: "community";
  url: string;       // GitHub repo URL 或本地路径
  branch?: string;
  /** 只导入匹配的 skill（glob），默认 '**' 全部导入 */
  filter?: string;
}
```

在 `source.types.ts` 中扩展 `SourceConfig` 联合类型，在 `SourceManager.createSource()` 中注册新类型。

### 2. 实现 `CommunitySource` 类

核心逻辑：

- **fetch/sync**：克隆或 pull 目标仓库
- **自动发现**：递归扫描目录，查找 `SKILL.md` 文件（无需 actant.json）
- **解析 SKILL.md**：复用现有 `skill-md-parser.ts` 解析 frontmatter
- **生成虚拟清单**：将扫描到的 skills 包装为 `FetchResult`（manifest.name 取仓库名）
- **filter 支持**：用 glob 过滤只需要的 skill 子集

### 3. CLI 集成

```bash
# 注册社区源
actant source add anthropic-skills --type community --url https://github.com/anthropics/skills

# 与现有命令复用
actant source sync anthropic-skills
actant source list
actant source install anthropic-skills@<skill-name>
```

### 4. 与 #144 的协同

- 本 Issue 提供 source 架构层面的 `community` 类型注册和扫描能力
- #144 提供 SKILL.md 格式层面的字段对齐和兼容验证
- 两者可独立推进，最终协同使 ActantHub 成为社区 skill 的一等消费者

## 验收标准

- [ ] `source.types.ts` 新增 `CommunitySourceConfig` 类型
- [ ] 实现 `CommunitySource` 类，支持 fetch/sync/dispose
- [ ] 自动发现：递归扫描 SKILL.md，无需 actant.json 即可生成 FetchResult
- [ ] filter 选项：支持 glob 过滤 skill 子集
- [ ] CLI `actant source add --type community` 命令可用
- [ ] 可成功注册 `anthropics/skills` 等社区仓库并列出其中的 skill
- [ ] 单元测试覆盖 CommunitySource 的 fetch/filter 逻辑

## 影响范围

- `packages/shared/src/types/source.types.ts` — SourceConfig 联合
- `packages/core/src/source/` — 新增 `community-source.ts`，修改 `source-manager.ts`
- `packages/cli/src/commands/source/` — 适配 community 类型
- `packages/core/src/source/source-validator.ts` — 可选：community 源的宽松校验模式
