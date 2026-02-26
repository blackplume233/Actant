---
name: intent-routing
description: 意图识别与路由 — 解析用户自然语言输入，识别意图类别，路由到合适的 Agent 或内置命令
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "intent,routing,nlp,steward"
  layer: kernel
  agent: steward
---

# Intent Routing

## Overview

Parse user natural language input, classify intent categories, and route to the appropriate Agent or built-in command.

## Intent Categories

| Category | Description | Routing Target |
|----------|-------------|----------------|
| **task-delegation** | User wants work done by an Agent | Steward → domain Agent (Researcher, Maintainer, etc.) |
| **query** | User asks a question or seeks information | Steward → Researcher or direct answer |
| **system-command** | User invokes system control (start/stop, config, status) | Built-in command handler |
| **conversation** | Greeting, clarification, follow-up | Steward handles directly, maintain context |

## Routing Rules

1. **Keyword matching**: Slash commands (`/qa`, `/issue`), explicit verbs ("create", "run", "check")
2. **Semantic inference**: Use context and prior turns to disambiguate ambiguous input
3. **Fallback**: When intent unclear, ask clarifying question before routing

## Fallback Behavior

- If confidence < threshold: respond with "I'm not sure if you want to... [options]. Which applies?"
- If multiple valid routes: prefer the one with highest prior success rate for similar queries
- If no valid route: explain capabilities and suggest alternatives
