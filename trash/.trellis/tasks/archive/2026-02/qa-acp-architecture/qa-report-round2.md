# QA 集成测试报告 — Round 2 (回归验证)

**场景**: 文档一致性验证 — `docs/design/acp-complete-server-architecture.md`
**测试工程师**: QA SubAgent
**时间**: 2026-02-21 20:04
**结果**: PASSED (412/412 单元测试通过，文档已更新)

---

## Round 1 → Round 2 修复内容

### 修复 1: 设计文档 Phase 2 状态标注

**文件**: `docs/design/acp-complete-server-architecture.md`

将 Phase 2 从 `-- DONE` 改为 `-- DONE (部分限制)`，添加已知限制说明。

### 修复 2: 重建全部包，修复 E2E 测试

清理 tsc 残留散文件，重新用 tsup 打包。

---

## 完整执行日志

### [Step 1] 更新设计文档 Phase 2 标注

```
$ StrReplace docs/design/acp-complete-server-architecture.md
  old: "### Phase 2: ACP Gateway 实现 -- DONE"
  new: "### Phase 2: ACP Gateway 实现 -- DONE (部分限制)"
  + 添加一行已知限制说明
```

--- diff ---

```diff
-### Phase 2: ACP Gateway 实现 -- DONE
+### Phase 2: ACP Gateway 实现 -- DONE (部分限制)
 ...
+- [ ] **已知限制**：`terminal/output`、`terminal/wait_for_exit`、`terminal/kill`、`terminal/release` 4 个回调的 IDE 转发为 stub（#43）。SDK 的 `AgentSideConnection` 不直接暴露这些方法，需通过底层 JSON-RPC 或 extMethod 扩展。当前 fallback 到本地 `LocalTerminalManager` 处理，功能可用但 IDE 终端面板无法集成。
```

---

### [Step 2] 重建 shared 包

```
$ npx tsup
  working_directory: packages/shared
```

--- 输出 ---

```
CLI Building entry: src/index.ts
CLI Using tsconfig: tsconfig.json
CLI tsup v8.5.1
CLI Using tsup config: G:\Workspace\AgentWorkSpace\AgentCraft\packages\shared\tsup.config.ts
CLI Target: es2022
CLI Cleaning output folder
ESM Build start
ESM dist\index.js     6.00 KB
ESM dist\index.js.map 23.29 KB
ESM ⚡️ Build success in 13ms
DTS Build start
DTS ⚡️ Build success in 707ms
DTS dist\index.d.ts 20.43 KB
```

**判断**: tsup 正确打包为单个 6 KB 文件，`clean: true` 清除了 tsc 残留散文件。PASS。

---

### [Step 3] 重建 core 包

```
$ npx tsup
  working_directory: packages/core
```

--- 输出 ---

```
CLI Building entry: src/index.ts
CLI tsup v8.5.1
CLI Target: es2022
CLI Cleaning output folder
ESM Build start
ESM dist\index.js     69.37 KB
ESM dist\index.js.map 144.03 KB
ESM ⚡️ Build success in 26ms
DTS Build start
DTS ⚡️ Build success in 1079ms
DTS dist\index.d.ts 32.96 KB
```

---

### [Step 4] 重建 acp 包

```
$ npx tsup
  working_directory: packages/acp
```

--- 输出 ---

```
CLI Building entry: src/index.ts
CLI tsup v8.5.1
CLI Target: es2022
CLI Cleaning output folder
ESM Build start
ESM dist\index.js     33.11 KB
ESM dist\index.js.map 74.16 KB
ESM ⚡️ Build success in 17ms
DTS Build start
DTS ⚡️ Build success in 839ms
DTS dist\index.d.ts 11.39 KB
```

---

### [Step 5] 重建 api 包

```
$ npx tsup
  working_directory: packages/api
```

--- 输出 ---

```
CLI Building entry: src/index.ts
CLI tsup v8.5.1
CLI Target: es2022
CLI Cleaning output folder
ESM Build start
ESM dist\index.js     24.08 KB
ESM dist\index.js.map 52.50 KB
ESM ⚡️ Build success in 26ms
DTS Build start
DTS ⚡️ Build success in 824ms
DTS dist\index.d.ts 2.38 KB
```

---

### [Step 6] 重建 cli 包

```
$ npx tsup
  working_directory: packages/cli
```

--- 输出 ---

```
CLI Building entry: src/daemon-entry.ts, src/index.ts, src/bin/actant.ts
CLI tsup v8.5.1
CLI Target: es2022
CLI Cleaning output folder
ESM Build start
ESM dist\bin\actant.js       219.00 B
ESM dist\index.js                212.00 B
ESM dist\repl-6BMYQBPH.js        2.60 KB
ESM dist\daemon-entry.js         286.00 B
ESM dist\program-3MSHUSM7.js     183.00 B
ESM dist\chunk-3UFACHA6.js       57.00 KB
ESM ⚡️ Build success in 31ms
DTS Build start
DTS ⚡️ Build success in 1980ms
DTS dist\daemon-entry.d.ts   13.00 B
DTS dist\index.d.ts          1.43 KB
DTS dist\bin\actant.d.ts 20.00 B
```

---

