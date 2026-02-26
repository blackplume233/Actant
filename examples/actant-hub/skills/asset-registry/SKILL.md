---
name: asset-registry
description: 资产注册 — 管理所有托管资产（Docker/工作目录/进程/配置/数据）的注册、索引和健康巡检
version: "1.0.0"
license: MIT
metadata:
  author: blackplume233
  actant-tags: "asset,registry,management,curator"
  layer: kernel
  agent: curator
---

# Asset Registry

## Overview

Manage registration, indexing, and health inspection of all managed assets: Docker containers, workspaces, processes, configs, and data.

## Asset Registration

**Purpose**: Bring human-delegated resources under Actant management.

- **Human delegation**: User explicitly registers an asset ("manage this Docker container", "watch this workspace")
- **Create ManagedAsset**: Create record with type, URI, metadata, health check config
- **Include in巡检**: Add to periodic health check roster
- **Lifecycle**: Track state (active, paused, archived, orphan)

## Health Inspection

**Purpose**: Periodically verify that managed assets are operational.

| Asset Type | Check | Failure Action |
|------------|-------|----------------|
| **Docker** | Container running? Port reachable? | Restart or alert |
| **Process** | PID alive? Responsive? | Restart or escalate |
| **Workspace** | Disk reachable? Permissions OK? | Alert |
| **Repo** | Git remote reachable? Clean state? | Report drift |
| **Config** | File exists? Valid schema? | Restore from backup |
| **Secret** | Vault/credential accessible? | Rotate or alert |
| **Data** | Path exists? Size within limits? | Cleanup or expand |

- **Schedule**: Configurable interval (e.g. every 2 min for critical, 1 hr for low-priority)
- **Reporting**: Aggregate results; surface failures to Maintainer or user

## Asset Catalog

**Purpose**: Maintain a complete index of all managed assets for Steward and other Agents.

- **Query interface**: By type, URI, tag, state
- **Relationships**: Link assets (e.g. workspace → Agent Instance, Docker → project)
- **Metadata**: Owner, created_at, last_health_check, notes

## URI Namespace

**Purpose**: Unified addressing for all assets.

- **Format**: `ac://assets/{type}/{name}`
- **Examples**:
  - `ac://assets/workspace/my-project`
  - `ac://assets/docker/postgres-dev`
  - `ac://assets/process/daemon-123`
  - `ac://assets/config/actant.json`
  - `ac://assets/secret/vault-api-key`
  - `ac://assets/data/logs-archive`
  - `ac://assets/repo/actant-core`

## Supported Asset Types

| Type | Description |
|------|-------------|
| **workspace** | Directory on disk; project root, Agent workspace |
| **docker** | Docker container or compose service |
| **repo** | Git repository (local clone) |
| **process** | Long-running process (daemon, Agent) |
| **config** | Configuration file |
| **secret** | Credential, API key, vault reference |
| **data** | Data directory, log archive, export |
