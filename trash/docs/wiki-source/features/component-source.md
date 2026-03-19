---
generated: true
---

<!-- GENERATED -->

# 组件源

> 从 GitHub 或本地同步 Agent 组件，像 Homebrew Tap 一样管理。

组件源是 Actant 的组件分发机制。团队维护一个仓库，所有人一键同步组件。

## 两种类型

| 类型 | 来源 | 适用 |
|------|------|------|
| **GitHub** | Git 仓库 | 团队共享、社区分发 |
| **Local** | 本地目录 | 开发调试、私有组件 |

## 基本操作

```bash
# 注册
actant source add team-hub --github https://github.com/our-team/hub.git
actant source add dev-hub --local ./my-hub

# 同步（显示新增/更新/删除/Breaking Change）
actant source sync team-hub

# 验证
actant source validate team-hub

# 使用源中的模板
actant agent create reviewer -t team-hub@code-reviewer
```

## 预设（Preset）

Preset 把多个组件打包为一个组合，一键应用到模板：

```bash
actant preset list team-hub
actant preset apply team-hub@dev-suite my-template
```

## 仓库结构

```
my-hub/
├── actant.json       # 包清单（必需）
├── skills/           # Skill 组件
├── prompts/          # Prompt 组件
├── templates/        # Agent 模板
├── mcp/              # MCP 配置
├── workflows/        # 工作流
└── presets/          # 预设
```

详细教程见 [创建组件仓库](/recipes/create-hub)。
