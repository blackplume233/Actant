---
id: 55
title: Actant 安装流程 · Help 指令 · 本地部署自更新机制
status: closed
closedAt: "2026-02-22"
labels:
  - feature
  - cli
  - devx
  - documentation
  - "priority:P0"
milestone: phase-3
author: human
assignees: []
relatedIssues:
  - 10
  - 11
  - 15
  - 34
  - 38
  - 59
relatedFiles:
  - packages/cli/src/program.ts
  - packages/cli/src/bin/actant.ts
  - scripts/self-update.js
  - scripts/updater-supervisor.js
  - packages/cli/src/commands/help.ts
  - packages/cli/package.json
  - packages/shared/src/platform/platform.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/manager/launch-mode-handler.ts
  - packages/core/src/state/instance-meta-io.ts
  - packages/api/src/daemon/daemon.ts
  - scripts/install.ps1
  - scripts/install.sh
  - docs/getting-started.md
  - package.json
taskRef: null
githubRef: "blackplume233/Actant#108"
closedAs: null
createdAt: "2026-02-22T12:00:00"
updatedAt: "2026-02-22T03:46:41"
---

**Related Issues**: [[0010-one-shot]], [[0011-acp-service]], [[0015-resolve-attach-detach]], [[0034-daemon-agentcraft-home]], [[0038-rename-agentcraft-to-actant]], [[0059-create-official-default-source-repo-compatible-with-agent-sk]]
**Related Files**: `packages/cli/src/program.ts`, `packages/cli/src/bin/actant.ts`, `scripts/self-update.js`, `scripts/updater-supervisor.js`, `packages/cli/src/commands/help.ts`, `packages/cli/package.json`, `packages/shared/src/platform/platform.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/core/src/manager/launch-mode-handler.ts`, `packages/core/src/state/instance-meta-io.ts`, `packages/api/src/daemon/daemon.ts`, `scripts/install.ps1`, `scripts/install.sh`, `docs/getting-started.md`, `package.json`

---

## 背景

Actant 已完成 Phase 1–3 核心功能开发，但缺乏正式的安装流程、内置帮助系统和本地部署更新机制。用户（开发者本人）需要：
1. 将 Actant 安装到合适的全局目录，作为日常持续使用的工具
2. 通过 `actant help` 快速查阅可用命令和用法
3. 在持续开发过程中，能将最新代码无缝更新到本地已部署的版本，同时保持已运行 Agent 的正常工作

## 一、正式安装流程文档与脚本 (Install)

### 问题

当前 Actant 只能在开发目录中通过 `pnpm dev` 运行，没有正式的安装流程。作为一个需要持续使用的开发者工具，需要：
- 全局可执行的 `actant` 命令
- 合理的目录结构（代码目录 vs 数据目录 vs 配置目录）
- 开发模式与生产模式并存

### 方案

#### 1.1 目录规划

```
开发目录（源码）:
  G:/Workspace/AgentWorkSpace/AgentCraft/   # 持续开发

运行时数据目录 (~/.actant/):
  ~/.actant/
  ├── config.json          # 全局配置
  ├── data/
  │   ├── templates/       # 用户模板
  │   ├── agents/          # Agent 实例 workspace
  │   └── sources/         # 缓存的 Source 内容
  ├── logs/                # Daemon 日志
  └── daemon.sock          # Daemon socket
```

#### 1.2 安装方式

**方式 A — pnpm link（开发者推荐）：**
```bash
# 在项目根目录
pnpm build
pnpm --filter @actant/cli link --global

# 验证
actant --version
actant help
```

**方式 B — npm global install（发布后）：**
```bash
npm install -g actant
```

**方式 C — 脚本安装（便捷）：**
提供 `scripts/install.sh`（Linux/macOS）和 `scripts/install.ps1`（Windows）：
- 检查 Node.js >= 22、pnpm >= 9
- `pnpm install && pnpm build`
- `pnpm --filter @actant/cli link --global`
- 创建 `~/.actant/` 目录结构
- 验证安装成功

#### 1.3 安装文档

在 `docs/getting-started.md` 创建正式安装文档：
- 前置依赖（Node.js 22+、pnpm 9+）
- 三种安装方式的步骤说明
- 首次运行引导（`actant daemon start` → `actant agent create`）
- 目录结构说明
- 常见问题（权限、PATH、socket 路径）

### 验收标准 — Install

- [ ] `scripts/install.ps1`（Windows）安装脚本可用
- [ ] `scripts/install.sh`（Linux/macOS）安装脚本可用
- [ ] 安装后 `actant` 全局命令可用
- [ ] `docs/getting-started.md` 包含完整安装指南
- [ ] `~/.actant/` 目录结构在首次运行时自动创建


