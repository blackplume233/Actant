---
id: 248
title: "RFC: Virtual File System (VFS) - Registry-based VFS Design"
status: closed
labels:
  - enhancement
milestone: null
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#248"
closedAs: completed
createdAt: "2026-02-27T10:26:04Z"
updatedAt: "2026-03-18T06:39:02"
closedAt: "2026-03-18T06:34:05Z"
---

## 概要

设计一个基于**注册制**的虚拟文件系统 (VFS)，遵循"一切皆文件"哲学。不同子系统（工作区、内存、配置、Canvas、进程等）以 **Source** 方式注册挂载点，并声明自身具备的文件操作能力。Agent 通过统一的 VFS 工具接口访问所有数据，无需关心底层实现。

## 动机

当前 Agent 访问文件依赖 MCP filesystem server（真实磁盘）或特定工具（如 `actant_canvas_update`）。每新增一个数据域就需要新增专用工具，无法扩展：

1. Agent 无法用统一接口访问内存上下文、配置、调度计划、进程输出等虚拟资源
2. 每种资源的搜索、读写、导航能力不一致，缺乏声明机制
3. 工具膨胀：N 个数据域 x M 个操作 = NxM 个工具

VFS 将所有数据域统一为文件语义，通过 **能力声明** 让 Agent 在运行时知道"这个路径能做什么"。

---

## 一、全部 17 种可挂载能力

以 Cursor / Claude Code / Windsurf 等主流 AI Agent 为参考，抽象出 17 种文件操作，**全部**作为 VFS 的可挂载能力。分为 4 层：

### L0 Core -- 基础 CRUD（5 种）

| # | 能力 ID | 描述 | Handler 签名 |
|---|---------|------|-------------|
| 1 | `read` | 读取文件全部内容 | `(path) => FileContent` |
| 2 | `read_range` | 按行号范围分段读取 | `(path, startLine, endLine?) => FileContent` |
| 3 | `write` | 创建新文件 / 覆写已有文件 | `(path, content) => WriteResult` |
| 4 | `edit` | 原地搜索替换编辑 | `(path, oldStr, newStr, replaceAll?) => EditResult` |
| 5 | `delete` | 删除文件 | `(path) => void` |

### L1 Navigate -- 目录导航（4 种）

| # | 能力 ID | 描述 | Handler 签名 |
|---|---------|------|-------------|
| 6 | `list` | 列出目录下的文件和子目录 | `(dirPath, opts?) => Entry[]` |
| 7 | `stat` | 获取文件元信息 | `(path) => {size, mtime, type, permissions}` |
| 8 | `tree` | 获取目录树结构（带深度控制） | `(path, opts?) => TreeNode` |
| 9 | `glob` | 按文件名模式匹配查找文件 | `(pattern, opts?) => string[]` |

### L2 Search -- 高级检索 + 领域能力（6 种）

| # | 能力 ID | 描述 | Handler 签名 |
|---|---------|------|-------------|
| 10 | `grep` | 按正则表达式搜索文件内容 | `(pattern, opts?) => GrepResult[]` |
| 11 | `semantic_search` | 按语义搜索代码 | `(query, opts?) => SearchResult[]` |
| 12 | `read_lints` | 读取 linter 诊断信息 | `(paths?) => Diagnostic[]` |
| 13 | `edit_notebook` | 编辑 Notebook 单元格 | `(path, cellIdx, oldStr, newStr, opts?) => EditResult` |
| 14 | `git_status` | 查看工作区文件变更状态 | `(opts?) => StatusEntry[]` |
| 15 | `git_diff` | 查看文件差异对比 | `(opts?) => DiffResult` |

### L3 Reactive -- 事件驱动（2 种）

| # | 能力 ID | 描述 | Handler 签名 |
|---|---------|------|-------------|
| 16 | `watch` | 监听文件/目录变更事件 | `(pattern, callback) => Disposer` |
| 17 | `on_change` | 文件变更触发钩子回调 | `(event, path, callback) => Disposer` |

---

## 二、双层类型系统（Source Type + File Schema）

### Source Type（挂载点级别）

```typescript
interface VfsSourceRegistration {
  name: string;
  mountPoint: string;
  sourceType: VfsSourceType;        // "filesystem" | "process" | "memory" | ...
  lifecycle: VfsLifecycle;          // 生命周期策略
  metadata: VfsSourceMeta;
  fileSchema: VfsFileSchemaMap;     // 文件级类型 + 能力声明
  handlers: VfsHandlerMap;          // 17 种能力的 handler 实现
}

type VfsSourceType =
  | "filesystem" | "process" | "config" | "memory"
  | "canvas" | "vcs" | "notebook" | "schedule"
  | "component-source" | (string & {});
```

