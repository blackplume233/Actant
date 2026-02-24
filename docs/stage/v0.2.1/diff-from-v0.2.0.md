# Version Diff: v0.2.0 → v0.2.1

> 生成时间: 2026-02-24T08:33:45.935Z

---

## 1. RPC 方法变更

### 新增方法

- **`source.validate`** — Params: `SourceValidateParams`, Result: `SourceValidateResult`

## 2. RPC 类型字段变更

### 新增 Params 类型

- `SourceValidateParams`

### 新增 Result 类型

- `SourceValidateResult`

## 3. CLI 命令变更

### 新增命令

- `actant source validate` — Validate all assets in a component source

## 4. 错误码变更

_无变更_

---

## 5. Zod Schema 变更

### template

- ⚠️ ➖ ~~`ModelProviderSchema`~~
#### `AgentTemplateSchema`
- 🔄 `provider`: `ModelProviderSchema` → `ModelProviderSchema.optional()`

### instanceMeta

#### `AgentInstanceMetaSchema`
- ➕ `providerConfig: ModelProviderConfigSchema.optional()`

## 6. TypeScript 接口变更

### agent

#### `AgentInstanceMeta`
- ➕ `SECURITY: Never contains apiKey — secrets stay in ~/.actant/config.json * and are resolved at runtime from the in-memory registry. */ providerConfig?: ModelProviderConfig`

### template

- ➕ `ModelApiProtocol`
- ➕ `ModelProviderDescriptor`
#### `ModelProviderConfig`
- 🔄 `type`: `ModelProviderType` → `string`
- 🔄 `protocol`: `"http" | "websocket" | "grpc"` → `ModelApiProtocol`

---

## 变更摘要

本次版本升级 (v0.2.0 → v0.2.1) 包含对外接口或配置结构变更，请仔细审查上述标记为 ⚠️ 的 breaking change。
