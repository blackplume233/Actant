---
name: trellis-command-router
description: '中转执行 `.cursor/commands` 里的 trellis 系列命令。用户输入 `/trellis-*`、短别名（如 `/ship` `/start` `/qa-fix`）或要求“执行 trellis 命令”时使用。职责是解析命令名、定位对应命令文件、把参数映射为 `{{input}}`，并按原命令规范执行。'
license: MIT
allowed-tools: Shell, Read, Glob, Grep, Task
---

# Trellis Command Router

## Overview

把 Codex 中的 slash 指令路由到既有 Cursor 命令文件，不复制逻辑、不重写流程。  
`.cursor/commands/*.md` 是唯一真相源，路由层只做解析与分发。

## Registered Commands

采用显式注册模式：只允许匹配已注册命令，不做隐式自动补全执行。

- 注册表：`references/registered-commands.md`
- 路由入口（平台命令包装）：
  - `commands/cursor.md`
  - `commands/claude.md`

## Resolution Workflow

按以下固定流程执行：

1. 提取命令与参数
- 从用户输入提取第一个 slash token（如 `/ship`）。
- 其余文本作为参数串，映射到目标命令的 `{{input}}`。

2. 规范化命令名
- 读取 `references/registered-commands.md`。
- 先按 `Input Command` 精确匹配。
- 再按 `Alias` 精确匹配。
- 仅当注册表命中时才得到目标文件；否则报告“命令不存在”并停止。

3. 加载并执行命令文件
- 读取命令文件全文，按其步骤执行。
- 若命令文件是“技能转发型”内容（例如 `@.agents/skills/.../commands/cursor.md`），继续读取目标文件并执行目标流程。

4. 输出执行摘要
- 说明路由结果：`原始命令 -> 命中文件`。
- 说明参数映射结果（即传入 `{{input}}` 的内容）。
- 说明执行阶段产物（通过/失败、关键输出）。

## Non-Goals

- 不改写 `.cursor/commands/*.md` 的业务规则。
- 不在路由层重新定义检查项（如 lint/type-check/test）；这些由目标命令文件决定。
- 不把路由层当成新的“命令真相源”。

## Fallback Behavior

当命令无法匹配时：
- 从 `references/registered-commands.md` 输出全部合法命令。
- 可给出前缀建议，但不得执行未注册命令。

命令解析细节见：`references/command-resolution.md`。
