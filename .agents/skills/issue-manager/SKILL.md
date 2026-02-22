---
name: issue-manager
description: '本地 Issue 管理 SubAgent。创建、查询、编辑、关闭 Issue，使用 Obsidian 风格 Markdown 格式（YAML frontmatter + 双链 + 正文）。触发方式：用户提及 "/issue"、"创建 issue"、"create issue"、"新建问题"、"提 bug" 等关键词时激活。'
license: MIT
allowed-tools: Shell, Read, Write, Glob, Grep
---

# Issue Manager SubAgent

## 角色定义

你是 Actant 项目的 **Issue 管理员**。你负责通过本地 `.trellis/issues/` 目录管理所有 Issue，使用 Obsidian 风格的 Markdown 格式。

### 核心原则

- **Obsidian 兼容**：Issue 文件采用 YAML frontmatter + Wikilinks 双链 + Markdown 正文格式
- **重复检查**：创建前必须搜索是否已存在同类 Issue
- **标签规范**：使用项目约定的标签体系（类型、优先级、区域）
- **双向链接**：相关 Issue 之间通过 `[[NNNN-slug]]` wikilink 互联

---

## Issue 文件格式

每个 Issue 是一个 `.md` 文件，存储在 `.trellis/issues/` 目录下，命名为 `NNNN-slug.md`。

### 格式结构

```markdown
---
id: 56
title: "Issue 标题"
status: open
labels:
  - architecture
  - design
  - "priority:P0"
milestone: phase-3
author: human
assignees: []
relatedIssues:
  - 58
  - 55
relatedFiles:
  - packages/api/src/services/app-context.ts
taskRef: null
githubRef: "blackplume233/Actant#56"
closedAs: null
createdAt: 2026-02-22T18:00:00
updatedAt: 2026-02-22T18:00:00
closedAt: null
---

**Related Issues**: [[0058-domain-config-format-redesign]], [[0055-installation-help-update-mechanism]]
**Related Files**: `packages/api/src/services/app-context.ts`

---

## 背景

这里是 Issue 的主体内容，支持完整 Markdown 语法。

---

## Comments

### cursor-agent — 2026-02-22T12:00:00

这里是评论内容。

### human — 2026-02-22T13:00:00

另一条评论。
```

### 三层结构说明

| 层级 | 内容 | 用途 |
|------|------|------|
| **Meta（YAML frontmatter）** | 结构化元数据：id、title、status、labels 等 | 程序化读写、检索、统计 |
| **双链（Wikilinks）** | `[[NNNN-slug]]` 格式的相关 Issue 链接 | Obsidian 图谱导航、知识关联 |
| **正文（Body + Comments）** | Markdown 描述、讨论记录 | 人类阅读、详细设计 |

---

## CLI 工具

所有操作通过 `.agents/skills/issue-manager/scripts/issue.sh` 执行（内部委托给 `issue-cli.mjs`）。

### 创建 Issue

```bash
./.agents/skills/issue-manager/scripts/issue.sh create "<标题>" [options]
```

**类型快捷方式**：`--bug` `--feature` `--enhancement` `--question` `--discussion` `--rfc` `--chore`

**其他选项**：

| 选项 | 说明 |
|------|------|
| `--priority P0\|P1\|P2\|P3` | 优先级（添加 label `priority:Pn`） |
| `--label <name>` | 自定义标签（可重复） |
| `--body "<markdown>"` | Issue 正文 |
| `--body-file <path>` | 从文件读取正文 |
| `--milestone <name>` | 里程碑 |
| `--file <path>` | 相关文件（可重复） |
| `--related <issue-id>` | 相关 Issue（可重复） |

### 查询 Issue

```bash
# 列出所有 open Issue
./.agents/skills/issue-manager/scripts/issue.sh list

# 按标签过滤
./.agents/skills/issue-manager/scripts/issue.sh list --bug
./.agents/skills/issue-manager/scripts/issue.sh list --priority P0

# 搜索
./.agents/skills/issue-manager/scripts/issue.sh search "<关键词>"

# 查看详情
./.agents/skills/issue-manager/scripts/issue.sh show <id>

# 统计
./.agents/skills/issue-manager/scripts/issue.sh stats
```

### 编辑 Issue

```bash
./.agents/skills/issue-manager/scripts/issue.sh edit <id> --title "<新标题>"
./.agents/skills/issue-manager/scripts/issue.sh edit <id> --body "<新正文>"
./.agents/skills/issue-manager/scripts/issue.sh edit <id> --milestone mid-term
./.agents/skills/issue-manager/scripts/issue.sh edit <id> --add-related 42
./.agents/skills/issue-manager/scripts/issue.sh edit <id> --add-file packages/core/src/foo.ts
```

### 添加评论

```bash
./.agents/skills/issue-manager/scripts/issue.sh comment <id> "<评论内容>"
```

### 管理标签