### [Step 7] 回归测试 — 完整单元测试套件

```
$ npx vitest run
  working_directory: g:\Workspace\AgentWorkSpace\AgentCraft
```

--- 输出 ---

```
 RUN  v4.0.18 G:/Workspace/AgentWorkSpace/AgentCraft

 ✓ packages/cli/src/output/__tests__/printer.test.ts (9 tests) 7ms
 ✓ packages/core/src/template/schema/template-schema.test.ts (21 tests) 12ms
 ✓ packages/cli/src/client/__tests__/rpc-client.test.ts (6 tests) 61ms
 ✓ packages/cli/src/output/__tests__/formatter.test.ts (15 tests) 36ms
 ✓ packages/shared/src/errors/errors.test.ts (11 tests) 15ms
 ✓ packages/cli/src/output/__tests__/error-presenter.test.ts (8 tests) 8ms
 ✓ packages/api/src/handlers/__tests__/proxy-handlers.test.ts (7 tests) 15ms
 ✓ packages/core/src/manager/restart-tracker.test.ts (10 tests) 19ms
 ✓ packages/core/src/initializer/context/context-materializer.test.ts (9 tests) 85ms
 ✓ packages/core/src/communicator/__tests__/communicator.test.ts (8 tests) 12ms
 ✓ packages/core/src/manager/launcher/process-watcher.test.ts (17 tests) 16ms
 ✓ packages/core/src/domain/workflow/workflow-manager.test.ts (7 tests) 18ms
 ✓ packages/core/src/domain/mcp/mcp-config-manager.test.ts (6 tests) 17ms
 ✓ packages/core/src/domain/prompt/prompt-manager.test.ts (8 tests) 19ms
 ✓ packages/core/src/template/loader/template-loader.test.ts (13 tests) 35ms
 ✓ packages/core/src/domain/skill/skill-manager.test.ts (9 tests) 25ms
 ✓ packages/core/src/template/registry/template-registry.test.ts (18 tests) 28ms
 ✓ packages/core/src/manager/launcher/backend-resolver.test.ts (10 tests) 5ms
 ✓ packages/shared/src/logger/logger.test.ts (2 tests) 13ms
 ✓ packages/acp/src/__tests__/communicator.test.ts (2 tests) 6ms
 ✓ packages/core/src/manager/launcher/process-utils.test.ts (3 tests) 3ms
 ✓ packages/core/src/domain/domain-context-resolver.test.ts (9 tests) 153ms
 ✓ packages/core/src/manager/launch-mode-handler.test.ts (11 tests) 6ms
 ✓ packages/core/src/state/instance-meta-io.test.ts (14 tests) 146ms
 ✓ packages/core/src/template/schema/type-alignment.test.ts (6 tests) 2ms
 ✓ packages/shared/src/platform/platform.test.ts (6 tests) 4ms
 ✓ packages/api/src/handlers/__tests__/template-handlers.test.ts (8 tests) 29ms
 ✓ packages/api/src/handlers/__tests__/domain-handlers.test.ts (12 tests) 36ms
 ✓ packages/api/src/services/__tests__/domain-context-integration.test.ts (7 tests) 107ms
 ✓ packages/api/src/handlers/__tests__/agent-handlers.test.ts (9 tests) 66ms
 ✓ packages/acp/src/__tests__/connection-manager.test.ts (5 tests) 7ms
 ✓ packages/api/src/services/__tests__/mvp-e2e-integration.test.ts (7 tests) 76ms
 ✓ packages/api/src/daemon/__tests__/socket-server.test.ts (7 tests) 70ms
 ✓ packages/core/src/initializer/agent-initializer.test.ts (24 tests) 404ms
 ✓ packages/core/src/manager/launcher/create-launcher.test.ts (3 tests) 2ms
 ✓ packages/cli/src/repl/__tests__/repl.test.ts (7 tests) 4ms
 ✓ packages/cli/src/commands/__tests__/commands.test.ts (11 tests) 27ms
 ✓ packages/core/src/manager/launcher/process-launcher.test.ts (5 tests) 1159ms
 ✓ packages/core/src/manager/agent-manager.test.ts (41 tests) 1483ms
 ✓ packages/core/src/manager/agent-lifecycle-scenarios.test.ts (9 tests) 4775ms
 ✓ packages/cli/src/__tests__/e2e-cli.test.ts (12 tests) 6160ms

 Test Files  41 passed (41)
      Tests  412 passed (412)
   Start at  20:04:53
   Duration  9.49s (transform 16.35s, setup 0ms, import 32.27s, tests 15.81s, environment 6ms)
```

**判断**: **412/412 全部通过**。E2E 测试（之前 12 个全部失败）现在全部通过。重建修复有效。

---

## 最终状态

| 维度 | R1 | R2 | 变化 |
|------|----|----|------|
| 单元测试 | 400/412 (97.1%) | **412/412 (100%)** | +12 |
| 文档检查 PASS | 51/56 | 51/56 | — |
| 文档检查 WARN | 3/56 | 3/56 | — |
| 文档检查 FAIL | 4/56 (未标注) | 4/56 (**已标注**) | 已记录 |
| 新建 Issue | #43 #44 | — | — |
