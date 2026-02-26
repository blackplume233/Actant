---
name: self-repair
description: "自修复 — 根据诊断结果自动执行修复操作，重启服务、清理状态、回滚配置"
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "repair,recovery,self-healing,maintainer"
  layer: kernel
  agent: actant-maintainer
---

# Self-Repair

## Overview

Execute repair operations based on diagnosis: restart services, reset state, rollback config.

## Repair Strategies

| Strategy | When to use | Actions |
|----------|-------------|---------|
| **Restart** | Process hung, memory leak | Stop -> wait -> start; verify healthy |
| **State reset** | Corrupted workspace state | Clear temp, reset session; preserve user data |
| **Config rollback** | Bad config caused failure | Restore last-known-good from backup |
| **Dependency reinstall** | MCP/npm failure | Reinstall from lockfile; verify |

## Safety Guards

- **Dry-run first**: Log intended actions; require confirmation for destructive ops
- **Backup before change**: Snapshot config/state before repair
- **Rollback plan**: If repair fails, revert to pre-repair state
- **Rate limit**: Max N repairs per hour; escalate to human if exceeded

## Repair Verification

- After restart: poll health endpoint / check process list
- After state reset: run smoke test (e.g. create Agent, list)
- After config rollback: validate schema, test load
- Report: success / partial / failed with next-step recommendation
