---
name: lifecycle-policy
description: 生命周期策略 — 保留/备份/过期/清理策略引擎，适用于记忆和资产的统一生命周期管理
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "lifecycle,retention,backup,curator"
  layer: kernel
  agent: curator
---

# Lifecycle Policy

## Overview

Retention, backup, expiration, and cleanup policy engine. Applies to both memories and assets for unified lifecycle management.

## Retention Policy

**Purpose**: Define how long to keep data before archival or deletion.

- **maxAge**: Maximum age (e.g. 90 days); older items are subject to onExpiry
- **maxSize**: Maximum total size (e.g. 10GB); when exceeded, evict oldest or lowest-value
- **onExpiry**: Action when retention limit reached:
  - `archive`: Move to cold storage (read-only, excluded from normal retrieval)
  - `delete`: Permanently remove
  - `notify`: Alert user; defer action until acknowledged
- **Scope**: Per asset type, per Template, or global default

## Backup Policy

**Purpose**: Create recoverable snapshots of critical state.

- **Config snapshots**: Before config changes; store last N versions
- **Data export**: Periodic export of memories, activity logs, asset metadata
- **Schedule**: Time-based (daily, weekly) or event-based (before major change)
- **Storage**: Local backup dir or external (user-configured)

## Capacity Governance

**Purpose**: Monitor disk usage and prevent overflow.

- **Monitor**: Track disk usage for workspace, logs, temp, backups
- **Thresholds**: Warn at 80%, critical at 95%
- **Over-limit actions**:
  - Notify user with breakdown (what's using space)
  - Auto-cleanup: temp files, old logs, expired archives
  - Delegate to Scavenger: orphan cleanup, aggressive reclaim
- **Escalation**: If auto-cleanup insufficient, block new writes and alert

## Expired Asset Archival / Cleanup

**Purpose**: Apply retention policy to assets and memories.

- **Expired assets**: Mark as archived; move to archive storage or delete per policy
- **Expired memories**: Apply confidence decay; archive or evict per memory-governance rules
- **Audit**: Log all archival/deletion for compliance and debugging

## Orphan Asset Detection

**Purpose**: Identify assets no longer referenced by any active Agent or user.

- **Orphan criteria**: No Agent references; no recent access; owner Agent destroyed
- **Detection**: Periodic scan; cross-reference with Agent registry, Template refs
- **Actions**:
  - Report to user: "Asset X is orphaned; archive or delete?"
  - Auto-archive: If policy allows, move to orphan archive
  - Delegate to Scavenger: Reclaim disk, remove from registry
- **Safety**: Never auto-delete without explicit policy; prefer archive + notify
