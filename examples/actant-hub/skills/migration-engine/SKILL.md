---
name: migration-engine
description: 数据迁移引擎 — 执行跨版本数据格式迁移，确保配置、状态和存储的向前兼容
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "migration,schema,compatibility,updater"
  layer: auxiliary
  agent: updater
---

# Migration Engine

## Overview

Execute cross-version data format migrations; ensure forward compatibility of config, state, and storage.

## Migration Script Discovery

- Discover migration scripts by version range (e.g., v1.2.0 → v1.3.0)
- Load from Hub skill bundles or project `.migrations/` directory
- Order migrations by target version; execute sequentially

## Schema Diff Analysis

- Compare current schema with target schema; identify added, removed, renamed fields
- Detect type changes (string → number, object shape changes)
- Generate migration plan with required transformations

## Data Transformation

- Apply field mappings, type coercions, and default value injection
- Support custom transform functions for complex migrations
- Preserve unknown fields when schema allows additional properties

## Dry-Run Validation

- Simulate migration without writing; report planned changes
- Validate transform output against target schema
- Abort if validation fails; provide actionable error messages

## Progress Tracking & Partial Failure Recovery

- Track migration progress; support resume from last successful step
- On failure: rollback partial writes; persist failure state for retry
- Log all transformations for audit trail
