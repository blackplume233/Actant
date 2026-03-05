## QA 集成测试报告

**场景**: 即兴探索 — 验证 Agent 雇员能正确访问 VFS
**测试工程师**: QA SubAgent
**时间**: 2026-03-01T17:46 ~ 17:50
**结果**: **PASSED** (16/16 步骤通过, 0 警告)

### 摘要

| # | 步骤 | 命令 | 判定 |
|---|------|------|------|
| 1 | Daemon 启动 | `daemon start --foreground` | PASS |
| 2 | VFS mount list (默认挂载) | `vfs mount list` | PASS |
| 3 | VFS ls / (根目录) | `vfs ls /` | PASS |
| 4 | VFS describe /config | `vfs describe /config --json` | PASS |
| 5 | VFS write + read /memory | `vfs write` / `vfs read` | PASS |
| 6 | VFS grep /memory | `vfs grep "VFS" /memory` | PASS |
| 7 | VFS ls /memory | `vfs ls /memory` | PASS |
| 8 | Agent 创建 → workspace 自动挂载 | `agent create` + `vfs mount list` | PASS |
| 9 | VFS ls + read Agent workspace | `vfs ls` / `vfs read` | PASS |
| 10 | VFS write → Agent workspace | `vfs write` + `vfs read` | PASS |
| 11 | VFS grep workspace | `vfs grep "VFS" /workspace/...` | PASS |
| 12 | VFS edit workspace | `vfs edit --old --new` + `vfs read` | PASS |
| 13 | VFS stat + tree | `vfs stat` / `vfs tree` | PASS |
| 14 | VFS delete | `vfs rm` + 确认 ENOENT | PASS |
| 15 | Agent 销毁 → workspace 自动卸载 | `agent destroy` + `vfs mount list` | PASS |
| 16 | VFS ls / (回到初始状态) | `vfs ls /` | PASS |

### Round 1 → Round 2 修复总结

**Round 1 发现**: 所有 VFS CLI/RPC 命令返回 `[RPC -32603] VFS not initialized`

**根因**: `AppContext.init()` 未初始化 `vfsRegistry` — VFS 组件全部实现但未接入 daemon 启动流程

**修复内容**:
1. `packages/api/src/services/app-context.ts`:
   - 导入 VFS 相关组件（VfsRegistry, SourceFactoryRegistry, source factories, VfsContextProvider, VfsLifecycleManager）
   - 将 `vfsRegistry` 从 optional 改为 required readonly 属性
   - 在构造函数中创建 VfsRegistry 和 SourceFactoryRegistry，注册全部 6 个内置 source factory
   - 新增 `initializeVfs()` 方法：创建 3 个 daemon 级默认挂载点（/config, /memory, /canvas），设置 VfsLifecycleManager，注册 agent 创建/销毁事件监听器自动挂载/卸载 workspace
   - 在 `init()` 中调用 `initializeVfs()`
   - 在 `stopPlugins()` 中调用 `vfsLifecycleManager.dispose()`
   - 注册 `VfsContextProvider` 到 session context injector
2. `packages/api/src/handlers/vfs-handlers.ts`:
   - 添加缺失的 `vfs.mount` RPC handler（通过 SourceFactoryRegistry 创建并注册新挂载点）
   - 简化 `requireVfsRegistry`（vfsRegistry 不再为 optional）

### 验证覆盖度

| 维度 | 覆盖 |
|------|------|
| Daemon 级挂载 (/config, /memory, /canvas) | ✓ |
| Agent workspace 自动挂载 | ✓ |
| Agent workspace 自动卸载 | ✓ |
| 文件 CRUD (read, write, edit, delete) | ✓ |
| 目录操作 (ls, tree, stat) | ✓ |
| 搜索 (grep) | ✓ |
| 元操作 (describe, mount list) | ✓ |
| 进程清理 (无泄漏) | ✓ |

### 完整执行日志

→ 见 `qa-log-round2.md`

### 创建的 Issue

无。Round 2 全部 PASS。
