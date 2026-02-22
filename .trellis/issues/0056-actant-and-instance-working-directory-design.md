---
id: 56
title: 明确 Actant 自身工作目录与 AgentInstance 工作目录的职责划分
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
  - 38
relatedFiles:
  - packages/api/src/services/app-context.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/initializer/agent-initializer.ts
  - packages/core/src/source/source-manager.ts
  - packages/core/src/state/instance-meta-io.ts
  - packages/cli/src/commands/agent/create.ts
  - packages/shared/src/platform/platform.ts
  - docs/stage/v0.1.0/architecture.md
taskRef: null
githubRef: "blackplume233/Actant#109"
closedAs: null
createdAt: "2026-02-22T18:00:00"
updatedAt: "2026-02-22T18:00:00"
closedAt: null
---

**Related Issues**: [[0058-domain-config-format-redesign]], [[0055-installation-help-update-mechanism]], [[0038-rename-agentcraft-to-actant]]
**Related Files**: `packages/api/src/services/app-context.ts`, `packages/core/src/manager/agent-manager.ts`, `packages/core/src/initializer/agent-initializer.ts`, `packages/core/src/source/source-manager.ts`, `packages/core/src/state/instance-meta-io.ts`, `packages/cli/src/commands/agent/create.ts`, `packages/shared/src/platform/platform.ts`, `docs/stage/v0.1.0/architecture.md`

---

## 背景

Actant 当前的 homeDir（`~/.actant/`）承担了「工具本身的运行时数据」和「Agent 实例的工作区」两重职责，但边界并不明确。Issue #55 中规划的目录结构将所有内容打平在 `~/.actant/` 下。

随着功能增长，需要**严格区分两个概念**：

1. **Actant 自身的工作目录（Actant Home）** — 工具平台级的全局数据
2. **AgentInstance 的工作目录（Instance Workspace）** — 每个 Agent 实例独立的沙箱

混淆这两者会导致：
- 用户无法灵活指定 Instance 存放位置（例如放到项目目录下、外部磁盘）
- 全局更新 / 清理操作可能误伤 Instance 数据
- Source 同步下来的组件（Skills、Prompts 等）缺少统一管理位置
- Instance 引用关系散落，无法集中查询所有 Instance 的状态

---

## 一、Actant 自身工作目录（Actant Home）

### 定位

这是 Actant **作为一个工具平台**的全局目录，存储自身运行所需的所有数据。类比 Docker 的 `/var/lib/docker/` 或 Homebrew 的 `/usr/local/Cellar/`。

### 路径

- 默认：`~/.actant/`
- 可通过环境变量 `ACTANT_HOME` 或 `~/.actant/config.json` 覆盖

### 目录结构

```
~/.actant/                          # ACTANT_HOME
├── config.json                     # 全局配置
├── daemon.pid                      # Daemon PID 文件
├── daemon.sock                     # Daemon IPC socket
│
├── configs/                        # 领域组件（内置 + Source 同步）
│   ├── skills/                     # 技能定义
│   ├── prompts/                    # 提示词
│   ├── mcp/                        # MCP Server 配置
│   ├── workflows/                  # 工作流
│   ├── plugins/                    # 插件
│   └── templates/                  # Agent 模板
│
├── sources/                        # Source 管理
│   ├── sources.json                # 已注册的 Source 列表
│   └── cache/                      # Source 拉取的原始内容缓存
│       ├── <source-name>/
│       └── ...
│
├── instances/                      # Instance 注册表（引用信息）
│   ├── registry.json               # 所有 Instance 的引用索引
│   └── <instance-name>/            # 内置位置的 Instance 工作目录（默认）
│       ├── .actant.json            # Instance 元数据
│       └── ...                     # Instance 运行时文件
│
├── backups/                        # self-update 备份
│   └── <update-id>/
│
├── logs/                           # Daemon 与更新日志
│   ├── daemon.log
│   └── update-*.log
│
└── update-manifest.json            # self-update 状态文件
```

### 关键设计点

1. **Source 同步的组件统一进入 `configs/`**：SkillManager、PromptManager 等从 `configs/<domain>/` 目录加载，Source sync 将远端组件写入同一目录。组件的来源（内置 / Source / 用户手动添加）通过元数据字段区分，而非目录分离。

2. **`instances/registry.json` 是核心引用索引**：记录所有已创建 Instance 的名称、状态、工作目录路径（可以是内置子目录，也可以是外部路径）。这让 `actant agent list` 始终能找到所有 Instance，不管它们实际存放在哪里。

3. **`sources/` 独立于 `configs/`**：`sources/` 存放 Source 的注册信息和原始缓存；`configs/` 存放最终可用的组件。Source sync 是「从 sources/cache/ 解析 → 写入 configs/」的过程。

---

## 二、AgentInstance 工作目录（Instance Workspace）

### 定位

每个 Agent Instance 拥有独立的工作目录（workspace），作为该 Instance 的「沙箱」。类比 Docker container 的 rootfs / volume。

### 两种位置策略

#### 策略 A：内置位置（默认）

Instance 工作目录位于 Actant Home 下：

```
~/.actant/instances/<instance-name>/
```

适用场景：
- 通用 Agent（code-reviewer、assistant 等）
- 不需要特定项目上下文的 Agent
- 简单使用，无需额外配置

#### 策略 B：外部指定位置

Instance 工作目录在用户指定的任意路径：

```
/path/to/my-project/.actant-workspace/
D:/Projects/my-app/.agents/reviewer/
```

