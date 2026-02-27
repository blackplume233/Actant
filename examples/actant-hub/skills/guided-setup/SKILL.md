---
name: guided-setup
description: 引导设置 — 交互式引导新用户完成 Actant 安装、配置和首次使用
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "setup,onboarding,wizard,onboarder"
  layer: auxiliary
  agent: onboarder
---

# Guided Setup

## Overview

Interactive guidance for new users to complete Actant installation, configuration, and first use.

## Environment Detection

- Detect OS, shell, Node/npm version, existing tools (git, Docker)
- Identify conflicts (e.g., old Actant install, incompatible deps)
- Report prerequisites status; suggest fixes for missing items

## Step-by-Step Configuration Wizard

- Walk through: install → config → verify in logical order
- Each step: explain purpose, show default, allow override
- Support skip for advanced users; resume from last incomplete step

## Prerequisite Checking

- Verify Node version (e.g., >= 18); npm/yarn/pnpm availability
- Check API keys or auth if required (e.g., Cursor, OpenAI)
- Validate network access for package install

## Personalized Recommendation

- Infer user profile from responses (dev experience, use case)
- Recommend presets, skills, or templates suited to profile
- Adjust wizard complexity (minimal vs full) based on preference

## Success Verification

- Run smoke test: start Actant, execute sample command
- Confirm config is valid; report any warnings
- Offer next step: interactive-tutorial or quick start guide
