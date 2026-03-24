# Provider Contribution Governance

## 变更摘要

- 冻结 `provider contribution` 的最小 SPI，新增 `mount` / `backend` / `data-source` 三类 contribution 契约，并将 `runtimefs` provider 统一建模为 `data-source` contribution
- `agent-runtime` plugin host 新增 `providers()` 采集路径，明确 provider 只是 `daemon plugin` 的子能力，不再作为顶层扩展模型单独漂移
- `/agents` 与 `/mcp/runtime` 的 runtime provider 改为显式贡献 `kind`、`filesystemType`、`mountPoint` 和 record 访问接口，VFS 侧增加一致性断言并同步更新测试与活文档

## 用户可见影响

- VFS / runtimefs 对外返回的 provider 元数据更加明确，后续挂载与运行时治理可以基于统一 contribution 契约继续收口
- plugin 侧可以显式声明 provider contribution，但 provider 不再承担“中心注册领域内容”的语义

## 破坏性变更/迁移说明

- `AgentRuntimeSourceProvider` 与 `McpRuntimeSourceProvider` 已转为兼容别名；新增正式名称 `AgentRuntimeProviderContribution` 与 `McpRuntimeProviderContribution`
- 现有 runtime provider 夹具和实现需要补齐 `kind`、`filesystemType`、`mountPoint` 与 `listRecords/getRecord` 形态

## 验证结果

- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/shared type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/vfs type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm --filter @actant/agent-runtime type-check`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/agent-runtime/src/plugin/plugin-host.test.ts`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/vfs/src/__tests__/m5-control-stream-e2e.test.ts`
- `PATH="/opt/homebrew/opt/node@22/bin:$PATH" pnpm vitest run --configLoader runner packages/vfs/src/__tests__/m5-filesystem-type-features-e2e.test.ts`
- 已确认 `pnpm --filter @actant/api type-check` 当前失败来自 worktree 缺失 ACP / PI / TUI 外部依赖，不是本主题引入的类型错误

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: #322
