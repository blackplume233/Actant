---
generated: true
---

<!-- GENERATED -->

# 创建组件仓库

从零创建一个可被任何 Actant 实例同步的组件仓库（Hub）。

## 1. 初始化

```bash
mkdir my-hub && cd my-hub
git init
mkdir skills prompts templates presets
```

## 2. 创建包清单

`actant.json`（必须放在根目录）：

```json
{
  "name": "my-hub",
  "version": "0.1.0",
  "description": "我的组件仓库"
}
```

省略 `components` 字段时，Source 系统自动扫描标准目录。

## 3. 添加组件

创建一个 Skill：

```json
// skills/security-review.json
{
  "name": "security-review",
  "version": "1.0.0",
  "description": "安全审查技能",
  "content": "# 安全审查\n\n- 检查注入风险\n- 验证输入\n- 审查认证逻辑"
}
```

创建一个 Template：

```json
// templates/security-agent.json
{
  "name": "security-agent",
  "version": "1.0.0",
  "backend": { "type": "claude-code" },
  "domainContext": { "skills": ["security-review"] }
}
```

## 4. 验证

```bash
actant source validate --path .
```

## 5. 本地测试

```bash
actant source add my-hub --local .
actant source sync my-hub
actant skill list          # 应该看到 my-hub@security-review
actant template list       # 应该看到 my-hub@security-agent
```

## 6. 发布

```bash
git add . && git commit -m "feat: initial hub"
git remote add origin https://github.com/you/my-hub.git
git push -u origin main
```

其他人注册：

```bash
actant source add my-hub --github https://github.com/you/my-hub.git
actant source sync my-hub
```

## CI 自动校验

```yaml
# .github/workflows/validate.yml
name: Validate Hub
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm install -g actant
      - run: actant source validate --path . --strict
```
