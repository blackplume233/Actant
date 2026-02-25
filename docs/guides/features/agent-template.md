# 功能：Agent Template 系统

> Agent Template 是 Actant 的核心配置单元，类似 Docker 中的 Dockerfile，定义了一个 Agent 的全部能力蓝图。

---

## 这个功能做什么

Agent Template 是一个 JSON 配置文件，它描述了一个 Agent"应该长什么样"——使用什么后端、具备哪些技能、遵循哪些提示词、对接哪些工具、拥有什么权限。通过模板，用户可以将 Agent 的配置标准化和复用化，避免每次手动配置。

**一句话总结**：写一个 JSON 文件，就能定义一个可重复创建的 Agent 类型。

---

## 核心结构

一个完整的 Agent Template 包含以下部分：

```
AgentTemplate
├── name                 模板名称（唯一标识）
├── version              语义化版本号（semver）
├── description          描述信息
├── backend              Agent 后端配置
│   ├── type             "cursor" | "claude-code" | "cursor-agent" | "pi" | "custom"
│   └── config           后端特定参数（如 model、apiKeyEnv）
├── provider             模型提供商
│   ├── type             "anthropic" | "openai" | "custom"
│   └── config           提供商参数
├── domainContext        领域上下文（Agent 能力组合）
│   ├── skills           引用的技能列表
│   ├── prompts          引用的提示词列表
│   ├── mcpServers       MCP 工具服务器配置
│   ├── workflow         工作流引用
│   ├── plugins          插件列表
│   └── subAgents        子 Agent 列表
├── permissions          权限配置
├── initializer          工作区初始化步骤
├── schedule             调度配置（雇员模式）
├── metadata             自定义元数据
└── tags                 分类标签
```

---

## 使用场景

### 场景 1：为团队定义标准的代码审查 Agent

团队希望所有人使用相同配置的代码审查 Agent，确保审查标准统一。

```json
{
  "name": "team-code-reviewer",
  "version": "1.0.0",
  "description": "团队标准代码审查 Agent",
  "backend": {
    "type": "claude-code",
    "config": { "model": "claude-sonnet-4-20250514" }
  },
  "provider": {
    "type": "anthropic",
    "config": { "apiKeyEnv": "ANTHROPIC_API_KEY" }
  },
  "domainContext": {
    "skills": ["code-review", "typescript-expert"],
    "prompts": ["system-code-reviewer"],
    "mcpServers": [
      { "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic/mcp-filesystem"] }
    ],
    "workflow": "trellis-standard"
  },
  "permissions": { "preset": "standard" }
}
```

### 场景 2：创建带定时任务的 PR 巡检 Agent

每天早上 9 点自动检查是否有新 PR 需要审查。

```json
{
  "name": "daily-pr-reviewer",
  "version": "1.0.0",
  "backend": { "type": "claude-code" },
  "provider": { "type": "anthropic" },
  "domainContext": {
    "skills": ["code-review"],
    "prompts": ["system-code-reviewer"]
  },
  "schedule": {
    "cron": [
      { "pattern": "0 9 * * 1-5", "prompt": "检查所有待审查的 PR 并生成审查报告", "timezone": "Asia/Shanghai" }
    ]
  }
}
```

### 场景 3：最小化模板

只需要指定后端类型就能创建一个基础 Agent。

```json
{
  "name": "minimal-agent",
  "version": "1.0.0",
  "backend": { "type": "claude-code" }
}
```

---

## 操作方式

### 查看可用模板

```bash
actant template list
```

### 查看模板详情

```bash
actant template show code-review-agent
```

### 加载自定义模板

```bash
actant template load ./my-template.json
```

### 校验模板文件（不加载）

```bash
actant template validate ./my-template.json
```

### 安装模板到全局配置目录

```bash
actant template install ./my-template.json
```

### 从模板创建 Agent

```bash
actant agent create my-agent -t code-review-agent
```

### 卸载模板

```bash
actant template unload code-review-agent
```

---

## 验证示例

以下流程验证模板系统的完整工作链路：

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 确认内置模板已加载
actant template list
# 预期输出: 显示 code-review-agent 等模板

# 3. 查看内置模板详情
actant template show code-review-agent
# 预期输出: 完整的模板 JSON，包含 backend、domainContext 等

# 4. 编写一个自定义模板文件 test-template.json
# （内容见上方"最小化模板"示例）

# 5. 校验模板
actant template validate ./test-template.json
# 预期输出: Validation passed

# 6. 加载模板
actant template load ./test-template.json
# 预期输出: Template loaded: minimal-agent

# 7. 确认模板已注册
actant template list
# 预期输出: 列表中出现 minimal-agent

# 8. 从模板创建 Agent
actant agent create test-agent -t minimal-agent
# 预期输出: Agent created: test-agent

# 9. 清理
actant agent destroy test-agent --force
actant template unload minimal-agent
actant daemon stop
```

---

## 内置模板

Actant 自带以下模板，位于 `configs/templates/` 目录：

| 模板 | 说明 | 后端 |
|------|------|------|
| `code-review-agent` | 代码审查 Agent，具备 code-review 和 typescript-expert 技能 | claude-code |

用户可通过 [创建自定义 Hub](../create-custom-hub.md) 分享和分发自己的模板。

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [领域上下文拼装](domain-context.md) | 模板中 `domainContext` 的具体组件如何工作 |
| [权限控制](permissions.md) | 模板中 `permissions` 字段的详细说明 |
| [雇员调度器](employee-scheduler.md) | 模板中 `schedule` 字段如何驱动自动化 |
| [组件源与同步](component-source.md) | 如何从远程获取和分发模板 |
