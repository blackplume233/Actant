---
name: "Phase 3a: 统一组件管理体系（v3）"
overview: "可扩展 Source 注册 + package@name 引用 + Plugin 组合预设 + BaseComponentManager CRUD + CLI/RPC"
todos:
  - id: base-manager-crud
    content: "P0: BaseComponentManager CRUD 增强 — add/update/remove/persist/import/export/search (#43)"
    status: pending
  - id: base-manager-tests
    content: "P0: BaseComponentManager 增强的单元测试 + 现有 Manager 回归"
    status: pending
  - id: source-interface
    content: "P0: Source 接口 + GitHubSource + LocalSource 实现"
    status: pending
  - id: source-manager
    content: "P0: SourceManager — 注册/同步/卸载源，组件自动注入各 Manager"
    status: pending
  - id: package-manifest
    content: "P0: 包清单 agentcraft.json schema + 解析"
    status: pending
  - id: plugin-schema
    content: "P0: PluginDefinition — 命名组合预设 schema + 模板一键添加"
    status: pending
  - id: namespace-resolve
    content: "P0: package@name 命名空间解析 + resolve 适配"
    status: pending
  - id: app-context-sources
    content: "P0: AppContext 集成 SourceManager + 启动加载"
    status: pending
  - id: rpc-types-all
    content: "P0: rpc.types.ts — CRUD + source + plugin 全部参数/返回类型"
    status: pending
  - id: rpc-handlers-all
    content: "P0: handlers — CRUD + source + plugin handlers"
    status: pending
  - id: cli-component-crud
    content: "P0: CLI skill/prompt/mcp/workflow add/remove/export"
    status: pending
  - id: cli-source-commands
    content: "P0: CLI source add/remove/sync/list"
    status: pending
  - id: cli-plugin-commands
    content: "P0: CLI plugin list/add-to-template"
    status: pending
  - id: tests-integration
    content: "P0: 集成测试 + spec 文档更新"
    status: pending
isProject: false
---

# Phase 3a: 统一组件管理体系（v3 — 最终方案）

> Issue: #38 | 子 Issue: #43, #45 (+ 新增 Source/Plugin 子系统)
>
> 三次讨论后的共识：
> 1. Plugin 不是扁平组件，是**组合预设**（一键把 N 个 skills + prompts + mcp + workflows 添加给模板）
> 2. 组件来源通过**可扩展 Source**管理（GitHub / Local / 后续 HTTP、npm 等）
> 3. MCP 管理的是**配置描述**而非运行时
> 4. 引用格式统一为 `package@name`

---

## 一、架构全景

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentTemplate                          │
│  domainContext:                                              │
│    skills:  ["community@code-review", "my-local-skill"]     │
│    prompts: ["community@system-reviewer"]                   │
│    mcp:     ["community@filesystem"]                        │
│    workflows: ["internal@trellis-standard"]                 │
│                                                             │
│  # 或通过 Plugin 一键添加:                                    │
│  # agentcraft plugin apply community@review-bundle my-tmpl  │
│  # → 自动展开为上述多个组件引用                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ resolve("package@name")
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BaseComponentManager (4 个实例)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │SkillMgr  │ │PromptMgr │ │McpCfgMgr │ │WorkflowMgr   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  本地组件: "name"                                            │
│  远程组件: "package@name" (由 SourceManager 注入)             │
│                                                             │
│  CRUD: add / update / remove / import / export / search     │
└──────────────────────────┬──────────────────────────────────┘
                           │ sync → register("pkg@name", component)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     SourceManager                            │
│  sources: Map<packageName, Source>                           │
│                                                             │
│  addSource(name, config) → Source.fetch() → 注入各 Manager   │
│  syncSource(name)        → Source.fetch() → 更新各 Manager   │
│  removeSource(name)      → 从各 Manager 移除 pkg@ 前缀组件    │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ GitHubSource │  │ LocalSource  │  │ (HttpSource)  │ ...  │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│  Source 接口可扩展，后续可增加 npm / registry / http 等        │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch + parse manifest
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Remote Package (GitHub repo / local dir)        │
│                                                             │
│  agentcraft.json  ← 包清单                                   │
│  skills/          ← SkillDefinition JSON 文件               │
│  prompts/         ← PromptDefinition JSON 文件              │
│  mcp/             ← McpServerDefinition JSON 文件 (配置)     │
│  workflows/       ← WorkflowDefinition JSON 文件            │
│  plugins/         ← PluginDefinition JSON (组合预设)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心概念定义