适用场景：
- Agent 需要在特定项目目录下工作（访问项目代码）
- Agent 的数据需要跟随项目版本控制
- 团队共享 Agent 配置（workspace 放进 repo）
- 用户希望 Agent 数据存放在特定磁盘/分区

### Instance 工作目录内部结构

无论采用哪种位置策略，Instance 内部结构一致：

```
<instance-workspace>/
├── .actant.json                   # Instance 元数据（名称、模板、状态、创建时间等）
├── agent-config.json              # 解析后的完整 Agent 配置（模板 + 组件组装结果）
├── sessions/                      # 会话历史
│   └── <session-id>.json
├── data/                          # Instance 私有数据（Agent 运行时产生的文件）
├── logs/                          # Instance 级别日志
└── temp/                          # 临时文件（可安全清理）
```

### CLI 接口设计

```bash
# 默认：在内置位置创建 Instance
actant agent create my-agent --template code-review-agent
# → workspace: ~/.actant/instances/my-agent/

# 指定外部位置
actant agent create my-agent --template code-review-agent --workspace /path/to/workspace
# → workspace: /path/to/workspace/
# → registry.json 中记录外部路径引用

# 在当前目录下创建（便捷写法）
actant agent create my-agent --template code-review-agent --workspace .
# → workspace: $(pwd)/
```

---

## 三、Instance 注册表（Registry）

### `instances/registry.json` 格式

```json
{
  "version": 1,
  "instances": {
    "reviewer": {
      "name": "reviewer",
      "template": "code-review-agent",
      "workspacePath": "~/.actant/instances/reviewer",
      "location": "builtin",
      "createdAt": "2026-02-22T10:00:00Z",
      "status": "stopped"
    },
    "project-helper": {
      "name": "project-helper",
      "template": "assistant",
      "workspacePath": "D:/Projects/my-app/.agents/helper",
      "location": "external",
      "createdAt": "2026-02-22T11:00:00Z",
      "status": "running"
    }
  }
}
```

### 注册表操作语义

| 操作 | 行为 |
|------|------|
| `agent create` | 创建 workspace + 注册到 registry |
| `agent list` | 读取 registry → 逐一校验 workspace 可达性 |
| `agent start` | 从 registry 查找 workspace 路径 → 启动进程 |
| `agent destroy` | 删除 workspace 目录 + 从 registry 移除 |
| `agent destroy --keep-data` | 仅从 registry 移除，保留 workspace 目录 |

### 一致性保证

- **启动时扫描**：Daemon 启动时遍历 registry，校验每个 workspace 路径是否存在、`.actant.json` 是否合法。不可达的 Instance 标记为 `orphaned`。
- **双向校验**：同时扫描内置 `instances/` 目录，发现未注册的 `.actant.json` 则补录到 registry（兼容旧版/手动创建的 Instance）。
- **原子写入**：registry.json 使用 write-rename 模式，避免写入中途崩溃导致损坏。

---

## 四、与现有代码的差异

### 当前状态

| 方面 | 当前实现 | 目标设计 |
|------|----------|----------|
| Instance 发现 | `scanInstances()` 扫描 `instancesDir` 子目录 | Registry 索引 + 扫描双重机制 |
| Instance 位置 | 固定在 `{homeDir}/instances/` 下 | 支持内置 + 外部任意路径 |
| Source 缓存 | `{homeDir}/sources-cache/` | `{homeDir}/sources/cache/` |
| Source 注册 | `{homeDir}/sources.json` | `{homeDir}/sources/sources.json` |
| 组件来源追踪 | 无 | 组件元数据记录 origin（builtin / source / user） |

### 需要修改的模块

1. **`AppContext`** (`packages/api/src/services/app-context.ts`)
   - 增加 `sourcesDir`、`registryPath` 等路径字段
   - 初始化时创建新目录结构

2. **`AgentManager`** (`packages/core/src/manager/agent-manager.ts`)
   - `create()` 支持 `workspacePath` 参数
   - `initialize()` 使用 Registry 而非纯目录扫描

3. **`AgentInitializer`** (`packages/core/src/initializer/`)
   - `createInstance()` 接受外部 workspace 路径

4. **`SourceManager`** (`packages/core/src/source/source-manager.ts`)
   - 路径从 `homeDir` 平级调整为 `homeDir/sources/` 子目录

5. **`instance-meta-io`** (`packages/core/src/state/instance-meta-io.ts`)
   - `scanInstances()` 增加 Registry 支持

6. **CLI `agent create` 命令**
   - 增加 `--workspace` 选项

---

## 五、迁移策略

对已有的 `~/.actant/` 目录需要平滑迁移：

1. **首次启动检测**：如果 `registry.json` 不存在但 `instances/` 下有子目录，自动扫描并生成 registry。
2. **sources 路径迁移**：如果旧 `sources.json`、`sources-cache/` 存在于 homeDir 根，自动移动到 `sources/` 子目录。
3. **向后兼容**：迁移期间两种路径都支持读取，写入统一走新路径。

---

## 验收标准

- [ ] `~/.actant/` 目录结构按新设计组织，职责清晰
- [ ] `instances/registry.json` 作为 Instance 注册表，记录所有 Instance 的位置信息
- [ ] `actant agent create --workspace <path>` 支持在外部路径创建 Instance
- [ ] `actant agent list` 能发现所有 Instance（内置 + 外部）
- [ ] Daemon 启动时校验 registry 与实际 workspace 的一致性
- [ ] Source 相关文件整理到 `sources/` 子目录
- [ ] 旧目录结构自动迁移，不丢失数据
- [ ] 文档更新：架构文档反映新目录设计
