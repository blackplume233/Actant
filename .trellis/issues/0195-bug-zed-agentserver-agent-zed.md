---
id: 195
title: "Bug: Zed AgentServer 妯″紡涓?Agent 鏃犳硶鎰熺煡 Zed 宸ヤ綔鐩綍鍐呭"
status: open
labels:
  - bug
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#195"
closedAs: null
createdAt: "2026-02-26T01:51:05Z"
updatedAt: "2026-02-27T12:35:52"
closedAt: null
---

## 问题描述

当 Zed 通过 `actant proxy` 连接到 Actant 管理的 Agent 后，Agent 无法感知当前 Zed 工作目录的文件内容。

---

## 核心思路：按 Agent Archetype 分治

不同原型的 Agent 对 cwd 的需求本质不同，应该按 archetype 制定各自的 cwd 策略，而非用一个通用方案覆盖所有场景。

| Archetype | 控制权 | ACP 的角色 | cwd 策略 |
|-----------|--------|-----------|----------|
| **employee（雇员型）** | 完全受 Actant 管控 | 仅是交互接口 | ACP 传入的 cwd 作为**可操作目录信息**传入 Agent |
| **tool（非雇员型）** | 外部 Agent 有较大控制权 | 遵循标准 ACP 操作逻辑 | 创建时就指定到合理的工作目录 |
| **service（服务型）** | 折中 | 标准 ACP + Actant 管理 | session 级别传递 cwd |

---

## 背景知识

### 三种 Archetype 当前默认值

```typescript
// archetype-defaults.ts
tool:     { launchMode: "direct",         interactionModes: ["open", "start", "chat"], autoStart: false }
employee: { launchMode: "acp-background", interactionModes: ["start", "run", "proxy"], autoStart: true }
service:  { launchMode: "acp-service",    interactionModes: ["proxy"],                 autoStart: true }
```

### Agent Instance 目录结构

```
~/.actant/instances/{name}/
├── .actant.json              ← 实例元数据（必需）
├── AGENTS.md / CLAUDE.md     ← 物化的 Skills / 指令
├── .claude/                  ← claude-code 后端配置
├── prompts/system.md         ← 系统提示词
└── logs/                     ← 日志
```

### 记忆存储机制

后端对话记忆由后端自身管理，**cwd 决定记忆归属**：

- claude-code：`~/.claude/projects/{url-encoded-cwd}/sessions/*.jsonl`
- Cursor：`%APPDATA%\Cursor\User\workspaceStorage\{workspace-hash}\`

### 两层 cwd

1. **进程级 cwd**：`spawn(command, args, { cwd: workspaceDir })`
2. **ACP 协议级 cwd**：`newSession(cwd)` 传递的逻辑工作目录

### 关键约束

直接切换进程 cwd 到外部目录 → `.actant.json` 找不到、物化配置丢失 → Agent 配置体系全面失效。

---

## Employee（雇员型）

### 定位

Employee 完全受 Actant 管控，有自己的 workspace、配置、记忆体系。ACP 只是用户与 Employee 交互的一种方式（Zed 面板、CLI chat 等），**不应该改变 Employee 的工作环境**。

### cwd 策略：ACP cwd 作为"可操作目录信息"

**不切换进程 cwd，不创建分身**。将 ACP 传入的 cwd 作为一个参数传递给 Agent，告知"用户当前在操作这个目录"。

```
Zed (cwd=~/my-project) ──ACP newSession(cwd=~/my-project)──▶ actant proxy ──▶ Employee Agent
                                                                                  │
                                                                                  ├─ 进程 cwd = ~/.actant/instances/my-employee （不变）
                                                                                  ├─ 配置 = instance 目录下的完整物化配置 （不变）
                                                                                  ├─ 记忆 = ~/.claude/projects/{instance-dir}/ （不变，属于 Agent）
                                                                                  └─ 可操作目录 = ~/my-project （新增信息）
