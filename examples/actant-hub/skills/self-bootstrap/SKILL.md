---
name: self-bootstrap
description: 自举 — 自主 fork 仓库、搭建开发环境、理解代码库结构，具备独立开发能力
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "bootstrap,setup,autonomy,spark"
  layer: spark
  agent: actant-spark
---

# Self-Bootstrap

## Overview

Independently fork repositories, set up development environments, and understand codebase structure to achieve autonomous development capability.

## Repo Fork and Clone

- Fork upstream repo to own namespace (if contributing externally)
- Clone repo; configure remote (origin = fork, upstream = original)
- Verify SSH/HTTPS access and permissions

## Dependency Installation

- Run package manager (npm, pnpm, yarn, pip, etc.) per project docs
- Resolve version conflicts; use lockfiles when available
- Verify install completes without errors

## Codebase Exploration Strategy

- Start with README, CONTRIBUTING, and architecture docs
- Map entry points: main, CLI, API routes
- Identify key modules and their dependencies

## Architecture Understanding

- Trace data flow: inputs → processing → outputs
- Note configuration sources (env, config files)
- Understand testing structure and fixtures

## Development Environment Verification

- Run build command; ensure successful compile
- Run test suite; baseline pass rate
- Run dev server or equivalent; confirm startup
