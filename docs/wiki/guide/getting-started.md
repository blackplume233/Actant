---
generated: true
---

<!-- GENERATED -->

# 快速开始

5 分钟内装好 Actant，创建并运行你的第一个 Agent。

## 环境要求

- **Node.js** ≥ 22
- **Claude Code** 或 **Cursor**（至少安装一个 Agent 后端）

## 安装

::: code-group
```bash [Linux / macOS]
curl -fsSL https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.sh | bash
```
```powershell [Windows]
irm https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.ps1 | iex
```
```bash [从源码]
git clone https://github.com/blackplume233/Actant.git
cd Actant && pnpm install && pnpm build && pnpm link --global
```
:::

安装完成后验证：

```bash
actant --version
```

## 第一个 Agent

```bash
# 1. 启动后台守护进程
actant daemon start

# 2. 查看可用模板
actant template list

# 3. 从模板创建 Agent
actant agent create my-reviewer -t code-review-agent

# 4. 让 Agent 执行一个任务
actant agent run my-reviewer --prompt "审查 src/index.ts 的错误处理"

# 5. 或者进入交互式对话
actant agent chat my-reviewer
```

## 用完清理

```bash
actant agent stop my-reviewer
actant agent destroy my-reviewer --force
actant daemon stop
```

## 接下来

- [核心概念](./concepts) — 理解 Template / Instance / Domain Context
- [功能总览](/features/) — 浏览全部能力
- [创建组件仓库](/recipes/create-hub) — 团队共享 Agent 配方