### 1. Source（可扩展组件源）

Source 是组件的**来源渠道**，定义"从哪里获取"。

```typescript
// 接口 — 新 Source 类型只需实现此接口
interface ComponentSource {
  readonly type: string;                    // "github" | "local" | "http" | ...
  fetch(): Promise<PackageManifest>;        // 拉取包清单 + 组件内容
  sync(): Promise<PackageManifest>;         // 重新同步（增量/全量）
  dispose(): Promise<void>;                 // 清理缓存
}

// 已规划实现
// Phase 3a:
//   - GitHubSource  — git clone --depth 1 / GitHub API
//   - LocalSource   — 本地目录直接读取
// 后续:
//   - HttpSource    — HTTP URL 下载 tarball
//   - NpmSource     — npm registry
//   - RegistrySource — 自建 registry
```

**Source 配置存储**：
```json
// ~/.agentcraft/sources.json
{
  "sources": {
    "community": {
      "type": "github",
      "url": "https://github.com/user/agent-skills",
      "branch": "main",
      "syncedAt": "2026-02-21T10:00:00Z"
    },
    "internal": {
      "type": "local",
      "path": "/home/dev/my-agent-skills"
    }
  }
}
```

### 2. Package Manifest（包清单）

每个组件包根目录的 `agentcraft.json`：

```json
{
  "name": "community-agent-skills",
  "version": "1.0.0",
  "description": "Community-maintained agent skills collection",
  "components": {
    "skills": ["skills/code-review.json", "skills/typescript-expert.json"],
    "prompts": ["prompts/system-reviewer.json"],
    "mcp": ["mcp/filesystem.json"],
    "workflows": ["workflows/trellis-standard.json"]
  },
  "plugins": ["plugins/review-bundle.json", "plugins/game-dev-bundle.json"]
}
```

如果没有 `agentcraft.json`，SourceManager 自动扫描 `skills/`、`prompts/`、`mcp/`、`workflows/`、`plugins/` 目录（约定优于配置）。

### 3. Plugin（命名组合预设）

Plugin 是一个**命名的组件组合**，一次操作把多个组件添加到 AgentTemplate。

```json
// plugins/review-bundle.json
{
  "name": "review-bundle",
  "description": "Complete code review setup — skills + prompts + MCP tools",
  "skills": ["code-review", "typescript-expert"],
  "prompts": ["system-reviewer"],
  "mcpServers": ["filesystem"],
  "workflows": []
}
```

**Plugin 不是组件，是组件的引用集合**。

使用方式：
```bash
# 一键应用 plugin 到模板
agentcraft plugin apply community@review-bundle my-template

# 等价于手动添加:
# agentcraft template edit my-template --add-skill community@code-review
# agentcraft template edit my-template --add-skill community@typescript-expert
# agentcraft template edit my-template --add-prompt community@system-reviewer
# agentcraft template edit my-template --add-mcp community@filesystem
```

**PluginDefinition schema**：
```typescript
interface PluginDefinition {
  name: string;
  description?: string;
  skills?: string[];       // 组件名（同包内相对引用，不带 package@ 前缀）
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
}
```

### 4. MCP 只管配置

MCP Source 提供的是**推荐配置**，不是可执行程序本身：

```json
// mcp/filesystem.json — 配置描述
{
  "name": "filesystem",
  "description": "Node.js filesystem MCP server for file operations",
  "command": "npx",
  "args": ["-y", "@anthropic/mcp-filesystem"],
  "env": {},
  "_note": "Requires Node.js installed locally. command/args may need adjustment per environment."
}
```

用户从 Source 获取 MCP 配置后，可能需要 `update` 调整本地路径/环境变量。

### 5. `package@name` 命名空间

| 引用格式 | 含义 | 示例 |
|---------|------|------|
| `name` | 本地组件（无命名空间） | `"my-local-skill"` |
| `package@name` | 远程源中的组件 | `"community@code-review"` |
| `package@plugin-name` | 远程源中的 Plugin 预设 | `"community@review-bundle"` |

**解析规则**：
1. 含 `@` → 拆分为 `(package, name)` → 查找 `SourceManager.getSource(package)` 中的组件
2. 不含 `@` → 直接在 Manager 本地查找
3. 本地同名组件优先于远程（允许 fork + 覆盖）

