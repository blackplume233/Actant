---
generated: true
---

<!-- GENERATED -->

# 安装

## 一键安装

安装脚本自动检测环境、安装 npm 包并运行配置向导。

::: code-group
```bash [Linux / macOS]
curl -fsSL https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.sh | bash
```
```powershell [Windows]
irm https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.ps1 | iex
```
:::

## 从源码安装

```bash
git clone https://github.com/blackplume233/Actant.git
cd Actant
pnpm install    # 需要 pnpm ≥ 9
pnpm build
pnpm link --global
```

## 安装后的目录

```
~/.actant/
├── config.json      全局配置
├── configs/         组件（skills, prompts, templates…）
├── instances/       Agent 实例工作区
├── sources/         组件源
├── logs/            日志
└── backups/         自更新备份
```

## 全局配置

`~/.actant/config.json`：

| 字段 | 说明 |
|------|------|
| `devSourcePath` | 开发源码路径（用于 self-update） |
| `update.maxBackups` | 保留的备份数 |
| `update.autoRestartAgents` | 更新后自动重启 Agent |

## 自更新

```bash
actant self-update              # 拉取最新版并重新构建
actant self-update --check      # 仅检查版本
actant self-update --dry-run    # 模拟执行
```

## 常见问题

**`actant: command not found`** — 运行 `pnpm --filter @actant/cli link --global`，或将 pnpm 全局 bin 加入 PATH。

**Daemon 连接失败** — `actant daemon status` 确认 Daemon 是否在运行。
