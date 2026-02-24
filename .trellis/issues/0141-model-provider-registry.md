---
id: 141
title: "RFC: ModelProvider registry - extensible provider system"
status: open
labels:
  - rfc
  - architecture
  - core
  - "priority:P2"
milestone: null
author: human
assignees: []
relatedIssues:
  - 133
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/template/schema/template-schema.ts
  - packages/core/src/template/schema/config-validators.ts
  - packages/cli/src/commands/setup/steps/configure-provider.ts
  - packages/core/src/manager/agent-manager.ts
  - packages/core/src/manager/launcher/backend-registry.ts
  - packages/core/src/manager/launcher/builtin-backends.ts
  - packages/api/src/services/app-context.ts
  - packages/pi/src/acp-bridge.ts
  - .trellis/spec/config-spec.md
taskRef: null
githubRef: "blackplume233/Actant#141"
closedAs: null
createdAt: 2026-02-24T19:00:00
updatedAt: 2026-02-25T14:00:00
closedAt: null
---

**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/template/schema/template-schema.ts`, `packages/core/src/template/schema/config-validators.ts`, `packages/cli/src/commands/setup/steps/configure-provider.ts`, `.trellis/spec/config-spec.md`

---

## 背景

当前 `ModelProviderType` 是一个硬编码的 TypeScript 联合类型（enum-like），每新增一个 Provider（如 Groq、OpenRouter、Mistral、Cohere 等），都需要修改核心类型定义、Zod schema、CLI setup 向导、默认协议映射等多处代码。不符合开放-封闭原则。

## 参考

[opencode](https://github.com/opencode-ai/opencode) 采用 Provider Registry 模式：内置 Provider 通过注册函数注册到 registry，每个 Provider 实现标准接口（baseUrl、auth、models、protocol），新 Provider 可通过配置或插件注册，无需修改核心代码。

## 核心架构：默认 Provider vs 注册 Provider

Provider 存在两个层次，职责不同：

### 默认 Provider（Setup 配置）

- **职责**：全局默认，Daemon 和所有未显式指定 Provider 的 Agent 使用它
- **配置位置**：`~/.actant/config.json` → `provider` 字段
- **配置方式**：`actant setup` 向导中的 Step 2（配置 Model Provider）
- **数量**：全局唯一
- **行为**：Setup 完成后自动注册到 Registry，供 Template 引用
- **类比**：`git config --global user.name` — 全局默认值

### 注册 Provider（Provider Registry）

- **职责**：Provider 注册表，供 Template 的 `provider.type` 字段引用
- **来源**：内置 Provider + 默认 Provider（自动注册）+ 用户手动注册
- **配置位置**：`~/.actant/config.json` → `providers` 字段（复数）
- **数量**：多个并存
- **行为**：Template 通过 `provider.type` 按名称引用已注册的 Provider
- **类比**：`git remote` — 可以有多个，但有一个是 origin

### 数据流

```
actant setup (Step 2)
  → config.provider (默认 Provider，全局唯一)
  → 自动注册到 Registry

config.providers (用户手动注册)
  → 注册到 Registry

内置 Provider (anthropic, openai, deepseek, ...)
  → 注册到 Registry

Template.provider.type = "groq"
  → Registry.get("groq")
  → 获取 protocol / baseUrl / 认证方式

Template.provider.type 未指定
  → 使用 config.provider (默认 Provider)
