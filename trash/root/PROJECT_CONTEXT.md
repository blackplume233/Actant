# Actant Project Context

Actant is a platform for building, bootstrapping, and managing AI agents. The current
phase is project-context-first bootstrap: a backend should be able to discover what the
project is, what rules apply, and what assets exist by reading repository files alone.

Read order for this repository:

1. `actant.project.json`
2. `.trellis/spec/index.md`
3. `.trellis/spec/backend/index.md`
4. `.trellis/spec/guides/cross-layer-thinking-guide.md`

Project-local Actant assets live under `configs/`:

- `configs/skills/` for reusable rules
- `configs/prompts/` for agent behavior prompts
- `configs/mcp/` for MCP server configs
- `configs/workflows/` for workflow definitions
- `configs/templates/` for agent templates

When consuming `/project/context.json`, prefer its declared `entrypoints` and
`available` catalogs over guessing from directory names.
