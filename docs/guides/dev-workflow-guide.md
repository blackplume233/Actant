# 开发流程指导手册

> 基于 **Plan → Code → Review → PR → Ship → QA → Stage** 的全生命周期开发流程，指导人类开发者和 AI Agent 正确使用项目内置命令进行协作开发。

---

## 目录

1. [流程总览](#流程总览)
2. [前置准备](#前置准备)
3. [Phase 1: Plan — 规划](#phase-1-plan--规划)
4. [Phase 2: Code — 编码](#phase-2-code--编码)
5. [Phase 3: Review — 审查](#phase-3-review--审查)
6. [Phase 4: PR — 提交合并请求](#phase-4-pr--提交合并请求)
7. [Phase 5: Ship — 交付](#phase-5-ship--交付)
8. [Phase 6: QA — 黑盒测试](#phase-6-qa--黑盒测试)
9. [Phase 7: Stage — 版本快照存档](#phase-7-stage--版本快照存档)
10. [多分支协作指南](#多分支协作指南)
11. [命令速查表](#命令速查表)
12. [常见问题](#常见问题)

---

## 流程总览

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Plan   │───→│  Code   │───→│  Review  │───→│   PR    │───→│  Ship   │───→│   QA    │───→│  Stage  │
│ 规划任务 │    │ 编写代码 │    │ 代码审查 │    │ 合并请求 │    │ 交付推送 │    │ 黑盒测试 │    │ 版本存档 │
└─────────┘    └─────────┘    └──────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │                              ↑                              │              │
     │         ┌────────────────────┘                              │              │
     │         │ 审查不通过时返回修改                                  │              │
     │         │                                                   ↓              │
     │    ┌─────────┐                                        ┌──────────┐         │
     │    │ 修复问题 │←───────────────────────────────────────│ 发现 Bug │←────────┘
     │    └─────────┘                                        └──────────┘
     │
     └──→ /trellis:plan-start (复杂任务) 或 /trellis:start (简单任务)
```

### 各阶段对应命令

| 阶段 | Cursor 命令 | Claude Code 命令 | 脚本命令 |
|------|------------|-----------------|---------|
| Plan | `trellis-plan-start` | `/trellis:plan-start` | `get-context.sh`, `task.sh` |
| Code | — | — | `task.sh start`, Sub Agents |
| Review | `trellis-finish-work` | `/trellis:finish-work` | `pnpm lint/type-check/test` |
| PR | — | `/trellis:create-pr` | `gh pr create` |
| Ship | `trellis-ship` | `/trellis:ship` | `git push`, `issue.sh` |
| QA | `qa` | `/qa` | QA SubAgent |
| Stage | `trellis-stage-version` | `/trellis:stage-version` | `stage-version.sh` |

### 何时用哪个命令？

| 场景 | 推荐流程 |
|------|---------|
| 快速 Bug 修复、单行改动 | `/trellis:start` → 直接修复 → `/trellis:ship` |
| 新功能开发（范围明确） | `/trellis:plan-start` → 全流程 |
| 多模块重构 | `/trellis:plan-start` → 全流程（需跨层检查） |
| 跨层变更（前端+后端） | `/trellis:plan-start` → 加 `/trellis:check-cross-layer` |
| 多人/多 Agent 并行开发 | `/trellis:parallel` → 各自在 worktree 中走全流程 |

---

## 前置准备

### 环境要求

| 依赖 | 最低版本 | 安装方式 |
|------|---------|---------|
| Node.js | >= 22.0.0 | [nodejs.org](https://nodejs.org/) |
| pnpm | >= 9.0.0 | `npm install -g pnpm@9.15.0` |
| Git | 任意 | 系统包管理器 |
| GitHub CLI (`gh`) | 推荐安装 | [cli.github.com](https://cli.github.com/) |

### 首次初始化

```bash
# 克隆并构建
git clone https://github.com/blackplume233/Actant.git
cd Actant
pnpm install && pnpm build

# 初始化开发者身份（仅首次）
./.trellis/scripts/init-developer.sh <your-name>
```

**命名约定**：

| 角色 | 推荐名称 |
|------|---------|
| Cursor AI Agent | `actant-cursor-agent` |
| Claude Code Agent | `actant-claude-agent` |
| 人类开发者 | `actant-<your-name>` |

### 验证身份

```bash
./.trellis/scripts/get-developer.sh
```

---

## Phase 1: Plan — 规划

> **原则：先规划，再动手。** Plan 文档是 AI 与用户之间的契约，未经确认不开始编码。

### 1.1 启动会话

**复杂任务**（新功能、多模块、范围不清）：

```
/trellis:plan-start          # Claude Code
trellis-plan-start           # Cursor
```

执行后 AI 会自动完成：
1. 读取 `.trellis/workflow.md` 了解开发流程
2. 初始化开发者身份
3. 执行 `get-context.sh` 获取项目状态
4. 阅读规范文档索引
5. 等待用户描述任务

**简单任务**（Bug 修复、小改动）：

```
/trellis:start               # Claude Code
trellis-start                # Cursor
```

### 1.2 描述需求

向 AI 描述你的开发需求。AI 会：

1. 提出澄清问题（如果范围不清）
2. 调用 Research Agent 分析代码库
3. 生成结构化的 Plan 文档

### 1.3 审核 Plan

AI 生成的 Plan 包含：

- **背景分析** — 为什么需要这个变更
- **方案设计** — 技术路线和架构决策
- **实施计划** — 分阶段的 Todo 列表（P0/P1/P2 优先级）
- **影响范围** — 涉及哪些文件和模块
- **验收标准** — 如何验证完成

**你的操作**：

| 操作 | 说明 |
|------|------|
| "LGTM" 或 "approved" | 批准，AI 开始执行 |
| 提出修改意见 | AI 修改 Plan 后重新呈现 |
| "reject" | 放弃当前 Plan，重新开始 |

### 1.4 创建 Task

Plan 批准后，AI 自动创建 Task 目录：

```bash
TASK_DIR=$(./.trellis/scripts/task.sh create "<title>" --slug <name>)
./.trellis/scripts/task.sh init-context "$TASK_DIR" <backend|frontend|fullstack>
./.trellis/scripts/task.sh start "$TASK_DIR"
```

Task 目录结构：

```
.trellis/tasks/MM-DD-task-name/
├── task.json              # 任务元数据
├── prd.md                 # 需求文档
├── implement.jsonl        # 实现上下文（注入给 Implement Agent）
├── check.jsonl            # 检查上下文（注入给 Check Agent）
└── debug.jsonl            # 调试上下文（注入给 Debug Agent）
```

---

## Phase 2: Code — 编码

> **原则：遵循规范，增量提交。** 编码前必须阅读相关规范文档。

### 2.1 阅读规范（必需）

| 任务类型 | 必读文档 |
|---------|---------|
| 后端开发 | `.trellis/spec/backend/index.md` → 对应主题 |
| 前端开发 | `.trellis/spec/frontend/index.md` → 对应主题 |
| 跨层变更 | `.trellis/spec/guides/cross-layer-thinking-guide.md` |

### 2.2 AI Agent 编码

AI 通过 Sub Agent 系统执行编码：

| Sub Agent | 职责 | 上下文注入 |
|-----------|------|-----------|
| **Research** | 分析代码库，寻找模式和规范 | 无（直接读取） |
| **Implement** | 按 PRD 编写代码 | implement.jsonl |
| **Check** | 审查代码质量，自动修复问题 | check.jsonl |
| **Debug** | 定位和修复特定问题 | debug.jsonl |

### 2.3 人类开发者编码

人类开发者直接编码时，遵循以下规范：

**代码规范**：

| 规范项 | 要求 |
|-------|------|
| 语言 | TypeScript strict, ESM only |
| 文件名 | kebab-case (`agent-manager.ts`) |
| 类名 | PascalCase (`AgentManager`) |
| 函数/变量 | camelCase (`createAgent()`) |
| 错误处理 | 使用 `ActantError` 体系，不抛裸 `Error` |
| 日志 | 使用 `createLogger()`，不用 `console.log` |
| 外部输入 | 必须经 Zod Schema 校验 |

**提交规范**（Conventional Commits）：

```
type(scope): description
```

| type | 适用场景 |
|------|---------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档变更 |
| `refactor` | 重构（不改变行为） |
| `test` | 测试 |
| `chore` | 构建、工具、杂项 |

scope 通常为包名：`core`, `cli`, `api`, `shared`, `acp`。

### 2.4 开发中常用命令

```bash
pnpm dev                     # 开发模式启动 CLI（热加载）
pnpm test:changed            # 运行受变更影响的测试
pnpm lint                    # ESLint 检查
pnpm type-check              # TypeScript 类型检查
```

---

## Phase 3: Review — 审查

> **原则：交付不仅是代码，还包括文档、验证和知识沉淀。**

### 3.1 预提交检查

```
/trellis:finish-work         # Claude Code
trellis-finish-work          # Cursor
```

AI 将逐项检查：

| 检查项 | 命令 | 阻断级别 |
|-------|------|---------|
| Lint 检查 | `pnpm lint` | ❌ 必须通过 |
| 类型检查 | `pnpm type-check` | ❌ 必须通过 |
| 测试 | `pnpm test` | ❌ 必须通过 |
| console.log 残留 | 代码扫描 | ❌ 不允许 |
| any 类型使用 | 代码扫描 | ❌ 不允许 |
| 非空断言 `!` | 代码扫描 | ❌ 不允许 |
| Spec 文档同步 | diff 分析 | ❌ 必须同步 |

### 3.2 Spec 文档同步规则

变更某些文件时，必须同步更新对应的 Spec 文档：

| 触发条件 | 需更新的 Spec |
|---------|--------------|
| `packages/shared/src/types/` 类型变更 | `config-spec.md` |
| `packages/core/src/template/schema/` Schema 变更 | `config-spec.md` |
| 环境变量增删改 | `config-spec.md` |
| RPC 方法/参数/返回变更 | `api-contracts.md` |
| CLI 命令签名/选项变更 | `api-contracts.md` |
| 错误码增删改 | `api-contracts.md` |

如需更新 Spec：

```
/trellis:update-spec         # Claude Code
```

### 3.3 代码审查

```
/trellis:review-code         # Claude Code
trellis-review-code          # Cursor (视配置)
```

审查维度：

1. **测试覆盖**（最高优先级）— 公共函数是否有测试？边界条件是否覆盖？
2. **类型安全** — TypeScript 类型是否完整、准确？
3. **错误处理** — 使用 `ActantError`，不抛裸 `Error`？
4. **架构合规** — 遵循项目分层架构？文件在正确位置？

### 3.4 跨层变更检查

如果变更涉及多个层（shared → core → api → cli）：

```
/trellis:check-cross-layer   # Claude Code
trellis-check-cross-layer    # Cursor
```

检查维度：

- **数据流** — Database → Service → API → UI 全链路类型/错误传播
- **代码复用** — 同一值是否在多处定义？是否应提取为共享常量？
- **依赖路径** — 新文件的 import 是否正确？是否有循环依赖？

### 3.5 Bug 修复后的深度分析

修复 Bug 后，建议执行：

```
/trellis:break-loop          # Claude Code
trellis-break-loop           # Cursor
```

从 5 个维度分析 Bug：根因分类 → 修复失败原因 → 预防机制 → 系统性扩展 → 知识沉淀。目标是打破"修 Bug → 遗忘 → 重复"的循环。

---

## Phase 4: PR — 提交合并请求

> **原则：Rebase 后创建 PR，保持提交历史清洁。**

### 4.1 创建 PR

```
/trellis:create-pr           # Claude Code
```

AI 自动执行：

1. **Context** — 收集分支信息、提交历史、变更概览
2. **Rebase** — `git fetch` + `git rebase origin/<base-branch>`
3. **Validate** — 简化版质量门禁（lint + type-check + test + 模式扫描）
4. **Push & Create** — `git push --force-with-lease` + `gh pr create`

### 4.2 PR 内容

自动生成的 PR 包含：

```markdown
## Summary
<1-3 条变更摘要>

## Changes
<关键变更列表，含文件引用>

## Test Plan
- [ ] lint passes
- [ ] type-check passes
- [ ] tests pass

## Related Issues
<从 commit message 自动检测 #N 引用>
```

### 4.3 前置条件

| 条件 | 说明 |
|------|------|
| 工作区干净 | 无未提交变更（否则需先 commit 或 stash） |
| 不在目标分支上 | 不能在 master/main 上创建 PR |
| Rebase 无冲突 | 有冲突则中止，需手动解决 |

### 4.4 处理 PR（合并侧）

收到 PR 后，使用 Handle PR 命令进行验证和合并：

```
/handle-pr <PR编号或URL>     # Claude Code
```

五阶段流水线：

1. **Discovery** — 获取 PR diff 和元数据
2. **Validation** — lint + type-check + test + 模式扫描 + Code Review
3. **Local Merge** — `git merge --no-ff` 到目标分支
4. **Update Spec** — 按需更新 config-spec.md / api-contracts.md
5. **Ship** — Push + 关闭 PR + Issue 同步

---

## Phase 5: Ship — 交付

> **原则：审查 → 提交 → 推送 → Issue 同步，一站式完成。**

### 5.1 执行 Ship

```
/trellis:ship                # Claude Code
trellis-ship                 # Cursor
```

四阶段流程：

| 阶段 | 内容 | 阻断级别 |
|------|------|---------|
| Phase 1: Review | 代码质量 + Spec 同步检查 | ❌ Spec 未同步则阻断 |
| Phase 2: Commit | `git add -A` + `git commit` | — |
| Phase 3: Push | `git push origin <branch>` | — |
| Phase 4: Issue Sync | 解析 commit 中的 `#N` 引用，更新 GitHub Issue | — |

### 5.2 Issue 同步规则

| commit message 中的引用 | 操作 |
|------------------------|------|
| `fixes #N` / `closes #N` / `resolves #N` | 关闭 Issue + 添加评论 |
| `(#N)` + fix 类型 commit | 关闭 Issue |
| `(#N)` + docs/refactor 类型 | 仅添加评论 |

### 5.3 安全规则

- **绝不** `git push --force`（除非用户明确要求）
- **绝不** 提交含密钥的文件（`.env`, `credentials.json`）
- **绝不** 修改 git config
- **绝不** 使用 `--no-verify` 跳过 hooks

---

## Phase 6: QA — 黑盒测试

> **原则：以真实用户视角，通过 CLI 交互验证功能正确性。**

### 6.1 触发 QA

```
/qa <mode> [args]            # Claude Code / Cursor
```

### 6.2 四种测试模式

| 模式 | 用法 | 说明 |
|------|------|------|
| **run** | `/qa run basic-lifecycle` | 执行已有场景 |
| **create** | `/qa create "测试模板热重载"` | 生成并执行新场景 |
| **list** | `/qa list` | 列出所有场景 |
| **explore** | `/qa explore "并发创建 5 个 Agent"` | 即兴测试（不保存） |

### 6.3 测试策略

**黑盒测试（主要）**：
- CLI 命令的退出码（0=成功，非0=失败）
- stdout 是否包含预期信息
- 连续操作间的状态连贯性

**白盒测试（辅助）**：
- workspace 目录结构是否正确
- 元数据文件状态是否一致
- 域上下文是否正确物化

### 6.4 问题处理

| 判定 | 操作 |
|------|------|
| FAIL | 自动创建 GitHub Issue（bug, P1, qa 标签） |
| WARN | 酌情创建 Issue（enhancement, P2） |
| PASS | 不创建 Issue |

### 6.5 场景文件位置

```
.agents/skills/qa-engineer/scenarios/
├── basic-lifecycle.json
├── template-management.json
├── error-handling.json
└── ...
```

---

## Phase 7: Stage — 版本快照存档

> **原则：每次发版生成完整的版本快照，便于追溯和对比。**

### 7.1 触发 Stage

```
/trellis:stage-version       # Claude Code
trellis-stage-version        # Cursor
```

### 7.2 执行流程

| 步骤 | 命令 | 产物 |
|------|------|------|
| 质量门禁 | `stage-version.sh pre-check` | — |
| 版本号确定 | 从 `package.json` 读取或 `bump` | — |
| 初始化目录 | `stage-version.sh init <ver>` | `docs/stage/v<ver>/` |
| 架构文档 | AI 生成 | `architecture.md` |
| API 快照 | `stage-version.sh snapshot` | `api-surface.md/.json` |
| 配置快照 | 同上 | `config-schemas.md/.json` |
| 代码度量 | `stage-version.sh metrics` | `metrics.json` |
| Changelog | `stage-version.sh changelog` | `changelog.md` |
| 测试报告 | `stage-version.sh test-report` | `test-report.json` |
| Issue 快照 | `stage-version.sh sync-issues` | `issue-snapshot.json` |
| 版本对比 | `stage-version.sh diff` | `diff-from-<prev>.md` |
| Git Tag | `stage-version.sh tag` | Git tag |
| GitHub Release | `stage-version.sh release` | GitHub Release |

### 7.3 辅助命令

```bash
bash .trellis/scripts/stage-version.sh bump patch    # 自增版本号
bash .trellis/scripts/stage-version.sh list           # 列出已存档版本
bash .trellis/scripts/stage-version.sh latest         # 最新版本摘要
bash .trellis/scripts/stage-version.sh unstage <ver>  # 删除已存档版本
```

---

## 多分支协作指南

### 场景一：单人串行开发

最简单的模式——在一个分支上依次完成任务。

```
master ──────────────────────────────────────────────────
         \                                      /
          feature/my-task ── commit ── commit ──
```

**流程**：

```bash
git checkout -b feature/my-task
# ... 开发 ...
/trellis:ship          # 提交并推送
/trellis:create-pr     # 创建 PR
/handle-pr             # 验证并合并
```

### 场景二：多 Agent 并行开发 (Multi-Agent Pipeline)

适合多个独立任务同时进行。

```
master ──────────────────────────────────────────────────
         \                       \               / merge
          feature/task-a          feature/task-b
          (Agent A worktree)      (Agent B worktree)
```

**启动**：

```
/trellis:parallel            # Claude Code
```

**AI 自动完成**：
1. 在主仓库中规划任务、配置上下文
2. 为每个任务创建 Git Worktree 和分支
3. 在各 Worktree 中启动独立的 Agent 执行开发
4. 各 Agent 独立走完 implement → check → finish → create-pr

**监控**：

```bash
./.trellis/scripts/multi-agent/status.sh                # 总览
./.trellis/scripts/multi-agent/status.sh --log <name>   # 查看日志
./.trellis/scripts/multi-agent/status.sh --watch <name> # 实时监控
```

**清理**：

```bash
./.trellis/scripts/multi-agent/cleanup.sh <branch>      # 清理 Worktree
```

### 场景三：人机协作

人类开发者和 AI Agent 在不同分支上并行工作。

```
master ──────────────────────────────────────────────────
         \                       \
          feature/human-task      feature/ai-task
          (人类开发者)              (AI Agent)
```

**建议**：

1. **分支隔离**：人和 AI 各用独立分支，避免互相覆盖
2. **任务边界清晰**：确保两个任务不修改同一个文件的同一区域
3. **及时同步**：定期从 master 拉取最新代码 rebase

### 多分支协作最佳实践

| 实践 | 说明 |
|------|------|
| **分支命名规范** | `feature/<slug>`, `fix/<slug>`, `docs/<slug>` |
| **短生命周期** | 分支存活时间尽量短，减少合并冲突 |
| **频繁 rebase** | 定期 `git rebase origin/master` 保持与主线同步 |
| **小粒度 PR** | 每个 PR 聚焦一件事，便于 Review |
| **合并前 rebase** | `/trellis:create-pr` 自动执行 rebase 确保无冲突 |
| **Worktree 隔离** | 多 Agent 并行时使用 Worktree，避免工作区冲突 |
| **Issue 先行** | 先在 GitHub 创建 Issue，再基于 Issue 创建 Task 和分支 |

### 从 Issue 到 PR 的完整流转

```
GitHub Issue (#N)                          # 需求来源
  ↓ issue.sh pull N                        # 拉取到本地缓存
  ↓ issue.sh promote N                     # 升级为 Task
  ↓
Task (active work)                         # 开发阶段
  ↓ /trellis:plan-start                    # 规划
  ↓ Code + Review                          # 编码 + 审查
  ↓ /trellis:create-pr                     # 创建 PR
  ↓
PR (#M)                                    # 合并阶段
  ↓ /handle-pr M                           # 验证 + 合并
  ↓
Ship                                       # 交付
  ↓ commit message: "feat(core): ... (#N)" # 关联 Issue
  ↓ gh issue close N                       # 自动关闭 Issue
  ↓ task.sh archive                        # 归档 Task
```

---

## 命令速查表

### Trellis 命令（用户触发）

| 命令 | 功能 | 时机 |
|------|------|------|
| `/trellis:plan-start` | Plan-first 启动会话 | 开始复杂任务 |
| `/trellis:start` | 快速启动会话 | 开始简单任务 |
| `/trellis:finish-work` | 预提交检查清单 | 提交前 |
| `/trellis:review-code` | 代码审查 | Review 阶段 |
| `/trellis:check-cross-layer` | 跨层一致性检查 | 多层变更后 |
| `/trellis:break-loop` | Bug 深度分析 | 修复 Bug 后 |
| `/trellis:update-spec` | 更新规范文档 | 发现新模式/修复 Bug 后 |
| `/trellis:ship` | 审查+提交+推送+Issue 同步 | 交付时 |
| `/trellis:create-pr` | Rebase+验证+创建 PR | PR 阶段 |
| `/handle-pr` | 验证+合并+Spec更新+Ship | 处理 PR |
| `/trellis:record-session` | 记录工作会话 | 任务完成后 |
| `/trellis:stage-version` | 生成版本快照 | 发版时 |
| `/trellis:parallel` | 多 Agent 并行编排 | 并行开发 |
| `/qa` | QA 黑盒测试 | 测试阶段 |

### 脚本命令（AI/人类执行）

```bash
# 会话管理
./.trellis/scripts/get-context.sh              # 获取项目上下文
./.trellis/scripts/get-developer.sh            # 查看当前开发者身份
./.trellis/scripts/init-developer.sh <name>    # 初始化开发者身份
./.trellis/scripts/add-session.sh              # 记录工作会话

# Task 管理
./.trellis/scripts/task.sh list                # 列出活跃任务
./.trellis/scripts/task.sh create "<title>"    # 创建新任务
./.trellis/scripts/task.sh start <dir>         # 激活任务
./.trellis/scripts/task.sh finish <dir>        # 完成任务
./.trellis/scripts/task.sh archive <name>      # 归档任务

# Issue 管理（GitHub-first，修改操作自动同步）
./.trellis/scripts/issue.sh list               # 列出活跃 Issue
./.trellis/scripts/issue.sh pull <N>           # 从 GitHub 拉取
./.trellis/scripts/issue.sh create "<title>"   # 创建新 Issue
./.trellis/scripts/issue.sh promote <id>       # 升级为 Task
./.trellis/scripts/issue.sh close <id>         # 关闭并归档
./.trellis/scripts/issue.sh sync --all         # 推送所有未同步变更
./.trellis/scripts/issue.sh check-dirty        # 检查未同步变更

# 版本管理
bash .trellis/scripts/stage-version.sh list    # 列出已存档版本
bash .trellis/scripts/stage-version.sh bump patch  # 自增版本号
```

### 构建与测试

```bash
pnpm install                 # 安装依赖
pnpm build                   # 构建所有包
pnpm dev                     # 开发模式（热加载）
pnpm test                    # 运行全部测试
pnpm test:changed            # 仅运行受影响的测试（日常首选）
pnpm test:endurance          # 耐久测试（15min 超时）
pnpm lint                    # ESLint 检查
pnpm lint:fix                # ESLint 自动修复
pnpm type-check              # TypeScript 类型检查
pnpm clean                   # 清理构建产物
pnpm check                   # type-check + 全量测试
```

---

## 常见问题

### Q: Plan 和 Start 有什么区别？

- `/trellis:plan-start` 包含规划阶段，会先生成 Plan 文档供用户审核，适合范围不清或复杂任务
- `/trellis:start` 跳过规划，直接进入编码，适合简单的 Bug 修复或小改动

### Q: Ship 和 Create PR 有什么区别？

- `/trellis:ship` = Review + Commit + Push + Issue Sync，适合在主分支或个人分支上直接交付
- `/trellis:create-pr` = Rebase + Validate + Push + 创建 GitHub PR，适合需要 Code Review 的协作场景

### Q: 人类开发者需要用哪些命令？

最小流程：
1. 编写代码
2. `pnpm lint && pnpm type-check && pnpm test:changed`（手动验证）
3. `git commit -m "type(scope): description"`
4. `git push`

推荐使用 AI 辅助流程获得更好的质量保障。

### Q: 如何处理 Rebase 冲突？

`/trellis:create-pr` 遇到冲突时会自动 abort 并输出诊断。手动解决步骤：

```bash
git rebase origin/master
# 解决冲突文件
git add <resolved-files>
git rebase --continue
# 然后重新执行 /trellis:create-pr
```

### Q: QA 测试需要真实的后端环境吗？

默认使用真实模式。如需 mock 模式，在场景文件中设置 `setup.launcherMode: "mock"` 或明确告知 AI。

### Q: 如何从一个已有的 GitHub Issue 开始开发？

```bash
# 1. 拉取 Issue 到本地
./.trellis/scripts/issue.sh pull <N>

# 2. 升级为 Task
./.trellis/scripts/issue.sh promote <N>

# 3. 启动开发
/trellis:plan-start
# AI 会自动检测到当前 Task 并继续
```
