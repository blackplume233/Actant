## 测试发现

**场景**: /qa-loop explore — hub agent 生命周期验证
**步骤**: agent create with hub template

## 复现方式

```bash
export ACTANT_HOME=$(mktemp -d)
actant daemon start --foreground
actant source sync
actant template list  # shows actant-hub@code-reviewer
actant agent create reviewer-1 -t "actant-hub@code-reviewer"
# ERROR: [RPC -32006] Skill "code-review" not found in registry
```

## 期望行为

`actant agent create` 应成功创建 agent，WorkspaceBuilder 能解析 hub 模板中的 domainContext 引用。

## 实际行为

```
[RPC -32006] Skill "code-review" not found in registry
Context: {"componentType":"Skill","componentName":"code-review"}
```

Skills 注册为 `actant-hub@code-review`（带 source 前缀），但模板 domainContext.skills 引用 `code-review`（不带前缀）。

## 分析

**根因**: `source-manager.ts:injectComponents()` 在注册模板时，只给 `template.name` 加了 `packageName@` 前缀，没有同步更新 `template.domainContext.skills`/`prompts`/`workflow` 中的组件引用。

**修复方案**: 在创建 nsTemplate 时，同时给 domainContext 中不含 `@` 的引用添加 `packageName@` 前缀。
