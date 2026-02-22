# actant-hub

Actant official component repository. This repo provides skills, prompts, MCP servers, workflows, templates, and presets for the Actant agent framework.

## Structure

- **skills/** — Agent skills (rules, knowledge) in JSON or SKILL.md format
- **prompts/** — System prompts and instruction sets
- **mcp/** — MCP server configurations
- **workflows/** — Development workflow templates
- **templates/** — Agent templates
- **presets/** — Preset bundles combining multiple components

## Usage

Add as a local or GitHub source in Actant:

```bash
actant source add actant-hub --local ./path/to/actant-hub
# or
actant source add actant-hub --github https://github.com/blackplume233/actant-hub.git
```
