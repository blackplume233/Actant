---
name: source-evaluation
description: 来源评估 — 评估信息来源的可靠性和时效性，过滤低质量内容
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "evaluation,credibility,quality,researcher"
  layer: auxiliary
  agent: researcher
---

# Source Evaluation

## Overview

Evaluate reliability and timeliness of information sources; filter low-quality content.

## Source Authority Scoring

- **Domain reputation**: Known authoritative domains (e.g., official docs, .gov, .edu)
- **Publisher track record**: Historical accuracy; user ratings if available
- **Expertise signals**: Author credentials, institutional affiliation

## Freshness Assessment

- Extract publication/update date from page metadata or content
- Score by recency; deprioritize stale content for time-sensitive topics
- Handle missing dates; infer from context when possible

## Bias Detection

- Identify promotional, opinion, or advocacy content vs factual
- Flag potential conflicts of interest (e.g., vendor-authored comparisons)
- Surface bias level to user; do not auto-filter, allow user choice

## Cross-Reference Verification

- Check if claims are corroborated by multiple independent sources
- Weight corroboration in overall score

## Citation Tracking

- Track which sources cite which; build citation graph
- Prefer well-cited sources; flag uncited or circular citations
