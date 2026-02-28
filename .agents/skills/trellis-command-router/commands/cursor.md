# Trellis Command Router

将用户输入的 trellis/别名命令按注册表逐条映射到 `.cursor/commands/*.md`，并执行目标命令文件。

## 前置准备

读取路由技能与注册表：

```
@.agents/skills/trellis-command-router/SKILL.md
@.agents/skills/trellis-command-router/references/registered-commands.md
```

## 用户指令

{{input}}

## 执行要求

1. 只使用注册表中的命令与别名做匹配。
2. 匹配后执行对应 `.cursor/commands/<name>.md`。
3. 将命令后参数映射为目标命令 `{{input}}`。
4. 未匹配时输出候选命令列表，不做模糊猜测执行。