```

### 实现方式

Employee 后端通过 ACP 是 `acp-background` 模式，天然支持 `newSession(cwd)`。proxy 只需确保 cwd 信息不丢失即可：

| Proxy 模式 | 当前状态 | 需要的改动 |
|-----------|---------|-----------|
| P1 Direct Bridge | 透明转发，cwd 自然到达后端 | 无需改动 |
| P2 Gateway | Gateway 传递 `params.cwd` | 无需改动（验证即可） |
| P3 Legacy | **cwd 在翻译为 `session.create` 时丢失** | **修复：传递 cwd 到 `session.create`** |

### 记忆归属

**归属 Agent（Employee）自身**。Employee 是一个持续存在的实体，它的记忆应该跟随自身，而非跟随临时操作的目录。

| 维度 | 结论 |
|------|------|
| 用户直接打开 Zed 项目能看到 Employee 的历史？ | ❌ 不能（记忆在 instance 路径下） |
| Employee 下次启动能回忆历史？ | ✅ 能（cwd 不变，记忆连续） |
| Employee 操作不同项目时记忆是否分裂？ | ❌ 不分裂（所有记忆都在同一个 instance 路径下） |

这是合理的——Employee 是一个"人"，它的记忆属于它自己，不属于某个项目。

### 同名文件冲突

无冲突。不改变目录结构，不在 Zed 目录中写入任何文件。

### S1（同目录） vs S2（不同目录）

| 场景 | 表现 |
|------|------|
| S1 | 进程 cwd 就是 Zed 目录，Agent 天然可以操作 |
| S2 | Agent 通过 ACP session cwd 得知 Zed 目录位置，在该目录中执行文件操作 |

两种场景行为一致，S2 不需要特殊处理——ACP session cwd 本来就是告诉后端"在哪操作"，后端应该尊重它。

### 后端类型影响

| 后端类型 | 表现 |
|----------|------|
| B1 ACP 后端（claude-code 等） | ✅ 支持 `newSession(cwd)`，自动在指定目录操作 |
| B2 非 ACP 后端 | ❌ 不支持 session cwd。但 Employee 默认是 `acp-background`，非 ACP 后端做 Employee 本身就不合理 |

### 小结

| 评价维度 | 结论 |
|----------|------|
| 文件访问 | ✅ 通过 ACP session cwd |
| 记忆 | ✅ 归属 Agent，连续不分裂 |
| 配置完整性 | ✅ 进程 cwd 不变 |
| 同名文件 | ✅ 无冲突 |
| 复杂度 | 极低（几乎只需修复 Legacy cwd 丢失） |

---

## Tool（非雇员型 / 外部 Agent）

### 定位

Tool 是用户按需启动的外部 Agent，用完即走（`launchMode: "direct"`，`autoStart: false`）。用户期望 Agent 直接在当前项目目录中工作，像启动一个本地工具一样。

### cwd 策略：创建时指定到合理的工作目录

Tool 的 workspace 应该就是用户要操作的目录。**创建实例时直接指向目标工作目录**，不依赖 ACP session cwd 运行时切换。

#### 场景一：用户主动创建 Tool

```bash
# 用户在 ~/my-project 中使用 Tool Agent
actant agent create my-tool -t code-review --work-dir ~/my-project
```

使用 `workDir` 机制，instance 物化到 Zed 项目目录中。进程 cwd = Zed 目录。

#### 场景二：Zed 通过 proxy 自动创建 Tool

```json
{
  "agent_servers": {
    "Actant Tool": {
      "command": "actant",
      "args": ["proxy", "my-tool", "-t", "code-review"]
    }
  }
}
```

Direct Bridge 模式的 `proxy` 支持 `-t` 自动创建。**当检测到 archetype=tool 时，自动将 Zed 工作目录作为 workDir**。

### 实现方式

| 创建方式 | cwd 确定逻辑 |
|---------|-------------|
| CLI `agent create --work-dir` | 用户显式指定 |
| `proxy -t` 自动创建 | Proxy 检测 archetype=tool → 使用 Zed cwd 或 `--cwd` 参数作为 workDir |
| 已存在的 Tool 实例 | 使用实例已有的 workspaceDir；若不匹配 Zed 目录，行为取决于 ACP 支持 |

### 记忆归属

**归属项目**。Tool 是临时性的（直接启动，用完退出），记忆跟随项目更自然。

| 维度 | 结论 |
|------|------|
| 用户直接打开 Zed 项目能看到 Tool 的历史？ | ✅ 能（cwd = Zed 目录） |
| Tool 下次启动（可能在不同项目）能回忆历史？ | 取决于 cwd 是否相同 |

### 同名文件冲突

使用 `workDir` 机制时，物化文件写入 Zed 项目目录：

| 情况 | 处理 |
|------|------|
| 项目无同名文件 | ✅ 正常物化 |
| 项目已有 `.claude/`、`CLAUDE.md` | ⚠️ 使用 `workDirConflict: "append"` 追加而非覆盖 |

**缓解**：
- 提供 `.gitignore` 模板（`.actant.json`、`logs/`）
- Tool 的物化产物通常较轻量（可以做最小化物化，只写入必要配置）

### S1 vs S2

| 场景 | 表现 |
|------|------|
| S1（workDir = Zed 目录） | ✅ 天然正确 |
| S2（已有实例，目录不匹配） | ⚠️ Tool 实例与当前 Zed 目录不匹配时，应提示用户重新创建或使用 `--cwd` |

### 后端类型影响

| 后端类型 | 表现 |
|----------|------|
| B1 ACP 后端 | ✅ 完全支持 |
| B2 非 ACP 后端 | ✅ 进程 cwd 已是 Zed 目录（通过 workDir），无需 ACP session cwd |

### 小结

| 评价维度 | 结论 |
|----------|------|
| 文件访问 | ✅ cwd 就是目标目录 |
| 记忆 | ✅ 归属项目 |
| 配置完整性 | ✅（物化到 workDir） |
| 同名文件 | ⚠️ 需 append 策略 |
| 全后端兼容 | ✅（不依赖 ACP session cwd） |
| 复杂度 | 低（利用现有 workDir 机制） |

---

## Service（服务型）

### 定位

Service 是常驻后台的 Agent（`acp-service`，`autoStart: true`），通过 ACP 对外提供服务。它有自己的 workspace 和配置，但需要**按 session 服务不同的客户端（可能来自不同的 Zed 项目）**。

### cwd 策略：session 级别传递 cwd

Service 的进程 cwd 保持在 instance 目录（配置完整），但**每个 ACP session 可以指定不同的工作目录**。Service 后端在每个 session 中切换到对应的 cwd 操作。

```
Zed Project A ──ACP newSession(cwd=~/project-a)──▶ Service Agent (cwd=instance dir)
Zed Project B ──ACP newSession(cwd=~/project-b)──▶     └─ session A → 操作 ~/project-a
                                                        └─ session B → 操作 ~/project-b
