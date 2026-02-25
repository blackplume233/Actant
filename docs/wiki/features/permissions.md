---
generated: true
---

<!-- GENERATED -->

# 权限控制

> 给 Agent 划定安全围栏。

## 四级预设

| 预设 | 工具 | 文件 | 网络 | 沙箱 | 场景 |
|------|------|------|------|------|------|
| `permissive` | 全部 | 全部 | 全部 | 关 | 可信内部环境 |
| `standard` | 白名单 | 工作区内 | 白名单域名 | 关 | 日常开发 |
| `restricted` | 最小集 | 只读 | 禁止 | 开 | 敏感环境 |
| `readonly` | 只读 | 只读 | 禁止 | 开 | 纯分析 |

## 使用

在模板中设置：

```json
{ "permissions": { "preset": "standard" } }
```

或自定义每个维度：

```json
{
  "permissions": {
    "tools": { "mode": "whitelist", "allowed": ["read_file", "search"] },
    "fileAccess": { "mode": "workspace" },
    "networkAccess": { "mode": "none" },
    "sandbox": { "enabled": true }
  }
}
```

也可以动态更新：

```bash
actant agent update-permissions my-agent --preset restricted
```