### File Schema（文件级别）

每个文件精确声明自己的类型和能力子集：

```typescript
type VfsFileSchemaMap = Record<string, VfsFileSchema>;

interface VfsFileSchema {
  type: VfsFileType;                // "text" | "json" | "stream" | "control" | ...
  mimeType?: string;
  description?: string;
  capabilities: VfsCapabilityId[];  // 此文件具备的能力子集
  jsonSchema?: Record<string, unknown>;
  dynamic?: boolean;                // 每次读取内容可能不同
  enumerable?: boolean;             // 是否在 list 中显示
}

type VfsFileType =
  | "text" | "json" | "stream" | "control"
  | "binary" | "directory" | "notebook" | "diff"
  | (string & {});
```

### 注册示例（/proc 进程）

```typescript
vfsRegistry.mount({
  name: `proc-${pid}`,
  mountPoint: `/proc/agent-a/${pid}`,
  sourceType: "process",
  lifecycle: { type: "process", pid, retainSeconds: 300 },
  metadata: { description: `Process: node server.js (PID: ${pid})`, virtual: true, owner: "agent-a" },
  fileSchema: {
    "status":      { type: "text",    capabilities: ["read"],                     dynamic: true },
    "pid":         { type: "text",    capabilities: ["read"] },
    "stdout":      { type: "stream",  capabilities: ["read", "read_range", "grep"], dynamic: true },
    "stderr":      { type: "stream",  capabilities: ["read", "read_range", "grep"], dynamic: true },
    "cmd":         { type: "control", capabilities: ["write"],
                     description: "写入控制指令: stop / restart / signal <SIG>" },
    "stdin":       { type: "control", capabilities: ["write"] },
    "config.json": { type: "json",    capabilities: ["read", "write", "edit"] },
    "env.json":    { type: "json",    capabilities: ["read"] },
    "metrics.json":{ type: "json",    capabilities: ["read"], dynamic: true },
  },
  handlers: { /* ... */ },
});
```

### 能力矩阵

| # | 能力 | `/workspace` | `/memory` | `/config` | `/canvas` | `/proc/*` | `/vcs` | `/notebook` | `/schedule` |
|---|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | read | Y | Y | Y | Y | Y | Y | Y | Y |
| 2 | read_range | Y | - | - | - | Y | - | - | - |
| 3 | write | Y | Y | Y | Y | Y | - | - | Y |
| 4 | edit | Y | - | Y | - | - | - | - | - |
| 5 | delete | Y | - | - | - | - | - | - | - |
| 6 | list | Y | Y | Y | Y | Y | Y | Y | Y |
| 7 | stat | Y | - | Y | - | Y | - | Y | - |
| 8 | tree | Y | Y | - | - | Y | - | - | - |
| 9 | glob | Y | - | - | - | - | - | - | - |
| 10 | grep | Y | Y | - | - | Y | - | - | - |
| 11 | semantic_search | Y | - | - | - | - | - | - | - |
| 12 | read_lints | Y | - | - | - | - | - | Y | - |
| 13 | edit_notebook | - | - | - | - | - | - | Y | - |
| 14 | git_status | - | - | - | - | - | Y | - | - |
| 15 | git_diff | - | - | - | - | - | Y | - | - |
| 16 | watch | Y | - | - | Y | Y | - | - | - |
| 17 | on_change | Y | - | - | - | Y | - | - | - |

---

## 三、VFS 生命周期

### Lifecycle 类型

```typescript
type VfsLifecycle =
  | { type: "daemon" }                                      // Daemon 关闭时卸载
  | { type: "agent"; agentName: string }                    // Agent stop 时级联卸载
  | { type: "session"; agentName: string; sessionId: string } // Session 结束时卸载
  | { type: "process"; pid: number; retainSeconds?: number }  // 进程退出 + 延迟后卸载
  | { type: "ttl"; expiresAt: number }                       // 定时过期卸载
  | { type: "manual" };                                      // 仅手动卸载
```

### 生命周期流程

