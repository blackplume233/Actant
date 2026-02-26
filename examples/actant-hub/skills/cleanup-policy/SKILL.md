---
name: cleanup-policy
description: 清理策略 — 基于规则的自动清理执行引擎，支持 dry-run 预览和安全确认
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "cleanup,policy,automation,scavenger"
  layer: auxiliary
  agent: scavenger
---

# Cleanup Policy

## Overview

Rule-based automated cleanup execution engine; supports dry-run preview and safety confirmation.

## Cleanup Rules

- **Age-based**: Delete files older than N days (e.g., logs > 7 days)
- **Size-based**: Delete when directory exceeds threshold; evict oldest first
- **Pattern-based**: Match glob patterns (e.g., `*.log`, `*.tmp`); apply rule to matches

## Dry-Run Mode

- List all files/dirs that would be affected without modifying
- Show estimated space reclaimed; require explicit confirm before execution
- Output machine-readable report for integration

## Safety Checklist

- **Protected paths**: Never touch system dirs, `.git/`, config files, user home
- **Minimum free space guard**: Abort if cleanup would leave disk below threshold (e.g., 10%)
- **Whitelist/blacklist**: User-defined paths to always exclude or include

## Execution Logging

- Log every deleted file/dir with timestamp and size
- Persist log for audit; support rollback reference

## Cleanup Report Generation

- Summary: total reclaimed space, file count, rule breakdown
- Per-rule stats: matched vs deleted; skipped (protected) count
