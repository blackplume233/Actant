# AgentCraft 项目分析报告

## 1. 项目概述

### 1.1 项目定位
**AgentCraft** 是一个 AI Agent 的构建、管理和编排平台，目标是让用户能够快速组装、复用和部署针对复杂业务领域的智能体。

### 1.2 核心差异化
与传统 AI 助手不同，AgentCraft 强调：
- **组合性** - 通过模板将 Skills、Prompts、MCP Tools 等组件像积木一样组合
- **可复用性** - Domain Context 组件通过名称引用，可在多个模板间共享
- **多模式运行** - 同时支持 One-shot、Direct、ACP-Service 三种启动模式

### 1.3 包结构
```
packages/
├── shared        # 共享类型和工具（库）
├── core          # 核心逻辑（库）
│   ├── domain/      # Domain Context 组件管理
│   ├── template/    # 模板系统（加载、验证、注册）
│   ├── initializer/ # Agent 实例初始化
│   ├── manager/     # Agent 生命周期管理
│   └── state/       # 状态持久化
├── api           # HTTP API 服务（应用）
├── cli           # 命令行工具（应用）
├── mcp-server    # MCP 协议服务（应用）
└── acp           # ACP 协议实现（库/服务）
```

---

## 2. 架构分析

### 2.1 分层架构
```
┌─────────────────────────────────────────┐
│  CLI / API / ACP Interface Layer       │
├─────────────────────────────────────────┤
│  AgentManager (Lifecycle Management)   │
├─────────────────────────────────────────┤
│  AgentInitializer (Materialization)    │
├─────────────────────────────────────────┤
│  TemplateRegistry / TemplateLoader     │
├─────────────────────────────────────────┤
│  Domain Context Managers               │
│  (Skill/Prompt/Workflow/MCPManager)    │
├─────────────────────────────────────────┤
│  State Persistence (IO Layer)          │
└─────────────────────────────────────────┘
```

### 2.2 关键设计决策

| 决策 | 实现 | 评价 |
|------|------|------|
| **Reference-Based Composition** | 模板通过名称引用组件 | ✅ 优秀，实现组件复用和独立版本管理 |
| **Generic BaseComponentManager** | 泛型基类统一组件管理 | ✅ 优秀，避免重复代码，类型安全 |
| **Instance-Process Separation** | AgentInstance 与 AgentProcess 分离 | ✅ 优秀，支持崩溃恢复和状态修复 |
| **Materializer Pattern** | Domain Context 物化为文件 | ✅ 良好，支持人类+AI 协作修改 |
| **Zod Schema Validation** | 运行时类型验证 | ✅ 优秀，前后端类型一致性 |

### 2.3 状态机设计
```typescript
type AgentStatus =
  | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";
```
- 支持从磁盘恢复实例状态
- 自动修复崩溃后遗留的 "running" 状态
- 损坏实例隔离到 `.corrupted/` 目录

---

## 3. 代码质量评估

### 3.1 测试覆盖
- **测试文件**: 15 个
- **测试用例**: 161 个
- **通过率**: 100%

| 模块 | 测试数 | 质量评价 |
|------|--------|----------|
| template-schema | 21 | 优秀，边界条件完整 |
| template-loader | 13 | 优秀，错误场景覆盖 |
| template-registry | 18 | 优秀，重复检测测试 |
| agent-manager | 19 | 优秀，生命周期完整 |
| agent-initializer | 13 | 良好，覆盖选项测试 |
| domain-context-resolver | 9 | 优秀，端到端集成 |
| skill/prompt/workflow/mcp managers | 30 | 良好，CRUD 完整 |
| errors | 11 | 优秀，错误层次完整 |

### 3.2 类型安全
- TypeScript 严格模式启用
- Zod Schema 运行时验证
- 类型对齐测试（type-alignment.test.ts）
- 自定义错误类型层次结构

### 3.3 代码风格
- 一致的命名规范（camelCase）
- 清晰的文件组织
- 适当的注释（复杂逻辑有说明）
- ESM 模块规范

### 3.4 潜在代码问题

#### 问题 1: 相对路径导入
```typescript
// 当前写法
import { SkillManager } from "../domain/skill/index.js";

// 问题：重构时容易出错，可读性差
```

#### 问题 2: tsup 用于应用构建
- CLI、API、MCP-Server 使用 tsup 构建
- tsup 是库构建工具，对应用支持有限
- CLI 缺少 shebang 处理
- API 产物包含无用的 .d.ts 文件

#### 问题 3: 错误处理一致性
```typescript
// 部分代码抛出原始错误，未包装为 AgentCraftError
if (err instanceof AgentCraftError) {
  throw err;
}
throw new WorkspaceInitError(...); // 其他错误被包装
```

#### 问题 4: 缺少输入验证
```typescript
// agent-manager.ts 的 createAgent 方法
async createAgent(name: string, templateName: string, ...)
// 缺少对 name 格式的验证（空字符串、非法字符等）
```

---

## 4. 技术选型分析

### 4.1 构建工具：tsup

| 维度 | 评价 | 说明 |
|------|------|------|
| 适用性 | ⚠️ 部分适用 | 适合 shared/core，不适合 cli/api |
| 构建速度 | ✅ 极快 | 基于 esbuild，毫秒级 |
| 配置复杂度 | ✅ 低 | 零配置，开箱即用 |
| 类型生成 | ✅ 内置 | 自动生成 .d.ts |
| 应用构建 | ❌ 有限 | 不处理 shebang，代码分割不可控 |