## 二、Help 指令实现 (Help)

### 问题

当前 CLI 使用 commander 的默认 `-h/--help` 机制，缺少：
- 顶层 `actant help` 子命令（不止 `--help` flag）
- 分组展示命令（Agent 管理、组件管理、系统管理）
- 常用 workflow 示例
- 上下文感知的帮助（`actant help agent` 显示 agent 子命令的详细帮助）

### 方案

#### 2.1 `actant help` 顶层命令

```
$ actant help

  Actant v0.1.0 — Build, manage, and compose AI agents

  Quick Start:
    actant daemon start              启动守护进程
    actant agent create my-agent     创建 Agent
    actant agent start my-agent      启动 Agent
    actant agent chat my-agent       与 Agent 对话

  Agent 管理:
    agent create|start|stop|list|chat|run    管理 Agent 生命周期
    template list|show                       管理 Agent 模板
    proxy <name>                             ACP 代理转发

  组件管理:
    skill list|add|remove|show       管理技能定义
    prompt list|add|remove|show      管理提示词
    mcp list|show                    管理 MCP Server 配置
    workflow list|show               管理工作流
    plugin list|add|remove|show      管理插件

  共享生态:
    source list|add|remove|sync      管理组件来源
    preset list|apply                管理预设包

  调度:
    schedule start|stop|status       管理雇员型 Agent 调度

  系统:
    daemon start|stop|status         Daemon 管理
    help [command]                   查看帮助
    --version                        显示版本号

  Tips:
    使用 actant help <command> 查看详细帮助
    直接运行 actant 进入交互式 REPL 模式
```

#### 2.2 `actant help <command>` 子命令帮助

```
$ actant help agent

  Agent 管理命令

  actant agent create <name> [--template <tpl>]  创建新 Agent
  actant agent start <name>                      启动 Agent
  actant agent stop <name>                       停止 Agent
  actant agent list                              列出所有 Agent
  actant agent chat <name>                       进入交互对话
  actant agent run <name> --prompt <text>         单次运行
  actant agent dispatch <name> --input <data>     触发调度任务

  示例:
    actant agent create reviewer --template code-review-agent
    actant agent start reviewer
    actant agent chat reviewer
```

#### 2.3 实现方式

在 `packages/cli/src/commands/help.ts` 创建 help 命令：
- 使用 commander 的 `.helpInformation()` 获取各命令帮助文本
- 自定义格式化输出（分组、着色、Quick Start）
- `actant help` → 显示总览
- `actant help <cmd>` → 显示特定命令的详细帮助
- `actant help <cmd> <subcmd>` → 显示子命令帮助

### 验收标准 — Help

- [ ] `actant help` 显示分组的命令总览和 Quick Start
- [ ] `actant help <command>` 显示特定命令的详细帮助和示例
- [ ] help 输出包含 chalk 着色（终端友好）
- [ ] 在 program.ts 中注册 help 命令


## 三、本地部署自更新机制 (Self-Update) — 脚本为骨、Agent 辅助

### 问题

用户在同一台机器上：
- **开发**：持续在源码目录开发 Actant 新功能
- **使用**：同时作为日常工具使用本地部署的 Actant 管理 Agent

传统的「自己更新自己」方案存在根本矛盾：正在运行的进程无法安全替换自身。

### 核心设计：脚本固化 + Agent 监管

**设计哲学**：更新的机械流程（build → link → restart）是确定性的，应该固化为一套**可独立执行、可测试、可审计**的脚本。Agent 不做具体更新操作，只负责**调度脚本、监控执行、诊断异常、汇报结果**。

```
职责分离：

┌─────────────────────────────────────────────────┐
│  更新脚本 (scripts/self-update.js)               │
│  ─ 确定性、可测试、可独立运行                      │
│  ─ 读 manifest → 备份 → build → link → verify    │
│  ─ 失败自动回滚 → 重启 Daemon                     │
│  ─ 每步写入 phase + 日志                          │
│  ─ 退出码 0=成功, 1=已回滚, 2=严重故障             │
└─────────────────────────────────────────────────┘
          ▲ 调用                 ▼ 读取结果
┌─────────────────────────────────────────────────┐
│  Updater Agent (辅助层，可选)                     │
│  ─ 由 Actant 以 detached 进程启动                 │
│  ─ 调用更新脚本并监控其 stdout/exitcode            │
│  ─ 如果脚本正常完成 → 验证 Agent 恢复、写 result   │
│  ─ 如果脚本异常 → 诊断错误、尝试修复、汇报给用户    │
│  ─ 最终自毁                                      │
└─────────────────────────────────────────────────┘
```

