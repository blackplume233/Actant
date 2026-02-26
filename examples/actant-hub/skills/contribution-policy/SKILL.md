---
name: contribution-policy
description: 贡献策略 — 遵循项目贡献规范，选择合适的 Issue、规划开发路径、确保质量标准
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "contribution,policy,standards,spark"
  layer: spark
  agent: actant-spark
---

# Contribution Policy

## Overview

Follow project contribution norms: select appropriate Issues, plan development path, and ensure quality standards.

## Issue Selection Criteria

- **good-first-issue**: Prefer labeled issues for onboarding; scope should be clear
- **Priority**: Align with project roadmap; high-priority bugs before low-priority features
- **Complexity**: Match skill level; avoid over-scoped or underspecified issues

## Branch Naming Convention

- Use format: `{type}/{short-description}` (e.g., feat/add-login, fix/typo-in-readme)
- Keep names short, lowercase, hyphen-separated
- Include Issue number when applicable: `fix/123-fix-null-check`

## Commit Message Convention

- Use conventional commits: feat:, fix:, docs:, refactor:, test:, chore:
- Scope optional: feat(auth): add login
- Body: explain what and why; reference Issue with Closes #N

## Testing Requirements

- New code must have tests; maintain or improve coverage
- All tests must pass before PR submission
- Integration tests for critical paths when applicable

## Documentation Requirements

- Update docs for user-facing changes
- Add JSDoc/TSDoc for public APIs
- Keep CONTRIBUTING and README accurate
