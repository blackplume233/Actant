---
name: rollback-strategy
description: 回滚策略 — 更新失败时的安全回滚机制，保护系统状态不被破坏
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "rollback,safety,recovery,updater"
  layer: auxiliary
  agent: updater
---

# Rollback Strategy

## Overview

Safe rollback mechanism when updates fail; protect system state from corruption.

## Pre-Update Snapshot

- Create full snapshot of config, state, and critical data before update
- Store snapshot in versioned backup location (e.g., `.backups/pre-update-{timestamp}`)
- Include checksums for integrity verification

## Rollback Triggers

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Health check failure** | Post-update health probe fails | Immediate rollback |
| **Test failure** | Smoke tests or regression tests fail | Rollback and alert |
| **Timeout** | Update exceeds max allowed duration | Abort and rollback |
| **User abort** | User cancels during update | Clean rollback |

## Rollback Procedure

1. **Config restore**: Revert config files to pre-update snapshot
2. **Dependency downgrade**: Reinstall previous package versions from lockfile
3. **State recovery**: Restore persisted state (sessions, caches) from backup
4. **Verification**: Run post-rollback health check

## Post-Rollback Verification

- Confirm system is operational; run minimal smoke tests
- Report rollback success/failure to user; suggest manual inspection if needed
- Preserve rollback logs for debugging
