---
name: context-assessment
description: 上下文评估 — 评估用户的技术背景和需求，定制个性化的学习路径
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "assessment,personalization,adaptive,onboarder"
  layer: auxiliary
  agent: onboarder
---

# Context Assessment

## Overview

Assess user's technical background and needs; tailor personalized learning paths.

## User Profiling Questions

- Experience level: beginner, intermediate, advanced, expert
- Prior tools: Cursor, Copilot, CLI tools, scripting
- Use case: personal, team, CI/CD, research
- Constraints: time, complexity preference, language

## Skill Level Detection

- Infer from responses and optional quick quiz
- Map to Actant concepts: "never used agents" vs "built custom workflows"
- Avoid over-testing; use lightweight signals

## Use Case Identification

- Categorize: code assist, automation, research, maintenance, onboarding
- Identify primary vs secondary goals
- Detect team vs solo context

## Learning Path Generation

- Generate ordered sequence of lessons/exercises from context-assessment
- Prioritize by relevance to use case and skill level
- Include optional deep-dives for interested users

## Progress Milestones

- Define checkpoints (e.g., "first successful delegation", "custom skill created")
- Track and celebrate milestones; suggest next goal
- Re-assess periodically; adjust path if goals change