```

## 方案

1. 定义 `ModelProviderDescriptor` 接口（type、displayName、protocol、defaultBaseUrl、models、validateConnection）
2. 实现 `ModelProviderRegistry`（register/get/list/has/getDefault）
3. 内置 Provider 在 core 初始化时注册
4. `actant setup` 的默认 Provider 自动注册到 Registry
5. 用户自定义 Provider 通过 `~/.actant/config.json` 的 `providers`（复数）字段注册
6. Zod schema 的 `type` 字段改为 `z.string()` + registry 语义校验
7. Template 的 `provider` 字段可省略，省略时使用默认 Provider

## 验收标准

- [ ] 内置 Provider 通过 registry 注册，行为与当前一致
- [ ] Setup 配置的默认 Provider 自动注册到 Registry
- [ ] 用户可通过 `config.providers` 注册额外 Provider，无需修改源码
- [ ] CLI setup 向导动态展示所有已注册 Provider
- [ ] Template 的 `provider.type` 接受任意已注册 Provider
- [ ] Template 省略 `provider` 时使用默认 Provider
- [ ] 未注册的 `provider.type` 产生 validation warning（非 error，允许降级到 custom）

---

## Comments

### human — 2026-02-24T22:00:00

Setup 的 Model Provider 和后续注册的 Provider 有区别：前者主要为了让默认后端使用，后者主要供后续 Template 选择。Setup 配置的 Provider 也应自动注册给其他 Template 使用。

### cursor-agent — 2026-02-25T14:00:00

#### Phase 2: 后端感知的 Provider 环境变量注入（`BackendDescriptor.buildProviderEnv`）

**问题**：当前 `buildProviderEnv()` 只生成 `ACTANT_*` 统一环境变量。但不同后端的 ACP 子进程期望的环境变量完全不同：

| 后端 | 期望的环境变量 | 我们能控制 bridge 吗？ |
|------|---------------|----------------------|
| Pi | `ACTANT_PROVIDER`、`ACTANT_MODEL`、`ACTANT_API_KEY`、`ACTANT_BASE_URL` | 能（自有 bridge） |
| Claude Code | `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL` | 不能（第三方二进制 `claude-agent-acp`） |
| Cursor Agent | Cursor 内部机制 | 不能（第三方程序） |

**现状缺口**：如果用户在 `config.json` 或模板中配了 `apiKey`，`buildProviderEnv` 只写成 `ACTANT_API_KEY`，`claude-agent-acp` 根本读不到。用户必须在系统环境里手动设好 `ANTHROPIC_API_KEY` 才能用。

**ACP 协议层面**：ACP 提供了 `SessionConfigOption`（category: `model` / `thinking_level`），可用于协议层面动态切换 model 和 thinking level，但不覆盖 API Key 等凭证。API Key 只能通过 spawn 时的环境变量传递。

**方案**：在 `BackendDescriptor` 上增加可选的 `buildProviderEnv` 策略函数，让每个后端自描述其所需的环境变量映射：

```typescript
export interface BackendDescriptor {
  // ...existing fields...

  /**
   * Convert provider config + backend config into env vars for this backend's subprocess.
   * Each backend knows which native env vars its process expects.
   * When omitted, AgentManager falls back to default ACTANT_* mapping.
   */
  buildProviderEnv?: (
    providerConfig: ModelProviderConfig,
    backendConfig?: Record<string, unknown>,
  ) => Record<string, string>;
}
```

各后端在注册时自带映射逻辑，AgentManager 查表调用，不再硬编码 `if/else`。

**TODO**：

- [ ] `BackendDescriptor` 增加 `buildProviderEnv?` 字段（`packages/shared/src/types/template.types.ts`）
- [ ] Pi 后端注册时提供 `buildProviderEnv`：映射 `ACTANT_*`（`packages/api/src/services/app-context.ts`）
- [ ] Claude Code 内置注册时提供 `buildProviderEnv`：映射 `ANTHROPIC_API_KEY` 等原生变量（`packages/core/src/manager/launcher/builtin-backends.ts`）
- [ ] `AgentManager.startAgent()` 中改用 `descriptor.buildProviderEnv ?? buildDefaultProviderEnv` 替代当前的 `buildProviderEnv()`
- [ ] 考虑 `ModelProviderDescriptor` 上增加 `nativeEnv?: { apiKey?: string; baseUrl?: string }` 供通用 fallback 使用
- [ ] Pi bridge 增加 `ACTANT_BASE_URL` 消费、`ACTANT_MODEL` 的 `buildProviderEnv` 注入
- [ ] 可选：Pi bridge 实现 ACP `SessionConfigOption`（model / thinking_level），支持会话中动态切换
- [ ] 更新 config-spec.md 中的环境变量约定文档
- [ ] 单元测试覆盖各后端的 `buildProviderEnv` 输出
