---
name: memory-governance
description: "记忆治理 — 管理分层记忆系统的 Promote/衰减/去重/凝练，确保记忆质量与一致性"
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "memory,governance,knowledge-management,curator"
  layer: kernel
  agent: actant-curator
---

# Memory Governance

## Overview

Manage the layered memory system: Promote, decay, deduplication, and condensation. Ensure memory quality and consistency across Instance, Template, and Actant layers.

## Instance Memory Promote

**Purpose**: Elevate high-value Instance memories to Template or Actant layers for broader reuse.

### Promote Workflow

1. **Candidate review**: Identify memories with high confidence, repeated use, or cross-session relevance
2. **Conflict resolution**: Before Promote, check for contradictions with existing Template/Actant memories
3. **Promotion**: Move approved candidates to `ac://memory/template/{templateId}/` or `ac://memory/actant/learnings/`
4. **Source attribution**: Preserve origin Instance ID for traceability

### Conflict Handling

- If Instance memory contradicts Template memory: flag for human review or apply recency/confidence rule
- If multiple Instances have conflicting memories: arbitrate by confidence score, usage count, or manual merge

## Memory Deduplication

**Purpose**: Reduce redundancy and maintain a single source of truth.

- **contentHash detection**: Compute hash of normalized content; detect duplicates across layers
- **Merge strategy**: Keep the most comprehensive version; merge metadata (confidence, timestamps, sources)
- **Refinement**: Produce a condensed version that preserves all unique information

## Memory Decay (Expiration)

**Purpose**: Archive or retire low-confidence or stale memories.

- **Confidence decay rules**: Apply time-based or usage-based decay to confidence scores
- **Archive threshold**: When confidence < threshold, move to archive (read-only, excluded from retrieval)
- **Eviction**: When archive exceeds capacity, delete lowest-value entries
- **Audit trail**: Log all decay/archive/eviction actions for debugging

## Memory Conflict Arbitration

**Purpose**: Resolve contradictions when multiple Instances have conflicting memories.

- **Detection**: Compare memories on same topic/entity; flag semantic contradictions
- **Arbitration strategies**:
  - Recency: Prefer newer memory
  - Confidence: Prefer higher confidence
  - Source authority: Prefer Template > Instance
  - Manual: Escalate to human when automated resolution unclear
- **Merge**: When possible, merge into a nuanced single memory ("Usually X, but in context Y, Z")

## Cross-Template Generic Learnings

**Purpose**: Identify and elevate learnings that apply across multiple Templates.

- **Recognition**: Detect patterns that recur across different Template contexts
- **Promotion target**: `ac://memory/actant/learnings/`
- **Use case**: System-wide best practices, shared domain knowledge, common pitfalls
- **Governance**: Curator reviews before Promote; avoid Template-specific details in Actant learnings