```
Daemon Init → mount /workspace, /config, /vcs (lifecycle: daemon)
  → Agent-A start → mount /memory/agent-a, /canvas/agent-a (lifecycle: agent)
    → Agent-A 管理进程 → mount /proc/agent-a/12345 (lifecycle: process)
      → 进程退出 → 保留 300s → auto unmount
    → Agent-A stop → unmount /memory/agent-a, /canvas/agent-a, /proc/agent-a/* (级联)
Daemon Shutdown → unmount all
```

---

## 四、四种注册入口

| 入口 | 调用者 | 参数类型 | 含 Handler | 需要 Factory |
|------|--------|---------|:---:|:---:|
| **内部编程** | Daemon 模块 | `VfsSourceRegistration` | Y | N |
| **RPC** | Agent / REST | `VfsMountParams` (声明式) | N | Y |
| **CLI** | 用户 | 命令行参数 | N | Y |
| **Template** | AgentManager | YAML 声明 | N | Y |

### RPC / CLI / Template 使用声明式规格 + SourceFactory

```typescript
type VfsSourceSpec =
  | { type: "filesystem"; path: string; readOnly?: boolean; watchEnabled?: boolean }
  | { type: "process"; command?: string; args?: string[]; pid?: number; bufferSize?: number }
  | { type: "memory"; maxSize?: string; persistent?: boolean }
  | { type: "config"; namespace?: string }
  | { type: "canvas"; maxItems?: number }
  | { type: "vcs"; repoPath?: string }
  | { type: "custom"; factory: string; config: Record<string, unknown> };

interface VfsSourceFactory<S extends VfsSourceSpec> {
  readonly type: string;
  create(spec: S, mountPoint: string, lifecycle: VfsLifecycle): VfsSourceRegistration;
  validate?(spec: S): { valid: boolean; errors?: string[] };
}
```

---

## 五、落盘方案 -- 文件系统镜像

VFS 虚拟路径 1:1 映射到真实数据目录，不依赖任何数据库：

```
~/.actant/vfs-data/
  ├── memory/agent-a/context.md              → /memory/agent-a/context.md
  ├── memory/agent-a/context.md.meta.json    → 元信息 sidecar
  ├── config/template.json                   → /config/template.json
  ├── canvas/agent-a/main.json               → /canvas/agent-a/main.json
  └── _vfs/
      ├── mounts.json                        → 挂载注册表
      ├── audit.jsonl                        → 变更审计日志 (NDJSON)
      └── index/                             → 可选索引目录
          ├── paths.idx                      → JSON 路径索引 (Level 1)
          └── fts.idx                        → SQLite FTS 索引 (Level 2, 可选)
```

### 索引分级

| Level | 方案 | 依赖 | 加速目标 |
|-------|------|------|---------|
| 0 | 无索引 | 无 | 千文件级直接 readdir/ripgrep |
| 1 | JSON 路径索引 | 无 | glob/list/stat: O(1) 内存查找 |
| 2 | SQLite 索引 (仅做索引) | better-sqlite3 | FTS5 全文搜索, 万文件级 |

LanceDB 不是 VFS 存储引擎，而是作为独立 Source 挂载到 `/index/semantic/` 提供语义搜索。

---

## 六、ACP Hook -- 透明拦截

VFS 直接 hook 到 ACP `ClientCallbackRouter` 的 `readTextFile` / `writeTextFile`。Agent 用原生 Read/Write 即可透明访问虚拟文件，不需要学新工具。

```
Agent 调用 Read("/proc/agent-a/12345/stdout")
  → ACP ClientCallbackRouter.readTextFile()
    → VfsInterceptor: 是 VFS 路径?
      → Yes: 权限检查 → VFS resolve → Source handler → 返回内容
      → No:  原有逻辑（upstream IDE / local handler）
```

同时通过 MCP Server 暴露 VFS 工具（`vfs_read`, `vfs_grep`, `vfs_describe` 等），兼容所有支持 MCP 的 Agent（Cursor、Claude Code 等）。

---

## 七、Token 统一权限模型

### 身份解析

```typescript
type VfsIdentity =
  | { type: "agent"; agentName: string; archetype: AgentArchetype;
      sessionId: string; parentAgent?: string }   // 有 Token: 已认证 Agent
  | { type: "anonymous"; source?: string };        // 无 Token: 匿名

// Token → Identity
function resolveIdentity(token: string | undefined, tokenStore: SessionTokenStore): VfsIdentity {
  if (!token) return { type: "anonymous" };
  const session = tokenStore.verify(token);
  if (!session) return { type: "anonymous" };
  return { type: "agent", agentName: session.agentName, archetype: session.archetype, ... };
}
```

