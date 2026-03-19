# QA 集成测试报告 — Round 1

**场景**: Phase 3 Eight Issues (#51 #52 #53 #54 #55 #56 #58 #59) 随机漫步测试
**测试工程师**: QA SubAgent
**时间**: 2026-02-22 14:00–14:04
**结果**: **PASSED** (72/72 步骤通过, 3 WARN → 1 修复 + 2 可接受)

## 摘要

| # | 步骤组 | 覆盖 Issue | 检查项 | PASS | WARN | FAIL |
|---|--------|-----------|--------|------|------|------|
| 0 | 基线单元测试 | All | 575 tests | 1 | 0 | 0 |
| 1-35 | #56 + #55 白盒 | #56 #55 | 35 | 33 | 2 | 0 |
| 36-45 | #51 + #52 白盒 | #51 #52 | 10 | 10 | 0 | 0 |
| 46-56 | #53 + #54 白盒 | #53 #54 | 11 | 10 | 1 | 0 |
| 57-66 | #58 + #59 白盒 | #58 #59 | 10 | 10 | 0 | 0 |
| 67-70 | CLI 黑盒 | #55 #56 | 4 | 4 | 0 | 0 |
| 71 | 文档修复 | #54 | 1 | 1 | 0 | 0 |
| 72 | 全量回归 | All | 578 tests | 1 | 0 | 0 |
| **合计** | | | **72** | **70** | **3** | **0** |

## WARN 分析

### WARN-1: InstanceRegistry.load() 不主动创建 registry.json
- **严重度**: 低
- **判定**: 可接受 — 首次 `save()` 时创建文件，`reconcile()` 会触发 `save()`
- **操作**: 不需修复

### WARN-2: cleanOldBackups slice 逻辑
- **严重度**: 低
- **判定**: 误报 — 经分析，`dirs.slice(maxBackups - 1)` 是正确的（dirs 排除了 currentId，保留 2 old + 1 current = 3 total）
- **操作**: 不需修复

### WARN-3: 扩展指南文档 Section 6 过时 (已修复)
- **严重度**: 低
- **实际问题**: 文档称 ComponentTypeHandler 为"未来工作"，但代码已实现
- **修复**: 更新 `docs/design/domain-context-extension-guide.md` Section 6 为"ComponentTypeHandler Pattern (Implemented)"
- **回归**: 578/578 测试通过

## 单元测试统计

| 指标 | 值 |
|------|---|
| 测试文件 | 51 |
| 总测试数 | 578 (基线 575 + 3 新增) |
| 通过 | 578 |
| 失败 | 0 |
| 跳过 | 0 |
| 耗时 | ~8s |

## 按 Issue 覆盖详情

### #51 Template 权限控制 ✅
- 4 预设正确定义 (permissive/standard/restricted/readonly)
- resolvePermissions 三路分发正确 (undefined/preset/object)
- resolvePermissionsWithMcp MCP 工具自动追加正确
- Zod schemas 完整 (5 个新 schema)
- ClaudeCodeBuilder 写入 .claude/settings.local.json 正确
- CursorBuilder best-effort 映射正确
- WorkspaceBuilder 传递 permissions 参数正确
- 权限验证测试: preset/object/invalid 全通过

### #52 Template Source 分享 ✅
- SourceManagerDeps 含 templateRegistry
- injectComponents 处理 templates 含 namespace 前缀
- removeNamespacedComponents 清除 templates
- applyPreset 处理 preset.templates
- FetchResult.templates 字段正确
- LocalSource 加载 templates/ 目录
- PackageManifest/PresetDefinition 类型扩展正确

### #53 版本控制 ✅
- VersionedComponent 基础接口完整 (7 字段)
- 5 种组件类型均正确继承
- parseComponentRef 解析名称/版本范围/namespace 正确
- SyncReport/ComponentVersionDelta 类型完整
- syncSourceWithReport snapshot diff 正确
- hasBreakingChanges major 版本检测正确
- CLI sync 报告 chalk 着色正确
- 9/9 component-ref 测试通过

### #54 DomainContext 扩展性 ✅
- ComponentTypeHandler 接口完整 (contextKey/resolve/materialize)
- 5 个内置 handler contextKey 正确
- WorkspaceBuilder handler 循环替代硬编码分支
- extensions 字段完整处理
- 扩展指南文档 11 步清单 + 命名约定 + 测试要求
- 12/12 workspace-builder 测试通过

### #55 安装/Help/Self-Update ✅
- help 命令分组展示 + 子命令帮助 + chalk 着色
- install.sh / install.ps1 完整 (检测/构建/链接/目录创建)
- self-update.js 7 阶段更新流程
- self-update CLI 命令 (--check/--source/--dry-run)
- getting-started.md 文档完整

### #56 工作目录设计 ✅
- InstanceRegistry 完整实现 (load/save/register/unregister/adopt/reconcile/updateStatus)
- AppContext 新路径属性 (configsDir/sourcesDir/registryPath/builtinInstancesDir)
- agent adopt CLI + RPC handler
- agent create --workspace 选项
- AgentAdoptParams/AgentAdoptResult RPC 类型

### #58 组件格式重设计 ✅
- BaseComponentManager.loadFromDirectory 支持 flat JSON + 目录/manifest.json + content.md
- resolveContentFile 辅助方法
- @namespace 递归扫描
- LocalSource loadJsonDir 目录支持
- 示例目录组件 + 向后兼容
- 28/28 base-component-manager 测试通过

### #59 官方 Source 仓库 ✅
- SKILL.md parser (frontmatter/tags/version/content/null)
- LocalSource SKILL.md 集成 + 去重
- DEFAULT_SOURCE_NAME/CONFIG 常量
- actant-hub 示例结构完整一致
- 8/8 skill-md-parser 测试 + 15/15 source-manager 测试通过

## 创建的 Issue
无 — 全部检查项通过或已修复。

## 建议

1. **补充 InstanceRegistry 单元测试**: 当前 InstanceRegistry 没有独立的单元测试文件，建议创建 `instance-registry.test.ts`
2. **权限 E2E 测试**: 当前权限功能只有单元测试，建议增加一个 E2E 测试场景验证 template 带 permissions 的完整流程
3. **actant-hub 实际发布**: 当前是 `examples/actant-hub/` 本地示例，后续需要发布到 GitHub

