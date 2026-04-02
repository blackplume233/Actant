# Test Delegation & Templates

## 测试模板

每轮测试前加载以下模板：

```json
{
  "name": "rw-basic-tpl",
  "version": "1.0.0",
  "backend": { "type": "cursor" },
  "provider": { "type": "anthropic" },
  "domainContext": {}
}
```

```json
{
  "name": "rw-claude-tpl",
  "version": "1.0.0",
  "backend": {
    "type": "claude-code",
    "config": { "model": "claude-sonnet-4-20250514" }
  },
  "provider": {
    "type": "anthropic",
    "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" }
  },
  "domainContext": {}
}
```

## 委托 Prompt 模板

每轮测试委托给 QA Engineer SubAgent（通过 Task 工具）。委托时需提供：

1. **精确的环境变量**（TEST_DIR 和 PIPE_ID 的实际值，不是引用）
2. **测试场景名称或步骤列表**
3. **日志文件路径**
4. **本轮重点关注的 PR 和功能模块**
5. **期望返回的结果格式**（总步骤、PASS/WARN/FAIL 数、摘要）

```
你是 QA 测试工程师 SubAgent，执行 Round N 完整回归测试。

## 触发原因
<新提交列表和 PR 编号>

## 环境信息
- 项目根目录: <project_root>
- CLI: packages/cli/dist/bin/actant.js
- 环境变量（每条命令都必须精确设置）:
  - $env:ACTANT_HOME = "<actual_test_dir>"
  - $env:ACTANT_SOCKET = "<actual_socket_path>"
  - $env:ACTANT_LAUNCHER_MODE = "mock"（如适用）

## 测试内容
<Phase A-G 步骤列表，含期望行为>

## 日志要求
每步追加到 <log_file_path>

## 返回内容
- 总步骤 / PASS / WARN / FAIL
- 与前轮对比
- 新 PR 回归结果
- FAIL/WARN 摘要
```

## 回归测试步骤模板

每轮回归测试包含以下标准阶段（可根据新 PR 动态扩展）：

| Phase | 内容 | 步骤数 |
|-------|------|--------|
| A: 基础设施检查 | daemon status、template list、version、help、agent list | 5 |
| B: 边界错误 + destroy 幂等 | 不存在的 Agent CRUD、模板/skill/prompt not found | 8-10 |
| C: Agent 完整生命周期 | create → status → resolve → destroy、重复创建、幂等销毁 | 10-14 |
| D: 域组件 CRUD | template show、skill/prompt/mcp/workflow/plugin list | 4-7 |
| E: 并发 + Resolve | 多 Agent 并发创建、resolve 自动创建 | 6-10 |
| F: 压力/干扰测试 | 快速创建销毁、连续无效操作 | 2-4 |
| G: 清理验证 | agent list 为空、daemon status 正常 | 2 |
| X: PR 特定验证（动态） | 根据新 PR 功能模块添加针对性测试 | 动态 |
