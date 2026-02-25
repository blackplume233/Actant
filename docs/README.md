# Actant Documentation

本目录包含 Actant 项目的全部文档，按用途和作者分目录组织。

> 后续计划构建 Wiki 站点，目录结构以此为准。

---

## 目录结构

```
docs/
├── wiki/             ★ Wiki 站点（VitePress，生成内容，不作为开发参考）
├── guides/           使用教程与操作指南（面向用户和 AI Agent）
├── planning/         产品规划（Roadmap、Phase TODO、执行计划）
│   └── archive/      已完成阶段的计划存档
├── design/           功能设计文档（活文档，协作编写）
├── decisions/        架构决策记录 ADR（需人类 Accepted 后生效）
├── stage/            版本快照存档（脚本 + AI 生成，只读）
│   └── v<x.y.z>/    每个版本的完整快照
├── reports/          技术报告与分析
├── human/            人类手写笔记（AI 禁止写入）
├── agent/            AI Agent 生成的分析报告（需人类验证）
└── site/             GitHub Pages 静态站点源码
```

---

## 各目录详细说明

### `wiki/` — Wiki 站点（VitePress）

基于 VitePress 的完整 Wiki，面向人类用户，包含入门指南、功能说明、实战教程、架构参考。

**全部内容为生成产物，不作为 AI Agent 的开发或操作参考。**

```bash
cd docs/wiki && pnpm install && pnpm dev   # 本地预览
```

| 区域 | 内容 |
|------|------|
| `guide/` | 快速开始、安装、核心概念 |
| `features/` | 10 项功能的精简说明（模板、生命周期、领域上下文、多后端、权限、调度器、ACP、组件源、可扩展架构、CLI） |
| `recipes/` | 创建组件仓库、CI/CD 集成、雇员 Agent |
| `reference/` | 架构概览、Changelog |

---

### `guides/` — 教程与操作指南

面向用户（人类或 AI Agent）的使用教程和操作手册。

| 文件 | 说明 |
|------|------|
| `getting-started.md` | 面向人类的快速入门指南 |
| `ai-agent-usage-guide.md` | 面向 AI Agent 的 Actant 使用手册 |
| `ai-agent-dev-guide.md` | 面向 AI Agent 的 Actant 源码开发手册 |
| `dev-workflow-guide.md` | 开发流程指南（Plan → Code → Review → PR → Ship → QA → Stage） |
| `dev-environment-setup.md` | 开发环境搭建指南 |
| `actant-hub-usage.md` | ActantHub 默认组件源的使用指南 |
| `create-custom-hub.md` | 从零创建自定义组件源仓库 |

> `features/` 子目录已合并入 `wiki/features/`，保留重定向说明。

**写入规则**：人类和 AI 均可创建和更新。

**命名规范**：`verb-noun.md`（如 `creating-templates.md`）或 `描述性名称.md`。

---

### `design/` — 功能设计文档

功能方案、架构讨论、技术分析等活文档。人类和 AI 均可起草和更新，但结构性变更需人类审阅。

**当前文件**：

| 文件 | 说明 |
|------|------|
| `architecture-docker-analogy.md` | Docker 类比架构设计 |
| `domain-context-extension-guide.md` | DomainContext 扩展指南 |
| `domain-context-formats.md` | 领域上下文格式定义 |
| `acp-complete-server-architecture.md` | ACP 完整服务端架构 |
| `acp-protocol-gap-analysis.md` | ACP 协议差距分析 |
| `acp-gateway-deprecation-discussion.md` | ACP Gateway 废弃讨论 |
| `agent-launch-scenarios.md` | Agent 启动场景设计 |
| `cli-daemon-refactor-plan.md` | CLI/Daemon 重构计划 |
| `core-agent-config-roadmap.md` | 核心 Agent 配置路线图 |
| `core-agent-progress-report.md` | 核心 Agent 进度报告 |
| `memory-layer-agent-evolution.md` | 记忆层与 Agent 演进设计 |
| `mvp-next-design.md` | MVP 后续设计 |
| `code-review-and-dependency-analysis.md` | 代码审查与依赖分析 |

**命名规范**：`topic.md` 或 `topic-subtopic.md`。

---

### `planning/` — 产品规划与路线图

产品 Roadmap、Phase TODO 清单、里程碑跟踪和执行计划。

| 文件 | 说明 |
|------|------|
| `roadmap.md` | 产品路线图（Phase 1–5 规划，Issue 对齐） |
| `phase3-todo.md` | Phase 3 MVP TODO（已完成） |
| `archive/` | 已完成阶段的执行计划存档 |

`archive/` 下包含各 Phase 的详细执行计划（从 `.cursor/plans/` 归档）：

| 文件 | 说明 |
|------|------|
| `phase3-full-execution.md` | Phase 3 全量执行计划 |
| `phase3a-unified-component-management.md` | Phase 3a 统一组件管理 |
| `phase3a-component-management.md` | Phase 3a 组件管理 |
| `phase3b-workspace-builder.md` | Phase 3b 工作区构建器 |
| `phase3c-employee-scheduler.md` | Phase 3c 雇员调度器 |
| `phase3-connectivity-management.md` | Phase 3 通信管理 |
| `phase3-issue-cleanup.md` | Phase 3 Issue 清理 |

