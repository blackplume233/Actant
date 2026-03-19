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
