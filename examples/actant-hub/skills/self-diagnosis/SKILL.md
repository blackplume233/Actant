---
name: self-diagnosis
description: 自诊断 — 监控系统健康指标，检测异常模式，定位故障根因
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "diagnosis,monitoring,health-check,maintainer"
  layer: kernel
  agent: maintainer
---

# Self-Diagnosis

## Overview

Monitor system health metrics, detect anomaly patterns, and locate root causes of failures.

## Health Metrics

| Metric | Source | Thresholds |
|--------|--------|------------|
| **CPU** | Process / OS | > 90% sustained → alert |
| **Memory** | RSS, heap | > 80% of limit → warn |
| **Disk** | Workspace, logs, temp | < 10% free → alert |
| **Process** | Daemon, Agent PIDs | Not running → critical |
| **Latency** | RPC, ACP round-trip | > 5s → warn |

## Anomaly Detection Patterns

- **Spike**: Sudden jump in metric; compare to rolling baseline
- **Drift**: Gradual degradation over time
- **Cascade**: One failure triggers others; trace dependency chain
- **Recurrence**: Same error pattern repeats; correlate with recent changes

## Log Analysis

- Parse stderr, daemon logs, Agent activity logs
- Extract error codes, stack traces, timestamps
- Group by error type; count frequency; identify hotspots

## Dependency Chain Tracing

- Map: Daemon → Agent → MCP → external service
- On failure: walk upstream to find first failing component
- Report: "Agent X failed because MCP Y timed out; MCP Y failed because..."
