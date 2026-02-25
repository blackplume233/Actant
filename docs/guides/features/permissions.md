# 功能：权限控制（Permissions）

> 权限控制系统为 Agent 设定安全边界——限制它能使用的工具、能访问的文件、能连接的网络，以及是否运行在沙箱中。

---

## 这个功能做什么

不同场景对 Agent 的信任程度不同。一个内部开发 Agent 可能需要完全的文件读写权限，而一个面向外部用户的 Agent 则应该被严格限制。权限控制系统通过 4 级预设 + 自定义配置的方式，让用户精确控制 Agent 的行为边界。

**一句话总结**：给 Agent 划定安全围栏——能干什么、不能干什么。

---

## 四级权限预设

| 预设 | 工具权限 | 文件访问 | 网络访问 | 沙箱 | 适用场景 |
|------|---------|---------|---------|------|---------|
| `permissive` | 全部允许 | 全部允许 | 全部允许 | 关闭 | 可信环境，内部开发 |
| `standard` | 白名单 | 工作区内 | 白名单域名 | 关闭 | 一般开发使用（默认推荐） |
| `restricted` | 最小集 | 只读 | 禁止 | 开启 | 敏感环境，有限信任 |
| `readonly` | 只读工具 | 只读 | 禁止 | 开启 | 仅供查看和分析 |

---

## 使用场景

### 场景 1：内部开发 Agent（宽松模式）

团队内部使用，完全信任 Agent。

```json
{
  "permissions": { "preset": "permissive" }
}
```

### 场景 2：代码审查 Agent（标准模式）

需要读取代码但限制写入范围。

```json
{
  "permissions": { "preset": "standard" }
}
```

### 场景 3：安全审计 Agent（只读模式）

只允许读取代码进行分析，不允许任何修改。

```json
{
  "permissions": { "preset": "readonly" }
}
```

### 场景 4：自定义权限

精确控制每个维度：

```json
{
  "permissions": {
    "tools": {
      "mode": "whitelist",
      "allowed": ["read_file", "list_files", "search", "write_file"]
    },
    "fileAccess": {
      "mode": "workspace",
      "additionalPaths": ["/shared/configs"]
    },
    "networkAccess": {
      "mode": "whitelist",
      "allowedDomains": ["api.github.com", "registry.npmjs.org"]
    },
    "sandbox": { "enabled": false }
  }
}
```

---

## 操作方式

### 在模板中设置

```json
{
  "name": "my-agent",
  "backend": { "type": "claude-code" },
  "permissions": { "preset": "standard" }
}
```

### 动态更新运行中 Agent 的权限

```bash
actant agent update-permissions my-agent --preset restricted
```

### 查看 Agent 的当前权限

```bash
actant agent status my-agent
# 输出中包含 permissions 信息
```

---

## 各维度详解

### 工具权限（tools）

| 模式 | 行为 |
|------|------|
| `all` | 允许使用所有工具 |
| `whitelist` | 只允许 `allowed` 列表中的工具 |
| `none` | 禁止使用所有工具 |

### 文件访问（fileAccess）

| 模式 | 行为 |
|------|------|
| `all` | 读写任意路径 |
| `workspace` | 仅限 Agent 工作区内，可通过 `additionalPaths` 扩展 |
| `readonly` | 只读，不允许写入 |
| `none` | 禁止文件访问 |

### 网络访问（networkAccess）

| 模式 | 行为 |
|------|------|
| `all` | 允许访问任何网络地址 |
| `whitelist` | 仅允许 `allowedDomains` 列表中的域名 |
| `none` | 完全禁止网络访问 |

### 沙箱（sandbox）

启用沙箱后，Agent 进程运行在隔离环境中，限制其对宿主系统的影响。

---

## 验证示例

```bash
# 1. 启动 Daemon
actant daemon start

# 2. 创建一个使用 readonly 预设的模板 readonly-agent.json:
# {
#   "name": "readonly-agent",
#   "version": "1.0.0",
#   "backend": { "type": "claude-code" },
#   "permissions": { "preset": "readonly" }
# }

# 3. 加载模板
actant template load ./readonly-agent.json

# 4. 创建 Agent
actant agent create ro-test -t readonly-agent

# 5. 查看状态（确认权限配置）
actant agent status ro-test
# 预期: permissions 显示 readonly 预设

# 6. 更新权限为 standard
actant agent update-permissions ro-test --preset standard

# 7. 确认更新
actant agent status ro-test
# 预期: permissions 变为 standard

# 8. 清理
actant agent destroy ro-test --force
actant daemon stop
```

---

## 相关功能

| 功能 | 关联 |
|------|------|
| [Agent 模板系统](agent-template.md) | 权限在模板的 `permissions` 字段中定义 |
| [Agent 生命周期管理](agent-lifecycle.md) | 可动态更新运行中 Agent 的权限 |
