---
name: version-check
description: 版本检查 — 检测 Actant 核心、Hub 组件、依赖包的可用更新，评估更新优先级
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "version,update,dependency,updater"
  layer: auxiliary
  agent: updater
---

# Version Check

## Overview

Detect available updates for Actant core, Hub components, and dependencies; assess update priority.

## Version Comparison (Semver)

- Parse and compare semantic versions (major.minor.patch)
- Support pre-release tags (alpha, beta, rc) and build metadata
- Handle version ranges (^, ~, >=) for dependency resolution

## Update Source Scanning

- **npm**: Query registry for package versions; check `latest`, `next` dist-tags
- **GitHub releases**: Fetch release tags and assets; parse release notes
- **Hub sources**: Scan local Hub manifests and remote Hub indexes for component updates

## Priority Assessment

| Priority | Condition | Action |
|----------|-----------|--------|
| **Security** | CVE, vulnerability fix | Recommend immediate update |
| **Breaking** | Major version bump | Require migration review |
| **Feature** | Minor version bump | Suggest update when convenient |
| **Patch** | Patch version bump | Optional, low risk |

## Changelog Parsing

- Extract notable changes from CHANGELOG.md or release notes
- Map changes to affected components; highlight breaking changes
- Summarize for user decision-making
