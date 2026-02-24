---
title: "统一配置抽象与校验体系 #119"
status: in_progress
assignee: cursor-agent
issueRef: 119
createdAt: 2026-02-23
---

# 统一配置抽象与校验体系

## Phases

- [ ] Phase 1: AgentTemplate extends VersionedComponent
- [ ] Phase 2: 统一 ConfigValidationResult 类型
- [ ] Phase 3: TemplateRegistry extends BaseComponentManager
- [ ] Phase 4: BaseComponentManager.validate() 返回 ConfigValidationResult
- [ ] Phase 5: 子配置独立校验器
- [ ] Phase 6: RPC 和 API 集成
