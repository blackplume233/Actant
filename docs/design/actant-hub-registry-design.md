# actant-hub — 官方组件仓库设计

> Issue: [#130](https://github.com/blackplume233/Actant/issues/130), [#204](https://github.com/blackplume233/Actant/issues/204)
> Status: Design
> Date: 2026-02-27

## 1. 概述

`actant-hub` 是 Actant 平台的**官方默认组件仓库**，类似 Homebrew 的 `homebrew-core`。用户安装 Actant 后，该仓库作为内置 Source 自动注册，提供开箱即用的 Skills、Prompts、MCP 配置、AgentTemplate 和 Preset 组件。

**仓库地址**：`https://github.com/blackplume233/actant-hub`

**核心原则**：
- 与现有 Source 系统完全兼容（`actant.json` + `PackageManifest`）
- 兼容 Agent Skills (skill.sh) 生态（SKILL.md 双格式）
- 不引入新组件类型，DomainContext 是现有组件的统称
- 不包含 `workflows/` 目录（Workflow 类型将废弃并归并为 Skill，另建 Issue 追踪）
- 三层 + 火种架构：Kernel / Auxiliary / Spark（#204）

## 2. 仓库结构

```
actant-hub/
├── actant.json              # PackageManifest（Source 系统入口）
├── registry.json            # 增强索引（分类、标签、搜索）
├── README.md
├── CONTRIBUTING.md
├── LICENSE                  # MIT
│
├── skills/                  # Skill 组件（双格式）— 25 个
│   ├── intent-routing/
│   │   └── SKILL.md         # Agent Skills (skill.sh) 兼容格式
│   ├── intent-routing.json  # Actant SkillDefinition 格式
│   ├── conversation-management/
│   │   └── SKILL.md
│   ├── conversation-management.json
│   ├── task-delegation/
│   │   └── SKILL.md
│   ├── task-delegation.json
│   ├── self-diagnosis/
│   │   └── SKILL.md
│   ├── self-diagnosis.json
│   ├── self-repair/
│   │   └── SKILL.md
│   ├── self-repair.json
│   ├── evolution-report/
│   │   └── SKILL.md
│   ├── evolution-report.json
│   ├── memory-governance/
│   │   └── SKILL.md
│   ├── memory-governance.json
│   ├── asset-registry/
│   │   └── SKILL.md
│   ├── asset-registry.json
│   ├── lifecycle-policy/
│   │   └── SKILL.md
│   ├── lifecycle-policy.json
│   ├── version-check/
│   │   └── SKILL.md
│   ├── version-check.json
│   ├── migration-engine/
│   │   └── SKILL.md
│   ├── migration-engine.json
│   ├── rollback-strategy/
│   │   └── SKILL.md
│   ├── rollback-strategy.json
│   ├── resource-scan/
│   │   └── SKILL.md
│   ├── resource-scan.json
│   ├── cleanup-policy/
│   │   └── SKILL.md
│   ├── cleanup-policy.json
│   ├── capacity-monitor/
│   │   └── SKILL.md
│   ├── capacity-monitor.json
│   ├── web-research/
│   │   └── SKILL.md
│   ├── web-research.json
│   ├── knowledge-synthesis/
│   │   └── SKILL.md
│   ├── knowledge-synthesis.json
│   ├── source-evaluation/
│   │   └── SKILL.md
│   ├── source-evaluation.json
│   ├── guided-setup/
│   │   └── SKILL.md
│   ├── guided-setup.json
│   ├── interactive-tutorial/
│   │   └── SKILL.md
│   ├── interactive-tutorial.json
│   ├── context-assessment/
│   │   └── SKILL.md
│   ├── context-assessment.json
│   ├── code-generation/
│   │   └── SKILL.md
│   ├── code-generation.json
│   ├── pr-management/
│   │   └── SKILL.md
│   ├── pr-management.json
│   ├── self-bootstrap/
│   │   └── SKILL.md
│   ├── self-bootstrap.json
│   ├── contribution-policy/
│   │   └── SKILL.md
│   └── contribution-policy.json
│
├── prompts/                 # Prompt 组件 — 8 个
│   ├── steward-system-prompt.json
│   ├── maintainer-system-prompt.json
│   ├── curator-system-prompt.json
│   ├── updater-system-prompt.json
│   ├── scavenger-system-prompt.json
│   ├── researcher-system-prompt.json
│   ├── onboarder-system-prompt.json
│   └── spark-system-prompt.json
│
├── mcp/                     # MCP Server 配置（当前为空，后续内置）
│
├── templates/               # AgentTemplate 完整定义 — 8 个
│   ├── actant-steward.json      # Kernel: 人类入口 (service)
│   ├── actant-maintainer.json   # Kernel: 自修复免疫系统 (employee)
│   ├── actant-curator.json      # Kernel: 本地资产管家 (employee)
│   ├── actant-updater.json      # Auxiliary: 版本升级 (employee)
│   ├── actant-scavenger.json    # Auxiliary: 垃圾清理 (employee)
│   ├── actant-researcher.json   # Auxiliary: 信息检索 (service)
│   ├── actant-onboarder.json    # Auxiliary: 引导教学 (tool)
│   └── actant-spark.json        # Spark: 自主编码贡献者 (employee)
│
└── presets/                 # 预设组合包 — 4 个
    ├── actant-kernel.json       # steward + maintainer + curator
    ├── actant-full.json         # 全部 8 templates
    ├── actant-lite.json         # steward only
    └── actant-contributor.json  # kernel + spark
```

## 3. 文件格式规范

### 3.1 actant.json（PackageManifest）

沿用现有 `PackageManifest` 接口（`packages/shared/src/types/source.types.ts`），Source 系统通过此文件发现组件。

```json
{
  "name": "actant-hub",
  "version": "1.0.0",
  "description": "Actant official component hub — kernel, auxiliary, and spark agent templates with skills, prompts, MCP configs & presets",
  "components": {
    "skills": [
      "skills/intent-routing.json",
      "skills/conversation-management.json",
      "skills/task-delegation.json",
      "skills/self-diagnosis.json",
      "skills/self-repair.json",
      "skills/evolution-report.json",
      "skills/memory-governance.json",
      "skills/asset-registry.json",
      "skills/lifecycle-policy.json",
      "skills/version-check.json",
      "skills/migration-engine.json",
      "skills/rollback-strategy.json",
      "skills/resource-scan.json",
      "skills/cleanup-policy.json",
      "skills/capacity-monitor.json",
      "skills/web-research.json",
      "skills/knowledge-synthesis.json",
      "skills/source-evaluation.json",
      "skills/guided-setup.json",
      "skills/interactive-tutorial.json",
      "skills/context-assessment.json",
      "skills/code-generation.json",
      "skills/pr-management.json",
      "skills/self-bootstrap.json",
      "skills/contribution-policy.json"
    ],
    "prompts": [
      "prompts/steward-system-prompt.json",
      "prompts/maintainer-system-prompt.json",
      "prompts/curator-system-prompt.json",
      "prompts/updater-system-prompt.json",
      "prompts/scavenger-system-prompt.json",
      "prompts/researcher-system-prompt.json",
      "prompts/onboarder-system-prompt.json",
      "prompts/spark-system-prompt.json"
    ],
    "mcp": [],
    "templates": [
      "templates/actant-steward.json",
      "templates/actant-maintainer.json",
      "templates/actant-curator.json",
      "templates/actant-updater.json",
      "templates/actant-scavenger.json",
      "templates/actant-researcher.json",
      "templates/actant-onboarder.json",
      "templates/actant-spark.json"
    ]
  },
  "presets": [
    "presets/actant-kernel.json",
    "presets/actant-full.json",
    "presets/actant-lite.json",
    "presets/actant-contributor.json"
  ]
}
```

### 3.2 SkillDefinition（JSON 格式）

```json
{
  "name": "memory-governance",
  "version": "1.0.0",
  "description": "记忆治理 — 管理分层记忆系统的 Promote/衰减/去重/凝练，确保记忆质量与一致性",
  "content": "# Memory Governance\n\n...",
  "tags": ["memory", "governance", "knowledge-management", "curator"],
  "license": "MIT"
}
```

### 3.3 SKILL.md（Agent Skills 兼容格式）

每个 Skill 在 `skills/{name}/SKILL.md` 提供 skill.sh 兼容版本，使得该仓库同时可被 Claude Code、Cursor 等通过 `npx skills add` 直接使用。

```markdown
---
name: memory-governance
description: "记忆治理 — 管理分层记忆系统的 Promote/衰减/去重/凝练"
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "memory,governance,knowledge-management,curator"
  layer: kernel
  agent: actant-curator
---

# Memory Governance

(skill content)
```

**数据源关系**：`SKILL.md` 是 source of truth，`.json` 可由构建脚本从 SKILL.md 生成。

### 3.4 PromptDefinition

```json
{
  "name": "curator-system-prompt",
  "version": "1.0.0",
  "description": "Actant Curator 系统提示词 — 本地资产管家",
  "content": "You are Actant Curator, the asset steward...",
  "variables": []
}
```

### 3.5 McpServerDefinition

> MCP Server 配置当前为空，后续将内置到 Actant 核心中，不通过 Hub 分发。
> 格式保留供未来扩展使用：

```json
{
  "name": "example-mcp",
  "version": "1.0.0",
  "description": "Example MCP server definition",
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "env": {}
}
```

### 3.6 AgentTemplate

```json
{
  "name": "actant-curator",
  "version": "1.0.0",
  "description": "Actant 资产管家 — 记忆治理 + 托管资产管理 + 运行记录归档",
  "archetype": "employee",
  "backend": { "type": "claude-code" },
  "domainContext": {
    "skills": ["memory-governance", "asset-registry", "lifecycle-policy"],
    "prompts": ["curator-system-prompt"],
    "mcpServers": []
  },
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": ["Read", "Write", "Shell"],
    "sandbox": { "enabled": false }
  },
  "schedule": {
    "heartbeat": {
      "intervalMs": 120000,
      "prompt": "巡检所有 active 状态的托管资产",
      "priority": "normal"
    },
    "cron": [
      {
        "pattern": "0 2 * * *",
        "prompt": "夜间记忆治理",
        "priority": "normal"
      }
    ],
    "hooks": [
      {
        "eventName": "session:end",
        "prompt": "Session 结束，提取记忆 Promote 候选",
        "priority": "normal"
      }
    ]
  },
  "metadata": {
    "layer": "kernel",
    "tier": "3"
  }
}
```

### 3.7 PresetDefinition

Preset 是按领域/场景打包的组件组合，用户可通过 `actant preset apply` 一键引入。

```json
{
  "name": "actant-kernel",
  "version": "1.0.0",
  "description": "内核预设 — Steward + Maintainer + Curator",
  "skills": [
    "intent-routing", "conversation-management", "task-delegation",
    "self-diagnosis", "self-repair", "evolution-report",
    "memory-governance", "asset-registry", "lifecycle-policy"
  ],
  "prompts": ["steward-system-prompt", "maintainer-system-prompt", "curator-system-prompt"],
  "mcpServers": [],
  "templates": ["actant-steward", "actant-maintainer", "actant-curator"]
}
```

## 4. registry.json 增强索引

`actant.json` 供 Source 系统机读发现组件。`registry.json` 提供人/CLI 友好的增强索引，用于搜索、分类和发现。

```json
{
  "$schema": "https://actant.dev/schemas/registry-v1.json",
  "version": "1.0.0",
  "lastUpdated": "2026-02-27",
  "categories": {
    "kernel": {
      "label": "Kernel Agents",
      "description": "核心 Agent — 默认启用，构成 Actant 平台的基础运行时",
      "presets": ["actant-kernel"],
      "templates": ["actant-steward", "actant-maintainer", "actant-curator"]
    },
    "auxiliary": {
      "label": "Auxiliary Agents",
      "description": "辅助 Agent — 按需启用，扩展平台功能",
      "presets": ["actant-full"],
      "templates": ["actant-updater", "actant-scavenger", "actant-researcher", "actant-onboarder"]
    },
    "spark": {
      "label": "Spark Agent",
      "description": "火种 Agent — 仅限贡献者，自主编码贡献者",
      "presets": ["actant-contributor"],
      "templates": ["actant-spark"]
    }
  },
  "components": {
    "skills": [
      { "name": "intent-routing", "description": "意图识别与路由", "tags": ["intent", "routing"], "categories": ["kernel"] },
      { "name": "conversation-management", "description": "会话管理", "tags": ["conversation", "context"], "categories": ["kernel"] },
      { "name": "task-delegation", "description": "任务委派", "tags": ["delegation", "orchestration"], "categories": ["kernel"] },
      { "name": "self-diagnosis", "description": "自诊断", "tags": ["diagnosis", "monitoring"], "categories": ["kernel"] },
      { "name": "self-repair", "description": "自修复", "tags": ["repair", "recovery"], "categories": ["kernel"] },
      { "name": "evolution-report", "description": "进化报告", "tags": ["evolution", "analytics"], "categories": ["kernel"] },
      { "name": "memory-governance", "description": "记忆治理", "tags": ["memory", "governance"], "categories": ["kernel"] },
      { "name": "asset-registry", "description": "资产注册", "tags": ["asset", "registry"], "categories": ["kernel"] },
      { "name": "lifecycle-policy", "description": "生命周期策略", "tags": ["lifecycle", "retention"], "categories": ["kernel"] },
      { "name": "version-check", "description": "版本检查", "tags": ["version", "update"], "categories": ["auxiliary"] },
      { "name": "migration-engine", "description": "数据迁移引擎", "tags": ["migration", "schema"], "categories": ["auxiliary"] },
      { "name": "rollback-strategy", "description": "回滚策略", "tags": ["rollback", "safety"], "categories": ["auxiliary"] },
      { "name": "resource-scan", "description": "资源扫描", "tags": ["scan", "resource"], "categories": ["auxiliary"] },
      { "name": "cleanup-policy", "description": "清理策略", "tags": ["cleanup", "policy"], "categories": ["auxiliary"] },
      { "name": "capacity-monitor", "description": "容量监控", "tags": ["capacity", "monitoring"], "categories": ["auxiliary"] },
      { "name": "web-research", "description": "网络研究", "tags": ["research", "web"], "categories": ["auxiliary"] },
      { "name": "knowledge-synthesis", "description": "知识合成", "tags": ["synthesis", "knowledge"], "categories": ["auxiliary"] },
      { "name": "source-evaluation", "description": "来源评估", "tags": ["evaluation", "credibility"], "categories": ["auxiliary"] },
      { "name": "guided-setup", "description": "引导设置", "tags": ["setup", "onboarding"], "categories": ["auxiliary"] },
      { "name": "interactive-tutorial", "description": "交互式教程", "tags": ["tutorial", "learning"], "categories": ["auxiliary"] },
      { "name": "context-assessment", "description": "上下文评估", "tags": ["assessment", "personalization"], "categories": ["auxiliary"] },
      { "name": "code-generation", "description": "代码生成", "tags": ["code", "generation"], "categories": ["spark"] },
      { "name": "pr-management", "description": "PR 管理", "tags": ["pr", "github"], "categories": ["spark"] },
      { "name": "self-bootstrap", "description": "自举", "tags": ["bootstrap", "autonomy"], "categories": ["spark"] },
      { "name": "contribution-policy", "description": "贡献策略", "tags": ["contribution", "standards"], "categories": ["spark"] }
    ],
    "prompts": [
      { "name": "steward-system-prompt", "description": "Steward 系统提示词", "tags": ["steward"], "categories": ["kernel"] },
      { "name": "maintainer-system-prompt", "description": "Maintainer 系统提示词", "tags": ["maintainer"], "categories": ["kernel"] },
      { "name": "curator-system-prompt", "description": "Curator 系统提示词", "tags": ["curator"], "categories": ["kernel"] },
      { "name": "updater-system-prompt", "description": "Updater 系统提示词", "tags": ["updater"], "categories": ["auxiliary"] },
      { "name": "scavenger-system-prompt", "description": "Scavenger 系统提示词", "tags": ["scavenger"], "categories": ["auxiliary"] },
      { "name": "researcher-system-prompt", "description": "Researcher 系统提示词", "tags": ["researcher"], "categories": ["auxiliary"] },
      { "name": "onboarder-system-prompt", "description": "Onboarder 系统提示词", "tags": ["onboarder"], "categories": ["auxiliary"] },
      { "name": "spark-system-prompt", "description": "Spark 系统提示词", "tags": ["spark"], "categories": ["spark"] }
    ],
    "mcp": [],
    "templates": [
      { "name": "actant-steward", "description": "人类入口", "tags": ["steward", "service"], "categories": ["kernel"] },
      { "name": "actant-maintainer", "description": "自修复免疫系统", "tags": ["maintainer", "employee"], "categories": ["kernel"] },
      { "name": "actant-curator", "description": "本地资产管家", "tags": ["curator", "employee"], "categories": ["kernel"] },
      { "name": "actant-updater", "description": "版本升级", "tags": ["updater", "employee"], "categories": ["auxiliary"] },
      { "name": "actant-scavenger", "description": "垃圾清理", "tags": ["scavenger", "employee"], "categories": ["auxiliary"] },
      { "name": "actant-researcher", "description": "信息检索", "tags": ["researcher", "service"], "categories": ["auxiliary"] },
      { "name": "actant-onboarder", "description": "引导教学", "tags": ["onboarder", "tool"], "categories": ["auxiliary"] },
      { "name": "actant-spark", "description": "自主编码贡献者", "tags": ["spark", "employee"], "categories": ["spark"] }
    ],
    "presets": [
      { "name": "actant-kernel", "description": "内核预设", "tags": ["kernel"], "categories": ["kernel"] },
      { "name": "actant-full", "description": "完整预设", "tags": ["full"], "categories": ["kernel", "auxiliary", "spark"] },
      { "name": "actant-lite", "description": "轻量预设", "tags": ["lite"], "categories": ["kernel"] },
      { "name": "actant-contributor", "description": "贡献者预设", "tags": ["contributor"], "categories": ["kernel", "spark"] }
    ]
  }
}
```

## 5. Skill 双格式策略

延续 Issue #111 的设计。每个 Skill 同时提供两种格式：

| 格式 | 路径 | 消费者 | 角色 |
|------|------|--------|------|
| `SKILL.md` | `skills/{name}/SKILL.md` | skill.sh 生态 (Claude Code, Cursor, Gemini CLI) | Source of truth |
| `.json` | `skills/{name}.json` | Actant Source 系统 | 可自动生成 |

现有 `LocalSource` / `GitHubSource` 已支持读取 SKILL.md 子目录格式（扫描 `skills/*/SKILL.md`，解析 YAML frontmatter + markdown body，转换为 `SkillDefinition`）。

可选提供 `scripts/build.mjs` 从 SKILL.md 自动生成 .json 文件。

## 6. Actant 侧集成

### 6.1 自动注册默认 Source

`SourceManager` 已有常量（`source-manager.ts` L14-19）：

```typescript
export const DEFAULT_SOURCE_NAME = "actant-hub";
export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  type: "github",
  url: "https://github.com/blackplume233/actant-hub.git",
  branch: "main",
};
```

在 `initialize()` 末尾添加自动注册逻辑：若 `sources.json` 中不存在默认源，则尝试注册。网络不可用时静默跳过。

### 6.2 CLI setup 集成

`actant setup` 流程中自动同步默认源，或提示用户确认。

### 6.3 template install 命令

实现 `actant template install <source>@<name>` stub，从默认源或指定源安装模板。

## 7. 版本策略

- 仓库整体版本通过 `actant.json` 的 `version` 字段管理
- 每个组件有独立的 `version` 字段（semver）
- 通过 git tag 标记仓库里程碑版本
- `SourceManager` 的 `SyncReport` 已支持版本变更检测和 breaking change 告警

## 8. 架构决策记录

### ADR: Workflow 类型废弃

**决策**：Workflow 类型将归并为 Skill（策略 A）。actant-hub 不设 `workflows/` 目录。

**理由**：
- `WorkflowDefinition` 与 `SkillDefinition` 数据结构完全相同（`name + content`）
- 唯一区别是物化路径（`.trellis/workflow.md` vs `AGENTS.md`），不值得维护独立的类型/管理器/处理器
- 从 Agent 视角看，workflow 内容作为 Skill 同样可达

**影响范围**：废弃 `WorkflowDefinition`、`WorkflowManager`、`workflowHandler`，更新 `DomainContextConfig`，更新 Builder 和 Trellis 命令。另建 Issue 追踪，不在 #130 范围内。

### ADR: 三层 + 火种架构（#204）

**决策**：Hub 组件按 Kernel / Auxiliary / Spark 三层组织。

**理由**：
- Kernel（steward + maintainer + curator）构成最小完整系统
- Auxiliary 按需扩展，不影响核心功能
- Spark 面向贡献者，访问受限

**Skill 分配**：内核 9 + 辅助 12 + 火种 4 = 25 Skills。
