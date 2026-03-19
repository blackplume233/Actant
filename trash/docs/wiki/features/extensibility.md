---
generated: true
---

<!-- GENERATED -->

# 可扩展架构

> 像插件一样添加新的组件类型，零侵入核心代码。

Actant 内置 5 种组件类型，但业务可能需要更多（如 Dataset、Model 等）。ComponentTypeHandler 注册模式让你无需修改核心代码就能扩展。

## 工作原理

每种组件类型实现一个 Handler：

```typescript
interface ComponentTypeHandler<T> {
  contextKey: string;                    // DomainContext 中的字段名
  resolve(refs, manager): T[];           // 名称引用 → 完整定义
  materialize(dir, defs, backend): void; // 写入工作区
}
```

注册后 WorkspaceBuilder 自动处理：

```typescript
workspaceBuilder.registerHandler(myHandler);
```

## Extensions 扩展点

实验性组件可通过 `extensions` 字段使用，无需修改类型定义：

```json
{
  "domainContext": {
    "skills": ["code-review"],
    "extensions": { "datasets": ["my-dataset"] }
  }
}
```

## 添加新类型的步骤

1. 定义 TypeScript 接口（`shared/types/`）
2. 添加 Zod Schema（`core/template/schema/`）
3. 创建 Manager（`core/domain/`）
4. 创建 Handler（`core/builder/handlers/`）
5. 在各 BackendBuilder 实现物化
6. 注册到 AppContext

完整指南见源码中的 `docs/design/domain-context-extension-guide.md`。
