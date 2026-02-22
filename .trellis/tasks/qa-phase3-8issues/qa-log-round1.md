# QA Log — Round 1 — Phase 3 Eight Issues Random Walk

**开始时间**: 2026-02-22T14:00:00+08:00
**范围**: #51 #52 #53 #54 #55 #56 #58 #59 全部修改
**环境**: Windows, mock launcher mode, isolated temp dir

---

### [Step 0] Baseline — Full Unit Test Suite

**时间**: 2026-02-22T14:00:00+08:00

#### 输入
```
npx pnpm test
```

#### 输出
```
exit_code: 0

--- stdout ---
Test Files  51 passed (51)
     Tests  575 passed (575)
  Duration  7.87s
--- stderr ---
(empty)
```

#### 判断: PASS
所有 575 个测试全部通过，51 个测试文件无失败。基线建立完成。

---

### [Step 1-35] Deep White-box Group A: #56 InstanceRegistry + #55 Help/Install/Self-Update

**时间**: 2026-02-22T14:01:00+08:00

35 个检查项覆盖:
- InstanceRegistry 实现 (load/save/register/unregister/adopt/reconcile/updateStatus)
- AppContext 集成 (configsDir/sourcesDir/registryPath/builtinInstancesDir)
- CLI agent adopt 命令 + RPC handler
- CLI agent create --workspace 选项
- RPC 类型 (AgentAdoptParams/AgentAdoptResult)
- help 命令黑盒测试 (分组展示 + 子命令帮助)
- install.sh / install.ps1 脚本验证
- self-update.js 7 阶段脚本
- getting-started.md 文档

#### 判断: 33 PASS, 2 WARN

WARN-1: `InstanceRegistry.load()` 不主动创建 registry.json，由首次 `save()` 创建 → 可接受行为
WARN-2: `cleanOldBackups` 的 `slice(maxBackups - 1)` → 经分析实际上是正确的（保留 current + 2 old = 3 total），误报

---

### [Step 36-45] Deep White-box Group B: #51 Permission Control + #52 Template Source Sharing

**时间**: 2026-02-22T14:01:00+08:00

10 个检查项覆盖:
- permission-presets.ts (4 presets, resolvePermissions, resolvePermissionsWithMcp)
- Zod schemas (PermissionModeSchema, SandboxSchema, PermissionsInputSchema 等)
- ClaudeCodeBuilder (resolvePermissionsWithMcp → .claude/settings.local.json)
- CursorBuilder (best-effort mapping → .cursor/settings.json)
- WorkspaceBuilder (接受 permissions 参数)
- 权限验证功能测试 (preset 字符串 / object / invalid)
- SourceManager template 注入/移除/namespace
- FetchResult.templates
- LocalSource.loadPackage templates
- Source 类型 (PackageManifest.components.templates, PresetDefinition.templates)

#### 判断: 10 PASS, 0 WARN, 0 FAIL

---

### [Step 46-56] Deep White-box Group C: #53 Version Control + #54 Extensibility

**时间**: 2026-02-22T14:01:00+08:00

11 个检查项覆盖:
- VersionedComponent 基础接口 (所有 5 种组件类型均继承)
- parseComponentRef (简单名/版本范围/namespace)
- SyncReport 类型 + mergeSyncReports
- SourceManager.syncSourceWithReport (snapshot diff + hasBreakingChanges)
- CLI sync 报告 chalk 着色
- component-ref.test.ts 功能测试 (9/9 pass)
- ComponentTypeHandler 接口
- 5 个内置 handler (skills/prompts/mcpServers/workflow/plugins)
- WorkspaceBuilder handler 循环 + extensions 处理
- 扩展指南文档
- workspace-builder.test.ts 功能测试 (12/12 pass)

#### 判断: 10 PASS, 1 WARN, 0 FAIL

WARN-3: 扩展指南文档第 6 节仍称 ComponentTypeHandler 为"未来工作"，但代码已实现 → 已修复

---

### [Step 57-66] Deep White-box Group D: #58 Component Format + #59 Official Source

**时间**: 2026-02-22T14:01:00+08:00

10 个检查项覆盖:
- BaseComponentManager.loadFromDirectory (flat JSON + directory/manifest.json + content.md + @namespace)
- LocalSource directory support
- 示例目录组件 (configs/skills/code-review/ + 向后兼容的 .json)
- base-component-manager.test.ts (28/28 pass)
- SKILL.md parser (frontmatter/tags/version/content/null)
- LocalSource SKILL.md 集成 (去重逻辑)
- DEFAULT_SOURCE_NAME/CONFIG 常量
- actant-hub 示例结构 (manifest/SKILL.md/JSON 一致性)
- skill-md-parser.test.ts (8/8 pass) + source-manager.test.ts (15/15 pass)
- 集成代码路径追踪 (local source → manifest → templates/presets)

#### 判断: 10 PASS, 0 WARN, 0 FAIL

---

### [Step 67] Black-box: CLI help command

**时间**: 2026-02-22T14:02:00+08:00

#### 输入
```
node packages/cli/dist/bin/actant.js help
```

#### 输出
```
exit_code: 0

--- stdout ---
  Actant — Build, manage, and compose AI agents
  v0.1.0

  Quick Start:
    actant daemon start              Start the daemon
    ...
  Agent Management:
    agent create|start|stop|list|chat|run    Agent lifecycle
    agent adopt <path>                       Adopt existing workspace
    ...
  System:
    help [command]                   Show help
    --version                        Show version
```

#### 判断: PASS
分组展示正确，包含新增的 `agent adopt` 命令。

---

### [Step 68] Black-box: CLI help agent

#### 输入
```
node packages/cli/dist/bin/actant.js help agent
```

#### 输出
```
exit_code: 0

--- stdout ---
Commands:
  create [options] <name>      Create a new agent from a template
  ...
  adopt [options] <path>       Adopt an existing agent workspace into the instance registry
  ...
```

#### 判断: PASS
agent adopt 子命令正确显示。

---

### [Step 69] Black-box: CLI self-update --check

#### 输入
```
node packages/cli/dist/bin/actant.js self-update --check --source .
```

#### 输出
```
exit_code: 0

--- stdout ---
=== Version Check ===
Source version: 0.1.0
Last update: none
```

#### 判断: PASS

---

### [Step 70] Black-box: CLI help template

#### 输入
```
node packages/cli/dist/bin/actant.js help template
```

#### 输出
```
exit_code: 0

--- stdout ---
Commands:
  list|ls [options]      List all registered templates
  ...
  install <spec>         Install a template from a source (source@name)
  ...
```

#### 判断: PASS
新增的 template install 子命令正确显示。

---

### [Step 71] Doc Fix Applied — Extension guide updated

将 Section 6 从"Future: ComponentTypeHandler Pattern"更新为"ComponentTypeHandler Pattern (Implemented)"，
反映代码已实现 handler 注册模式和 extensions 处理的事实。

#### 判断: PASS (修复)

---

### [Step 72] Full Regression — Complete Test Suite

**时间**: 2026-02-22T14:03:00+08:00

#### 输入
```
npx pnpm test
```

#### 输出
```
exit_code: 0

--- stdout ---
Test Files  51 passed (51)
     Tests  578 passed (578)
  Duration  7.84s
--- stderr ---
(empty)
```

#### 判断: PASS
578/578 通过 (比基线多 3 个权限验证测试)，0 失败，0 回归。

---