### 权限规则

```typescript
interface VfsPermissionRule {
  pathPattern: string;            // glob, 支持 ${self} 变量
  principal: VfsPrincipal;
  actions: VfsCapabilityId[];
  effect: "allow" | "deny";
  priority?: number;
}

type VfsPrincipal =
  | { type: "owner" }             // 挂载点 owner
  | { type: "self" }              // 路径含自己名字的 Agent
  | { type: "agent"; name: string }
  | { type: "archetype"; min: AgentArchetype }
  | { type: "parent" }            // 父 Agent
  | { type: "any" }               // 所有已认证 Agent
  | { type: "public" };           // 任何人（含匿名）
```

### 默认权限矩阵

| 路径 | owner (self) | parent | 同级 Agent | repo Agent | 匿名 (public) |
|------|:---:|:---:|:---:|:---:|:---:|
| `/workspace/**` | RW 全部 | - | - | - | - |
| `/memory/${self}/**` | RW | R | R | R | - |
| `/proc/${self}/**` | RW (含 cmd) | RW | R | R | - |
| `/config/**` | RW (service+) | RW | RW (service+) | R | R (public/) |
| `/canvas/${self}/**` | RW | R | R | R | - |
| `/vcs/**` | R | R | R | R | R |
| `/` (根) | list | list | list | list | list |

### Token 行为

- **ACP Agent**: session 创建时自动绑定 token，Agent 无感知，VfsInterceptor 直接持有 identity
- **CLI (actant internal)**: `--token $ACTANT_SESSION_TOKEN` 或自动读取 env
- **CLI (actant vfs)**: 无 token = 匿名 = 仅 public 权限
- **REST API / Dashboard**: `X-Actant-Token` header，无 token 降级为匿名

---

## 八、完整 CLI 命令集

```
actant vfs <subcommand> [--token <token>]
```

### L0 Core

| 命令 | 能力 | 示例 |
|------|------|------|
| `vfs read <path> [--start N] [--end N]` | read / read_range | `vfs read /proc/agent-a/123/stdout --start -20` |
| `vfs write <path> [--content X \| --file F]` | write | `echo "stop" \| vfs write /proc/agent-a/123/cmd` |
| `vfs edit <path> --old X --new Y [--all]` | edit | `vfs edit /config/t.json --old '"3000"' --new '"8080"'` |
| `vfs delete <path>` | delete | `vfs delete /memory/agent-a/temp.md` |

### L1 Navigate

| 命令 | 能力 | 示例 |
|------|------|------|
| `vfs ls [path] [-r] [-l] [--hidden]` | list | `vfs ls / --long` |
| `vfs stat <path> [--json]` | stat | `vfs stat /workspace/src/index.ts` |
| `vfs tree [path] [--depth N] [--pattern P]` | tree | `vfs tree /proc/ --depth 2` |
| `vfs find <pattern> [--cwd P] [--type f\|d]` | glob | `vfs find "*.json" --cwd /config/` |

### L2 Search

| 命令 | 能力 | 示例 |
|------|------|------|
| `vfs grep <pattern> [path] [-i] [-C N] [--glob P] [--type T] [--count\|--files]` | grep | `vfs grep "ERROR" /proc/ -r` |
| `vfs search <query> [--scope P] [--limit N]` | semantic_search | `vfs search "auth code" --scope /workspace/` |
| `vfs lints [paths...] [--severity S] [--json]` | read_lints | `vfs lints /workspace/src/ --severity error` |
| `vfs edit-notebook <path> --cell N --old X --new Y` | edit_notebook | `vfs edit-notebook /workspace/a.ipynb --cell 3 ...` |
| `vfs git-status [path] [--json]` | git_status | `vfs git-status` |
| `vfs git-diff [path] [--staged] [--commit R]` | git_diff | `vfs git-diff --staged` |

### L3 Reactive

| 命令 | 能力 | 示例 |
|------|------|------|
| `vfs watch <path> [--pattern P] [--events E]` | watch | `vfs watch /workspace/src/ --pattern "*.ts"` |
| `vfs hook add\|list\|remove` | on_change | `vfs hook add --path "/proc/*/status" --event modify --action "..."` |

### 元操作