**在 BaseComponentManager 中的存储**：远程组件注册时 key = `"community@code-review"`，本地组件 key = `"code-review"`。resolve 时先找精确匹配，再找本地。

---

## 三、实施计划

### 阶段 A: BaseComponentManager CRUD (#43)

> 基础层 — 所有 Manager 的统一能力增强

| # | Task | 预估 |
|---|------|------|
| A.1 | `persistDir` + `setPersistDir()` + `writeComponent()` / `deleteComponent()` | 小 |
| A.2 | `add(component, persist?)` / `update(name, patch, persist?)` / `remove(name, persist?)` | 中 |
| A.3 | `importFromFile(filePath)` / `exportToFile(name, filePath)` | 中 |
| A.4 | `search(query)` / `filter(predicate)` | 小 |
| A.5 | `validate()` 改为 public | 小 |
| A.6 | 单元测试 — 全部新方法 + 现有行为回归 | 中 |
| A.7 | AppContext 各 Manager 调用 `setPersistDir()` | 小 |

### 阶段 B: Source + Package + Plugin 体系

> 组件源管理 — 可扩展 Source、包清单、Plugin 预设

| # | Task | 依赖 | 预估 |
|---|------|------|------|
| B.1 | `ComponentSource` 接口 + `PackageManifest` schema (shared types) | - | 中 |
| B.2 | `GitHubSource` 实现 (git clone --depth 1 + 缓存) | B.1 | 大 |
| B.3 | `LocalSource` 实现 (本地目录直读) | B.1 | 小 |
| B.4 | `PluginDefinition` schema (shared types) | - | 小 |
| B.5 | `SourceManager` 实现 — addSource/syncSource/removeSource | B.1-B.3 | 大 |
| B.6 | SourceManager ↔ 各 Manager 联动 (sync 后注入 `pkg@name` 组件) | A 全部, B.5 | 中 |
| B.7 | Plugin apply 逻辑 — 展开 Plugin → 修改 Template domainContext | B.4, B.6 | 中 |
| B.8 | `sources.json` 持久化 + 启动时自动加载 | B.5 | 中 |
| B.9 | AppContext 集成 SourceManager | B.5, B.8 | 小 |
| B.10 | 单元测试 — Source/SourceManager/Plugin | B.5-B.7 | 大 |

### 阶段 C: RPC + CLI

> 对外接口层

| # | Task | 依赖 | 预估 |
|---|------|------|------|
| C.1 | `rpc.types.ts` — CRUD 参数/返回 + RpcMethodMap 扩展 | A | 中 |
| C.2 | `rpc.types.ts` — source/plugin 参数/返回 + RpcMethodMap | B | 中 |
| C.3 | CRUD handler 泛型工厂 `createCrudHandlers` | A | 中 |
| C.4 | `domain-handlers.ts` — 注册 skill/prompt/mcp/workflow CRUD | C.1, C.3 | 小 |
| C.5 | `source-handlers.ts` — source.add/remove/sync/list | B.5, C.2 | 中 |
| C.6 | `plugin-handlers.ts` — plugin.list/apply | B.7, C.2 | 中 |
| C.7 | CLI `skill/prompt/mcp/workflow add/remove/export` (12 个子命令) | C.4 | 大 |
| C.8 | CLI `source add/remove/sync/list` | C.5 | 中 |
| C.9 | CLI `plugin list/apply` | C.6 | 中 |
| C.10 | `formatter.ts` — source/plugin 格式化 | - | 小 |

### 阶段 D: 收尾

| # | Task | 预估 |
|---|------|------|
| D.1 | 集成测试 — RPC handler 调用链 | 大 |
| D.2 | `api-contracts.md` 更新 | 中 |
| D.3 | `config-spec.md` 更新 | 中 |
| D.4 | lint + typecheck + pnpm test:changed | 中 |

---

## 四、核心类型设计

### shared types (packages/shared/src/types/)

