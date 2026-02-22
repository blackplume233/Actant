---
id: 38
title: 项目重命名：AgentCraft → Actant
status: closed
labels:
  - refactor
  - branding
  - "priority:P1"
milestone: mid-term
author: human
assignees: []
relatedIssues:
  - 59
relatedFiles:
  - package.json
  - packages/cli/package.json
  - packages/core/package.json
  - packages/api/package.json
  - packages/acp/package.json
  - packages/shared/package.json
  - packages/mcp-server/package.json
  - pnpm-lock.yaml
  - AGENTS.md
  - .trellis/roadmap.md
  - .trellis/workflow.md
  - docs/design/architecture-docker-analogy.md
taskRef: null
githubRef: "blackplume233/Actant#42"
closedAs: completed
createdAt: "2026-02-21T14:00:00"
updatedAt: "2026-02-22T03:46:39"
closedAt: "2026-02-22T10:00:00"
---

**Related Issues**: [[0059-create-official-default-source-repo-compatible-with-agent-sk]]
**Related Files**: `package.json`, `packages/cli/package.json`, `packages/core/package.json`, `packages/api/package.json`, `packages/acp/package.json`, `packages/shared/package.json`, `packages/mcp-server/package.json`, `pnpm-lock.yaml`, `AGENTS.md`, `.trellis/roadmap.md`, `.trellis/workflow.md`, `docs/design/architecture-docker-analogy.md`

---

## 目标

将项目从 **AgentCraft** 全量重命名为 **Actant**（actant.dev）。涵盖代码、配置、文档、文件路径的所有引用。

## 背景

- "AgentCraft" 名称在 AI Agent 领域高度拥挤（npm `@idosal/agentcraft`、agentcraft.pro、getagentcraft.com 等）
- **Actant**（"行动者"）源自叙事学（Greimas 行动元模型）和行动者网络理论（Latour），意为 "执行行动的实体"，与 Actor Model 同根（act-）
- 域名 `actant.dev` 已购买
- npm 裸包名 `actant` 和 `@actant/*` scope 均可用
- GitHub org `actant` 可用

## 重命名映射

| 原名 | 新名 |
|------|------|
| `AgentCraft` | `Actant` |
| `agentcraft` | `actant` |
| `AGENTCRAFT` | `ACTANT` |
| `@agentcraft/*` | `@actant/*` |
| `agentcraft.sock` | `actant.sock` |
| `~/.agentcraft/` | `~/.actant/` |
| `.agentcraft.json` | `.actant.json` |
| `agentcraft agent ...` (CLI) | `actant agent ...` |

## 实施计划

### Step 1: package.json 与依赖

- [ ] 根 `package.json`: `name: "agentcraft"` → `"actant"`
- [ ] `packages/cli/package.json`: `@agentcraft/cli` → `@actant/cli`，`bin.agentcraft` → `bin.actant`
- [ ] `packages/core/package.json`: `@agentcraft/core` → `@actant/core`
- [ ] `packages/api/package.json`: `@agentcraft/api` → `@actant/api`
- [ ] `packages/acp/package.json`: `@agentcraft/acp` → `@actant/acp`
- [ ] `packages/shared/package.json`: `@agentcraft/shared` → `@actant/shared`
- [ ] `packages/mcp-server/package.json`: `@agentcraft/mcp-server` → `@actant/mcp-server`
- [ ] 所有 package.json 中的 `dependencies` / `devDependencies` 内部引用更新
- [ ] `pnpm-lock.yaml` 重新生成

### Step 2: 代码中的字符串与标识符

- [ ] TypeScript/JS 源码中所有 `agentcraft` / `AgentCraft` / `AGENTCRAFT` 字符串
- [ ] import 路径：`from '@agentcraft/...'` → `from '@actant/...'`
- [ ] 文件系统路径常量：`~/.agentcraft/`、`.agentcraft.json`、`agentcraft.sock`
- [ ] CLI 命令名注册（Commander `program.name('agentcraft')` → `'actant'`）
- [ ] 日志 / 输出中的品牌名

### Step 3: 配置文件

- [ ] `tsconfig.json` 中的 paths 映射（`@agentcraft/*`）
- [ ] `.ai-devkit.json` 如有品牌引用
- [ ] vitest.config.ts 如有品牌引用
- [ ] ESLint 配置如有品牌引用

### Step 4: 文档与 Trellis

- [ ] `.trellis/roadmap.md` — 项目愿景、MVP 描述、CLI 示例
- [ ] `.trellis/spec/*.md` — 生命周期、API 契约等规范文档
- [ ] `.trellis/workflow.md` — 工作流文档
- [ ] `docs/design/*.md` — 所有设计文档（Docker 类比、ACP 讨论等）
- [ ] `.trellis/issues/*.json` — 涉及品牌名的 issue body / comments（`githubRef` 保留原值）
- [ ] `AGENTS.md` / `.cursor/rules/` — AI assistant 指引文件
- [ ] `README.md`（如存在）

### Step 5: Git 与 CI

- [ ] GitHub 仓库重命名（手动操作：Settings → Rename）
- [ ] `.trellis/issues/*.json` 中 `githubRef` 字段批量更新（可后续处理）
- [ ] CI/CD 配置如有品牌引用

## 注意事项

1. **先 commit 当前进行中的工作**（issue #35 的改动），再执行重命名
2. 重命名作为**单独一个 commit**，保持 git history 清晰
3. 重命名后运行 `pnpm install` 重新生成 lockfile
4. 运行 `pnpm type-check` 和 `pnpm test:changed` 验证无破坏
5. `.agentcraft.json`（agent 实例元数据文件名）的变更需同步更新 core 中的常量定义
6. `agentcraft.sock`（daemon socket 文件名）需同步更新 api 中的常量定义

## 验收标准

- [ ] `pnpm install && pnpm build` 成功
- [ ] `pnpm type-check` 无错误
- [ ] `pnpm test` 全部通过
- [ ] `rg -i agentcraft packages/` 返回零结果（代码中无残留）
- [ ] CLI 入口命令从 `agentcraft` 变为 `actant`
- [ ] 文档中 AgentCraft → Actant 全量替换
