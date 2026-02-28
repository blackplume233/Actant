# Command Resolution Reference

## Canonical Source

- All routed commands must resolve to files under `.cursor/commands/`.
- Resolution must use explicit registry entries only.
- Registry file: `references/registered-commands.md`.

## Resolution Order

1. Input token: `/raw`.
2. Match exact row in `Input Command` column.
3. If not matched, match exact row in `Alias` column.
4. If still miss: list registered commands and stop.

## Alias Examples (Registered)

- `/ship` -> `/trellis-ship`
- `/start` -> `/trellis-start`
- `/project-review` -> `/trellis-project-review`
- `/qa-alpha` -> `/trellis-qa-alpha`
- `/qa-fix` -> `/trellis-qa-fix`
- `/qa-watch` -> `/trellis-qa-watch`
- `/create-pr` -> `/trellis-create-pr`
- `/watch-prs` -> `/trellis-watch-prs`

## Parameter Mapping

- Preserve text after command token as-is.
- Map this tail string to target command `{{input}}` after registry match.

Example:

- Input: `/trellis-create-pr master`
- Routed file: `.cursor/commands/trellis-create-pr.md`
- `{{input}}`: `master`
