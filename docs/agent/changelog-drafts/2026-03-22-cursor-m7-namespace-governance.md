# M7 Namespace Governance

## 变更摘要

- 将活跃实现和活跃文档统一到 Linux 语义，收敛为 `mount namespace` / `mount table` / `filesystem type` / `mount instance` / `node type`
- 将旧 `source` 双关语拆开：
  VFS / 挂载语义改为 `mount` / `filesystem`
  外部组件仓库语义改为 `catalog`
- 将默认配置入口切换为 `actant.namespace.json`，运行时不再静默回退 `actant.project.json`
- 在 standalone / hub / MCP 路径中补齐 namespace root projection、`/project/context.json`、`/_project.json`、child namespace 子树与 `runtimefs` 子树
- 清理 active truth / CLI help / example 中的旧入口与旧命令文案，并新增 terminology gate 防止回流

## 用户可见影响

- 默认且唯一运行时配置入口是 `actant.namespace.json`
- CLI / RPC / MCP 的活跃说明改为 `catalog`、`filesystem type`、`node type` 等新术语
- standalone kernel 现在可以在无 daemon 场景下直接读取 `hostfs` / `memfs` / `runtimefs` 投影
- `/project/context.json`、`/_project.json` 与 `/projects/<child>` 的 namespace 视图在 standalone 与 hub 中保持一致
- 示例仓库 `examples/project-context-discovery` 已切到 namespace 配置入口

## 破坏性变更/迁移说明

- 运行时默认加载器不再回退读取 `actant.project.json`
- 旧 `source.*` CLI / RPC 命名已经让位给 `catalog.*`
- 旧 `SourceTypeRegistry` / `SourceConfig` / `ProjectSourceEntry` 等活跃主类型已迁到 namespace / filesystem / catalog 语义
- 仍持有旧配置的仓库需要先执行显式迁移，再进入新的运行时加载路径
- 若外部脚本依赖旧帮助文案或旧字段名，应迁移到 `mount point`、`mount type`、`filesystem type`、`node type`、`catalog`

## 验证结果

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- `git diff --name-only -z -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | xargs -0 rg -n 'console\\.log\\(' --`
- `git diff -U0 -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | rg -n '^\\+.*console\\.log\\('`
- `git diff -U0 -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | rg -n --pcre2 '^\\+.*(:\\s*any\\b|<any>|as any\\b)'`
- `git diff -U0 -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | rg -n --pcre2 '^\\+.*(?<![=!<>])\\b[A-Za-z_$][A-Za-z0-9_$\\.\\]\\)]*!([\\.?\\[\\)\\],;:]|\\s*$)'`
- `pnpm vitest run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts packages/cli/src/commands/__tests__/commands.test.ts packages/mcp-server/src/context-backend.test.ts`
- 结果：`lint` / `type-check` / `test` 全部通过；新增行模式扫描未发现 `console.log`、TypeScript `any` 或非空断言；terminology gate 通过

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: pending
