---
id: 52
title: AgentTemplate 应当可通过 Source 分享，Preset 中也应包含 AgentTemplate
status: open
labels:
  - feature
  - source
  - template
  - "priority:P1"
milestone: phase-3
author: human
assignees: []
relatedIssues:
  - 38
  - 49
  - 51
  - 59
relatedFiles:
  - packages/core/src/source/component-source.ts
  - packages/core/src/source/source-manager.ts
  - packages/core/src/source/local-source.ts
  - packages/core/src/source/github-source.ts
  - packages/shared/src/types/source.types.ts
  - packages/shared/src/types/template.types.ts
  - packages/core/src/template/registry/template-registry.ts
taskRef: null
githubRef: "blackplume233/Actant#105"
closedAs: null
createdAt: "2026-02-21T23:15:00"
updatedAt: "2026-02-22T03:46:42"
closedAt: null
---

**Related Issues**: [[0038-rename-agentcraft-to-actant]], [[0049-input-router-sources]], [[0051-template-permission-control]], [[0059-create-official-default-source-repo-compatible-with-agent-sk]]
**Related Files**: `packages/core/src/source/component-source.ts`, `packages/core/src/source/source-manager.ts`, `packages/core/src/source/local-source.ts`, `packages/core/src/source/github-source.ts`, `packages/shared/src/types/source.types.ts`, `packages/shared/src/types/template.types.ts`, `packages/core/src/template/registry/template-registry.ts`

---

## 问题

当前 Source 系统（GitHub / Local 等）可以同步和分享 Skill、Prompt、McpServer、Workflow 四种组件，以及 Preset 组合包。但 **AgentTemplate 本身不在可分享组件之列**，这是一个重大遗漏。

AgentTemplate 是 Actant 的核心产物 — 它定义了一个完整的 Agent 配置。用户理应能够：
1. 将自己编写的 AgentTemplate 发布到 Source（GitHub 仓库或本地包）
2. 从他人的 Source 安装 AgentTemplate 到本地 TemplateRegistry
3. 在 Preset 中引用 AgentTemplate，实现 "一键获得完整 Agent 配置包"

## 现状分析

### FetchResult（component-source.ts）

```typescript
export interface FetchResult {
  manifest: PackageManifest;
  skills: SkillDefinition[];
  prompts: PromptDefinition[];
  mcpServers: McpServerDefinition[];
  workflows: WorkflowDefinition[];
  presets: PresetDefinition[];
  // ❌ 没有 templates
}
```

### PackageManifest（source.types.ts）

```typescript
export interface PackageManifest {
  name: string;
  components?: {
    skills?: string[];
    prompts?: string[];
    mcp?: string[];
    workflows?: string[];
    // ❌ 没有 templates
  };
  presets?: string[];
}
```

### PresetDefinition（source.types.ts）

```typescript
export interface PresetDefinition {
  name: string;
  description?: string;
  skills?: string[];
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
  // ❌ 没有 templates
}
```

### SourceManagerDeps（source-manager.ts）

```typescript
export interface SourceManagerDeps {
  skillManager: BaseComponentManager<SkillDefinition>;
  promptManager: BaseComponentManager<PromptDefinition>;
  mcpConfigManager: BaseComponentManager<McpServerDefinition>;
  workflowManager: BaseComponentManager<WorkflowDefinition>;
  // ❌ 没有 templateRegistry
}
```

## 提议方案

### 1. FetchResult 新增 templates 字段

```typescript
export interface FetchResult {
  manifest: PackageManifest;
  skills: SkillDefinition[];
  prompts: PromptDefinition[];
  mcpServers: McpServerDefinition[];
  workflows: WorkflowDefinition[];
  presets: PresetDefinition[];
  templates: AgentTemplate[];       // ✅ 新增
}
```

### 2. PackageManifest.components 新增 templates

```typescript
export interface PackageManifest {
  name: string;
  components?: {
    skills?: string[];
    prompts?: string[];
    mcp?: string[];
    workflows?: string[];
    templates?: string[];           // ✅ 新增
  };
  presets?: string[];
}
```

### 3. PresetDefinition 新增 templates 字段

```typescript
export interface PresetDefinition {
  name: string;
  description?: string;
  skills?: string[];
  prompts?: string[];
  mcpServers?: string[];
  workflows?: string[];
  templates?: string[];             // ✅ 新增
}
```

### 4. SourceManagerDeps 新增 templateRegistry

```typescript
export interface SourceManagerDeps {
  skillManager: BaseComponentManager<SkillDefinition>;
  promptManager: BaseComponentManager<PromptDefinition>;
  mcpConfigManager: BaseComponentManager<McpServerDefinition>;
  workflowManager: BaseComponentManager<WorkflowDefinition>;
  templateRegistry: TemplateRegistry; // ✅ 新增
}
```

### 5. SourceManager 注入逻辑扩展

`injectComponents()` 和 `removeNamespacedComponents()` 需要处理 templates，将远程模板以 `package@name` 命名空间注入到 TemplateRegistry。

### 6. LocalSource / GitHubSource 加载 templates/ 目录

在 Source 目录结构中新增 `templates/` 目录，Source 实现类需扫描并加载其中的 `.json` 模板定义文件。

### 7. applyPreset 扩展

`applyPreset()` 当前只展开 skills/prompts/mcpServers/workflows 引用。如果 preset 包含 templates，应将模板注册到本地 TemplateRegistry（而非展开到某个模板的 domainContext 中 — 因为 template 是独立的顶层实体）。

可考虑新增 `installPreset()` 方法区别于 `applyPreset()`：
- `applyPreset(presetName, templateName)` — 将 preset 中的组件（skills/prompts 等）合并到已有模板
- `installPreset(presetName)` — 安装 preset 中的所有模板到本地，同时安装依赖组件

### 8. CLI / RPC 扩展

```bash
# 列出 Source 中的模板
actant source templates <sourceName>

# 从 Source 安装模板
actant template install <package>@<templateName>

# 导出模板为可分享格式
actant template export <name> [--out]
```

## 目录结构示例

```
my-agent-package/
├── actant.json          # PackageManifest
├── skills/
│   ├── code-review.md
│   └── test-writer.md
├── prompts/
│   └── system-prompt.md
├── templates/               # ✅ 新增
│   ├── code-reviewer.json   # AgentTemplate
│   └── test-engineer.json   # AgentTemplate
└── presets/
    └── full-dev-suite.json  # 包含 templates 引用
```

## 验收标准

- [ ] `FetchResult` 新增 `templates: AgentTemplate[]` 字段
- [ ] `PackageManifest.components` 新增 `templates?: string[]`
- [ ] `PresetDefinition` 新增 `templates?: string[]` 字段
- [ ] `SourceManagerDeps` 包含 `templateRegistry`
- [ ] `SourceManager.injectComponents()` 将远程模板注入 TemplateRegistry
- [ ] `SourceManager.removeNamespacedComponents()` 处理模板清除
- [ ] `LocalSource` / `GitHubSource` 可扫描加载 `templates/` 目录
- [ ] Preset 安装可将模板注册到本地
- [ ] 至少 1 个示例 Source 包含可分享的 AgentTemplate
- [ ] 相关单元测试覆盖
- [ ] CLI 支持从 Source 安装模板