**关键区别**：用户也可以跳过 Agent 直接运行脚本（`node scripts/self-update.js`），结果完全一致。Agent 只是让流程更智能，不是必须的。

### 方案详细设计

#### 3.1 更新脚本 `scripts/self-update.js`

一个纯 Node.js 脚本，零外部依赖（不依赖 Actant 运行时），可独立执行：

```
node scripts/self-update.js [--manifest <path>] [--skip-build] [--skip-daemon]

执行流程（严格顺序，每步记录 phase）：

  Phase 1 — pre-check
    ├─ 读取 update-manifest.json
    ├─ 验证源码目录存在
    └─ 验证 pnpm / node 版本满足要求

  Phase 2 — backup
    ├─ 快照当前 packages/*/dist/ 到 ~/.actant/backups/<id>/
    └─ 采用硬链接（快速、省空间），保留最近 N 份

  Phase 3 — build
    ├─ cd <sourcePath>
    ├─ pnpm install (如有新依赖)
    └─ pnpm build

  Phase 4 — link
    └─ pnpm --filter @actant/cli link --global

  Phase 5 — verify
    ├─ actant --version （确认新版本可执行）
    └─ 比对 version / commitHash 是否更新

  Phase 6 — daemon-restart
    ├─ actant daemon start（Daemon 已被调用方提前停掉）
    └─ 等待 daemon ready（socket 可连接）

  Phase 7 — agent-check
    ├─ 遍历 manifest.runningAgents
    ├─ 检查各 PID 是否存活
    └─ 新 Daemon 自动 reattach 存活的 Agent

退出码：
  0 — 更新成功
  1 — 更新失败，已成功回滚到备份版本
  2 — 严重故障（回滚也失败），需人工介入

日志输出：
  每个 phase 的开始/结束/耗时写入 ~/.actant/logs/update-<id>.log
  同时更新 manifest.phase 字段（用于崩溃恢复）
```

#### 3.2 `actant self-update` 命令

```bash
actant self-update [--source <path>] [--check] [--force] [--dry-run] [--no-agent]
```

- `--source <path>`：源码目录，默认读取 `~/.actant/config.json` 的 `devSourcePath`
- `--check`：只检查版本差异，不执行更新
- `--force`：跳过活跃 session 警告
- `--dry-run`：模拟执行，显示将要做的操作
- `--no-agent`：跳过 Agent 监管，Actant 直接 spawn 脚本后退出（最简模式）

完整时序（默认带 Agent）：
```
  用户/AI             Actant Daemon          Updater Agent          更新脚本
    │                      │                      │                    │
    │─ self-update ──────►│                      │                    │
    │                      │─ 1. 预检查            │                    │
    │                      │─ 2. 写 manifest       │                    │
    │                      │─ 3. 记录 Agent PIDs   │                    │
    │                      │─ 4. spawn Agent ─────►│ (detached)         │
    │                      │─ 5. Daemon 退出       │                    │
    │                      ✗                      │                    │
    │                                             │─ 6. 调用脚本 ──────►│
    │                                             │                    │─ backup
    │                                             │                    │─ build
    │                                             │                    │─ link
    │                                             │                    │─ verify
    │                                             │                    │─ daemon start
    │                                             │◄─ 7. exit 0 ───────│
    │                      │◄─ 新 Daemon 启动      │                    │
    │                      │─ reattach Agents      │                    │
    │                                             │─ 8. 验证 Agents 恢复│
    │                                             │─ 9. 写 result       │
    │                                             │─ 10. 自毁           │
    │                                             ✗                    │
    │◄─ 更新完成 ──────────│                                           │
```

`--no-agent` 简化模式（无 Agent 监管）：
```
  用户/AI             Actant Daemon          更新脚本
    │                      │                    │
    │─ self-update ──────►│                    │
    │                      │─ 写 manifest       │
    │                      │─ spawn 脚本 ───────►│ (detached)
    │                      │─ Daemon 退出       │
    │                      ✗                    │
    │                                           │─ backup → build → link
    │                                           │─ verify → daemon start
    │                      │◄─ 新 Daemon ────────│
    │                      │                    │─ exit 0
    │◄─ 更新完成 ──────────│                    ✗
```

#### 3.3 Update Manifest（状态交接文件）

Actant 退出前写入 `~/.actant/update-manifest.json`：

