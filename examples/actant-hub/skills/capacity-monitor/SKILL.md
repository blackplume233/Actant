---
name: capacity-monitor
description: 容量监控 — 持续监控磁盘、内存、进程数等系统容量指标，提前预警
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "capacity,monitoring,alerting,scavenger"
  layer: auxiliary
  agent: scavenger
---

# Capacity Monitor

## Overview

Continuous monitoring of disk, memory, process count, and other system capacity metrics; early warning.

## Threshold Configuration

- Define per-metric thresholds (e.g., disk > 85%, memory > 90%)
- Support absolute values (e.g., free disk < 5GB) and percentages
- Configurable per workspace or global defaults

## Trend Prediction

- Track metric history; extrapolate growth rate
- Predict when threshold will be breached (e.g., "disk full in ~7 days")
- Use simple linear regression or moving average

## Alert Escalation Levels

| Level | Condition | Action |
|-------|------------|--------|
| **Info** | Approaching threshold (e.g., 70%) | Log only; optional notification |
| **Warning** | At threshold (e.g., 85%) | Notify user; suggest cleanup |
| **Critical** | Severe (e.g., 95%) | Urgent alert; integrate with Maintainer for automated response |

## Integration with Maintainer

- On critical: delegate to Maintainer for automated cleanup (resource-scan + cleanup-policy)
- Pass context: which metric, current value, suggested actions
- Maintainer reports back; Capacity Monitor logs resolution
