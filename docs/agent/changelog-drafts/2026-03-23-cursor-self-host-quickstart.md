# Self-Host Quickstart Closure

## 变更摘要

- 将仓库根默认运行时配置切到 `actant.namespace.json`，删除活跃入口中的旧 `actant.project.json`。
- 将 smoke / E2E 自托管验证统一到 `test:self-host`，并让 `test:e2e` 直接串联 namespace 自托管链路。
- 收口 hub / help / standalone VFS 标签文案，使活跃 CLI 与运行时输出统一使用 namespace 语义。
- 更新安装脚本，移除失效的 `actant setup` 引导，改为安装完成后输出 `actant init -> actant hub status -> actant namespace validate` 的 next steps。
- 扩展 terminology gate，把安装脚本纳入活跃入口禁词扫描。

## 用户可见影响

- 仓库根现在可以直接作为 namespace 项目运行与验证。
- 新增 `pnpm test:self-host` 作为最短自托管验证入口。
- `actant hub` 帮助文案统一为 namespace hub，不再提示旧的 project-context 路径叙事。
- 安装完成后不会再错误提示用户执行 `actant setup`。

## 破坏性变更/迁移说明

- 运行时默认入口不再接受仓库根的 `actant.project.json`；需要改为 `actant.namespace.json`。
- 安装脚本不再提供 `--skip-setup`，因为安装阶段不再自动执行项目初始化。
- `test:context` 仍保留，但现在只是 `test:self-host` 的兼容别名。

## 验证结果

- `pnpm exec vitest run packages/shared/src/__tests__/contextfs-terminology-gate.test.ts`
- `pnpm test:self-host`
- `pnpm test:e2e`
- `pnpm type-check`

## 关联 PR / Commit / Issue

- PR: pending
- Commit: pending
- Issue: pending