```typescript
// --- source.types.ts ---

/** Source 配置（持久化到 sources.json） */
export type SourceConfig =
  | { type: "github"; url: string; branch?: string }
  | { type: "local"; path: string };
// 后续扩展: | { type: "http"; url: string } | { type: "npm"; package: string }

/** Source 注册信息 */
export interface SourceEntry {
  name: string;               // package name (命名空间前缀)
  config: SourceConfig;
  syncedAt?: string;          // ISO timestamp
}

/** 包清单 (agentcraft.json) */
export interface PackageManifest {
  name: string;
  version?: string;
  description?: string;
  components?: {
    skills?: string[];        // 文件相对路径
    prompts?: string[];
    mcp?: string[];
    workflows?: string[];
  };
  plugins?: string[];         // plugin 定义文件相对路径
}

// --- plugin.types.ts ---

/** Plugin = 命名组合预设 */
export interface PluginDefinition {
  name: string;
  description?: string;
  skills?: string[];          // 同包内组件名（不带 package@ 前缀）
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
}
```

### core interfaces (packages/core/src/source/)

```typescript
// --- component-source.ts ---

/** 可扩展 Source 接口 — 新增源类型只需实现此接口 */
export interface ComponentSource {
  readonly type: string;
  readonly packageName: string;

  /** 拉取包内容，返回清单 + 已解析的组件 */
  fetch(): Promise<FetchResult>;

  /** 增量/全量重新同步 */
  sync(): Promise<FetchResult>;

  /** 清理本地缓存 */
  dispose(): Promise<void>;
}

export interface FetchResult {
  manifest: PackageManifest;
  skills: SkillDefinition[];
  prompts: PromptDefinition[];
  mcpServers: McpServerDefinition[];
  workflows: WorkflowDefinition[];
  plugins: PluginDefinition[];
}

// --- source-manager.ts ---

export class SourceManager {
  private sources = new Map<string, ComponentSource>();

  /** 注册新源 → fetch → 组件注入各 Manager */
  async addSource(name: string, config: SourceConfig): Promise<void>;

  /** 重新同步指定源 */
  async syncSource(name: string): Promise<void>;

  /** 移除源 → 从各 Manager 删除该 package 下所有组件 */
  async removeSource(name: string): Promise<void>;

  /** 列出已注册源 */
  listSources(): SourceEntry[];

  /** 查找 plugin 定义 */
  getPlugin(packageName: string, pluginName: string): PluginDefinition | undefined;

  /** Apply plugin → 展开为组件引用列表 → 追加到 Template.domainContext */
  applyPlugin(
    packageName: string,
    pluginName: string,
    template: AgentTemplate,
  ): AgentTemplate;
}
```

---

## 五、影响范围

### 新建文件

```
packages/shared/src/types/
  source.types.ts              ← SourceConfig, SourceEntry, PackageManifest
  plugin.types.ts              ← PluginDefinition

packages/core/src/source/
  component-source.ts          ← ComponentSource 接口 + FetchResult
  github-source.ts             ← GitHubSource 实现
  local-source.ts              ← LocalSource 实现
  source-manager.ts            ← SourceManager
  source-manager.test.ts       ← 单元测试
  __fixtures__/                ← 测试用 mock 包

packages/core/src/domain/base-component-manager.ts   [修改] CRUD 增强

packages/api/src/handlers/
  source-handlers.ts           ← source RPC handlers
  plugin-handlers.ts           ← plugin RPC handlers

packages/cli/src/commands/
  source/                      ← source add/remove/sync/list
  plugin/                      ← plugin list/apply
  skill/add.ts, remove.ts, export.ts
  prompt/add.ts, remove.ts, export.ts
  mcp/add.ts, remove.ts, export.ts
  workflow/add.ts, remove.ts, export.ts
```

### 修改文件

```
packages/shared/src/types/index.ts              ← 导出新类型
packages/shared/src/types/rpc.types.ts          ← 新增方法类型 + MethodMap
packages/shared/src/types/domain-context.types.ts  ← (可选) 无需改动，引用格式 package@name 只是字符串
packages/core/src/domain/base-component-manager.ts ← CRUD + persist + search
packages/core/src/domain/index.ts               ← 导出 SourceManager
packages/api/src/services/app-context.ts        ← 注入 SourceManager + setPersistDir
packages/api/src/handlers/domain-handlers.ts    ← 注册 CRUD handlers
packages/api/src/handlers/index.ts              ← 导出新 handlers
packages/cli/src/commands/index.ts              ← 注册 source/plugin 命令
packages/cli/src/commands/skill/index.ts        ← 注册 add/remove/export
packages/cli/src/commands/prompt/index.ts       ← 同上
packages/cli/src/commands/mcp/index.ts          ← 同上
packages/cli/src/commands/workflow/index.ts     ← 同上
packages/cli/src/output/formatter.ts            ← source/plugin 格式化
```

