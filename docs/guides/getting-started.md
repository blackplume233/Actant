# Getting Started with Actant

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9
- **Claude Code CLI** (for claude-code backend)
- **Cursor IDE** (for cursor backend)

## Installation

### Quick Install (Recommended)

**Linux/macOS:**

```bash
git clone https://github.com/blackplume233/Actant.git
cd Actant
bash scripts/install.sh
```

**Windows (PowerShell):**

```powershell
git clone https://github.com/blackplume233/Actant.git
cd Actant
.\scripts\install.ps1
```

### Manual Install

1. Clone the repository and enter the project directory
2. Run `pnpm install`
3. Run `pnpm build`
4. Run `pnpm --filter @actant/cli link --global`

## Directory Structure

After installation, Actant creates:

- **`~/.actant/`** — Actant home directory
  - `config.json` — Global configuration
  - `configs/` — Domain components (skills, prompts, etc.)
  - `instances/` — Agent instance workspaces + registry
  - `sources/` — Component source management
  - `logs/` — Daemon and update logs
  - `backups/` — Self-update backups

## First Steps

### 1. Start the Daemon

```bash
actant daemon start
```

### 2. Browse Available Components

```bash
actant skill list
actant prompt list
actant template list
```

### 3. Create Your First Agent

```bash
actant agent create my-agent --template code-review-agent
```

### 4. Start and Chat

```bash
actant agent start my-agent
actant agent chat my-agent
```

### 5. Stop When Done

```bash
actant agent stop my-agent
```

## Configuration

Global config at `~/.actant/config.json`:

```json
{
  "devSourcePath": "",
  "update": {
    "maxBackups": 3,
    "preUpdateTestCommand": "pnpm test:changed",
    "autoRestartAgents": true
  }
}
```

Set `devSourcePath` to your Actant source directory for self-update from local development.

## Getting Help

```bash
actant help
actant help agent
actant help <command>
```

## Common Issues

### "actant: command not found"

Run `pnpm --filter @actant/cli link --global` again, or add pnpm's global bin to PATH.

### Daemon Connection Failed

Ensure daemon is running: `actant daemon status`

### Permission Errors on Global Link

Try with elevated privileges or configure npm prefix.
