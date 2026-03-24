# Changelog Drafts

交付采用“先草稿后汇总”。

> Archive / delivery-memory notice:
> `docs/agent/changelog-drafts/` is a delivery-memory surface.
> Drafts here support ship / merge / release aggregation, but they are not active architecture or roadmap truth.

- 日常 ship / merge 前，必须先在这里保留 changelog draft
- 正式 release changelog 仍由 `docs/stage/<version>/changelog.md` 汇总生成
- 文件名必须为 `YYYY-MM-DD-<agent>-<topic>.md`

最小模板：

```md
# 标题

## 变更摘要

## 用户可见影响

## 破坏性变更/迁移说明

## 验证结果

## 关联 PR / Commit / Issue
```
