# Thinking Guides

> **Purpose**: Expand your thinking to catch things you might not have considered.

---

## Why Thinking Guides?

**Most bugs and tech debt come from "didn't think of that"**, not from lack of skill:

- Didn't think about what happens at layer boundaries → cross-layer bugs
- Didn't think about code patterns repeating → duplicated code everywhere
- Didn't think about agent lifecycle edge cases → orphaned processes
- Didn't think about composability → rigid, non-reusable components

These guides help you **ask the right questions before coding**.

---

## Available Guides

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) | Identify patterns and reduce duplication | When you notice repeated patterns |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | Think through data flow across layers | Features spanning CLI ↔ Core ↔ ACP/MCP/API |
| [Cross-Platform Guide](./cross-platform-guide.md) | Ensure Linux/macOS/Windows compatibility | Any feature touching IPC, signals, file paths, or process management |

### Design References (Mid-term)

| Design Doc | Purpose | Status |
|------------|---------|--------|
| [Memory Layer & Agent Evolution](../../../docs/design/memory-layer-agent-evolution.md) | Instance memory, cross-session learning, Template evolution | Draft — Mid-term |

---

## Actant-Specific Thinking Triggers

### When to Think About Agent Lifecycle

- [ ] Feature involves starting or stopping agents
- [ ] Feature changes agent state (running, stopped, crashed)
- [ ] Feature adds a new launch mode or communication path
- [ ] Long-running agent needs to survive manager restart

→ Consider: What happens on failure? How do we clean up? What state needs persisting?

### When to Think About Composability

- [ ] Adding a new Domain Context component (skill, workflow, MCP)
- [ ] Adding or modifying a backend definition
- [ ] Creating a new Agent Template
- [ ] Modifying how components are referenced or resolved
- [ ] Adding plugin capabilities (memory, scheduler)

→ Consider: Is this reusable across templates? Is it referenced by name? Can it be swapped? If it's a backend, is the data serializable (no functions) and distributable via actant-hub?

### When to Think About Agent Evolution

- [ ] Feature involves Agent session lifecycle (start/stop)
- [ ] Feature changes what gets materialized into workspace
- [ ] Feature adds new instance-level persistent state
- [ ] Feature involves cross-instance or cross-session data

→ Read [Memory Layer Design](../../../docs/design/memory-layer-agent-evolution.md)

### When to Think About Cross-Layer Issues

- [ ] Feature touches CLI ↔ Core ↔ API boundaries
- [ ] Data format changes between layers
- [ ] Agent communicates via ACP or MCP
- [ ] External client (Unreal/Unity) consumes agent output

→ Read [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md)

### When to Think About Code Reuse

- [ ] You're writing similar code to something that exists
- [ ] You see the same pattern repeated 3+ times
- [ ] You're adding a new field to multiple places
- [ ] **You're modifying any constant or config**
- [ ] **You're creating a new utility/helper function** ← Search first!

→ Read [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)

### When to Think About CLI ↔ API Parity

- [ ] Adding a new CLI command
- [ ] Changing command arguments or output format
- [ ] Adding a new feature to the API

→ Consider: Does the CLI command have an API equivalent? Do they share the same underlying logic?

---

## Pre-Modification Rule (CRITICAL)

> **Before changing ANY value, ALWAYS search first!**

```bash
rg "value_to_change" .
```

This single habit prevents most "forgot to update X" bugs.

---

## How to Use This Directory

1. **Before coding**: Skim the relevant thinking guide
2. **During coding**: If something feels repetitive or complex, check the guides
3. **After bugs**: Add new insights to the relevant guide (learn from mistakes)

---

## Contributing

Found a new "didn't think of that" moment? Add it to the relevant guide.

---

**Core Principle**: 30 minutes of thinking saves 3 hours of debugging.
