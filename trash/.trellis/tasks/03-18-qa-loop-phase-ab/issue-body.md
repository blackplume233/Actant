## 测试发现

**场景**: Phase A/B 深度黑盒测试
**步骤**: 2.3 - Template show 检查 rules/toolSchema 持久化

## 复现方式

```bash
# 创建含 rules 和 toolSchema 的模板
echo '{"name":"test","version":"1.0.0","backend":{"type":"pi"},"rules":["Be concise"],"toolSchema":{"my_tool":{"type":"object"}}}' > test-tpl.json

# 加载并查看
actant template load test-tpl.json   # -> Loaded test@1.0.0
actant template show test -f json     # -> 输出中缺少 rules 和 toolSchema
```

## 期望行为

template show 应返回包含 rules 和 toolSchema 的完整模板。

## 实际行为

rules 和 toolSchema 被丢弃，持久化文件中也缺失。

## 分析

根因：toAgentTemplate() 在 template-loader.ts:103-134 使用显式字段列举，Phase B-2 新增的 rules/toolSchema 未同步添加。
Zod schema 第 147-148 行已正确定义。这是 Issue #118 的同类问题。

## 修复

已在本轮 QA 中即时修复，在 toAgentTemplate() 返回对象中添加 rules/toolSchema。
