## 测试发现

**场景**: ultimate-real-user-journey
**步骤**: p8-ctx-wb-extensions

## 复现方式

```bash
set ACTANT_HOME=%TEMP%\ac-qa-test
actant daemon start --foreground
# 使用包含 plugins 引用的模板创建 Agent
actant agent create rich-agent -t qa-rich-tpl
# 检查 workspace 中的 plugin 物化文件
ls %ACTANT_HOME%\instances\rich-agent\.cursor\extensions.json
```

## 期望行为

当模板 domainContext 包含 plugins 引用时，WorkspaceBuilder 应将 plugin 信息物化到 .cursor/extensions.json（或等价的配置文件）。

## 实际行为

.cursor/extensions.json 文件不存在。其他域组件（skills -> .cursor/rules/*.mdc, prompts -> prompts/system.md, mcp -> .cursor/mcp.json, workflow -> .trellis/workflow.md）均已正确物化。

## 分析

WorkspaceBuilder 目前可能尚未实现 plugin 到 .cursor/extensions.json 的物化逻辑。考虑到 Cursor IDE 的 extensions 配置机制，可能需要确认：
1. Plugin 物化的目标文件格式和路径
2. 是否需要物化（如果 plugins 仅作为元数据记录则不需要）