**建议**: 库保持 tsup，应用迁移到 tsc 或 Rollup。

### 4.2 类型系统：Zod + TypeScript

| 维度 | 评价 |
|------|------|
| 运行时验证 | ✅ 必要，模板 JSON 需要验证 |
| 类型推导 | ✅ 与 TypeScript 集成良好 |
| 性能 | ⚠️ 运行时有一定开销，可接受 |
| 维护性 | ✅ Schema 即文档 |

### 4.3 模块系统：ESM

| 维度 | 评价 |
|------|------|
| 兼容性 | ⚠️ Node 22 支持良好，部分工具链需适配 |
| 导入路径 | ❌ 需要显式 .js 扩展名（ESM 规范） |
| Tree Shaking | ✅ 比 CommonJS 更好 |
| 未来趋势 | ✅ 标准方向 |

### 4.4 包管理：pnpm + Workspace

| 维度 | 评价 |
|------|------|
| 依赖管理 | ✅ pnpm 节省磁盘空间 |
| 本地链接 | ✅ workspace:* 协议方便 |
| 构建顺序 | ⚠️ 需要手动管理或配合 Turborepo |

---

## 5. 使用场景验证

### 5.1 场景覆盖度

| 场景 | 支持度 | 实现状态 |
|------|--------|----------|
| 自定义业务 Agent | ✅ 完全支持 | domain/ 模块完整 |
| CI 集成 (One-shot) | ✅ 支持 | launchMode 已定义 |
| 持久化 Agent | ✅ 支持 | state/ 持久化实现 |
| Agent as Service | ✅ 支持 | AgentManager 生命周期完整 |
| ACP 集成 | ⚠️ 部分支持 | acp 包待实现 |
| Agent-to-Agent | ⚠️ 基础支持 | subAgents 字段已定义 |

### 5.2 启动模式实现

```typescript
// 已实现
export type LaunchMode = "direct" | "acp-background" | "acp-service" | "one-shot";
```

- **direct**: 直接打开 IDE（已实现 MockLauncher）
- **acp-service**: 后台服务（AgentManager 支持）
- **one-shot**: 一次性任务（元数据支持）
- **acp-background**: ACP 后台模式（待实现）

---

## 6. 潜在风险与建议

### 6.1 高风险

#### 风险 1: 进程崩溃恢复机制不完整
```typescript
// agent-manager.ts
const process = await this.launcher.launch(dir, starting);
// 如果进程崩溃（非 stopAgent 调用），没有自动检测机制
```
**建议**: 添加心跳检测或进程监控。

#### 风险 2: 并发操作竞态条件
```typescript
// 多个同时 startAgent 调用可能导致状态不一致
if (meta.status === "running" || meta.status === "starting") {
  throw new AgentAlreadyRunningError(name);
}
// 非原子操作
```
**建议**: 添加锁机制或使用原子操作。

### 6.2 中风险

#### 风险 3: 测试依赖文件系统
- 大量使用 `mkdtemp` 和真实文件操作
- 测试运行慢，可能受文件系统影响
**建议**: 关键路径使用内存文件系统（memfs）测试。

#### 风险 4: 缺少日志轮转
```typescript
// 使用 pino，但没有配置日志文件和轮转
const logger = createLogger("agent-manager");
```
**建议**: 生产环境配置日志文件和轮转策略。

### 6.3 改进建议（优先级排序）

| 优先级 | 建议 | 影响 |
|--------|------|------|
| P0 | 应用包（cli/api）迁移到 tsc 构建 | 解决 shebang 和产物问题 |
| P1 | 添加包内非相对路径导入（#domain/*） | 提高可维护性 |
| P1 | 实现心跳检测机制 | 提高可靠性 |
| P2 | 添加输入验证层 | 提高健壮性 |
| P2 | 引入 Turborepo 管理构建顺序 | 提高构建效率 |
| P3 | 添加性能测试 | 确保可扩展性 |
| P3 | 完善 ACP 协议实现 | 完成核心功能 |

---

## 7. 总结

### 7.1 优势
1. **架构清晰** - 分层明确，职责分离
2. **测试完善** - 161 个测试，覆盖核心功能
3. **类型安全** - TypeScript + Zod 双重保障
4. **设计模式优秀** - 泛型基类、物化模式、状态机

### 7.2 劣势
1. **构建工具选型不当** - tsup 用于应用构建有局限
2. **导入路径混乱** - 大量相对路径，重构困难
3. **部分功能待实现** - ACP 协议、心跳检测等
4. **缺少生产级配置** - 日志、监控、输入验证

### 7.3 总体评价
**代码质量**: A- (优秀的设计，一些小问题)
**架构设计**: A (清晰的分层，良好的扩展性)
**测试覆盖**: A (161 测试，100% 通过)
**技术选型**: B+ (构建工具需要调整)

**项目状态**: 核心基础设施已完成，适合继续开发，但建议在扩大规模前解决构建工具和导入路径问题。

---

*报告生成时间: 2026-02-20*
*分析范围: packages/core, packages/shared 及配置文件*
