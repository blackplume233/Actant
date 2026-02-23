---
id: 133
title: "Actant: support reading environment variables as default provider configuration"
status: open
labels:
  - enhancement
  - "priority:P2"
  - core
milestone: null
author: human
assignees: []
relatedIssues: []
relatedFiles:
  - packages/shared/src/types/template.types.ts
  - packages/core/src/initializer/context/context-materializer.ts
  - packages/core/src/template/schema/template-schema.ts
taskRef: null
githubRef: "blackplume233/Actant#133"
closedAs: null
createdAt: 2026-02-23T00:00:00
updatedAt: 2026-02-23T00:00:00
closedAt: null
---

**Related Files**: `packages/shared/src/types/template.types.ts`, `packages/core/src/initializer/context/context-materializer.ts`, `packages/core/src/template/schema/template-schema.ts`

---

## 目标

Actant 的模板 `provider` 字段目前需要在模板文件中硬编码配置（type / baseUrl / config）。应支持从环境变量中读取默认 provider 配置，降低模板中泄露敏感信息的风险，同时简化多环境切换。

## 背景

当前 `ModelProviderConfig` 结构：

```typescript
interface ModelProviderConfig {
  type: ModelProviderType;       // 'anthropic' | 'openai' | 'openai-compatible' | 'custom'
  protocol?: 'http' | 'websocket' | 'grpc';
  baseUrl?: string;
  config?: Record<string, unknown>;
}
```

用户通常需要在模板 JSON/YAML 中写死 `baseUrl` 和 API key（通过 config），这在多环境（开发/测试/生产）切换时不够灵活，也容易因模板文件被 commit 而泄露密钥。

## 方案

1. **环境变量映射约定**：定义一组标准环境变量名，actant 在解析 provider 配置时按优先级读取：
   - `ACTANT_PROVIDER_TYPE` → provider.type
   - `ACTANT_PROVIDER_BASE_URL` → provider.baseUrl
   - `ACTANT_PROVIDER_PROTOCOL` → provider.protocol
   - 同时兼容上游习惯：`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`OPENAI_BASE_URL` 等

2. **优先级**：模板显式配置 > 环境变量 > 内置默认值

3. **实现位置**：在 `context-materializer.ts` 或 provider 解析阶段，增加 env fallback 逻辑

4. **安全提示**：文档中标注不要将 API key 写入模板文件，推荐使用 `.env` + gitignore 或系统环境变量

## 验收标准

- [ ] 支持从 `ACTANT_PROVIDER_TYPE` / `ACTANT_PROVIDER_BASE_URL` 等环境变量读取默认 provider 配置
- [ ] 兼容 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` 等上游习惯变量名
- [ ] 模板中显式指定的值优先于环境变量
- [ ] 未设置环境变量且模板未配置时，给出清晰的错误提示
- [ ] 相关文档更新
