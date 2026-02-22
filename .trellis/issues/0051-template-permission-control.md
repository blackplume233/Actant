---
id: 51
title: AgentTemplate 权限控制 — 对齐 Claude Code permissions 配置结构
status: open
labels:
  - feature
  - template
  - security
  - "priority:P1"
milestone: phase-3
author: cursor-agent
assignees: []
relatedIssues:
  - 36
  - 39
  - 46
  - 50
relatedFiles:
  - packages/core/src/template/schema/template-schema.ts
  - packages/core/src/initializer/context/context-materializer.ts
  - packages/shared/src/types/domain-component.types.ts
  - docs/design/mvp-next-design.md
taskRef: null
githubRef: null
closedAs: null
createdAt: "2026-02-21T22:30:00"
updatedAt: "2026-02-21T22:45:00"
closedAt: null
---

**Related Issues**: [[0036-agent]], [[0039-session-lease-mock-untestable]], [[0046-backend-builder-implementations]], [[0050-employee-scheduler-integration]]
**Related Files**: `packages/core/src/template/schema/template-schema.ts`, `packages/core/src/initializer/context/context-materializer.ts`, `packages/shared/src/types/domain-component.types.ts`, `docs/design/mvp-next-design.md`

---

## 问题

当前 `AgentTemplateSchema` 没有权限控制字段。`ContextMaterializer.materializeClaudePermissions()` 硬编码了一组 allow-list（Bash, Read, Write, Edit, MultiEdit, WebFetch, WebSearch + MCP tools），所有 Agent 无论角色都获得完全一样的权限，模板作者无法做精细控制。

## 设计原则

**直接对齐 Claude Code 原生 `permissions` + `sandbox` 结构**，而非另建一套抽象。好处：
- 模板作者的心智模型与 Claude Code 文档一致
- ContextMaterializer 只需透传/合并，无需复杂映射
- 未来 Claude Code 新增权限特性时兼容性好

## 参考：Claude Code 权限体系

来源: https://code.claude.com/docs/en/permissions

### permissions 对象

```jsonc
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Read", "mcp__puppeteer"],
    "deny":  ["Bash(rm *)", "WebFetch"],
    "ask":   ["Write", "Edit"]
  }
}
```

求值顺序: **deny → ask → allow**，首个匹配规则生效。

### 工具模式语法

| 模式 | 示例 | 效果 |
|------|------|------|
| 仅工具名 | `Bash` | 匹配该工具所有调用 |
| 精确命令 | `Bash(npm run build)` | 精确匹配 |
| 通配符 | `Bash(npm run *)` | glob 模式 |
| 域名限制 | `WebFetch(domain:example.com)` | 限制域名 |
| 文件路径 | `Read(./.env)`, `Edit(/src/**/*.ts)` | gitignore 风格路径 |
| MCP 工具 | `mcp__server__tool`, `mcp__server` | MCP 服务器工具 |
| Sub-Agent | `Task(Plan)`, `Task(Explore)` | 控制子 Agent |
| 全部 | `*` | 匹配所有 |

### defaultMode

| 模式 | 说明 |
|------|------|
| `default` | 首次使用时提示 |
| `acceptEdits` | 自动接受文件编辑 |
| `plan` | 只读分析模式 |
| `dontAsk` | 除 allow 外自动拒绝 |
| `bypassPermissions` | 跳过所有权限检查（仅限隔离环境） |

### sandbox 对象（Bash 级 OS 隔离）

```jsonc
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": false,
    "network": {
      "allowedDomains": ["github.com", "npmjs.org"],
      "allowLocalBinding": false
    }
  }
}
```

### additionalDirectories

扩展 Agent 的工作目录访问范围。

## 提议 Schema

### 1. AgentTemplateSchema 新增 `permissions` 字段

```typescript
const PermissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);

const SandboxNetworkSchema = z.object({
  allowedDomains: z.array(z.string()).optional(),
  allowLocalBinding: z.boolean().optional(),
}).optional();

const SandboxSchema = z.object({
  enabled: z.boolean().default(false),
  autoAllowBashIfSandboxed: z.boolean().default(false),
  network: SandboxNetworkSchema,
}).optional();

const PermissionsSchema = z.object({
  // 核心: allow / deny / ask — Claude Code 原生格式
  allow: z.array(z.string()).optional(),
  deny:  z.array(z.string()).optional(),
  ask:   z.array(z.string()).optional(),

  // 权限模式
  defaultMode: PermissionModeSchema.optional(),

  // Bash 沙箱
  sandbox: SandboxSchema,

  // 额外工作目录
  additionalDirectories: z.array(z.string()).optional(),
}).optional();

// AgentTemplateSchema 新增
const AgentTemplateSchema = z.object({
  name, version, description,
  backend,
  provider,
  domainContext,
  initializer,
  permissions: PermissionsSchema,    // ← 新增
  metadata,
});
```

