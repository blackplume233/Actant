# ActantHub 使用指南

> ActantHub 是 Actant 平台的官方默认组件仓库，类似 Homebrew 的 `homebrew-core`。它提供开箱即用的 Skills、Prompts、MCP 配置、Templates 和 Presets。

## 什么是 ActantHub

ActantHub 是一个**组件源（Source）**——一个标准化的目录结构（本地或 Git 仓库），包含可被 Actant 发现和加载的组件。安装 Actant 后，`actant-hub` 作为默认源自动注册。

**ActantHub 提供的组件类型**：

| 类型 | 说明 | 示例 |
|------|------|------|
| Skills | Agent 遵循的规则/知识 | `code-review`, `test-writer` |
| Prompts | 系统提示词模板 | `system-prompt` |
| MCP Servers | MCP 服务器配置 | `filesystem` |
| Templates | 完整的 Agent 配置模板 | `code-reviewer` |
| Presets | 组件组合包 | `dev-suite` |

## 管理 Source

### 查看已注册的源

```bash
actant source list
```

输出示例：

```
  actant-hub  (github)  https://github.com/blackplume233/actant-hub.git
  my-hub      (local)   /home/user/my-hub
```

### 添加 GitHub 源

```bash
actant source add <name> --github <url> [--branch <branch>]
```

示例：

```bash
actant source add actant-hub --github https://github.com/blackplume233/actant-hub.git
actant source add my-remote --github https://github.com/user/my-hub.git --branch dev
```

### 添加本地源

```bash
actant source add <name> --local <path>
```

示例：

```bash
actant source add my-local --local ./path/to/my-hub
```

### 同步源

从远程获取最新组件（本地源也会重新扫描）：

```bash
# 同步单个源
actant source sync actant-hub

# 同步所有源
actant source sync
```

同步报告会显示新增、更新和删除的组件数量，以及是否存在 breaking changes。

### 移除源

```bash
actant source remove my-hub
```

### 验证源

检查源中所有组件的数据完整性：

```bash
# 验证已注册的源
actant source validate actant-hub

# 验证本地目录（无需注册）
actant source validate --path ./my-hub

# 严格模式（warnings 也视为失败）
actant source validate actant-hub --strict

# JSON 输出
actant source validate actant-hub --format json
```

## 安装和使用组件

### 安装 Template

使用 `source@name` 格式引用源中的组件：

```bash
actant template install actant-hub@code-reviewer
```

安装后模板会在本地注册，可以直接使用：

```bash
actant agent create my-reviewer --template actant-hub@code-reviewer
```

### 浏览可用组件

```bash
# 列出所有 Skills
actant skill list

# 列出所有 Templates
actant template list

# 查看 Template 详情
actant template show actant-hub@code-reviewer
```

源中的组件以 `package@name` 格式命名，例如 `actant-hub@code-review`。

### 使用 Preset

Preset 是按场景打包的组件组合。查看可用 Preset：

```bash
actant preset list
actant preset show actant-hub@dev-suite
```

应用 Preset 到模板：

```bash
actant preset apply actant-hub@dev-suite --template my-template
```

这会将 Preset 中定义的所有 skills、prompts、MCP servers 等注入到指定模板的 `domainContext` 中。

## Local Source vs GitHub Source

| 特性 | Local Source | GitHub Source |
|------|-------------|--------------|
| 数据来源 | 本地目录 | GitHub 仓库（shallow clone） |
| 适用场景 | 开发调试、私有组件 | 生产环境、团队共享 |
| 同步方式 | 重新扫描目录 | `git pull` 或重新克隆 |
| 缓存 | 无 | `~/.actant/sources-cache/<name>/` |
| 网络需求 | 无 | 首次 fetch 和 sync 需要网络 |

## 离线行为

- **已缓存的 GitHub Source**：正常工作，使用本地缓存数据。`sync` 操作会跳过并记录警告。
- **未缓存的 GitHub Source**：`fetch` 和 `sync` 会失败，但不影响其他源。
- **Local Source**：完全不受网络状态影响。
- **默认源注册**：如果网络不可用，`actant-hub` 默认源会静默跳过注册，不影响其他功能。
