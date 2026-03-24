# Agent Documentation

This directory contains AI-agent-generated content. All content here should be treated as **agent opinion** and requires human validation before being acted upon.

> Historical / delivery-memory notice:
> `docs/agent/` is not an active truth source.
> Use it as audit evidence, delivery memory, and release drafting context only.
> Active execution state remains in `docs/planning/contextfs-roadmap.md`; active architecture truth remains in spec/design entry docs.

## Subdirectories

- `sessions/` — AI development session summaries
- `analysis/` — Code analysis and architecture review reports
- `reviews/` — AI-generated code review reports
- `changelog-drafts/` — 交付前必须保留的 changelog 草稿区；正式 release changelog 仍由 `docs/stage/<version>/changelog.md` 汇总

## File Naming

Use `YYYY-MM-DD-agent-topic.md` format. Include the agent identifier (e.g., `cursor`, `claude`) in the filename.

## Changelog Draft Contract

`docs/agent/changelog-drafts/` 现在是交付流程中的强制中间件，而不是可选记录。

- 文件名必须为 `YYYY-MM-DD-<agent>-<topic>.md`
- 每个 draft 必须包含：
  - `# 标题`
  - `## 变更摘要`
  - `## 用户可见影响`
  - `## 破坏性变更/迁移说明`
  - `## 验证结果`
  - `## 关联 PR / Commit / Issue`

推荐入口：

```bash
./.trellis/scripts/create-changelog-draft.sh --topic <topic> --title "<Title>"
```

## Important

Content in this directory is **not authoritative**. It reflects the AI agent's understanding at a point in time and may contain errors or outdated assumptions. Always cross-reference with `docs/human/` and `docs/decisions/` for ground truth.
