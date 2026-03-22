# Repo-Local Runtime Sandboxes

Use this directory for persistent self-host/context development state that should live
inside the repository but must stay out of git history.

Recommended layout:

```text
.trellis/runtime/
  context-dev/
    home/          # ACTANT_HOME for repo-local daemon/CLI work
    detached-home/ # optional detached-readonly home
    standalone/    # local SEA installs from scripts/install-local.mjs
    sessions/      # optional per-round or per-issue sandboxes
```

Recommended commands:

```powershell
$env:ACTANT_HOME = (Resolve-Path ".trellis/runtime/context-dev/home").Path
pnpm run dev:actant -- hub status -f json

node scripts/install-local.mjs --standalone --install-dir .trellis/runtime/context-dev/standalone
```

This tree is ignored by git on purpose. Keep durable notes and QA reports under
`.trellis/tasks/`, and keep mutable runtime state, binaries, sockets, and pid files here.
