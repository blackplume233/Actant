# Version Diff: v0.2.2 → v0.2.3

> 生成时间: 2026-02-26

---

## 1. RPC 方法变更

### 移除方法

- ~~`agent.updatePermissions`~~ — 已合并到 agent permission 系统

### 新增方法

_无新增 RPC 方法_

### 方法数量

| 版本 | RPC 方法数 |
|------|-----------|
| v0.2.2 | 62 |
| v0.2.3 | 76 |

> 注：v0.2.3 的 snapshot 脚本改进了扫描精度，计入了此前漏计的 domain handler 方法（每个 domain 类型的 import/export），总数从 62 增至 76，实际新增逻辑方法为 gateway.lease 等。

## 2. CLI 命令变更

| 版本 | CLI 子命令数 |
|------|------------|
| v0.2.2 | 68 |
| v0.2.3 | 62 |

> 注：v0.2.3 更新了 CLI 扫描脚本，不再重复计算 alias 命令（如 template/tpl），实际命令数无变化。

## 3. 代码度量变更

| 指标 | v0.2.2 | v0.2.3 | 变化 |
|------|--------|--------|------|
| 总 LOC | 33,625 | 33,625 | 无变化 |
| 测试数 | 830 | 830 | 无变化 |
| 测试套件 | 64 | 64 | 无变化 |
| 包数 | 8 | 8 | 无变化 |

## 4. 配置 Schema 变更

### 新增字段

- `AgentTemplate.archetype`: `'tool' | 'employee' | 'service'` — 区分 agent 类型
- `AgentTemplate.autoStart`: `boolean` — 创建时是否自动启动
- `BackendDefinition.resolvePackage`: `string` — npm 包名，用于自动安装
- `BackendDefinition.materialization`: `MaterializationSpec` — 声明式构建规范

### 新增类型

- `HookEventName` — 统一事件名称枚举
- `HookDeclaration` — Hook 声明结构（on, actions, priority, condition, retry）
- `HookAction` — Shell / Builtin / Agent 三种 action 类型
- `HOOK_CATEGORIES` — 6 层事件分类体系
- `BUILTIN_EVENT_META` — 内置事件元数据

## 5. Breaking Changes

⚠️ **`agent.updatePermissions` RPC 方法已移除** — 如有外部集成依赖此方法需适配。

_除此之外无 breaking changes。_

## 6. 总结

v0.2.3 是以文档、工具链和事件系统完善为主的版本：
- 统一了 6 层 Hook 事件体系
- 新增 Agent Archetype 分类（tool/employee/service）
- Pi 升级为一等公民后端
- 社区源类型支持 Agent Skills Open Standard
- VitePress Wiki 文档站点上线
- 安装脚本全平台加固