**写入规则**：人类和 AI 均可更新。Roadmap 变更需与 GitHub Issues 保持同步。

**命名规范**：`phase<N>-slug.md`（阶段计划）或自由命名。

> **迁移说明**：`roadmap.md` 和 `phase3-todo.md` 原在 `.trellis/` 下，现已迁移至此。
> `.trellis/` 中保留了重定向指引文件。

---

### `decisions/` — 架构决策记录 (ADR)

重要技术选型和架构决策。人类或 AI 均可提出，但只有人类标记 `Status: Accepted` 后才生效。

| 文件 | 说明 |
|------|------|
| `001-tech-stack.md` | 技术栈选型（TypeScript + pnpm monorepo） |
| `002-directory-structure.md` | 项目目录结构规范 |

**命名规范**：`NNN-slug.md`（三位数字编号 + kebab-case 标题）。

---

### `stage/` — 版本快照存档

每个版本的完整快照，由 `/trellis:stage-version` 命令生成。**只读**，不应手动修改。

```
stage/
├── v0.1.0/
│   ├── metadata.json         版本元数据
│   ├── architecture.md       完整架构文档（AI 生成）
│   ├── api-surface.md        API 接口文档（脚本生成）
│   ├── api-surface.json      API 机器可读快照
│   ├── config-schemas.md     配置结构文档（脚本生成）
│   ├── config-schemas.json   配置结构机器可读快照
│   ├── metrics.json          代码度量
│   ├── dependencies.json     依赖树快照
│   ├── test-report.json      测试报告
│   ├── changelog.md          变更日志
│   └── issue-snapshot.json   Issue 状态快照
└── v0.1.2/
    ├── (同上)
    └── diff-from-v0.1.0.md   与上一版本的对比报告
```

---

### `reports/` — 技术报告

独立的技术分析报告，通常是一次性的深度调研产物。

| 文件 | 说明 |
|------|------|
| `PROJECT_ANALYSIS_REPORT.md` | 项目整体分析报告 |
| `TSUP_SUITABILITY_REPORT.md` | tsup 构建工具适用性评估 |

---

### `human/` — 人类手写笔记

**AI 禁止自动写入此目录。** 仅限人类开发者手工编写。

| 文件 | 说明 |
|------|------|
| `human_start.md` | 项目愿景、语义、开发原则 |

**命名规范**：`YYYY-MM-DD-topic.md` 或自由命名。

---

### `agent/` — AI Agent 生成的报告

AI Agent 自动生成的分析、审查、会话日志等。**内容视为意见**，需人类验证后方可作为决策依据。

**命名规范**：`YYYY-MM-DD-agent-topic.md`。

---

### `site/` — GitHub Pages 源码

GitHub Pages 静态站点源文件，通过 `.github/workflows/deploy-site.yml` 自动部署。

| 文件 | 说明 |
|------|------|
| `index.html` | Landing Page 主页 |
| `content.md` | 内容源数据 |

修改 `site/` 下文件并推送到 master 后会自动触发部署。

---

## 写入规则总览

| 目录 | 谁可以写 | 可靠性 | 修改限制 |
|------|---------|--------|---------|
| `wiki/` | 生成工具 | **生成产物，不作为开发参考** | AI Agent 不应引用 |
| `guides/` | 人类 + AI | 权威（经审阅后） | 无 |
| `planning/` | 人类 + AI | 权威 | Roadmap 变更需与 Issues 同步 |
| `design/` | 人类 + AI | 活文档 | 结构性变更需人类审阅 |
| `decisions/` | 人类 + AI 提议 | `Accepted` 后权威 | 状态变更仅限人类 |
| `stage/` | 脚本 + AI | 版本快照 | **只读，不手动修改** |
| `reports/` | 人类 + AI | 参考 | 无 |
| `human/` | **仅人类** | 权威 | **AI 禁止写入** |
| `agent/` | **仅 AI** | 需人类验证 | 无 |
| `site/` | 人类 + AI | — | 推送后自动部署 |

---

## 命名规范总览

| 文档类型 | 命名模式 | 示例 |
|---------|---------|------|
| 操作指南 | `verb-noun.md` 或描述性名称 | `getting-started.md`, `ai-agent-usage-guide.md` |
| 产品规划 | `phase<N>-slug.md` 或自由命名 | `roadmap.md`, `phase3-todo.md` |
| 设计文档 | `topic.md` | `domain-context-formats.md` |
| ADR | `NNN-slug.md` | `001-tech-stack.md` |
| 人类笔记 | `YYYY-MM-DD-topic.md` | `2026-02-19-kickoff.md` |
| Agent 报告 | `YYYY-MM-DD-agent-topic.md` | `2026-02-19-cursor-spec-update.md` |
| 技术报告 | `TOPIC_REPORT.md` | `PROJECT_ANALYSIS_REPORT.md` |

---

## Wiki 站点

Wiki 已实现，位于 `docs/wiki/`（VitePress 项目）。

```bash
cd docs/wiki && pnpm install && pnpm dev
```

**定位**：面向人类用户的产品文档。全部内容为生成产物，AI Agent 不应以此为开发参考。

**部署**：与 `docs/site/`（Landing Page）共存，可通过 GitHub Pages 发布到 `/Actant/wiki/` 路径。
