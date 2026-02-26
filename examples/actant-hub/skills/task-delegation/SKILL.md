---
name: task-delegation
description: 任务委派 — 将用户请求分解并委派给合适的 Agent，跟踪执行状态，汇报结果
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "delegation,orchestration,task-management,steward"
  layer: kernel
  agent: steward
---

# Task Delegation

## Overview

Decompose user requests, delegate to appropriate Agents, track execution status, and report results.

## Agent Selection Criteria

| Agent | Best for | Example triggers |
|-------|----------|------------------|
| **Researcher** | Information gathering, web search, analysis | "Find", "research", "analyze" |
| **Maintainer** | Health checks, repair, evolution reports | "Fix", "diagnose", "report" |
| **Curator** | Memory, assets, lifecycle | "Archive", "cleanup", "govern" |
| **Scavenger** | Orphan cleanup, disk reclaim | "Clean", "reclaim" |
| **Onboarder** | New Agent setup, workspace init | "Create agent", "setup" |

## Task Decomposition

- Break complex requests into subtasks with clear dependencies
- Identify parallel vs sequential execution; prefer parallel when independent
- Set timeout and fallback for each subtask

## Execution Modes

- **Sequential**: A → B → C when B depends on A's output
- **Parallel**: A || B || C when independent; aggregate results
- **Fan-out/fan-in**: Delegate to N agents, merge outputs with defined strategy

## Result Aggregation

- Collect outputs from delegated Agents
- Apply merge strategy: concatenate, summarize, or pick best
- Format final response for user consumption

## Error Escalation

- On Agent failure: retry once; if still failing, escalate to Maintainer or report to user
- On timeout: cancel in-flight work, report partial results, suggest manual follow-up
