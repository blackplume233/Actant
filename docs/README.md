# Actant Documentation

This directory contains all project documentation, organized by authorship and purpose.

## Directory Structure

```
docs/
├── decisions/      Architecture Decision Records (ADR)
├── design/         Feature design documents
├── human/          Human-authored notes, reviews, meetings
├── agent/          Agent-generated analysis, session logs, reviews
├── api/            Auto-generated API documentation
└── guides/         Usage tutorials and how-tos
```

## Human vs Agent Separation

| Directory | Author | Content | Reliability |
|-----------|--------|---------|-------------|
| `human/` | Human developers | Design rationale, meeting notes, roadmap | Authoritative |
| `agent/` | AI agents | Session logs, code analysis, auto-reviews | Requires human validation |
| `decisions/` | Collaborative | ADRs — proposed by either, accepted by human | Authoritative once accepted |
| `design/` | Collaborative | Feature designs — drafted by either | Living documents |

### Rules

- **Never auto-generate content into `human/`** — this is the human-exclusive zone
- **Always treat `agent/` content as opinion** — human review required before acting on it
- **ADRs require explicit `Status: Accepted`** — proposals stay as `Proposed` until human approval
- **Design docs are living** — both humans and agents can update, but structural changes need human review

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| ADR | `NNN-slug.md` | `001-tech-stack.md` |
| Design doc | `topic.md` | `template-system.md` |
| Human notes | `YYYY-MM-DD-topic.md` | `2026-02-19-kickoff.md` |
| Agent output | `YYYY-MM-DD-agent-topic.md` | `2026-02-19-cursor-spec-update.md` |
| Guide | `verb-noun.md` | `creating-templates.md` |