### Risk Assessment

| 风险 | 影响 | 缓解 |
|------|------|------|
| GitHubSource 依赖网络 | 中 | 本地缓存 + LocalSource 用于开发/测试 |
| `package@name` 格式可能与现有模板冲突 | 低 | 无 `@` 的引用保持现有行为 |
| Source sync 失败导致组件缺失 | 中 | 缓存上次成功结果 + 错误日志 |
| Plugin apply 可能导致模板膨胀 | 低 | apply 前显示将添加的组件列表供确认 |
| BaseComponentManager 变更影响 4 个 Manager | 高 | 全部 additive，回归测试 |

---

## 六、CLI 命令总览

```bash
# ---- 组件 CRUD (skill/prompt/mcp/workflow 统一模式) ----
agentcraft skill list                    # 列出全部 (含 source 来源)
agentcraft skill show <name>             # 详情
agentcraft skill add <file>              # 从 JSON 文件添加本地组件
agentcraft skill remove <name>           # 移除
agentcraft skill export <name> [--out]   # 导出为 JSON 文件
# prompt/mcp/workflow 同理

# ---- Source 管理 ----
agentcraft source list                   # 列出已注册源
agentcraft source add <url> --name <pkg> [--type github|local]
agentcraft source remove <pkg>
agentcraft source sync [<pkg>]           # 同步指定源或全部

# ---- Plugin (组合预设) ----
agentcraft plugin list [<pkg>]           # 列出可用 plugin
agentcraft plugin show <pkg@name>        # 查看 plugin 包含的组件
agentcraft plugin apply <pkg@name> <template>  # 一键应用到模板
```

### RPC 方法

```
# 组件 CRUD (×4 组件类型 ×5 操作 = 20 方法)
skill.add / skill.update / skill.remove / skill.import / skill.export
prompt.add / prompt.update / prompt.remove / prompt.import / prompt.export
mcp.add / mcp.update / mcp.remove / mcp.import / mcp.export
workflow.add / workflow.update / workflow.remove / workflow.import / workflow.export

# Source (4 方法)
source.list / source.add / source.remove / source.sync

# Plugin (3 方法)
plugin.list / plugin.show / plugin.apply
```

---

## 七、验收标准

- [ ] 4 个 Manager 统一支持 add/update/remove + JSON 持久化
- [ ] search / filter / importFromFile / exportToFile 可用
- [ ] `ComponentSource` 接口可扩展，GitHubSource + LocalSource 实现
- [ ] SourceManager 完整：addSource / syncSource / removeSource
- [ ] 注册 GitHub 源后，`pkg@name` 组件在 list 中可见
- [ ] PluginDefinition schema 实现
- [ ] `plugin apply pkg@plugin template` 一键添加多个组件到模板
- [ ] MCP 组件管理的是配置描述，非运行时
- [ ] 27 个新 RPC 方法全部可调用
- [ ] CLI 全部新命令可用
- [ ] lint + typecheck + pnpm test:changed 通过
- [ ] api-contracts.md + config-spec.md 更新

---

## 八、后续扩展点

| 方向 | 描述 | 时机 |
|------|------|------|
| HttpSource | 从 HTTP URL 下载 tarball | Phase 3a 后 |
| NpmSource | 从 npm registry 获取 | 长期 |
| RegistrySource | 自建 AgentCraft registry | 长期 |
| Plugin 版本管理 | `package@plugin:1.2.0` | 长期 |
| Plugin 依赖解析 | Plugin A depends on Plugin B | 长期 |
| Security scan | 参考 skill-install 的安全扫描 | Phase 3a 后 |
| UI Dashboard | Source/Plugin 可视化管理 | 有 UI 后 |

---

## 九、相关参考

| 参考 | 路径 |
|------|------|
| BaseComponentManager | `packages/core/src/domain/base-component-manager.ts` |
| SkillManager 范例 | `packages/core/src/domain/skill/skill-manager.ts` |
| domain-handlers.ts | `packages/api/src/handlers/domain-handlers.ts` |
| CLI 命令模式 | `packages/cli/src/commands/skill/` |
| AppContext | `packages/api/src/services/app-context.ts` |
| rpc.types.ts | `packages/shared/src/types/rpc.types.ts` |
| skill-install (模式参考) | `~/.claude/skills/skill-install/SKILL.md` |
| Issue #38 | `.trellis/issues/0038-unified-component-management.json` |