| 命令 | 说明 |
|------|------|
| `vfs describe <path> [--json]` | 查询路径的类型、能力、元信息 |
| `vfs mount <mountPoint> --source <type> [opts]` | 手动挂载 |
| `vfs unmount <name>` | 手动卸载 |
| `vfs mount list [--json]` | 列出所有挂载点及能力 |

---

## 九、Agent 感知机制

### 双路径暴露

| 路径 | 方式 | 覆盖范围 |
|------|------|---------|
| **ACP Hook** | ClientCallbackRouter 拦截 readTextFile/writeTextFile | Actant 管理的 Agent (原生 Read/Write 透明访问) |
| **MCP Server** | @actant/mcp-server 注册 vfs_* 工具 | 所有支持 MCP 的 Agent (Cursor, CC 等) |

### System Context 注入

VfsContextProvider (实现 ContextProvider) 在 session 启动时注入挂载点表:

```
## Virtual File System (VFS)

You have access to a unified virtual file system.

### Available Mount Points
  /workspace               filesystem     [read, write, edit, delete, list, stat, tree, glob, grep, ...]
  /memory/agent-a          memory         [read, write, list, grep]
  /config                  config         [read, write, edit, list, stat]
  /proc/agent-a/12345      process        [read, read_range, write, list, grep]
  /vcs                     vcs            [read, list, git_status, git_diff]

### Quick Reference
  Read("/proc/agent-a/12345/stdout")       -- read process output
  Read("/memory/agent-a/notes.md")         -- read agent memory
  Write("/proc/agent-a/12345/cmd", "stop") -- send command to process
```

Agent 用原生 Read/Write 即可访问虚拟路径，用 `vfs_describe` 按需探索能力。

---

## 十、架构总览

```
                控制层 (做事)                     VFS 暴露层 (投影)
              ─────────────                    ─────────────────
              ProcessManager.spawn()    ──►    /proc/agent-a/12345/
              AgentManager.start()      ──►    /memory/agent-a/
              ConfigStore.set()         ──►    /config/
              CanvasManager.update()    ──►    /canvas/agent-a/
              git (real repo)           ──►    /vcs/
              LanceDB Source            ──►    /index/semantic/
```

VFS 不持有业务状态，只做投影。控制层拥有实体和句柄，VFS 把实体状态映射为文件语义。

---

## 实现步骤

- [ ] 定义全部 17 种能力的类型: VfsCapabilityId, VfsCapabilityMap, handler 接口, 数据类型
- [ ] 定义双层类型系统: VfsSourceRegistration + VfsFileSchema
- [ ] 实现 VfsRegistry (mount / unmount / resolve / hasCapability / describe)
- [ ] 实现 VfsLifecycleManager (daemon / agent / session / process / ttl / manual)
- [ ] 实现 VfsPermissionManager (规则评估 + token 身份解析)
- [ ] 实现 SourceFactory 注册机制 (声明式 Spec -> Registration)
- [ ] 实现 WorkspaceSource (真实文件系统, 全 17 能力)
- [ ] 实现 ProcessSource (/proc mount)
- [ ] 实现 MemorySource + ConfigSource + CanvasSource
- [ ] 实现 VcsSource (/vcs mount, git_status / git_diff)
- [ ] 实现 VfsInterceptor (hook 到 ACP ClientCallbackRouter)
- [ ] 实现 VfsContextProvider (system context 注入)
- [ ] 在 @actant/mcp-server 注册 VFS 工具
- [ ] 实现完整 CLI: actant vfs (17 种操作 + describe + mount)
- [ ] 实现 RPC handlers: vfs.* 方法组
- [ ] 实现文件系统镜像落盘 + meta.json sidecar
- [ ] 实现可选索引 (Level 1 JSON / Level 2 SQLite FTS)
- [ ] 端到端测试: Agent 通过原生 Read/Write 跨 mount 操作
- [ ] 端到端测试: 权限隔离 (self/other/anonymous)
- [ ] 端到端测试: 进程管理场景 /proc 全流程

## 关联

- 与 SessionContextInjector (`packages/core/src/context-injector/`) 集成
- 与 ClientCallbackRouter (`packages/acp/src/callback-router.ts`) hook 集成
- 与 SessionTokenStore 复用 token 认证
- 与 PermissionPolicyEnforcer 权限体系对齐
- 与 ComponentSource (`packages/core/src/source/`) 概念对齐
- 需要扩展 RPC method map 增加 `vfs.*` 方法组
