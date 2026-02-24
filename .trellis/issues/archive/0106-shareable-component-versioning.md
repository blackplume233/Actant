---
id: 106
title: 可共享内容缺少版本控制能力 — 组件/模板/预设的版本管理体系
status: closed
closedAt: "2026-02-22"
labels:
  - feature
  - source
  - domain
  - versioning
  - "priority:P1"
milestone: phase-3
author: human
assignees: []
relatedIssues:
  - 42
  - 102
  - 105
  - 59
relatedFiles:
  - packages/shared/src/types/domain-component.types.ts
  - packages/shared/src/types/source.types.ts
  - packages/shared/src/types/domain-context.types.ts
  - packages/core/src/domain/base-component-manager.ts
  - packages/core/src/source/source-manager.ts
  - packages/core/src/source/component-source.ts
  - packages/core/src/template/registry/template-registry.ts
taskRef: null
githubRef: "blackplume233/Actant#106"
closedAs: null
createdAt: "2026-02-21T23:30:00"
updatedAt: "2026-02-22T03:46:43"
---

**Related Issues**: [[0042-rename-agentcraft-to-actant]], [[0102-input-router-sources]], [[0105-shareable-agent-template-source]], [[0059-create-official-default-source-repo-compatible-with-agent-sk]]
**Related Files**: `packages/shared/src/types/domain-component.types.ts`, `packages/shared/src/types/source.types.ts`, `packages/shared/src/types/domain-context.types.ts`, `packages/core/src/domain/base-component-manager.ts`, `packages/core/src/source/source-manager.ts`, `packages/core/src/source/component-source.ts`, `packages/core/src/template/registry/template-registry.ts`

---

## 问题

当前所有可通过 Source 系统共享的内容（Skill、Prompt、Workflow、McpServer、Plugin、Preset，以及即将加入的 AgentTemplate — 见 #52）**完全没有版本控制能力**。这意味着：

1. **组件定义没有 version 字段** — Skill、Prompt、Workflow、McpServer、Plugin、Preset 的类型定义中都没有 `version`，只有 `name`
2. **无法锁定版本** — 模板引用组件时只能写 `skills: ["code-review"]`，无法表达 `"code-review@^1.0.0"` 这样的版本约束
3. **sync 静默覆盖** — `SourceManager.syncSource()` 会先删除旧组件再注入新的，没有任何版本比较、冲突检测或回滚机制
4. **不可回滚** — 没有历史版本记录，一旦 sync 引入了 breaking change，无法恢复到之前的版本
5. **多版本不可共存** — `BaseComponentManager` 以 `name` 为唯一键（`Map<string, T>`），同名组件只能有一个版本
6. **PresetDefinition 无版本** — Preset 自身也没有版本号，无法区分不同版本的预设
7. **PackageManifest 版本孤立** — `PackageManifest.version` 仅作展示用途，与组件版本无关联

## 现状分析

### 组件类型定义（domain-component.types.ts）

```typescript
// 所有组件定义都缺少 version 字段
export interface SkillDefinition {
  name: string;       // ✅
  description?: string;
  content: string;
  tags?: string[];
  // ❌ 没有 version
}

export interface PromptDefinition {
  name: string;
  content: string;
  variables?: string[];
  // ❌ 没有 version
}

export interface WorkflowDefinition {
  name: string;
  content: string;
  // ❌ 没有 version
}

export interface McpServerDefinition {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  // ❌ 没有 version
}

export interface PluginDefinition {
  name: string;
  type: "npm" | "file" | "config";
  // ❌ 没有 version
}
```

### BaseComponentManager 仅以 name 为键

```typescript
export abstract class BaseComponentManager<T extends NamedComponent> {
  protected readonly components = new Map<string, T>(); // key = name only
  register(component: T): void {
    this.components.set(component.name, component); // 同名直接覆盖
  }
}
```

### SourceManager 无版本感知

```typescript
async syncSource(name: string): Promise<FetchResult> {
  this.removeNamespacedComponents(name);  // 全部删除
  const result = await source.sync();      // 全部重新注入
  this.injectComponents(name, result);     // 无版本比较
}
```

### 模板引用无版本约束

```typescript
export interface DomainContextConfig {
  skills?: string[];       // ["code-review"] — 纯名称，无版本
  prompts?: string[];
  plugins?: string[];
  // ...
}
```

## 提议方案

### 第一层：组件级版本元数据（基础层）

#### 1.1 所有组件定义新增 version 字段

```typescript
export interface VersionedComponent {
  name: string;
  version?: string;  // semver, 可选以保持向后兼容
}

export interface SkillDefinition extends VersionedComponent {
  description?: string;
  content: string;
  tags?: string[];
}

// Prompt, Workflow, McpServer, Plugin, Preset 同理
```

