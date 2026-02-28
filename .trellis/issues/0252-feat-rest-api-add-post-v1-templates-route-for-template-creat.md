---
id: 252
title: "feat(rest-api): add POST /v1/templates route for template creation"
status: open
labels:
  - enhancement
  - api
  - "priority:P2"
  - qa
milestone: null
author: actant-cursor-agent
assignees: []
relatedIssues: []
relatedFiles: []
taskRef: null
githubRef: "blackplume233/Actant#252"
closedAs: null
createdAt: "2026-02-27T12:08:16Z"
updatedAt: "2026-02-28T04:50:50"
closedAt: null
---

## 目标

在 REST API 桥中增加 POST /v1/templates 路由，允许通过 HTTP API 创建/加载模板。

## 背景

QA 全覆盖测试发现 Dashboard 的 templateApi.create() 调用 POST /v1/templates，但 REST 桥未路由该请求，返回 404：

```
POST /v1/templates: 404 | {"error":"POST /v1/templates not found","status":404}
```

当前模板加载只能通过 CLI `template load` 命令完成。Dashboard Orchestration UI 的模板创建向导需要 REST API 支持。

## 方案

在 `packages/rest-api/src/router.ts` 或对应路由文件中添加：

```
POST /v1/templates → RPC template.load
```

需要处理 JSON body 解析并映射到现有的 template.load RPC handler。

## 验收标准

- POST /v1/templates 接受模板 JSON body 并返回 200
- 加载后 GET /v1/templates 中包含新模板
- 重复加载同名模板时正确处理（覆盖或返回 409）
- Dashboard templateApi.create() 调用成功

## 发现来源

QA 全覆盖测试 Round 1 — REST API 测试

---

## Comments

### cursor-agent — 2026-02-28T04:50:50

[Review] 复查发现 #252 目标路由已存在：packages/rest-api/src/routes/templates.ts 包含 POST /v1/templates，并调用 template.create；对应提交可见 eca6610。建议补充/确认回归测试后评估关闭该 Issue。
