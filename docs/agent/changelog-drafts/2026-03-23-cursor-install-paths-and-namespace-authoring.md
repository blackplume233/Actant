# Fix local install paths and namespace mount authoring

## 变更摘要

- 修复 `vfs.mountAdd` / `vfs.mountRemove` 在 `context` host profile 下被错误当成 runtime VFS mutation 拦截的问题，恢复 fresh namespace project 的配置写路径。
- 将 `scripts/install-local.mjs` 的默认本地安装模式改成 workspace wrapper，直接指向仓库内 `scripts/run-workspace-entry.mjs` 与 CLI source entrypoints，不再依赖脏掉的 workspace symlink。
- 修复 `scripts/build-standalone.mjs` 的 macOS SEA 构建链路：注入前确保二进制可写，并在本机 Node 缺少 SEA fuse 时自动下载同版本官方 Node 模板二进制完成注入。

## 用户可见影响

- 新建空目录后，`actant init --scaffold minimal` 配合 `actant hub status` / `actant namespace validate` / `actant vfs mount add` 可以直接完成 namespace mount authoring。
- `node scripts/install-local.mjs --install-dir <dir>` 现在可以稳定产出可执行的 `actant` / `acthub` 本地命令。
- 在当前 macOS + Homebrew Node 22 环境下，`node scripts/install-local.mjs --standalone --install-dir <dir>` 也可以成功生成 standalone 二进制。

## 破坏性变更/迁移说明

- `install-local` 默认 link 模式不再走 `npm link`；它现在安装的是 workspace wrapper。
- workspace wrapper 依赖当前仓库源码和本地 Node 环境，只适用于本地开发安装，不适用于脱离仓库的分发场景。

## 验证结果

- `pnpm vitest run packages/api/src/services/__tests__/host-profile-compat.test.ts packages/api/src/handlers/__tests__/vfs-handlers.test.ts packages/cli/src/__tests__/e2e-cli.test.ts`
- 黑盒命令行回归：
  - `node scripts/install-local.mjs --force --install-dir <tmp-bin>`
  - `<tmp-bin>/actant --version`
  - `node scripts/install-local.mjs --standalone --force --install-dir <tmp-standalone-bin>`
  - `<tmp-standalone-bin>/actant --version`
  - fresh project: `actant init --scaffold minimal` -> `actant hub status -f json` -> `actant namespace validate --json` -> `actant vfs mount add --type hostfs --path /extra --host-path ./extra --json` -> `actant vfs mount list --json`

## 关联 PR / Commit / Issue

- Issue: #319
- Issue: #320
