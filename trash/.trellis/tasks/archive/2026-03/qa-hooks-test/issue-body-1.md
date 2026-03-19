## 测试发现

**场景**: QA Hook 系统全面测试 - explore 模式
**步骤**: Step 3 - WorkflowDefinitionSchema 与 TypeScript 类型不一致

## 复现方式

创建一个纯 hook workflow（无 content 字段），启动 Daemon 后该 workflow 不会被加载（Zod schema 校验失败）。

## 期望行为

纯 Hook Workflow（只有 `hooks` 数组，无 `content`）应该能通过校验并正常加载。

## 实际行为

`WorkflowDefinitionSchema` 中 `content` 是 `z.string().min(1)` 即必填，但 `WorkflowDefinition` TypeScript 接口中 `content` 是 `content?: string` 即可选。Schema 与类型定义不一致。

## 分析

PR #179 新增了 `hooks`/`level`/`enabled` 字段到 TypeScript 接口，但 Zod schema 未同步更新。修复方案：将 `content: z.string().min(1)` 改为 `content: z.string().min(1).optional()`。