### 2. 预设（preset）— 语法糖

常用场景提供预设，减少样板：

```typescript
const PermissionsWithPresetSchema = z.union([
  // 字符串引用预设
  z.enum(["permissive", "standard", "restricted", "readonly"]),
  // 完整对象
  PermissionsSchema,
]);
```

预设定义：

| 预设 | allow | deny | ask | defaultMode |
|------|-------|------|-----|-------------|
| `permissive` | `["*"]` | `[]` | `[]` | `bypassPermissions` |
| `standard` | `["Read", "Edit", "Write", "Bash(npm run *)", "Bash(git *)", "WebFetch", "WebSearch"]` | `[]` | `["Bash"]` | `default` |
| `restricted` | `["Read", "WebSearch"]` | `["Bash", "WebFetch"]` | `["Edit", "Write"]` | `dontAsk` |
| `readonly` | `["Read", "WebFetch", "WebSearch"]` | `["Bash", "Edit", "Write", "MultiEdit"]` | `[]` | `plan` |

### 3. ContextMaterializer 改造

```typescript
async materializePermissions(
  workspaceDir: string,
  permissions: PermissionsInput | undefined,
  mcpServers: McpServerRef[],
  backendType: AgentBackendType,
): Promise<void> {
  // 1. 解析 preset → 完整 permissions 对象
  const resolved = resolvePreset(permissions);

  // 2. 自动追加 MCP 工具到 allow（如果 allow 中没有 '*'）
  if (!resolved.allow?.includes('*')) {
    for (const server of mcpServers) {
      resolved.allow ??= [];
      resolved.allow.push(`mcp__${server.name}`);
    }
  }

  // 3. 按后端类型物化
  if (backendType === 'claude-code') {
    // 直接写入 .claude/settings.local.json — 结构天然对齐
    const settings = {
      permissions: {
        allow: resolved.allow ?? [],
        deny:  resolved.deny ?? [],
        ...(resolved.ask ? { ask: resolved.ask } : {}),
      },
      ...(resolved.sandbox ? { sandbox: resolved.sandbox } : {}),
    };
    await writeFile(join(configDir, 'settings.local.json'), JSON.stringify(settings, null, 2));
  } else if (backendType === 'cursor') {
    // Cursor 不支持完全相同的格式，做最佳映射
    // ...
  }
}
```

### 4. 未设置 permissions 时的默认行为

向后兼容：当模板不包含 `permissions` 字段时，行为等同于当前硬编码逻辑（`permissive` 预设 + MCP 工具自动追加）。

## 模板示例

### 全权限 Agent（当前默认行为）

```yaml
permissions: "permissive"
```

### 代码审查 Agent（只读）

```yaml
permissions: "readonly"
```

### 定制权限

```yaml
permissions:
  allow:
    - Read
    - "Bash(npm run test *)"
    - "Bash(npm run lint *)"
    - "Bash(git diff *)"
    - "WebFetch(domain:github.com)"
    - "WebFetch(domain:npmjs.org)"
  deny:
    - "Bash(rm *)"
    - "Bash(git push *)"
  ask:
    - Write
    - Edit
  defaultMode: default
  sandbox:
    enabled: true
    network:
      allowedDomains:
        - github.com
        - npmjs.org
```

## 验收标准

- [ ] AgentTemplateSchema 新增 `permissions` 字段（支持 preset 字符串或完整对象）
- [ ] Zod schema 校验通过，支持 Claude Code 所有工具模式语法
- [ ] ContextMaterializer 根据 permissions 动态生成配置，不再硬编码
- [ ] 未设置 permissions 时向后兼容（等同 `permissive`）
- [ ] 预设解析正确（permissive / standard / restricted / readonly）
- [ ] Claude Code 后端: 直接映射到 `.claude/settings.local.json`
- [ ] Cursor 后端: 做最佳适配映射
- [ ] 关联 #36 的实例级覆盖与审计需求
- [ ] 单元测试覆盖各 preset + 自定义 permissions
- [ ] 更新模板示例文档

---

## Comments

### cursor-agent — unknown