```json
{
  "updateId": "upd-20260222-143000",
  "createdAt": "2026-02-22T14:30:00Z",
  "sourcePath": "G:/Workspace/AgentWorkSpace/AgentCraft",
  "installedVersion": {
    "version": "0.1.0",
    "commitHash": "abc1234",
    "buildTime": "2026-02-22T10:00:00Z"
  },
  "backupPath": "~/.actant/backups/upd-20260222-143000/",
  "runningAgents": [
    { "name": "reviewer", "pid": 12345, "workspaceDir": "~/.actant/data/agents/reviewer" },
    { "name": "assistant", "pid": 67890, "workspaceDir": "~/.actant/data/agents/assistant" }
  ],
  "daemonSocketPath": "~/.actant/daemon.sock",
  "rollbackOnFailure": true,
  "phase": "pending",
  "useAgent": true
}
```

`phase` 字段随脚本执行逐步更新：`pending → backup → build → link → verify → daemon-restart → agent-check → done`。如果进程中途崩溃，下次 Daemon 启动时可根据 phase 决定恢复策略。

#### 3.4 Updater Agent 角色定义

Agent 不执行任何更新操作，只做三件事：

```
1. 调度：启动更新脚本，传入 manifest 路径
2. 监控：读取脚本 stdout + exitcode，监控 phase 进展
3. 善后：
   ├─ exitcode=0 → 验证 Agent 恢复状态 → 写入 update-result.json → 自毁
   ├─ exitcode=1 → 读取回滚日志 → 诊断失败原因 → 写入 result → 自毁
   └─ exitcode=2 → 尝试手动恢复（重新 link 备份）→ 写入 result → 自毁
```

Agent 的智能体现在：
- **失败诊断**：分析 build 错误日志，判断是 TypeScript 类型错误还是依赖缺失
- **恢复决策**：如果脚本崩溃在 link 阶段（phase=link），可以直接跳到 verify
- **用户通知**：更新完成后通过 update-result.json 向用户/AI 汇报详细结果

Agent 以 `detached: true, stdio: 'pipe'` 启动，独立于 Daemon 进程树。它本身是一个轻量 Node.js 脚本（`scripts/updater-supervisor.js`），不需要 Actant 模板系统。

#### 3.5 用户数据保护策略（核心安全设计）

```
用户数据保护三原则：

1. 「脚本只碰编译产物，绝不碰用户数据」
   更新脚本操作范围严格限定为：
   ✅ 源码目录的 node_modules/ 和 packages/*/dist/（编译产物）
   ✅ 全局 link 符号链接（指向新 dist）
   ✅ ~/.actant/backups/（备份目录，脚本自管理）
   ✅ ~/.actant/update-manifest.json（phase 状态更新）
   ✅ ~/.actant/logs/update-*.log（日志追加写入）
   ❌ 绝不读写 ~/.actant/data/agents/*（Agent workspace + 用户数据）
   ❌ 绝不读写 ~/.actant/data/templates/*（用户自定义模板）
   ❌ 绝不读写 ~/.actant/data/sources/*（缓存的 Source 内容）
   ❌ 绝不修改 ~/.actant/config.json（用户全局配置）
   ❌ 绝不删除任何 .actant.json（Agent 实例元数据）

2. 「先备份，后操作」
   更新前将当前 dist/ 目录备份到 ~/.actant/backups/<updateId>/
   备份采用硬链接（秒级完成，不占额外空间）
   保留最近 N 个备份（默认 3 个），旧备份自动清理

3. 「原子切换 + 失败回滚」
   link 操作是原子的（符号链接替换）
   脚本任何阶段失败 → 自动恢复备份 → 重启旧版 Daemon
   如果回滚也失败 → exit 2，Agent 尝试最后修复或提示人工介入

数据隔离架构：
┌───────────────────────────────────────────┐
│          ~/.actant/ (ACTANT_HOME)          │
├───────────────────────────────────────────┤
│  config.json          🔒 只读（不可触碰）   │
│  data/                                    │
│  ├── agents/*         🔒 只读（不可触碰）   │
│  ├── templates/*      🔒 只读（不可触碰）   │
│  └── sources/*        🔒 只读（不可触碰）   │
│  logs/                📝 追加写入（仅日志）  │
│  daemon.sock          ♻️ Daemon 管理        │
│  backups/             📦 脚本管理           │
│  update-manifest.json ♻️ 脚本读写 phase     │
│  update-result.json   ♻️ Agent 写入结果     │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│        源码目录 (devSourcePath)             │
├───────────────────────────────────────────┤
│  node_modules/        ♻️ pnpm install      │
│  packages/*/dist/     ♻️ pnpm build        │
│  其他源码文件          🔒 只读              │
└───────────────────────────────────────────┘
```

