---
name: evolution-report
description: 进化报告 — 分析系统运行趋势，识别改进机会，生成周度进化建议
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "evolution,analytics,improvement,maintainer"
  layer: kernel
  agent: maintainer
---

# Evolution Report

## Overview

Analyze system operation trends, identify improvement opportunities, and generate weekly evolution recommendations.

## Trend Analysis

- **Performance**: Latency percentiles, throughput over time
- **Stability**: Error rate, crash frequency, recovery time
- **Usage**: Agent invocations, skill usage, template adoption
- **Resource**: Disk growth, memory patterns, temp file accumulation

## Performance Benchmarks

- Compare current week vs prior week for key metrics
- Flag regressions: "Latency p99 increased 2x vs last week"
- Highlight improvements: "Error rate down 30% after config fix"

## Error Pattern Aggregation

- Group errors by type, Agent, and time window
- Identify top N recurring issues
- Correlate with deployments or config changes

## Improvement Proposals

- **Quick wins**: Low-effort fixes with high impact
- **Technical debt**: Areas needing refactor or cleanup
- **Capacity**: Scaling or resource limits to consider
- **Skills**: Underused or overused skills; suggest additions/removals

## Skill Effectiveness Scoring

- Track: skill invocation count, success rate, user satisfaction (if available)
- Recommend: deprecate low-value skills, promote high-value ones
- Report: "Skill X used 50x, 95% success; Skill Y used 2x, 30% success — consider deprecating Y"
