---
name: code-generation
description: 代码生成 — 根据 Issue 描述和代码上下文，自主编写高质量代码
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "code,generation,development,spark"
  layer: spark
  agent: actant-spark
---

# Code Generation

## Overview

Generate high-quality code from Issue descriptions and code context. Follow project conventions and deliver production-ready implementations.

## Code Style Adherence

- Match existing project style: indentation, naming, file structure
- Follow linter/formatting rules (ESLint, Prettier, etc.)
- Use project-specific patterns and idioms

## Test-First Development

- Write tests before or alongside implementation (TDD when applicable)
- Cover happy path, edge cases, and error conditions
- Ensure tests pass before marking task complete

## Incremental Commits

- Commit in logical units: one feature/fix per commit
- Keep commits small and reviewable
- Use conventional commit format (feat:, fix:, refactor:)

## Code Review Preparation

- Self-review before submitting: logic, edge cases, style
- Add inline comments for non-obvious logic
- Ensure no debug code, TODOs, or temporary hacks remain

## Documentation Co-Generation

- Update README, JSDoc, or API docs when adding public APIs
- Add usage examples for new features
- Keep changelog entries concise and accurate
