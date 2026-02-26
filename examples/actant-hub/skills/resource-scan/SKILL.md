---
name: resource-scan
description: 资源扫描 — 全面扫描系统资源使用情况，识别可回收资源和冗余文件
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "scan,resource,disk,scavenger"
  layer: auxiliary
  agent: scavenger
---

# Resource Scan

## Overview

Comprehensive scan of system resource usage; identify reclaimable resources and redundant files.

## Disk Usage Analysis

- **By directory**: Aggregate size per directory; identify largest consumers
- **By age**: Find files not accessed/modified beyond threshold (e.g., 30 days)
- **By type**: Group by extension (e.g., .log, .tmp, .cache); report totals

## Orphan File Detection

- **Temp files**: System temp dirs, project `.tmp/`, `*.tmp`, `*.temp`
- **Build artifacts**: `dist/`, `build/`, `out/`, `.next/`, `node_modules/.cache/`
- **Stale caches**: Expired cache entries; caches exceeding max age or size

## Process Resource Consumption

- Identify zombie processes; suggest cleanup
- Detect memory leaks (long-running processes with growing RSS)
- Report top CPU/memory consumers for user review

## Docker Resource Audit

- **Dangling images**: Untagged images; report reclaimable space
- **Stopped containers**: List and estimate disk usage
- **Unused volumes**: Orphan volumes not attached to any container
- Provide `docker system df`-style summary
