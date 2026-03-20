# Ship Sub

Use the `ship-sub` skill to deliver through a child branch PR instead of shipping directly on the base branch.

Read:

```
@.agents/skills/ship-sub/SKILL.md
```

Also read:

```
@.agents/skills/pr-handler/SKILL.md
```

Then execute the full flow:

1. Run ship-grade checks on the current child branch
2. Commit and push the child branch
3. Create or reuse a Draft PR
4. Switch to the base branch and complete delivery with `handle-pr`

User input:

{{input}}
