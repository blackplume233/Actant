# Quality Guidelines

> 当前质量基线服务于 `ContextFS` / `VFS` 文档收口后的实现阶段。

---

## Documentation First

任何结构性改动都先改文档，再改代码：

1. `vision/spec/design/roadmap` 先收口
2. 类型与契约随后固定
3. 再进入实现、测试、审查

修改核心模块前，必须先做 impact 分析。

---

## ContextFS Boundary Rules

任何设计、实现、评审都不得重新引入以下旧模型作为当前真相：

- 旧中心化 orchestration object
- `DomainContext`
- `workflow` 作为 V1 顶层对象
- 旧 tool registry 平台中心模型

如果新增或修改资源，至少回答：

- 它暴露哪些路径
- 它支持哪些操作
- 权限由谁判定
- 生命周期由谁持有
- 是否需要 `watch` 或 `stream`

---

## 通信层变更流程

通信层协议、接口或行为语义变更时：

1. 先更新对应 spec 文档
2. 如涉及频道协议，再同步更新 `docs/design/channel-protocol/`
3. 最后才修改实现代码

---

## TUI Testing

交互式 TUI 测试应优先使用无头测试 harness，而不是依赖真实 TTY 或脆弱的进程级交互。

---

## Language Conventions

- 文档默认中文
- 代码、类型、标识符使用英文
- commit message 使用英文
- 非显而易见的设计决策要写清楚，但避免把历史模型重新写回当前文档
