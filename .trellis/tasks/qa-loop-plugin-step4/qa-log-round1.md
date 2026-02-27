# QA Log — Round 1
**任务**: qa-loop-plugin-step4
**时间**: 2026-02-27
**范围**: Step 4 Plugin 体系核心 — unit-only 模式

---

### [Step 1] 全量构建
**时间**: 2026-02-27T21:21

#### 输入
```
pnpm build
```

#### 输出
```
exit_code: 0

--- stdout ---
全部 11 个包构建成功
packages/shared build: DTS dist\index.d.ts 85.98 KB
packages/core build: DTS dist\index.d.ts 124.85 KB
packages/cli build: DTS dist\index.d.ts 1.43 KB
（所有包均 ⚡️ Build success）

--- stderr ---
(empty)
```

#### 判断: PASS
全量构建 0 错误，所有包（shared/core/api/cli/acp/mcp-server/dashboard/pi/actant/rest-api）均成功。
新增的 plugin 体系代码被正确打包进入 core dist。

---

### [Step 2] @actant/shared 类型检查
**时间**: 2026-02-27T21:22

#### 输入
```
pnpm --filter @actant/shared type-check
```

#### 输出
```
exit_code: 0

--- stdout ---
> @actant/shared@0.2.3 type-check
> tsc --noEmit
(无输出 = 通过)

--- stderr ---
(empty)
```

#### 判断: PASS
新增 `plugin.types.ts` 中的全部类型（PluginScope, PluginRuntimeState, PluginContext, PluginRuntimeHooks, PluginRef, SubsystemScope, SubsystemOrigin, SubsystemDefinition）类型正确，无错误。

---

### [Step 3] @actant/core 类型检查
**时间**: 2026-02-27T21:22

#### 输入
```
pnpm --filter @actant/core type-check
```

#### 输出
```
exit_code: 0

--- stdout ---
> @actant/core@0.2.3 type-check
> tsc --noEmit
(无输出 = 通过)

--- stderr ---
(empty)
```

#### 判断: PASS
plugin-host.ts, types.ts, legacy-adapter.ts 全部类型正确。
ActantPlugin 六插口接口与 HookEventBus / ContextProvider / SourceConfig 等已有类型无冲突。

---

### [Step 4] 全 monorepo 类型检查
**时间**: 2026-02-27T21:22

#### 输入
```
pnpm -r type-check
```

#### 输出
```
exit_code: 0

--- stdout ---
11 个包全部 type-check Done，无错误

--- stderr ---
(empty)
```

#### 判断: PASS
引入 Plugin 体系后，全 monorepo 类型安全，无回归。

---

### [Step 5] 全量单元测试
**时间**: 2026-02-27T21:21

#### 输入
```
pnpm test
```

#### 输出
```
exit_code: 0

--- stdout ---
Test Files  76 passed (76)
     Tests  1004 passed (1004)
  Duration  21.94s

新增测试 (27 个):
✓ src/plugin/plugin-host.test.ts (27 tests) 12ms

--- stderr ---
(empty)
```

#### 判断: PASS
1004/1004 全部通过，含 27 个新增的 plugin 测试。
无回归，全部旧测试正常。

---

### [Step 6] Plugin 测试详细验证（verbose）
**时间**: 2026-02-27T21:22

#### 输入
```
pnpm --filter @actant/core test -- --reporter=verbose src/plugin
```

#### 输出
```
exit_code: 0

Test Files  1 passed (1)
     Tests  27 passed (27)
  Duration  366ms
```

#### 覆盖场景验证
| 测试组 | 数量 | 结果 |
|--------|------|------|
| Registration（注册/重名检测） | 2 | PASS |
| Normal Lifecycle（正常生命周期） | 2 | PASS |
| Exception Isolation（异常隔离） | 4 | PASS |
| Tick Re-entrancy Guard（防重入） | 2 | PASS |
| Topological Sort（拓扑排序） | 3 | PASS |
| Plug 3: hooks | 2 | PASS |
| Plug 4: contextProviders | 2 | PASS |
| Plug 5: subsystems | 1 | PASS |
| Plug 6: sources | 1 | PASS |
| list() | 3 | PASS |
| adaptLegacyPlugin() | 5 | PASS |

#### 判断: PASS
所有 27 个场景覆盖齐全，全部通过。

---

### [Step 7] Linter 检查
**时间**: 2026-02-27T21:22

#### 输入
```
ReadLints on packages/core/src/plugin/ + plugin.types.ts
```

#### 输出
```
No linter errors found.
```

#### 判断: PASS
无 linter 错误。

---

### [Step 8] 运行时 API 导出验证
**时间**: 2026-02-27T21:22

#### 输入
```
node -e "import('@actant/core').then(m => { ... })"
node -e "import('@actant/shared').then(m => { ... })"
```

#### 输出
```
core 导出:  PluginHost, PluginManager, adaptLegacyPlugin
shared 导出: (type-only, 无运行时值，符合预期)
dist/index.d.ts: ActantPlugin 接口、PluginScope、SubsystemDefinition 等均正确生成
```

#### 判断: PASS
公共 API 导出正确。PluginHost 和 adaptLegacyPlugin 可从 @actant/core 直接使用。
类型全部在 dist/index.d.ts 中正确导出，外部消费者可以无障碍使用。