```

### 实现方式

Service 使用 `acp-service` launchMode，已经是长驻进程。只需确保 session cwd 端到端传递：

| Proxy 模式 | 当前状态 | 需要的改动 |
|-----------|---------|-----------|
| P1 Direct Bridge | 透明转发 | 无需改动 |
| P2 Gateway | 传递 `params.cwd` | 无需改动（验证即可） |
| P3 Legacy | cwd 丢失 | **修复：传递 cwd** |

### 记忆归属

**取决于后端实现**。如果后端（如 claude-code）按进程 cwd 存储记忆，则所有 session 的记忆都在 instance 路径下（同 Employee）。如果后端按 session cwd 分别存储，则记忆按项目分散。

| 后端记忆策略 | 表现 |
|------------|------|
| 按进程 cwd 存储 | 所有 session 记忆集中在 Service instance 下 |
| 按 session cwd 存储 | 记忆按项目分散，各 Zed 项目可看到自己的历史 |

Service 作为折中类型，两种都可接受——具体取决于 Service 的用途。

### 并发 session

Service 可能同时服务多个 Zed 客户端，每个 session 的 cwd 不同。后端需要支持**多 session 并发、每 session 独立 cwd**，这是 ACP 协议的标准能力。

### 同名文件冲突

无冲突。进程 cwd 不变，不在 Zed 目录中写入任何文件。

### S1 vs S2

| 场景 | 表现 |
|------|------|
| S1 | session cwd 与进程 cwd 一致，正常 |
| S2 | session cwd 指向不同目录，后端在 session 级别切换 |

### 后端类型影响

| 后端类型 | 表现 |
|----------|------|
| B1 ACP 后端 | ✅ 天然支持 session cwd |
| B2 非 ACP 后端 | ❌ 不支持 session cwd。但 Service 默认是 `acp-service`，非 ACP 后端做 Service 不合理 |

### 小结

| 评价维度 | 结论 |
|----------|------|
| 文件访问 | ✅ 通过 session cwd |
| 记忆 | ⚠️ 取决于后端实现 |
| 配置完整性 | ✅ 进程 cwd 不变 |
| 同名文件 | ✅ 无冲突 |
| 并发支持 | ✅ 标准 ACP 多 session |
| 复杂度 | 低 |

---

## 三种 Archetype 策略对比

| | Employee | Tool | Service |
|---|---|---|---|
| **核心理念** | ACP cwd 是信息，不是命令 | 创建时就定位到目标目录 | session 级别 cwd 切换 |
| **进程 cwd** | instance 目录（不变） | Zed 项目目录（workDir） | instance 目录（不变） |
| **配置加载** | 从 instance 目录 | 从 workDir（物化在内） | 从 instance 目录 |
| **记忆归属** | Agent 自身 | 项目 | 取决于后端 |
| **ACP cwd 含义** | "请在这个目录操作" | N/A（cwd 已正确） | "本 session 在此目录操作" |
| **同名文件风险** | 无 | 有（需 append 策略） | 无 |
| **全后端兼容** | 仅 ACP 后端 | ✅ 全部 | 仅 ACP 后端 |
| **生命周期** | 持续存在，autoStart | 按需启动，用完退出 | 持续存在，autoStart |

---

## 实现计划

### Phase 1（短期 Quick Win）

1. **修复 Legacy cwd 丢失**：`handleLegacyMessage` 中 `session.create` 传递 cwd
   - 影响 Employee 和 Service 在 Legacy 模式下的 session cwd
2. **验证 ACP session cwd 端到端生效**：
   - Direct Bridge（Employee / Service）
   - Gateway（Service）
3. **文档**：在 `zed-agent-server.md` 中说明按 archetype 选择配置方式

### Phase 2（中期）

4. **Tool 的 `proxy -t` 自动 workDir**：当 archetype=tool 时，`proxy` 自动使用 Zed cwd 作为 workDir 创建实例
5. **Tool 的 workDir conflict 策略**：支持 `append` 模式，避免覆盖用户项目中的同名文件
6. **最小化物化**：Tool 场景下只写入必要配置，减少对用户项目目录的污染

### Phase 3（长期）

7. **Actant Memory Layer**：自建记忆索引，同时支持 Agent 维度和项目维度查询
   - Employee 的记忆可以按操作过的项目建索引
   - Service 的多 session 记忆可以统一管理
8. **configDir/workDir 分离**（可选）：让 Employee/Service 在保持配置完整的同时支持进程级 cwd 切换

---

## 影响范围

- `packages/cli/src/commands/proxy.ts` — Legacy cwd 修复 + Tool auto-workDir
- `packages/acp/src/gateway.ts` — Gateway cwd 端到端验证
- `packages/core/src/initializer/archetype-defaults.ts` — archetype cwd 策略
- `packages/core/src/initializer/agent-initializer.ts` — Tool workDir 自动化
- `packages/core/src/manager/agent-manager.ts` — resolveAgent cwd 逻辑

## 相关文档

- `docs/wiki/recipes/zed-agent-server.md`
- `docs/design/memory-layer-agent-evolution.md`