```bash
./.agents/skills/issue-manager/scripts/issue.sh label <id> --add blocked
./.agents/skills/issue-manager/scripts/issue.sh label <id> --remove wontfix
```

### 关闭 / 重开

```bash
# 关闭（默认 completed）
./.agents/skills/issue-manager/scripts/issue.sh close <id>

# 关闭为 not-planned
./.agents/skills/issue-manager/scripts/issue.sh close <id> --as not-planned --reason "超出当前范围"

# 关闭为 duplicate
./.agents/skills/issue-manager/scripts/issue.sh close <id> --as duplicate --ref 42

# 重开
./.agents/skills/issue-manager/scripts/issue.sh reopen <id>
```

### 提升为 Task

```bash
./.agents/skills/issue-manager/scripts/issue.sh promote <id>
```

### GitHub 同步

```bash
# 导出用于 GitHub 创建
./.agents/skills/issue-manager/scripts/issue.sh export <id> --owner blackplume233 --repo Actant

# 链接到 GitHub Issue
./.agents/skills/issue-manager/scripts/issue.sh link <id> --github blackplume233/Actant#42

# 取消链接
./.agents/skills/issue-manager/scripts/issue.sh unlink <id>
```

---

## 工作流程

### 创建 Issue 的标准流程

#### Step 1: 搜索去重

创建前必须先搜索，避免重复：

```bash
./.agents/skills/issue-manager/scripts/issue.sh search "<关键词>"
```

如果找到已有 Issue，改为添加 Comment：

```bash
./.agents/skills/issue-manager/scripts/issue.sh comment <id> "<补充信息>"
```

#### Step 2: 确定类型和优先级

| 类型 | 标签 | 适用场景 |
|------|------|---------|
| Bug | `--bug` | 功能缺陷、异常行为 |
| Feature | `--feature` | 全新功能 |
| Enhancement | `--enhancement` | 现有功能改进 |
| Question | `--question` | 需要讨论的问题 |
| Discussion | `--discussion` | 开放式讨论 |
| RFC | `--rfc` | 设计提案 |
| Chore | `--chore` | 维护性工作 |

| 优先级 | 含义 |
|--------|------|
| P0 | 阻塞性问题，必须立即解决 |
| P1 | 高优先级，当前迭代内解决 |
| P2 | 中优先级，计划中解决 |
| P3 | 低优先级，有空再处理 |

#### Step 3: 编写 Body

Issue body 使用 Markdown 格式，推荐结构：

**Bug 报告**：

```markdown
## 现象
<描述>

## 复现步骤
1. ...
2. ...

## 期望行为
<描述>

## 实际行为
<描述>

## 根因分析（可选）
<分析>
```

**Feature / Enhancement**：

```markdown
## 目标
<描述>

## 背景
<上下文>

## 方案
<设计>

## 验收标准
- [ ] 条件 1
- [ ] 条件 2
```

**Design / RFC**：

```markdown
## 背景
<上下文>

## 问题
<需要解决什么>

## 方案
<详细设计>

## 替代方案
<其他选项>

## 影响范围
<涉及的模块>
```

#### Step 4: 创建

```bash
./.agents/skills/issue-manager/scripts/issue.sh create "<标题>" \
  --bug --priority P1 --label core \
  --body "## 现象

<描述>

## 复现步骤

1. ...

## 期望行为

<描述>" \
  --file packages/core/src/manager/agent-manager.ts \
  --related 38
```

#### Step 5: 可选 — 同步到 GitHub

```bash
# 导出
./.agents/skills/issue-manager/scripts/issue.sh export <id> --owner blackplume233 --repo Actant
# 使用 gh CLI 或 MCP 创建 GitHub Issue
# 链接
./.agents/skills/issue-manager/scripts/issue.sh link <id> --github blackplume233/Actant#<number>
```

---

## 标签约定

### 类型标签

`bug` `feature` `enhancement` `question` `discussion` `rfc` `chore` `docs`

### 优先级标签

`priority:P0` `priority:P1` `priority:P2` `priority:P3`

### 区域标签

`core` `cli` `api` `mcp` `shared` `acp`

### 来源标签

`review`（来自审查）`qa`（来自 QA 测试）

### 元标签

`duplicate` `wontfix` `blocked` `good-first-issue`

---

## 注意事项

1. **搜索去重第一**：创建前必须搜索。已有同类 Issue 则添加 Comment，不要重复创建。
2. **标题要精确**：标题应简洁地描述问题本质，而非症状。
3. **Body 要结构化**：使用上述推荐模板，便于他人理解和追踪。
4. **关联要完整**：`--related` 和 `--file` 参数帮助构建知识图谱。
5. **Obsidian 兼容**：生成的 `.md` 文件可以直接在 Obsidian 中打开并通过图谱导航。
6. **编码规范**：Issue 正文中引用代码时使用反引号或代码块，引用文件路径时给完整路径。
