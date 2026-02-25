# 功能：安装与自更新

> Actant 提供一键安装脚本和自更新机制——安装后即可使用，后续版本升级无需手动操作。

---

## 这个功能做什么

安装脚本自动检测环境、安装依赖、构建项目并配置全局命令。自更新机制从源码仓库拉取最新版本，运行测试后自动替换，并支持回滚。

**一句话总结**：一行命令装好，一行命令升级。

---

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | >= 22.0.0 | 运行时 |
| pnpm | >= 9.0.0 | 包管理器（安装脚本自动安装） |
| Claude Code 或 Cursor | — | 至少一个 Agent 后端 |

---

## 安装方式

### 方式 1：一键安装（推荐）

**Linux / macOS**：

```bash
curl -fsSL https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.sh | bash
```

**Windows (PowerShell)**：

```powershell
irm https://raw.githubusercontent.com/blackplume233/Actant/master/scripts/install.ps1 | iex
```

安装脚本会自动：
1. 检测 Node.js 和 pnpm 环境
2. 安装 `actant` npm 包
3. 运行配置向导
4. 注册默认组件源

### 方式 2：从源码安装

```bash
git clone https://github.com/blackplume233/Actant.git
cd Actant
pnpm install
pnpm build
pnpm link --global
```

### 方式 3：本地开发安装

```bash
# 标准本地安装
node scripts/install-local.mjs

# Standalone 模式（打包为单个可执行文件）
node scripts/install-local.mjs --standalone
```

---

## 安装后的目录结构

```
~/.actant/
├── config.json         # 全局配置
├── configs/            # 领域组件（skills, prompts, templates, ...）
├── instances/          # Agent 实例工作区 + 注册表
├── sources/            # 组件源管理
├── logs/               # Daemon 和更新日志
└── backups/            # 自更新备份
```

---

## 全局配置

`~/.actant/config.json`：

```json
{
  "devSourcePath": "",
  "update": {
    "maxBackups": 3,
    "preUpdateTestCommand": "pnpm test:changed",
    "autoRestartAgents": true
  }
}
```

| 字段 | 说明 |
|------|------|
| `devSourcePath` | 开发源码路径（用于 self-update） |
| `update.maxBackups` | 最多保留的备份数量 |
| `update.preUpdateTestCommand` | 更新前运行的测试命令 |
| `update.autoRestartAgents` | 更新后是否自动重启 Agent |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `ACTANT_HOME` | `~/.actant` | Actant 主目录 |
| `ACTANT_SOCKET` | 自动检测 | IPC 通信路径 |
| `ANTHROPIC_API_KEY` | — | Anthropic API Key |
| `LOG_LEVEL` | `info` | 日志级别 |

---

## 自更新

### 检查更新

```bash
actant self-update --check
# 输出当前版本和最新版本的对比
```

### 执行更新

```bash
actant self-update
# 从源码拉取最新代码 → 安装依赖 → 运行测试 → 重新构建 → 替换
```

### 模拟执行

```bash
actant self-update --dry-run
# 执行所有步骤但不实际替换文件
```

### 强制更新

```bash
actant self-update --force
# 跳过版本检查，强制更新
```

### 更新流程

```
检查版本 → git pull → pnpm install → 运行测试 → pnpm build → 备份当前版本 → 替换 → 重启 Daemon
```

- 更新前自动备份到 `~/.actant/backups/`
- 如果测试失败，自动中止更新
- 配置 `autoRestartAgents: true` 时，更新后自动重启所有运行中的 Agent

---

## 验证示例

```bash
# 1. 确认安装成功
actant --version
# 预期: 显示版本号（如 0.2.2）

# 2. 检查帮助信息
actant help
# 预期: 显示所有可用命令

# 3. 检查 Daemon 是否可以启动
actant daemon start
actant daemon status
# 预期: Daemon running

# 4. 检查更新
actant self-update --check
# 预期: 显示当前版本信息

# 5. 模拟更新
actant self-update --dry-run
# 预期: 显示更新步骤但不实际执行

# 6. 清理
actant daemon stop
```

---

## 常见问题

### "actant: command not found"

```bash
# 重新链接全局命令
pnpm --filter @actant/cli link --global

# 或将 pnpm 的全局 bin 目录添加到 PATH
```

### Daemon 连接失败

```bash
# 检查 Daemon 状态
actant daemon status

# 如果未运行，启动它
actant daemon start
```

### 权限不足

```bash
# Linux/macOS：使用 sudo 或配置 npm prefix
sudo npm install -g actant

# Windows：以管理员身份运行 PowerShell
```

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [CLI 交互模式](cli-interaction.md) | 安装后的主要交互入口 |
| [组件源与同步](component-source.md) | 安装时自动注册默认组件源 |