对于没有显式声明 version 的组件，默认视为 `"0.0.0"`（或 `"*"`）。

#### 1.2 PresetDefinition 新增 version

```typescript
export interface PresetDefinition {
  name: string;
  version?: string;  // ✅ 新增
  description?: string;
  skills?: string[];
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
  templates?: string[];  // #52
}
```

### 第二层：版本感知的引用（引用层）

#### 2.1 组件引用支持版本约束

模板和 Preset 引用组件时，支持 `name@versionRange` 语法：

```typescript
// DomainContextConfig 中
skills: [
  "code-review",          // 隐含 @*（任意版本）
  "test-writer@^1.0.0",   // semver range
  "linter@~2.1.0",
]
```

解析工具函数：

```typescript
interface ComponentRef {
  name: string;
  versionRange?: string;  // semver range or undefined (= any)
}

function parseComponentRef(ref: string): ComponentRef {
  const atIdx = ref.lastIndexOf("@");
  if (atIdx > 0) {
    return { name: ref.slice(0, atIdx), versionRange: ref.slice(atIdx + 1) };
  }
  return { name: ref };
}
```

**注意**：需要和 Source 命名空间 `package@name` 的 `@` 区分开。可以使用 `:` 作为版本分隔符（`code-review:^1.0.0`），或者 Source 命名空间用 `/`（`official/code-review@^1.0.0`）。

### 第三层：Source 同步的版本管理（同步层）

#### 3.1 sync 时版本比较与冲突检测

```typescript
async syncSource(name: string): Promise<SyncReport> {
  const oldResult = this.captureCurrentState(name);
  const newResult = await source.sync();
  const report = this.diffVersions(oldResult, newResult);

  if (report.hasBreakingChanges && !options?.force) {
    throw new VersionConflictError(report);
  }

  this.removeNamespacedComponents(name);
  this.injectComponents(name, newResult);
  return report;
}
```

#### 3.2 SyncReport 结构

```typescript
interface SyncReport {
  added: ComponentVersionDelta[];    // 新增的组件
  updated: ComponentVersionDelta[];  // 版本变更的组件
  removed: ComponentVersionDelta[];  // 被删除的组件
  unchanged: string[];               // 未变化的组件
  hasBreakingChanges: boolean;       // 是否有大版本变更
}

interface ComponentVersionDelta {
  type: "skill" | "prompt" | "workflow" | "mcpServer" | "plugin" | "template" | "preset";
  name: string;
  oldVersion?: string;
  newVersion?: string;
}
```

### 第四层：版本锁定与回滚（高级层，可后续实现）

#### 4.1 Lock 文件

类似 `package-lock.json`，在 `~/.actant/sources-lock.json` 中锁定每个组件的精确版本：

```json
{
  "lockVersion": 1,
  "components": {
    "official@code-review": { "type": "skill", "version": "1.2.3", "integrity": "sha256-..." },
    "official@system-prompt": { "type": "prompt", "version": "2.0.0", "integrity": "sha256-..." }
  }
}
```

#### 4.2 版本快照与回滚

每次 sync 前保存快照（snapshot），支持 `actant source rollback <name>` 回退到上一次同步状态。

## 实施优先级

| 优先级 | 内容 | 复杂度 |
|--------|------|--------|
| P0 | 组件定义加 version 字段（向后兼容 optional） | 低 |
| P0 | PresetDefinition 加 version | 低 |
| P1 | SyncReport — sync 时报告变更摘要 | 中 |
| P1 | 组件引用支持版本约束语法 | 中 |
| P2 | BaseComponentManager 版本感知（resolve 时匹配版本范围） | 中 |
| P2 | Lock 文件持久化 | 中 |
| P3 | 版本快照与回滚 | 高 |

## 验收标准

### 基础层（必须）

- [ ] 所有可共享组件类型（Skill, Prompt, Workflow, McpServer, Plugin）新增 `version?: string` 字段
- [ ] PresetDefinition 新增 `version?: string` 字段
- [ ] 未声明 version 的组件向后兼容，默认视为无版本约束
- [ ] 现有 JSON 定义文件和测试不因新增字段而 break

### 引用层（重要）

- [ ] 定义版本约束语法，与 Source 命名空间 `@` 不冲突
- [ ] `parseComponentRef()` 工具函数实现并测试
- [ ] resolve() 方法在有版本约束时进行版本匹配

### 同步层（重要）

- [ ] `syncSource()` 返回 `SyncReport`，包含 added/updated/removed 信息
- [ ] CLI `source sync` 命令展示版本变更摘要
- [ ] 大版本变更时给出警告（可选 --force 跳过）

### 高级层（可后续迭代）

- [ ] Lock 文件生成与读取
- [ ] `source rollback` 命令
