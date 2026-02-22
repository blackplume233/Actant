---
id: 32
title: "Initializer: 可扩展的 Agent 初始化流程框架"
status: open
labels:
  - feature
  - "priority:P1"
milestone: mid-term
author: cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#37"
closedAs: null
createdAt: "2026-02-20T16:18:19"
updatedAt: "2026-02-20T16:18:19"
closedAt: null
---

## 目标

实现一个可扩展、可配置的 **Initializer** 框架，在 Agent 物化（materialization）阶段执行自定义初始化流程。

## 背景

当前 `AgentInitializer` 只完成基础工作：
1. 创建 workspace 目录
2. 物化 Domain Context（skills → AGENTS.md, mcpServers → mcp.json 等）
3. 写入 .actant.json

但配置中已定义了 `InitializerConfig` 结构，支持声明初始化步骤：
```typescript
interface InitializerConfig {
  steps: InitializerStep[];
}

interface InitializerStep {
  type: string;
  config?: Record<string, unknown>;
}
```

这些步骤目前**未被实际执行**。

## 参考：Trellis 工作流模式

Trellis 使用 `.trellis/workflow.md` 定义开发流程，包含：
- 阶段（phase）划分
- 每个阶段的任务清单
- 可重复的步骤执行

Initializer 应借鉴此模式，提供**声明式 + 可编程**的初始化能力。

## 需求

### 1. InitializerStep 基类设计

```typescript
abstract class InitializerStepExecutor {
  readonly type: string;
  
  // 验证配置是否合法
  abstract validate(config: unknown): ValidationResult;
  
  // 执行步骤
  abstract execute(
    context: StepContext,
    config: unknown
  ): Promise<StepResult>;
  
  // 可选：回滚（失败时调用）
  rollback?(
    context: StepContext,
    config: unknown,
    error: Error
  ): Promise<void>;
}

interface StepContext {
  workspaceDir: string;
  instanceMeta: AgentInstanceMeta;
  template: AgentTemplate;
  logger: Logger;
  // 步骤间共享数据
  state: Map<string, unknown>;
}

interface StepResult {
  success: boolean;
  // 输出到下一步的数据
  output?: Record<string, unknown>;
  // 用户可见的消息
  message?: string;
}
```

### 2. 内置步骤实现

参考 Trellis 的常见初始化场景：

| 步骤类型 | 用途 | 配置示例 |
|---------|------|---------|
| `git-clone` | 克隆代码仓库 | `{ repo: "https://...", branch?: "main", depth?: 1 }` |
| `git-init` | 初始化新仓库 | `{ initialBranch?: "main" }` |
| `npm-install` | 安装 Node 依赖 | `{ registry?: "...", args?: ["--frozen-lockfile"] }` |
| `file-copy` | 复制模板文件 | `{ from: "./templates/config", to: "./config" }` |
| `file-template` | 渲染模板文件 | `{ template: "...", output: "./.env", variables: {...} }` |
| `exec` | 执行任意命令 | `{ command: "make", args: ["setup"] }` |
| `mkdir` | 创建目录结构 | `{ paths: ["./logs", "./temp"] }` |
| `write-file` | 写入文件 | `{ path: "./README.md", content: "..." }` |

### 3. 执行引擎

```typescript
class InitializationPipeline {
  constructor(
    private stepRegistry: StepRegistry,
    private options?: PipelineOptions
  );
  
  async run(
    steps: InitializerStep[],
    context: StepContext
  ): Promise<PipelineResult>;
  
  // 支持 dry-run 模式
  async dryRun(steps: InitializerStep[]): Promise<ValidationResult[]>;
  
  // 失败策略
  private handleFailure(
    failedStep: InitializerStep,
    error: Error,
    executedSteps: ExecutedStep[]
  ): Promise<void>;
}
```

**执行特性：**
- 顺序执行（步骤间有依赖关系）
- 事务性：失败时回滚已执行的步骤（如删除已 clone 的目录）
- 幂等性检测：支持标记步骤为幂等，中断后可安全重试
- 超时控制：每个步骤可配置超时
- 进度报告：回调或事件通知执行进度

### 4. 集成点

修改 `AgentInitializer.createInstance()`：

```typescript
async createInstance(...) {
  // ... 现有代码 ...
  
  // 执行初始化步骤（如果有）
  if (template.initializer?.steps) {
    const pipeline = new InitializationPipeline(this.stepRegistry);
    const result = await pipeline.run(template.initializer.steps, {
      workspaceDir,
      instanceMeta: meta,
      template,
      logger,
      state: new Map(),
    });
    
    if (!result.success) {
      // 清理 workspace 并抛出错误
      await this.cleanup(workspaceDir);
      throw new InitializationError(result.errors);
    }
  }
  
  return meta;
}
```

### 5. 配置验证

在 `template validate` 时预检初始化配置：
- 所有步骤类型是否已注册
- 配置是否符合步骤的 schema
- 检测循环依赖（如果未来支持步骤依赖图）

## 验收标准

- [ ] `InitializerStepExecutor` 抽象基类
- [ ] `InitializationPipeline` 执行引擎（支持顺序执行、失败回滚、超时）
- [ ] 至少 5 个内置步骤实现（git-clone, npm-install, file-copy, exec, mkdir）
- [ ] 步骤注册机制（支持用户扩展自定义步骤）
- [ ] 集成到 `AgentInitializer`，在创建实例时自动执行
- [ ] `template validate` 支持预检初始化配置
- [ ] 完整的单元测试覆盖
- [ ] 文档和配置示例

## 设计原则

1. **可扩展性**：通过注册机制支持自定义步骤，不修改核心代码
2. **可配置性**：所有行为通过声明式配置控制
3. **可观测性**：详细的日志、进度回调、执行报告
4. **安全性**：超时控制、资源限制、敏感信息（如 token）不直接暴露在配置中
5. **故障恢复**：失败回滚、幂等重试

## 参考文档

- 当前实现：`packages/core/src/initializer/`
- Trellis Workflow：`.trellis/workflow.md`
- 配置规范：`.trellis/spec/config-spec.md` §5 InitializerConfig
