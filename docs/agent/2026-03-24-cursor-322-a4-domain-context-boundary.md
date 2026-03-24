# #322 A4 Domain-Context Boundary Baseline

> Date: 2026-03-24
> Scope: `packages/domain-context`
> Purpose: 形成 `keep / migrate / delete` 清单，为后续 A4 / A5 / 主题 7 收口提供真相源
> Historical boundary note: 当前执行状态以 roadmap 为准；本文件保留为阶段性边界分析记录。

## Conclusion

`domain-context` 后续不应继续被描述为系统中心层。

当前建议边界：

- `keep`: parser / schema / validator / loader / renderer-adjacent helper / permission compilation / version sync helper
- `migrate`: 仍被上层当“跨包管理器合同”使用的 manager / registry / watcher 能力
- `delete`: 继续把 `domain-context` 当系统状态中心、把 manager 直接公开成活跃平台边界的兼容出口

## Keep

这些能力仍然符合“文件优先 / 解释在消费侧”的定位，后续继续保留在 `domain-context`：

- `schemas/*`
  - `instance-schemas.ts`
  - `schedule-config.ts`
- `template/schema/*`
  - `template-schema.ts`
  - `config-validators.ts`
- `template/loader/template-loader.ts`
- `permissions/*`
  - `permission-presets.ts`
  - `permission-policy-enforcer.ts`
  - `permission-audit.ts`
- `provider/*`
  - `model-provider-registry.ts`
  - `builtin-providers.ts`
  - `provider-env-resolver.ts`
- `version/*`
  - `component-ref.ts`
  - `sync-report.ts`

判断依据：

- 这些模块主要处理 schema、解析、校验、策略或版本同步
- 它们不需要成为 VFS 真相源
- 它们可以继续作为 `agent-runtime` 或 `api` 的底层依赖存在

## Migrate

这些能力当前还能工作，但不应继续作为跨包中心合同；后续需要继续收口：

- `domain/base-component-manager.ts`
- `domain/skill/skill-manager.ts`
- `domain/prompt/prompt-manager.ts`
- `domain/mcp/mcp-config-manager.ts`
- `domain/workflow/workflow-manager.ts`
- `domain/plugin/plugin-manager.ts`
- `template/registry/template-registry.ts`
- `template/watcher/template-file-watcher.ts`

迁移方向：

- `BaseComponentManager`
  - 从“跨包公共抽象”降级为包内实现细节，后续优先被最小 collection 接口替代
- concrete managers
  - 继续允许在 `api` / `project-context` 内做本地 mutable collection
  - 不再通过 `@actant/agent-runtime` 根导出成为活跃平台边界
- `TemplateRegistry`
  - 继续服务模板加载与本地工作区写路径
  - 但不应再成为系统中心注册表
- `TemplateFileWatcher`
  - 继续保留为模板目录 watcher
  - 后续应评估迁到更贴近 `api` / namespace authoring 的层，而不是继续当 `domain-context` 的长期核心

## Delete

下面这些做法应被视为待删除的 legacy 行为，而不是可继续扩展的方向：

- `@actant/agent-runtime` 根导出继续转发 `domain-context` manager/template 对象
- 把 `BaseComponentManager` 当跨包标准合同类型
- 让 `domain-context` manager 成为“先注册内容、再投影回 VFS”的中心真相源
- 让 watcher / registry 继续定义系统运行时边界

## Implemented In This Round

本轮已完成的边界收口：

- `@actant/agent-runtime` 根导出已移除 `./domain/index` 与 `./template/index`
- `packages/api/src/handlers/domain-handlers.ts` 已不再通过 `@actant/agent-runtime` 依赖 `BaseComponentManager`
- `packages/agent-runtime/src/builder/*` 已开始从 `BaseComponentManager` 收口到最小 `ResolvableComponentCollection` 合同

## Next Cuts

- 把 `workspace-builder` / `domain-handlers` 之外剩余的 `BaseComponentManager` 跨包合同点继续替换为最小接口
- 明确 `TemplateRegistry` 与 `TemplateFileWatcher` 的长期归属层
- 为活跃 public export 增加 gate，阻止 `BaseComponentManager` / concrete managers 从 `@actant/agent-runtime` 回流
