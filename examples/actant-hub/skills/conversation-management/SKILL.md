---
name: conversation-management
description: 会话管理 — 维护多轮对话上下文，管理会话生命周期，确保连贯的用户体验
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "conversation,context,session,steward"
  layer: kernel
  agent: steward
---

# Conversation Management

## Overview

Maintain multi-turn dialogue context, manage session lifecycle, and ensure coherent user experience.

## Context Window Management

- **Sliding window**: Keep recent N turns within token budget; summarize older content if needed
- **Key facts extraction**: Persist user preferences, project context, and decisions across turns
- **Token awareness**: Proactively suggest summarization or session split when approaching limits

## Session Lifecycle

| Phase | Actions |
|-------|--------|
| **Start** | Load persisted context (if any), greet, establish scope |
| **Active** | Append turns, update working memory, track delegated tasks |
| **Pause** | Persist state for resume; optional checkpoint for long gaps |
| **End** | Extract memories for Promote, archive session artifacts, cleanup |

## Multi-Turn State Tracking

- Track: current task chain, pending delegations, user corrections, open questions
- On handoff: pass relevant context to receiving Agent; record handoff reason
- On return: merge delegated result into conversation; update user-facing summary

## Graceful Handoff

- Before delegating: briefly confirm scope with user if ambiguous
- After delegation: present result in user-friendly form; offer follow-up options
- On Agent error: surface error clearly, suggest retry or alternative
