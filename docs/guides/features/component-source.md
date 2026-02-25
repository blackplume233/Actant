# 功能：组件源与同步（Component Source）

> 组件源是 Actant 的组件分发机制——类似 Docker Hub 或 Homebrew Tap，从 GitHub 仓库或本地目录同步 Skills、Templates、Presets 等组件。

---

## 这个功能做什么

组件源允许团队或社区将 Agent 组件（技能、模板、提示词等）打包为一个标准化仓库，任何 Actant 实例都可以注册并同步这些组件。

支持两种类型的源：

| 类型 | 数据来源 | 适用场景 |
|------|---------|---------|
| **GitHub Source** | GitHub 仓库（shallow clone） | 团队共享、社区分发 |
| **Local Source** | 本地目录 | 开发调试、私有组件 |

**一句话总结**：将 Agent 组件发布到 Git 仓库，让任何人一键同步使用。

---

## 核心概念

### 包清单（PackageManifest）

每个组件源仓库必须在根目录包含 `actant.json` 文件，描述源的名称和组件列表：

```json
{
  "name": "my-hub",
  "version": "0.1.0",
  "description": "我的组件仓库",
  "components": {
    "skills": ["skills/code-review.json"],
    "prompts": ["prompts/system-prompt.json"],
    "templates": ["templates/code-reviewer.json"]
  },
  "presets": ["presets/dev-suite.json"]
}
```

如果省略 `components`，Source 系统会自动扫描 `skills/`、`prompts/`、`mcp/`、`workflows/`、`templates/`、`presets/` 目录。

### 同步报告（SyncReport）

每次同步时生成报告，包含：
- **新增**的组件数量
- **更新**的组件数量
- **删除**的组件数量
- **Breaking Change** 检测

### 预设（Preset）

Preset 是按场景打包的组件组合，可一键应用到模板上：

```json
{
  "name": "dev-suite",
  "version": "1.0.0",
  "skills": ["code-review", "test-writer"],
  "prompts": ["system-prompt"],
  "mcpServers": ["filesystem"]
}
```

---

## 使用场景

### 场景 1：团队内共享组件库

团队维护一个 GitHub 仓库作为 Agent 组件的统一来源。

```bash
# 注册团队的组件源
actant source add team-hub --github https://github.com/our-team/agent-hub.git

# 同步最新组件
actant source sync team-hub

# 使用团队模板创建 Agent
actant agent create my-agent -t team-hub@code-reviewer
```

### 场景 2：本地开发调试组件

在发布到 GitHub 之前，先在本地验证组件的正确性。

```bash
# 注册本地目录为组件源
actant source add dev-hub --local ./my-hub

# 验证数据完整性
actant source validate dev-hub

# 同步加载组件
actant source sync dev-hub

# 确认组件已加载
actant skill list
# 预期: 出现 dev-hub@my-skill 等
```

### 场景 3：使用 Preset 快速配置模板

```bash
# 查看可用预设
actant preset list team-hub

# 查看预设详情
actant preset show team-hub@dev-suite

# 将预设中的所有组件应用到模板
actant preset apply team-hub@dev-suite my-template
```

### 场景 4：CI/CD 中自动验证组件

在组件仓库的 CI 流水线中自动校验：

```yaml
# .github/workflows/validate-hub.yml
name: Validate Hub
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm install -g actant
      - run: actant source validate --path . --strict
```

---

## 操作方式

### 源管理

```bash
actant source list                                    # 列出已注册源
actant source add <name> --github <url>               # 注册 GitHub 源
actant source add <name> --github <url> --branch dev  # 指定分支
actant source add <name> --local <path>               # 注册本地源
actant source remove <name>                           # 删除源
actant source sync <name>                             # 同步单个源
actant source sync                                    # 同步所有源
actant source validate <name>                         # 验证已注册源
actant source validate --path ./my-hub                # 验证本地目录
actant source validate <name> --strict                # 严格模式
```

### 预设管理

```bash
actant preset list [source]                           # 列出预设
actant preset show <source>@<preset>                  # 查看预设详情
actant preset apply <source>@<preset> <template>      # 应用预设到模板
```

---

## 组件源目录结构

```
my-hub/
├── actant.json              # 必需：包清单
├── README.md
├── skills/                  # Skill 组件
│   ├── my-skill.json
│   └── my-skill/
│       └── SKILL.md         # Agent Skills 兼容格式
├── prompts/                 # Prompt 组件
│   └── my-prompt.json
├── mcp/                     # MCP Server 配置
│   └── my-mcp.json
├── workflows/               # Workflow 组件
│   └── my-workflow.json
├── templates/               # Agent Template
│   └── my-template.json
├── backends/                # 后端描述符
│   └── my-backend.json
└── presets/                 # 组合包
    └── my-preset.json
```

---

## 离线行为

| 场景 | 行为 |
|------|------|
| 已缓存的 GitHub Source | 正常工作，`sync` 操作跳过并记录警告 |
| 未缓存的 GitHub Source | `fetch` 和 `sync` 失败，不影响其他源 |
| Local Source | 完全不受网络状态影响 |
| 默认源注册 | 网络不可用时静默跳过，不影响其他功能 |

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 查看当前已注册的源
actant source list
# 预期: 可能显示 actant-hub（默认源）

# 3. 创建一个本地 Hub 目录
mkdir test-hub && cd test-hub
mkdir skills

# 4. 创建 actant.json
# { "name": "test-hub" }

# 5. 创建一个技能文件 skills/test-skill.json
# { "name": "test-skill", "content": "Test skill content" }

# 6. 验证 Hub 结构
actant source validate --path .
# 预期: Validation passed

# 7. 注册为本地源
actant source add test-hub --local .
# 预期: Source added: test-hub

# 8. 同步组件
actant source sync test-hub
# 预期: SyncReport 显示新增组件

# 9. 确认组件已加载
actant skill list
# 预期: 出现 test-hub@test-skill

# 10. 清理
actant source remove test-hub
actant daemon stop
```

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 模板系统](agent-template.md) | 源中的模板可直接用于创建 Agent |
| [领域上下文拼装](domain-context.md) | 源中的组件是领域上下文的来源之一 |
| [创建自定义 Hub](../create-custom-hub.md) | 从零创建组件源仓库的完整教程 |
