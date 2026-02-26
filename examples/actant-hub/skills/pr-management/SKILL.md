---
name: pr-management
description: "PR 管理 — 创建、维护和响应 Pull Request，处理 review 意见和 CI 反馈"
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "pr,github,review,spark"
  layer: spark
  agent: actant-spark
---

# PR Management

## Overview

Create, maintain, and respond to Pull Requests. Handle review feedback and CI failures to ship changes successfully.

## PR Creation

- **Title**: Clear, descriptive; use conventional format (feat:, fix:, refactor:)
- **Description**: Link to Issue, summarize changes, list testing done
- **Labels**: Apply appropriate labels (bug, feature, documentation, etc.)

## Review Response Workflow

- Address each review comment: fix, explain, or discuss
- Push follow-up commits; avoid force-push unless rebase is required
- Re-request review after addressing feedback

## CI Failure Analysis and Fix

- Parse CI logs to identify failing tests or lint errors
- Fix root cause locally; verify with same commands CI runs
- Push fix; monitor CI until green

## Merge Conflict Resolution

- Rebase or merge main into branch when conflicts arise
- Resolve conflicts carefully; preserve intended changes
- Run full test suite after resolving conflicts

## Changelog Entry

- Add entry to CHANGELOG.md (or equivalent) for user-facing changes
- Follow existing changelog format and section structure
