---
id: 204
title: "actant-hub core agent kernel: steward / maintainer / curator + auxiliary + spark"
status: open
labels:
  - feature
  - architecture
  - "priority:P1"
milestone: phase-4
author: human
assignees: []
relatedIssues:
  - 173
  - 130
  - 194
  - 178
  - 169
  - 136
  - 165
  - 122
relatedFiles:
  - docs/design/actant-hub-registry-design.md
  - docs/guides/actant-hub-usage.md
  - packages/shared/src/types/template.types.ts
  - docs/planning/phase4-employee-steps.md
taskRef: null
githubRef: "blackplume233/Actant#204"
closedAs: null
createdAt: 2026-02-26T12:00:00
updatedAt: 2026-02-26T14:00:00
closedAt: null
---

**Related Issues**: [[0170-epic-plugin-memory-system]], [[0178-acp-employee-tools-capability-rfc]], [[0169-actant-layer-curator-agent]], [[0135-workflow-as-hook-package]], [[0136-agent-to-agent-email]], [[0165-memory-plugin-instance-layer]], [[0122-employee-service-mode]], [[0182-instance-interaction-archetype]]
**Related Files**: `docs/design/actant-hub-registry-design.md`, `packages/shared/src/types/template.types.ts`, `docs/planning/phase4-employee-steps.md`

---

## 平台级 Agent 模板体系

三层 + 火种架构：

### 内核层（Kernel）— 默认启用

| # | 模板名 | Archetype | 定位 |
|---|--------|-----------|------|
| 1 | `actant-steward` | service | 人类唯一入口，替代 CLI |
| 2 | `actant-maintainer` | employee | 自修复 + 自进化免疫系统 |
| 3 | `actant-curator` | employee | 本地资产管家——记忆治理 + 托管资产 + 运行记录（一切即 file） |

### 辅助层（Auxiliary）— 按需启用

| # | 模板名 | Archetype | 定位 |
|---|--------|-----------|------|
| 4 | `actant-updater` | employee | 版本升级 + 数据迁移 |
| 5 | `actant-scavenger` | employee | 垃圾清理 + 资源回收 |
| 6 | `actant-researcher` | service | 信息检索 + 知识采集 |
| 7 | `actant-onboarder` | tool | 引导 + 教学 |

### 火种层（Spark）— 仅限贡献者

| # | 模板名 | Archetype | 定位 |
|---|--------|-----------|------|
| 8 | `actant-spark` | employee | 自主 fork → 持续编码 → PR 回馈主线，永不停止 |

### 配套

- 25 个 Skills（内核 9 + 辅助 12 + 火种 4）
- 4 个 Presets：`actant-kernel` / `actant-full` / `actant-lite` / `actant-contributor`

Spark 的自举哲学：Actant 管理 Spark → Spark 改进 Actant → Actant 更好地管理 Spark → 正反馈闭环。

详见 GitHub Issue body。

---

## Comments

### human — 2026-02-26T14:30:00

**补充：清理 Hub 设计文档中的旧占位配置**

本 Issue 实施时需清理 `docs/design/actant-hub-registry-design.md`（#130）中的旧占位组件：

删除旧 Templates: `code-reviewer`, `qa-engineer`, `doc-writer`
删除旧 Skills: `code-review`, `test-writer`, `doc-writer`
删除旧 Prompts: `code-assistant`, `qa-assistant`
删除旧 Presets: `web-dev`, `devops`
保留 MCP: `filesystem`, `memory-server`

替换为新的 8 Templates + 25 Skills + 4 Presets。
同步更新 `actant-hub-usage.md`、`create-hub.md` 中的示例引用。

### cursor-agent — 2026-02-26T15:00:00

**重新定义 Curator：从 Hub 资产管理到本地资产管家**

Curator 不负责 Hub 组件管理（那是 Updater 的事）。Curator 管理：
1. **记忆资产** — 对接分层记忆系统（L0/L1/L2、Instance→Template→Actant Promote）
2. **托管资产** — 人类委托的一切有形物（Docker 容器、工作目录、进程、配置、数据库…）
3. **运行记录** — Session 记录、审计日志、性能指标
4. **Agent 产出物** — 报告、代码、导出文件

核心哲学：**一切即 file**。所有被管理实体统一为 `ac://` URI 寻址的 Asset。
- `ac://memory/...` 记忆
- `ac://assets/docker/...` Docker 容器
- `ac://assets/workspace/...` 工作目录
- `ac://assets/process/...` 长驻进程
- `ac://records/...` 运行记录
- `ac://artifacts/...` Agent 产出物

人类可以通过 Steward 说"帮我管理这个 Docker 数据库"→ Curator 注册为托管资产并持续巡检。

详见 GitHub Issue comment。