#### 3.6 全局配置 `~/.actant/config.json`

```json
{
  "devSourcePath": "G:/Workspace/AgentWorkSpace/AgentCraft",
  "update": {
    "maxBackups": 3,
    "preUpdateTestCommand": "pnpm test:changed",
    "autoRestartAgents": true
  }
}
```

#### 3.7 `actant self-update --check` 版本对比

```json
{
  "installed": {
    "version": "0.1.0",
    "buildTime": "2026-02-22T10:00:00Z",
    "commitHash": "abc1234"
  },
  "source": {
    "version": "0.1.0",
    "commitHash": "def5678",
    "dirty": true,
    "uncommittedChanges": 5,
    "ahead": 3
  },
  "needsUpdate": true,
  "lastUpdate": {
    "updateId": "upd-20260222-100000",
    "status": "success",
    "time": "2026-02-22T10:00:00Z"
  }
}
```

#### 3.8 脚本可独立测试

更新脚本作为独立模块，可以在 CI 或本地单独测试：

```bash
# 直接运行脚本（不经过 Actant CLI）
node scripts/self-update.js --manifest ~/.actant/update-manifest.json

# dry-run 模式（只打印将执行的操作）
node scripts/self-update.js --manifest ~/.actant/update-manifest.json --dry-run

# 跳过 daemon 重启（测试 build + link 流程）
node scripts/self-update.js --manifest ~/.actant/update-manifest.json --skip-daemon
```

#### 3.9 边界情况处理

| 场景 | 脚本行为 | Agent 辅助行为 |
|------|----------|---------------|
| pnpm build 失败 | 回滚备份 → 重启旧 Daemon → exit 1 | 分析 build 日志，诊断失败原因 |
| link 权限不足 | 回滚 → exit 1 | 提示用户检查 npm 全局目录权限 |
| 新 Daemon 启动失败 | 回滚 → 启动旧 Daemon → exit 1 | 检查端口/socket 冲突 |
| 脚本自身崩溃 | manifest.phase 记录进度 | Agent 根据 phase 尝试续跑或回滚 |
| Agent 也崩溃 | manifest.phase 仍保留 | 下次 daemon start 检测 manifest，提示恢复 |
| 更新途中断电 | 同上 | 同上 |
| 有 Agent 正在活跃交互 | 脚本不关心（Agent 进程独立） | 预检时警告用户 |
| 源码有未提交更改 | 正常执行（开发常态） | --check 时报告 dirty 状态 |

### 验收标准 — Self-Update

- [ ] `scripts/self-update.js` 可独立执行，不依赖 Actant 运行时
- [ ] 脚本支持 --manifest / --dry-run / --skip-daemon / --skip-build 参数
- [ ] 脚本每步更新 manifest.phase，支持崩溃恢复
- [ ] 脚本退出码语义明确：0=成功, 1=已回滚, 2=严重故障
- [ ] `~/.actant/config.json` 支持 `devSourcePath` 和 `update` 配置
- [ ] `actant self-update --check` 显示版本对比和上次更新状态
- [ ] `actant self-update` 完整执行：写 manifest → spawn Agent → Daemon 退出
- [ ] `actant self-update --no-agent` 简化模式直接 spawn 脚本
- [ ] 更新过程中用户数据（~/.actant/data/）零接触
- [ ] 更新前自动备份 dist/ 编译产物
- [ ] 编译/link/验证任一步骤失败时自动回滚
- [ ] 新 Daemon 启动后自动 reattach 运行中的 Agent
- [ ] Updater Agent 监控脚本执行并写入 update-result.json
- [ ] Daemon 启动时检测未完成的 update manifest，提示恢复


## 实施优先级

| 优先级 | 模块 | 内容 | 复杂度 |
|--------|------|------|--------|
| P0 | Install | 安装脚本 + 文档 + 目录结构初始化 | 低 |
| P0 | Help | `actant help` 命令 + 分组展示 | 低 |
| P1 | Self-Update | `scripts/self-update.js` 更新脚本（备份 → build → link → verify → restart） | 中 |
| P1 | Self-Update | `actant self-update` 命令（预检 → manifest → spawn → 退出） | 中 |
| P1 | Self-Update | 用户数据保护 + 备份/回滚机制 | 中 |
| P2 | Self-Update | `scripts/updater-supervisor.js` Agent 监管层 | 中 |
| P2 | Self-Update | Daemon 启动时 manifest 恢复检测 | 低 |
| P2 | Self-Update | `--check` 版本对比 + update-result 查询 | 低 |
| P3 | Self-Update | AI 辅助更新 skill/command 封装 | 低 |
