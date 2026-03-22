# M7 Namespace Governance

## 变更摘要

- 将活跃真相源统一到 Linux 语义，新增 `docs/design/contextfs-v1-linux-terminology.md`，并重写 spec / design / planning 入口文档
- 将 M7 重新定义为 `Mount Namespace 配置面 + Filesystem Type 闭环`，新增 `docs/planning/workspace-normalization-todo.md` 与 `.trellis/tasks/m7-namespace-governance/` 作为治理与执行入口
- 在共享类型、VFS、API、CLI、MCP backend 中补齐 `mountType`、`filesystemType`、`nodeType`、`tags` 等公共输出字段
- 将默认配置入口切换为 `actant.namespace.json`，并保留 `actant.project.json` 兼容输入
- 同步治理 `.claude/commands/trellis/*` 与 `.cursor/commands/*` 的活跃交付命令，避免旧 `Source` / `Prompt` 术语回流

## 用户可见影响

- 默认阅读入口、路线图和工作区文档都改用 `mount namespace` / `mount table` / `filesystem type` / `mount instance` / `node type`
- `vfs stat` / `describe` 及相关 CLI / RPC / MCP 输出现在稳定暴露 `mountType`、`filesystemType`、`nodeType` 和 `tags`
- 新项目和后续治理应优先使用 `actant.namespace.json`；旧 `actant.project.json` 只作为兼容入口保留
- ship / spec / finish-work 等命令入口不再把旧对象模型当当前基线

## 破坏性变更/迁移说明

- 默认术语与默认配置入口已经切换到 Linux 语义
- 旧 `actant.project.json`、旧 `SourceType` / `Source` / `Trait` 仍保留兼容或历史映射，不会在本轮直接阻断已有内容
- 若外部脚本或文档依赖旧 CLI / RPC 输出字段语义，应迁移到新的 `mountType`、`filesystemType`、`nodeType` 字段
- 本轮无强制数据迁移脚本；历史路径与内部包名仍允许暂时保留

## 验证结果

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- `git diff --name-only -z -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | xargs -0 rg -n 'console\\.log\\(' --`
- `git diff --name-only -z -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | xargs -0 rg -n --pcre2 '(:\\s*any\\b|<any>|as any\\b)' --`
- `git diff --name-only -z -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mts' '*.cts' | xargs -0 rg -n --pcre2 '(?<![=!<>])\\b[A-Za-z_$][A-Za-z0-9_$\\.\\]\\)]*!([\\.?\\[\\)\\],;:]|\\s*$)' --`
- 结果：`lint` / `type-check` / `test` 全部通过；模式扫描未发现新增 `console.log`、TypeScript `any` 或非空断言

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: pending
