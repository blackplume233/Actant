# QA Log - Round 2

**Scenario**: full-cli-regression (post-fix)
**Time**: 2026-02-24T10:06:11.1145437+08:00
**Environment**: real mode, global binary (rebuilt)
**ACTANT_HOME**: C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999

---

### [Step] p1-version - CLI version
**Time**: 2026-02-24T10:06:11.1315445+08:00

#### Input
```nactant --version
```

#### Output
```nexit_code: 0

--- stdout ---
0.2.0

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p1-help - CLI help
**Time**: 2026-02-24T10:06:12.1657083+08:00

#### Input
```nactant --help
```

#### Output
```nexit_code: 0

--- stdout ---
Usage: actant [options] [command]

Actant — Build, manage, and compose AI agents

Options:
  -V, --version           output the version number
  -h, --help              display help for command

Commands:
  template|tpl            Manage agent templates
  agent                   Manage agent instances
  skill                   Manage loaded skills
  prompt                  Manage loaded prompts
  mcp                     Manage loaded MCP server configs
  workflow                Manage loaded workflows
  plugin                  Manage loaded plugins
  source                  Manage component sources (GitHub repos, local dirs)
  preset                  Manage component presets (bundled compositions)
  schedule                Manage agent schedules (heartbeat, cron, hooks)
  daemon                  Manage the Actant daemon
  proxy [options] <name>  Run an ACP proxy for an agent (stdin/stdout ACP
                          protocol)
  help [command]          Show help information
  self-update [options]   Update Actant from local source
  setup [options]         Interactive setup wizard — configure Actant step by
                          step

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p1-daemon-status - Daemon status
**Time**: 2026-02-24T10:06:13.1833743+08:00

#### Input
```nactant daemon status -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "running": true,
  "version": "0.1.0",
  "uptime": 41,
  "agents": 0
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p2-tpl-list - List templates
**Time**: 2026-02-24T10:06:14.2001864+08:00

#### Input
```nactant template list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-reviewer",
    "version": "1.0.0",
    "description": "A code review agent — systematic reviews with security, performance, and maintainability checks",
    "backend": {
      "type": "claude-code"
    },
    "provider": {
      "type": "anthropic"
    },
    "domainContext": {
      "skills": [
        "code-review"
      ],
      "prompts": [
        "code-assistant"
      ],
      "mcpServers": [
        {
          "name": "filesystem",
          "command": "npx",
          "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "."
          ]
        }
      ]
    },
    "metadata": {
      "category": "web-dev",
      "difficulty": "beginner"
    }
  },
  {
    "name": "actant-hub@qa-engineer",
    "version": "1.0.0",
    "description": "A QA testing agent — writes tests, runs test suites, and reports quality issues",
    "backend": {
      "type": "claude-code"
    },
    "provider": {
      "type": "anthropic"
    },
    "domainContext": {
      "skills": [
        "test-writer"
      ],
      "prompts": [
        "qa-assistant"
      ],
      "mcpServers": [
        {
          "name": "filesystem",
          "command": "npx",
          "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "."
          ]
        }
      ]
    },
    "metadata": {
      "category": "web-dev",
      "difficulty": "beginner"
    }
  },
  {
    "name": "actant-hub@doc-writer",
    "version": "1.0.0",
    "description": "A documentation agent — writes READMEs, API docs, architecture docs, and guides",
    "backend": {
      "type": "claude-code"
    },
    "provider": {
      "type": "anthropic"
    },
    "domainContext": {
      "skills": [
        "doc-writer"
      ],
      "prompts": [
        "code-assistant"
      ],
      "mcpServers": [
        {
          "name": "filesystem",
          "command": "npx",
          "args": [
            "-y",
            "@modelcontextprotocol/server-filesystem",
            "."
          ]
        }
      ]
    },
    "metadata": {
      "category": "web-dev",
      "difficulty": "beginner"
    }
  },
  {
    "name": "qa-regression-tpl",
    "version": "1.0.0",
    "description": "QA full regression test template",
    "backend": {
      "type": "cursor"
    },
    "provider": {
      "type": "anthropic",
      "protocol": "http"
    },
    "domainContext": {
      "skills": [],
      "prompts": [],
      "mcpServers": [],
      "subAgents": [],
      "plugins": []
    }
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p2-tpl-validate-valid - Validate valid
**Time**: 2026-02-24T10:06:16.3637752+08:00

#### Input
```nactant template validate C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\test-template.json
```

#### Output
```nexit_code: 0

--- stdout ---
Valid — qa-regression-tpl@1.0.0

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p2-tpl-validate-invalid - Validate invalid
**Time**: 2026-02-24T10:06:17.3894780+08:00

#### Input
```nactant template validate C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\invalid-template.json
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
Invalid template
  - name: Invalid input: expected string, received undefined
  - version: Invalid input: expected string, received undefined
  - backend: Invalid input: expected object, received undefined
  - provider: Invalid input: expected object, received undefined
  - domainContext: Invalid input: expected object, received undefined
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p2-tpl-show - Show template
**Time**: 2026-02-24T10:06:18.4094674+08:00

#### Input
```nactant template show qa-regression-tpl -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "name": "qa-regression-tpl",
  "version": "1.0.0",
  "description": "QA full regression test template",
  "backend": {
    "type": "cursor"
  },
  "provider": {
    "type": "anthropic",
    "protocol": "http"
  },
  "domainContext": {
    "skills": [],
    "prompts": [],
    "mcpServers": [],
    "subAgents": [],
    "plugins": []
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p2-tpl-show-ne - Show nonexistent
**Time**: 2026-02-24T10:06:19.4350959+08:00

#### Input
```nactant template show nonexistent-tpl-xyz
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32001] Template "nonexistent-tpl-xyz" not found in registry
  Context: {"templateName":"nonexistent-tpl-xyz"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p3-skill-list-0 - Skill list (initial)
**Time**: 2026-02-24T10:06:20.4632667+08:00

#### Input
```nactant skill list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-review",
    "version": "1.0.0",
    "description": "Systematic code review skill — guides agents through structured, thorough code reviews.",
    "tags": [
      "code-quality",
      "review",
      "best-practices"
    ],
    "content": "# Code Review Skill\n\nYou are a systematic code reviewer. Follow this structured approach for every code review.\n\n## Review Checklist\n\n### 1. Correctness\n- Does the code do what it claims?\n- Are edge cases handled (null, empty, boundary values)?\n- Are error paths properly handled?\n\n### 2. Security\n- No hardcoded secrets or credentials\n- Input validation on all external data\n- Proper escaping for SQL, HTML, shell commands\n- Principle of least privilege for permissions\n\n### 3. Performance\n- No unnecessary allocations in hot paths\n- Appropriate data structures for the use case\n- Database queries are indexed and bounded\n- No N+1 query patterns\n\n### 4. Maintainability\n- Clear naming that reveals intent\n- Functions do one thing and do it well\n- No magic numbers — use named constants\n- Dependencies are explicit, not implicit\n\n### 5. Testing\n- New code has corresponding tests\n- Tests cover both happy path and error cases\n- Tests are deterministic (no flaky timing dependencies)\n- Test names describe the behavior being verified\n\n## Review Output Format\n\nFor each finding, provide:\n1. **Severity**: critical / warning / suggestion / nitpick\n2. **Location**: file and line range\n3. **Issue**: what's wrong\n4. **Fix**: concrete suggestion with code"
  },
  {
    "name": "actant-hub@test-writer",
    "version": "1.0.0",
    "description": "Test writing skill — guides agents to write thorough, maintainable tests using TDD principles.",
    "tags": [
      "testing",
      "tdd",
      "quality"
    ],
    "content": "# Test Writer Skill\n\nYou write thorough, maintainable tests. Follow TDD principles and aim for high confidence, not just high coverage.\n\n## Approach\n\n### 1. Understand Before Testing\n- Read the code under test completely before writing any test\n- Identify the public API surface — test behavior, not implementation\n- List edge cases, error conditions, and boundary values\n\n### 2. Test Structure (AAA Pattern)\n- **Arrange**: set up preconditions and inputs\n- **Act**: execute the behavior under test\n- **Assert**: verify the expected outcome\n\n### 3. Naming Convention\nUse descriptive names that document behavior:\n- `should return empty array when no items match`\n- `should throw ConfigNotFoundError when file is missing`\n- `should retry up to 3 times on transient failure`\n\n### 4. Test Categories\n- **Unit tests**: isolated, fast, mock external dependencies\n- **Integration tests**: verify component interactions with real dependencies\n- **Edge case tests**: null, empty, overflow, concurrent access\n\n### 5. Quality Guidelines\n- Each test verifies exactly one behavior\n- Tests are independent — no shared mutable state between tests\n- Avoid testing implementation details (private methods, internal state)\n- Use factory functions for test data, not copy-paste\n- Prefer explicit assertions over snapshot tests for logic\n\n## Anti-patterns to Avoid\n- Tests that always pass (missing assertions)\n- Tests coupled to implementation (break on refactor)\n- Flaky tests depending on timing or external state\n- Overly broad tests that verify too many things at once"
  },
  {
    "name": "actant-hub@doc-writer",
    "version": "1.0.0",
    "description": "Documentation writing skill — guides agents to write clear, structured technical documentation.",
    "tags": [
      "documentation",
      "writing",
      "technical-writing"
    ],
    "content": "# Documentation Writer Skill\n\nYou write clear, structured technical documentation. Prioritize clarity over completeness — a short, accurate doc beats a long, confusing one.\n\n## Principles\n\n### 1. Know Your Audience\n- **API docs**: developers integrating your code — focus on usage, parameters, return values, errors\n- **Guides**: developers learning a concept — focus on progressive complexity with examples\n- **Architecture docs**: future maintainers — focus on why, not what\n\n### 2. Structure\n- Lead with a one-sentence summary of what this does and why it matters\n- Use progressive disclosure: overview → quickstart → detailed reference\n- Include a working code example within the first screen\n\n### 3. Writing Style\n- Use active voice and present tense\n- One idea per sentence; one topic per paragraph\n- Avoid jargon without definition; link to glossary if needed\n- Use concrete examples instead of abstract explanations\n\n### 4. Code Examples\n- Every public API must have at least one usage example\n- Examples must be complete enough to copy-paste and run\n- Show the expected output or behavior\n- Include error handling in examples\n\n### 5. Maintenance\n- Date or version-stamp docs that may become stale\n- Link to source code for implementation details\n- Prefer generated docs (from code comments) for API reference\n- Keep docs near the code they describe"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-skill-add - Skill add
**Time**: 2026-02-24T10:06:21.5056143+08:00

#### Input
```nactant skill add C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\code-review.json
```

#### Output
```nexit_code: 0

--- stdout ---
Skill "code-review" added successfully.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-skill-list-1 - Skill list (after)
**Time**: 2026-02-24T10:06:22.5359406+08:00

#### Input
```nactant skill list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-review",
    "version": "1.0.0",
    "description": "Systematic code review skill — guides agents through structured, thorough code reviews.",
    "tags": [
      "code-quality",
      "review",
      "best-practices"
    ],
    "content": "# Code Review Skill\n\nYou are a systematic code reviewer. Follow this structured approach for every code review.\n\n## Review Checklist\n\n### 1. Correctness\n- Does the code do what it claims?\n- Are edge cases handled (null, empty, boundary values)?\n- Are error paths properly handled?\n\n### 2. Security\n- No hardcoded secrets or credentials\n- Input validation on all external data\n- Proper escaping for SQL, HTML, shell commands\n- Principle of least privilege for permissions\n\n### 3. Performance\n- No unnecessary allocations in hot paths\n- Appropriate data structures for the use case\n- Database queries are indexed and bounded\n- No N+1 query patterns\n\n### 4. Maintainability\n- Clear naming that reveals intent\n- Functions do one thing and do it well\n- No magic numbers — use named constants\n- Dependencies are explicit, not implicit\n\n### 5. Testing\n- New code has corresponding tests\n- Tests cover both happy path and error cases\n- Tests are deterministic (no flaky timing dependencies)\n- Test names describe the behavior being verified\n\n## Review Output Format\n\nFor each finding, provide:\n1. **Severity**: critical / warning / suggestion / nitpick\n2. **Location**: file and line range\n3. **Issue**: what's wrong\n4. **Fix**: concrete suggestion with code"
  },
  {
    "name": "actant-hub@test-writer",
    "version": "1.0.0",
    "description": "Test writing skill — guides agents to write thorough, maintainable tests using TDD principles.",
    "tags": [
      "testing",
      "tdd",
      "quality"
    ],
    "content": "# Test Writer Skill\n\nYou write thorough, maintainable tests. Follow TDD principles and aim for high confidence, not just high coverage.\n\n## Approach\n\n### 1. Understand Before Testing\n- Read the code under test completely before writing any test\n- Identify the public API surface — test behavior, not implementation\n- List edge cases, error conditions, and boundary values\n\n### 2. Test Structure (AAA Pattern)\n- **Arrange**: set up preconditions and inputs\n- **Act**: execute the behavior under test\n- **Assert**: verify the expected outcome\n\n### 3. Naming Convention\nUse descriptive names that document behavior:\n- `should return empty array when no items match`\n- `should throw ConfigNotFoundError when file is missing`\n- `should retry up to 3 times on transient failure`\n\n### 4. Test Categories\n- **Unit tests**: isolated, fast, mock external dependencies\n- **Integration tests**: verify component interactions with real dependencies\n- **Edge case tests**: null, empty, overflow, concurrent access\n\n### 5. Quality Guidelines\n- Each test verifies exactly one behavior\n- Tests are independent — no shared mutable state between tests\n- Avoid testing implementation details (private methods, internal state)\n- Use factory functions for test data, not copy-paste\n- Prefer explicit assertions over snapshot tests for logic\n\n## Anti-patterns to Avoid\n- Tests that always pass (missing assertions)\n- Tests coupled to implementation (break on refactor)\n- Flaky tests depending on timing or external state\n- Overly broad tests that verify too many things at once"
  },
  {
    "name": "actant-hub@doc-writer",
    "version": "1.0.0",
    "description": "Documentation writing skill — guides agents to write clear, structured technical documentation.",
    "tags": [
      "documentation",
      "writing",
      "technical-writing"
    ],
    "content": "# Documentation Writer Skill\n\nYou write clear, structured technical documentation. Prioritize clarity over completeness — a short, accurate doc beats a long, confusing one.\n\n## Principles\n\n### 1. Know Your Audience\n- **API docs**: developers integrating your code — focus on usage, parameters, return values, errors\n- **Guides**: developers learning a concept — focus on progressive complexity with examples\n- **Architecture docs**: future maintainers — focus on why, not what\n\n### 2. Structure\n- Lead with a one-sentence summary of what this does and why it matters\n- Use progressive disclosure: overview → quickstart → detailed reference\n- Include a working code example within the first screen\n\n### 3. Writing Style\n- Use active voice and present tense\n- One idea per sentence; one topic per paragraph\n- Avoid jargon without definition; link to glossary if needed\n- Use concrete examples instead of abstract explanations\n\n### 4. Code Examples\n- Every public API must have at least one usage example\n- Examples must be complete enough to copy-paste and run\n- Show the expected output or behavior\n- Include error handling in examples\n\n### 5. Maintenance\n- Date or version-stamp docs that may become stale\n- Link to source code for implementation details\n- Prefer generated docs (from code comments) for API reference\n- Keep docs near the code they describe"
  },
  {
    "name": "code-review",
    "description": "Rules and guidelines for reviewing code quality",
    "content": "## Code Review Checklist\n\n- Check for proper error handling (try/catch, error boundaries)\n- Verify type safety (no `any`, proper generics)\n- Review naming conventions (descriptive, consistent casing)\n- Look for potential performance issues (unnecessary re-renders, N+1 queries)\n- Ensure tests cover edge cases\n- Validate input/output contracts match API specs\n- Check for security vulnerabilities (injection, XSS, auth bypass)",
    "tags": [
      "review",
      "quality",
      "best-practices"
    ]
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-skill-show - Skill show
**Time**: 2026-02-24T10:06:23.5612228+08:00

#### Input
```nactant skill show code-review -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "name": "code-review",
  "description": "Rules and guidelines for reviewing code quality",
  "content": "## Code Review Checklist\n\n- Check for proper error handling (try/catch, error boundaries)\n- Verify type safety (no `any`, proper generics)\n- Review naming conventions (descriptive, consistent casing)\n- Look for potential performance issues (unnecessary re-renders, N+1 queries)\n- Ensure tests cover edge cases\n- Validate input/output contracts match API specs\n- Check for security vulnerabilities (injection, XSS, auth bypass)",
  "tags": [
    "review",
    "quality",
    "best-practices"
  ]
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-skill-export - Skill export
**Time**: 2026-02-24T10:06:24.5881508+08:00

#### Input
```nactant skill export code-review -o C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\skill-exp.json
```

#### Output
```nexit_code: 0

--- stdout ---
Skill "code-review" exported to C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\skill-exp.json

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-skill-remove - Skill remove
**Time**: 2026-02-24T10:06:25.6145259+08:00

#### Input
```nactant skill remove code-review
```

#### Output
```nexit_code: 0

--- stdout ---
Skill "code-review" removed.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-skill-list-2 - Skill list (removed)
**Time**: 2026-02-24T10:06:26.6438588+08:00

#### Input
```nactant skill list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-review",
    "version": "1.0.0",
    "description": "Systematic code review skill — guides agents through structured, thorough code reviews.",
    "tags": [
      "code-quality",
      "review",
      "best-practices"
    ],
    "content": "# Code Review Skill\n\nYou are a systematic code reviewer. Follow this structured approach for every code review.\n\n## Review Checklist\n\n### 1. Correctness\n- Does the code do what it claims?\n- Are edge cases handled (null, empty, boundary values)?\n- Are error paths properly handled?\n\n### 2. Security\n- No hardcoded secrets or credentials\n- Input validation on all external data\n- Proper escaping for SQL, HTML, shell commands\n- Principle of least privilege for permissions\n\n### 3. Performance\n- No unnecessary allocations in hot paths\n- Appropriate data structures for the use case\n- Database queries are indexed and bounded\n- No N+1 query patterns\n\n### 4. Maintainability\n- Clear naming that reveals intent\n- Functions do one thing and do it well\n- No magic numbers — use named constants\n- Dependencies are explicit, not implicit\n\n### 5. Testing\n- New code has corresponding tests\n- Tests cover both happy path and error cases\n- Tests are deterministic (no flaky timing dependencies)\n- Test names describe the behavior being verified\n\n## Review Output Format\n\nFor each finding, provide:\n1. **Severity**: critical / warning / suggestion / nitpick\n2. **Location**: file and line range\n3. **Issue**: what's wrong\n4. **Fix**: concrete suggestion with code"
  },
  {
    "name": "actant-hub@test-writer",
    "version": "1.0.0",
    "description": "Test writing skill — guides agents to write thorough, maintainable tests using TDD principles.",
    "tags": [
      "testing",
      "tdd",
      "quality"
    ],
    "content": "# Test Writer Skill\n\nYou write thorough, maintainable tests. Follow TDD principles and aim for high confidence, not just high coverage.\n\n## Approach\n\n### 1. Understand Before Testing\n- Read the code under test completely before writing any test\n- Identify the public API surface — test behavior, not implementation\n- List edge cases, error conditions, and boundary values\n\n### 2. Test Structure (AAA Pattern)\n- **Arrange**: set up preconditions and inputs\n- **Act**: execute the behavior under test\n- **Assert**: verify the expected outcome\n\n### 3. Naming Convention\nUse descriptive names that document behavior:\n- `should return empty array when no items match`\n- `should throw ConfigNotFoundError when file is missing`\n- `should retry up to 3 times on transient failure`\n\n### 4. Test Categories\n- **Unit tests**: isolated, fast, mock external dependencies\n- **Integration tests**: verify component interactions with real dependencies\n- **Edge case tests**: null, empty, overflow, concurrent access\n\n### 5. Quality Guidelines\n- Each test verifies exactly one behavior\n- Tests are independent — no shared mutable state between tests\n- Avoid testing implementation details (private methods, internal state)\n- Use factory functions for test data, not copy-paste\n- Prefer explicit assertions over snapshot tests for logic\n\n## Anti-patterns to Avoid\n- Tests that always pass (missing assertions)\n- Tests coupled to implementation (break on refactor)\n- Flaky tests depending on timing or external state\n- Overly broad tests that verify too many things at once"
  },
  {
    "name": "actant-hub@doc-writer",
    "version": "1.0.0",
    "description": "Documentation writing skill — guides agents to write clear, structured technical documentation.",
    "tags": [
      "documentation",
      "writing",
      "technical-writing"
    ],
    "content": "# Documentation Writer Skill\n\nYou write clear, structured technical documentation. Prioritize clarity over completeness — a short, accurate doc beats a long, confusing one.\n\n## Principles\n\n### 1. Know Your Audience\n- **API docs**: developers integrating your code — focus on usage, parameters, return values, errors\n- **Guides**: developers learning a concept — focus on progressive complexity with examples\n- **Architecture docs**: future maintainers — focus on why, not what\n\n### 2. Structure\n- Lead with a one-sentence summary of what this does and why it matters\n- Use progressive disclosure: overview → quickstart → detailed reference\n- Include a working code example within the first screen\n\n### 3. Writing Style\n- Use active voice and present tense\n- One idea per sentence; one topic per paragraph\n- Avoid jargon without definition; link to glossary if needed\n- Use concrete examples instead of abstract explanations\n\n### 4. Code Examples\n- Every public API must have at least one usage example\n- Examples must be complete enough to copy-paste and run\n- Show the expected output or behavior\n- Include error handling in examples\n\n### 5. Maintenance\n- Date or version-stamp docs that may become stale\n- Link to source code for implementation details\n- Prefer generated docs (from code comments) for API reference\n- Keep docs near the code they describe"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-list-0 - Prompt list (initial)
**Time**: 2026-02-24T10:06:27.6714614+08:00

#### Input
```nactant prompt list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-assistant",
    "version": "1.0.0",
    "description": "System prompt for a general-purpose code assistant agent",
    "tags": [
      "coding",
      "assistant",
      "general"
    ],
    "content": "You are a senior software engineer acting as a code assistant. Your role is to help developers write, review, debug, and improve code.\n\n## Guidelines\n\n- Write clean, idiomatic code following the language's conventions\n- Explain your reasoning when making design decisions\n- Suggest tests for any new code you write\n- When fixing bugs, explain the root cause before showing the fix\n- Prefer simple solutions over clever ones\n- If a request is ambiguous, ask for clarification before proceeding\n- Always consider error handling and edge cases\n- Use TypeScript strict mode conventions when writing TypeScript\n- Follow the project's existing patterns and conventions",
    "variables": [
      "language",
      "framework"
    ]
  },
  {
    "name": "actant-hub@qa-assistant",
    "version": "1.0.0",
    "description": "System prompt for a QA testing assistant agent",
    "tags": [
      "testing",
      "qa",
      "quality"
    ],
    "content": "You are a QA engineer focused on finding bugs and ensuring software quality. Your role is to systematically test software, identify issues, and report them clearly.\n\n## Guidelines\n\n- Think like a user: test realistic scenarios, not just technical edge cases\n- Verify both happy paths and failure modes\n- Check boundary values, null inputs, and concurrent operations\n- Document reproduction steps precisely: environment, input, expected vs actual\n- Categorize issues by severity: critical (data loss/security), high (feature broken), medium (degraded UX), low (cosmetic)\n- Suggest fixes when possible, but always separate observation from speculation\n- Run regression tests after any fix to ensure no new issues\n- Test across platforms when applicable (Windows, macOS, Linux)\n- Verify error messages are helpful and actionable"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-add - Prompt add
**Time**: 2026-02-24T10:06:28.6923932+08:00

#### Input
```nactant prompt add C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\system-code-reviewer.json
```

#### Output
```nexit_code: 0

--- stdout ---
Prompt "system-code-reviewer" added successfully.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-list-1 - Prompt list (after)
**Time**: 2026-02-24T10:06:29.7191862+08:00

#### Input
```nactant prompt list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-assistant",
    "version": "1.0.0",
    "description": "System prompt for a general-purpose code assistant agent",
    "tags": [
      "coding",
      "assistant",
      "general"
    ],
    "content": "You are a senior software engineer acting as a code assistant. Your role is to help developers write, review, debug, and improve code.\n\n## Guidelines\n\n- Write clean, idiomatic code following the language's conventions\n- Explain your reasoning when making design decisions\n- Suggest tests for any new code you write\n- When fixing bugs, explain the root cause before showing the fix\n- Prefer simple solutions over clever ones\n- If a request is ambiguous, ask for clarification before proceeding\n- Always consider error handling and edge cases\n- Use TypeScript strict mode conventions when writing TypeScript\n- Follow the project's existing patterns and conventions",
    "variables": [
      "language",
      "framework"
    ]
  },
  {
    "name": "actant-hub@qa-assistant",
    "version": "1.0.0",
    "description": "System prompt for a QA testing assistant agent",
    "tags": [
      "testing",
      "qa",
      "quality"
    ],
    "content": "You are a QA engineer focused on finding bugs and ensuring software quality. Your role is to systematically test software, identify issues, and report them clearly.\n\n## Guidelines\n\n- Think like a user: test realistic scenarios, not just technical edge cases\n- Verify both happy paths and failure modes\n- Check boundary values, null inputs, and concurrent operations\n- Document reproduction steps precisely: environment, input, expected vs actual\n- Categorize issues by severity: critical (data loss/security), high (feature broken), medium (degraded UX), low (cosmetic)\n- Suggest fixes when possible, but always separate observation from speculation\n- Run regression tests after any fix to ensure no new issues\n- Test across platforms when applicable (Windows, macOS, Linux)\n- Verify error messages are helpful and actionable"
  },
  {
    "name": "system-code-reviewer",
    "description": "System prompt for a code review agent",
    "content": "You are a senior code reviewer for the {{project}} project.\n\nYour responsibilities:\n1. Review code changes for correctness, performance, and maintainability\n2. Identify potential bugs, security issues, and anti-patterns\n3. Suggest improvements with concrete code examples\n4. Ensure coding standards and conventions are followed\n5. Verify test coverage for new functionality\n\nWhen reviewing:\n- Be constructive and specific in feedback\n- Explain the 'why' behind suggestions\n- Prioritize issues by severity (critical > major > minor > style)\n- Acknowledge good patterns and improvements",
    "variables": [
      "project"
    ]
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-show - Prompt show
**Time**: 2026-02-24T10:06:30.7472859+08:00

#### Input
```nactant prompt show system-code-reviewer -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "name": "system-code-reviewer",
  "description": "System prompt for a code review agent",
  "content": "You are a senior code reviewer for the {{project}} project.\n\nYour responsibilities:\n1. Review code changes for correctness, performance, and maintainability\n2. Identify potential bugs, security issues, and anti-patterns\n3. Suggest improvements with concrete code examples\n4. Ensure coding standards and conventions are followed\n5. Verify test coverage for new functionality\n\nWhen reviewing:\n- Be constructive and specific in feedback\n- Explain the 'why' behind suggestions\n- Prioritize issues by severity (critical > major > minor > style)\n- Acknowledge good patterns and improvements",
  "variables": [
    "project"
  ]
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-export - Prompt export
**Time**: 2026-02-24T10:06:31.7734930+08:00

#### Input
```nactant prompt export system-code-reviewer -o C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\prompt-exp.json
```

#### Output
```nexit_code: 0

--- stdout ---
Prompt "system-code-reviewer" exported to C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\prompt-exp.json

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-remove - Prompt remove
**Time**: 2026-02-24T10:06:32.8013292+08:00

#### Input
```nactant prompt remove system-code-reviewer
```

#### Output
```nexit_code: 0

--- stdout ---
Prompt "system-code-reviewer" removed.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-prompt-list-2 - Prompt list (removed)
**Time**: 2026-02-24T10:06:33.8403794+08:00

#### Input
```nactant prompt list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@code-assistant",
    "version": "1.0.0",
    "description": "System prompt for a general-purpose code assistant agent",
    "tags": [
      "coding",
      "assistant",
      "general"
    ],
    "content": "You are a senior software engineer acting as a code assistant. Your role is to help developers write, review, debug, and improve code.\n\n## Guidelines\n\n- Write clean, idiomatic code following the language's conventions\n- Explain your reasoning when making design decisions\n- Suggest tests for any new code you write\n- When fixing bugs, explain the root cause before showing the fix\n- Prefer simple solutions over clever ones\n- If a request is ambiguous, ask for clarification before proceeding\n- Always consider error handling and edge cases\n- Use TypeScript strict mode conventions when writing TypeScript\n- Follow the project's existing patterns and conventions",
    "variables": [
      "language",
      "framework"
    ]
  },
  {
    "name": "actant-hub@qa-assistant",
    "version": "1.0.0",
    "description": "System prompt for a QA testing assistant agent",
    "tags": [
      "testing",
      "qa",
      "quality"
    ],
    "content": "You are a QA engineer focused on finding bugs and ensuring software quality. Your role is to systematically test software, identify issues, and report them clearly.\n\n## Guidelines\n\n- Think like a user: test realistic scenarios, not just technical edge cases\n- Verify both happy paths and failure modes\n- Check boundary values, null inputs, and concurrent operations\n- Document reproduction steps precisely: environment, input, expected vs actual\n- Categorize issues by severity: critical (data loss/security), high (feature broken), medium (degraded UX), low (cosmetic)\n- Suggest fixes when possible, but always separate observation from speculation\n- Run regression tests after any fix to ensure no new issues\n- Test across platforms when applicable (Windows, macOS, Linux)\n- Verify error messages are helpful and actionable"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-list-0 - MCP list
**Time**: 2026-02-24T10:06:52.2853860+08:00

#### Input
```nactant mcp list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@filesystem",
    "version": "1.0.0",
    "description": "File system access MCP server — read, write, search, and navigate project files",
    "tags": [
      "fs",
      "files",
      "essential"
    ],
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "."
    ],
    "env": {}
  },
  {
    "name": "actant-hub@memory-server",
    "version": "1.0.0",
    "description": "Persistent memory MCP server — knowledge graph for long-term agent context",
    "tags": [
      "memory",
      "knowledge-graph",
      "persistence"
    ],
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-memory"
    ],
    "env": {}
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-add - MCP add
**Time**: 2026-02-24T10:06:53.3160212+08:00

#### Input
```nactant mcp add C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\filesystem.json
```

#### Output
```nexit_code: 0

--- stdout ---
MCP "filesystem" added successfully.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-list-1 - MCP list (after)
**Time**: 2026-02-24T10:06:54.3381548+08:00

#### Input
```nactant mcp list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@filesystem",
    "version": "1.0.0",
    "description": "File system access MCP server — read, write, search, and navigate project files",
    "tags": [
      "fs",
      "files",
      "essential"
    ],
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "."
    ],
    "env": {}
  },
  {
    "name": "actant-hub@memory-server",
    "version": "1.0.0",
    "description": "Persistent memory MCP server — knowledge graph for long-term agent context",
    "tags": [
      "memory",
      "knowledge-graph",
      "persistence"
    ],
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-memory"
    ],
    "env": {}
  },
  {
    "name": "filesystem",
    "description": "MCP server for filesystem access within the workspace",
    "command": "npx",
    "args": [
      "-y",
      "@anthropic/mcp-filesystem"
    ],
    "env": {
      "ROOT_DIR": "/workspace"
    }
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-show - MCP show
**Time**: 2026-02-24T10:06:55.3629100+08:00

#### Input
```nactant mcp show filesystem -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "name": "filesystem",
  "description": "MCP server for filesystem access within the workspace",
  "command": "npx",
  "args": [
    "-y",
    "@anthropic/mcp-filesystem"
  ],
  "env": {
    "ROOT_DIR": "/workspace"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-export - MCP export
**Time**: 2026-02-24T10:06:56.3918569+08:00

#### Input
```nactant mcp export filesystem -o C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\mcp-exp.json
```

#### Output
```nexit_code: 0

--- stdout ---
MCP "filesystem" exported to C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\mcp-exp.json

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-remove - MCP remove
**Time**: 2026-02-24T10:06:57.4138795+08:00

#### Input
```nactant mcp remove filesystem
```

#### Output
```nexit_code: 0

--- stdout ---
MCP "filesystem" removed.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-mcp-list-2 - MCP list (removed)
**Time**: 2026-02-24T10:06:58.4411464+08:00

#### Input
```nactant mcp list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub@filesystem",
    "version": "1.0.0",
    "description": "File system access MCP server — read, write, search, and navigate project files",
    "tags": [
      "fs",
      "files",
      "essential"
    ],
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "."
    ],
    "env": {}
  },
  {
    "name": "actant-hub@memory-server",
    "version": "1.0.0",
    "description": "Persistent memory MCP server — knowledge graph for long-term agent context",
    "tags": [
      "memory",
      "knowledge-graph",
      "persistence"
    ],
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-memory"
    ],
    "env": {}
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-list-0 - Workflow list
**Time**: 2026-02-24T10:06:59.4746052+08:00

#### Input
```nactant workflow list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-add - Workflow add
**Time**: 2026-02-24T10:07:00.5035272+08:00

#### Input
```nactant workflow add C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\trellis-standard.json
```

#### Output
```nexit_code: 0

--- stdout ---
Workflow "trellis-standard" added successfully.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-list-1 - Workflow list (after)
**Time**: 2026-02-24T10:07:01.5283094+08:00

#### Input
```nactant workflow list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "trellis-standard",
    "description": "Standard Trellis development workflow",
    "content": "# Development Workflow\n\n## Quick Start\n\n1. **Read context** — Understand current project state\n2. **Plan** — Break down the task into actionable steps\n3. **Implement** — Write code following project guidelines\n4. **Test** — Run lint, type-check, and tests\n5. **Record** — Document changes in session journal\n\n## Code Quality Checklist\n\n- [ ] Lint checks pass\n- [ ] Type checks pass\n- [ ] Tests pass\n- [ ] No `any` types introduced\n- [ ] Error handling is comprehensive\n- [ ] Changes documented if needed"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-show - Workflow show
**Time**: 2026-02-24T10:07:02.5579841+08:00

#### Input
```nactant workflow show trellis-standard -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "name": "trellis-standard",
  "description": "Standard Trellis development workflow",
  "content": "# Development Workflow\n\n## Quick Start\n\n1. **Read context** — Understand current project state\n2. **Plan** — Break down the task into actionable steps\n3. **Implement** — Write code following project guidelines\n4. **Test** — Run lint, type-check, and tests\n5. **Record** — Document changes in session journal\n\n## Code Quality Checklist\n\n- [ ] Lint checks pass\n- [ ] Type checks pass\n- [ ] Tests pass\n- [ ] No `any` types introduced\n- [ ] Error handling is comprehensive\n- [ ] Changes documented if needed"
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-export - Workflow export
**Time**: 2026-02-24T10:07:03.5791569+08:00

#### Input
```nactant workflow export trellis-standard -o C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\wf-exp.json
```

#### Output
```nexit_code: 0

--- stdout ---
Workflow "trellis-standard" exported to C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\wf-exp.json

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-remove - Workflow remove
**Time**: 2026-02-24T10:07:04.5944202+08:00

#### Input
```nactant workflow remove trellis-standard
```

#### Output
```nexit_code: 0

--- stdout ---
Workflow "trellis-standard" removed.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-wf-list-2 - Workflow list (removed)
**Time**: 2026-02-24T10:07:05.6221858+08:00

#### Input
```nactant workflow list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-list-0 - Plugin list
**Time**: 2026-02-24T10:07:06.6334882+08:00

#### Input
```nactant plugin list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-add - Plugin add
**Time**: 2026-02-24T10:07:07.6652776+08:00

#### Input
```nactant plugin add C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\web-search-plugin.json
```

#### Output
```nexit_code: 0

--- stdout ---
Plugin "web-search" added successfully.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-list-1 - Plugin list (after)
**Time**: 2026-02-24T10:07:08.6920939+08:00

#### Input
```nactant plugin list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "web-search",
    "description": "Web search capability plugin — enables agents to search the web for real-time information",
    "type": "npm",
    "source": "@anthropic/web-search",
    "config": {
      "maxResults": 10,
      "safeSearch": true
    },
    "enabled": true
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-show - Plugin show
**Time**: 2026-02-24T10:07:09.7088986+08:00

#### Input
```nactant plugin show web-search -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "name": "web-search",
  "description": "Web search capability plugin — enables agents to search the web for real-time information",
  "type": "npm",
  "source": "@anthropic/web-search",
  "config": {
    "maxResults": 10,
    "safeSearch": true
  },
  "enabled": true
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-export - Plugin export
**Time**: 2026-02-24T10:07:10.7381843+08:00

#### Input
```nactant plugin export web-search -o C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\plugin-exp.json
```

#### Output
```nexit_code: 0

--- stdout ---
Plugin "web-search" exported to C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\plugin-exp.json

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-remove - Plugin remove
**Time**: 2026-02-24T10:07:11.7634699+08:00

#### Input
```nactant plugin remove web-search
```

#### Output
```nexit_code: 0

--- stdout ---
Plugin "web-search" removed.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p3-plugin-list-2 - Plugin list (removed)
**Time**: 2026-02-24T10:07:12.7871889+08:00

#### Input
```nactant plugin list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p4-source-list-0 - Source list
**Time**: 2026-02-24T10:07:13.7990908+08:00

#### Input
```nactant source list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub",
    "config": {
      "type": "github",
      "url": "https://github.com/blackplume233/actant-hub.git",
      "branch": "main"
    },
    "syncedAt": "2026-02-24T02:07:14.142Z"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p4-source-add - Source add local
**Time**: 2026-02-24T10:07:14.8137031+08:00

#### Input
```nactant source add C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\_fixtures\local-source --type local --name qa-local-source
```

#### Output
```nexit_code: 0

--- stdout ---
Source "qa-local-source" added. Components: 0 skills, 0 prompts, 0 mcp, 0 workflows, 0 presets

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p4-source-list-1 - Source list (after)
**Time**: 2026-02-24T10:07:15.8263815+08:00

#### Input
```nactant source list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "actant-hub",
    "config": {
      "type": "github",
      "url": "https://github.com/blackplume233/actant-hub.git",
      "branch": "main"
    },
    "syncedAt": "2026-02-24T02:07:16.171Z"
  },
  {
    "name": "qa-local-source",
    "config": {
      "type": "local",
      "path": "C:\\Users\\black\\AppData\\Local\\Temp\\ac-qa-r2-1802678999\\_fixtures\\local-source"
    },
    "syncedAt": "2026-02-24T02:07:16.171Z"
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p4-source-remove - Source remove
**Time**: 2026-02-24T10:07:16.8402802+08:00

#### Input
```nactant source remove qa-local-source
```

#### Output
```nexit_code: 0

--- stdout ---
Source "qa-local-source" removed.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p5-preset-list - Preset list
**Time**: 2026-02-24T10:07:17.8566210+08:00

#### Input
```nactant preset list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "name": "web-dev",
    "version": "1.0.0",
    "description": "Web development preset — code review, testing, documentation, and file system access",
    "skills": [
      "code-review",
      "test-writer",
      "doc-writer"
    ],
    "prompts": [
      "code-assistant"
    ],
    "mcpServers": [
      "filesystem"
    ],
    "templates": [
      "code-reviewer",
      "qa-engineer",
      "doc-writer"
    ]
  },
  {
    "name": "devops",
    "version": "1.0.0",
    "description": "DevOps preset — testing, documentation, file system and persistent memory for infrastructure work",
    "skills": [
      "test-writer",
      "doc-writer"
    ],
    "prompts": [
      "code-assistant"
    ],
    "mcpServers": [
      "filesystem",
      "memory-server"
    ],
    "templates": [
      "qa-engineer"
    ]
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p5-preset-show-ne - Preset show nonexistent
**Time**: 2026-02-24T10:07:18.8822828+08:00

#### Input
```nactant preset show ne@preset
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32000] Configuration file not found: Preset "ne@preset" not found
  Context: {"configPath":"Preset \"ne@preset\" not found"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p6-list-0 - Agent list (empty)
**Time**: 2026-02-24T10:07:44.4860454+08:00

#### Input
```nactant agent list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-create - Agent create
**Time**: 2026-02-24T10:07:45.5313147+08:00

#### Input
```nactant agent create reg-agent -t qa-regression-tpl -f json
```

#### Output
```nexit_code: 0

--- stdout ---
Agent created successfully.

{
  "id": "21164080-9973-4bc5-8b1c-0071be56bc49",
  "name": "reg-agent",
  "templateName": "qa-regression-tpl",
  "templateVersion": "1.0.0",
  "backendType": "cursor",
  "status": "created",
  "launchMode": "direct",
  "workspacePolicy": "persistent",
  "processOwnership": "managed",
  "createdAt": "2026-02-24T02:07:45.877Z",
  "updatedAt": "2026-02-24T02:07:45.877Z",
  "effectivePermissions": {
    "allow": [
      "*"
    ],
    "deny": [],
    "ask": [],
    "defaultMode": "bypassPermissions"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-list-1 - Agent list (after)
**Time**: 2026-02-24T10:07:46.5595426+08:00

#### Input
```nactant agent list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[
  {
    "id": "21164080-9973-4bc5-8b1c-0071be56bc49",
    "name": "reg-agent",
    "templateName": "qa-regression-tpl",
    "templateVersion": "1.0.0",
    "backendType": "cursor",
    "status": "created",
    "launchMode": "direct",
    "workspacePolicy": "persistent",
    "processOwnership": "managed",
    "createdAt": "2026-02-24T02:07:45.877Z",
    "updatedAt": "2026-02-24T02:07:45.877Z",
    "effectivePermissions": {
      "allow": [
        "*"
      ],
      "deny": [],
      "ask": [],
      "defaultMode": "bypassPermissions"
    }
  }
]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-status-created - Status (created)
**Time**: 2026-02-24T10:07:47.5877452+08:00

#### Input
```nactant agent status reg-agent -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "id": "21164080-9973-4bc5-8b1c-0071be56bc49",
  "name": "reg-agent",
  "templateName": "qa-regression-tpl",
  "templateVersion": "1.0.0",
  "backendType": "cursor",
  "status": "created",
  "launchMode": "direct",
  "workspacePolicy": "persistent",
  "processOwnership": "managed",
  "createdAt": "2026-02-24T02:07:45.877Z",
  "updatedAt": "2026-02-24T02:07:45.877Z",
  "effectivePermissions": {
    "allow": [
      "*"
    ],
    "deny": [],
    "ask": [],
    "defaultMode": "bypassPermissions"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-resolve - Resolve (cursor mode)
**Time**: 2026-02-24T10:07:48.6122836+08:00

#### Input
```nactant agent resolve reg-agent
```

#### Output
```nexit_code: 0

--- stdout ---
Instance:  reg-agent
Backend:   cursor
Workspace: C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\instances\reg-agent
Command:   cursor.cmd
Args:      C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\instances\reg-agent

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-status-resolved - Status (resolved)
**Time**: 2026-02-24T10:07:49.6440388+08:00

#### Input
```nactant agent status reg-agent -f json
```

#### Output
```nexit_code: 0

--- stdout ---
{
  "id": "21164080-9973-4bc5-8b1c-0071be56bc49",
  "name": "reg-agent",
  "templateName": "qa-regression-tpl",
  "templateVersion": "1.0.0",
  "backendType": "cursor",
  "status": "created",
  "launchMode": "direct",
  "workspacePolicy": "persistent",
  "processOwnership": "managed",
  "createdAt": "2026-02-24T02:07:45.877Z",
  "updatedAt": "2026-02-24T02:07:45.877Z",
  "effectivePermissions": {
    "allow": [
      "*"
    ],
    "deny": [],
    "ask": [],
    "defaultMode": "bypassPermissions"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-destroy - Destroy agent
**Time**: 2026-02-24T10:07:50.6720662+08:00

#### Input
```nactant agent destroy reg-agent --force
```

#### Output
```nexit_code: 0

--- stdout ---
Destroyed reg-agent

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p6-list-2 - Agent list (after destroy)
**Time**: 2026-02-24T10:07:51.6956980+08:00

#### Input
```nactant agent list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p7-create - Create adv-agent
**Time**: 2026-02-24T10:07:52.7256302+08:00

#### Input
```nactant agent create adv-agent -t qa-regression-tpl -f json
```

#### Output
```nexit_code: 0

--- stdout ---
Agent created successfully.

{
  "id": "e19b4213-c08e-4c79-8431-55cfe5c11d2e",
  "name": "adv-agent",
  "templateName": "qa-regression-tpl",
  "templateVersion": "1.0.0",
  "backendType": "cursor",
  "status": "created",
  "launchMode": "direct",
  "workspacePolicy": "persistent",
  "processOwnership": "managed",
  "createdAt": "2026-02-24T02:07:53.076Z",
  "updatedAt": "2026-02-24T02:07:53.076Z",
  "effectivePermissions": {
    "allow": [
      "*"
    ],
    "deny": [],
    "ask": [],
    "defaultMode": "bypassPermissions"
  }
}

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p7-resolve - Resolve workspace
**Time**: 2026-02-24T10:07:53.7505873+08:00

#### Input
```nactant agent resolve adv-agent
```

#### Output
```nexit_code: 0

--- stdout ---
Instance:  adv-agent
Backend:   cursor
Workspace: C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\instances\adv-agent
Command:   cursor.cmd
Args:      C:\Users\black\AppData\Local\Temp\ac-qa-r2-1802678999\instances\adv-agent

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p7-tasks - Agent tasks
**Time**: 2026-02-24T10:07:54.7792660+08:00

#### Input
```nactant agent tasks adv-agent
```

#### Output
```nexit_code: 0

--- stdout ---
Queued: 0  Processing: false

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p7-logs - Agent logs
**Time**: 2026-02-24T10:07:55.8069223+08:00

#### Input
```nactant agent logs adv-agent
```

#### Output
```nexit_code: 0

--- stdout ---
No execution logs.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p7-dispatch-nr - Dispatch (not running)
**Time**: 2026-02-24T10:07:56.8335705+08:00

#### Input
```nactant agent dispatch adv-agent -m "test"
```

#### Output
```nexit_code: 1

--- stdout ---
No scheduler for agent "adv-agent". Task not queued.

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p7-attach-bad - Attach bad PID
**Time**: 2026-02-24T10:07:57.8614149+08:00

#### Input
```nactant agent attach adv-agent --pid 99999
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32008] Failed to launch agent "adv-agent"
  Context: {"instanceName":"adv-agent","cause":"Process with PID 99999 does not exist"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p7-detach-na - Detach (not attached)
**Time**: 2026-02-24T10:07:58.8880803+08:00

#### Input
```nactant agent detach adv-agent
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32010] Agent "adv-agent" has no attached process
  Context: {"instanceName":"adv-agent"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p7-destroy - Destroy adv-agent
**Time**: 2026-02-24T10:07:59.9129150+08:00

#### Input
```nactant agent destroy adv-agent --force
```

#### Output
```nexit_code: 0

--- stdout ---
Destroyed adv-agent

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p8-help - Proxy help
**Time**: 2026-02-24T10:08:00.9445935+08:00

#### Input
```nactant proxy --help
```

#### Output
```nexit_code: 0

--- stdout ---
Usage: actant proxy [options] <name>

Run an ACP proxy for an agent (stdin/stdout ACP protocol)

Arguments:
  name                       Agent name to proxy

Options:
  --lease                    Use Session Lease mode (requires running agent)
                             (default: false)
  -t, --template <template>  Template name (auto-creates instance if not found)
  -h, --help                 display help for command

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p8-ne - Proxy nonexistent
**Time**: 2026-02-24T10:08:01.9742749+08:00

#### Input
```nactant proxy ne-proxy-agent
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32003] Agent instance "ne-proxy-agent" not found
  Context: {"instanceName":"ne-proxy-agent"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p9-schedule-ne - Schedule list (nonexistent)
**Time**: 2026-02-24T10:08:02.9953710+08:00

#### Input
```nactant schedule list ne-sched-agent
```

#### Output
```nexit_code: 1

--- stdout ---
No scheduler for agent "ne-sched-agent".

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-no-tpl - Create no template
**Time**: 2026-02-24T10:08:04.0321293+08:00

#### Input
```nactant agent create no-tpl
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
error: required option '-t, --template <template>' not specified
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-bad-tpl - Create bad template
**Time**: 2026-02-24T10:08:05.0544776+08:00

#### Input
```nactant agent create bad -t ne-tpl
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32001] Template "ne-tpl" not found in registry
  Context: {"templateName":"ne-tpl"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-start-ne - Start nonexistent
**Time**: 2026-02-24T10:08:06.0825818+08:00

#### Input
```nactant agent start ghost-xyz
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32003] Agent instance "ghost-xyz" not found
  Context: {"instanceName":"ghost-xyz"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-stop-ne - Stop nonexistent
**Time**: 2026-02-24T10:08:07.1137363+08:00

#### Input
```nactant agent stop ghost-xyz
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32003] Agent instance "ghost-xyz" not found
  Context: {"instanceName":"ghost-xyz"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-status-ne - Status nonexistent
**Time**: 2026-02-24T10:08:08.1404551+08:00

#### Input
```nactant agent status ghost-xyz
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32003] Agent instance "ghost-xyz" not found
  Context: {"instanceName":"ghost-xyz"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-destroy-ne - Destroy nonexistent (--force)
**Time**: 2026-02-24T10:08:09.1670742+08:00

#### Input
```nactant agent destroy ghost-xyz --force
```

#### Output
```nexit_code: 0

--- stdout ---
Destroyed ghost-xyz

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p10-dup-create - Create for dup test
**Time**: 2026-02-24T10:08:10.1934406+08:00

#### Input
```nactant agent create dup-test -t qa-regression-tpl
```

#### Output
```nexit_code: 0

--- stdout ---
Agent created successfully.

Agent:     dup-test
ID:        9c3c2e64-02b7-4bbd-8328-b8bcaf7eb547
Template:  qa-regression-tpl@1.0.0
Status:    created
Launch:    direct
PID:       —
Created:   2026-02-24T02:08:10.535Z
Updated:   2026-02-24T02:08:10.535Z

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p10-dup-dup - Duplicate create
**Time**: 2026-02-24T10:08:11.2240048+08:00

#### Input
```nactant agent create dup-test -t qa-regression-tpl
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32002] Instance directory "dup-test" already exists
  Context: {"validationErrors":[{"path":"name","message":"Directory already exists: C:\\Users\\black\\AppData\\Local\\Temp\\ac-qa-r2-1802678999\\instances\\dup-test"}]}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-dup-clean - Cleanup dup-test
**Time**: 2026-02-24T10:08:12.2556220+08:00

#### Input
```nactant agent destroy dup-test --force
```

#### Output
```nexit_code: 0

--- stdout ---
Destroyed dup-test

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p10-skill-ne - Skill show ne
**Time**: 2026-02-24T10:08:13.2833046+08:00

#### Input
```nactant skill show ne-skill
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32000] Configuration file not found: Skill "ne-skill" not found
  Context: {"configPath":"Skill \"ne-skill\" not found"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-prompt-ne - Prompt show ne
**Time**: 2026-02-24T10:08:14.3033536+08:00

#### Input
```nactant prompt show ne-prompt
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32000] Configuration file not found: Prompt "ne-prompt" not found
  Context: {"configPath":"Prompt \"ne-prompt\" not found"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-mcp-ne - MCP show ne
**Time**: 2026-02-24T10:08:15.3183848+08:00

#### Input
```nactant mcp show ne-mcp
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32000] Configuration file not found: MCP server "ne-mcp" not found
  Context: {"configPath":"MCP server \"ne-mcp\" not found"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-wf-ne - Workflow show ne
**Time**: 2026-02-24T10:08:16.3511200+08:00

#### Input
```nactant workflow show ne-wf
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32000] Configuration file not found: Workflow "ne-wf" not found
  Context: {"configPath":"Workflow \"ne-wf\" not found"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-plugin-ne - Plugin show ne
**Time**: 2026-02-24T10:08:17.3774994+08:00

#### Input
```nactant plugin show ne-plugin
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
[RPC -32000] Configuration file not found: Plugin "ne-plugin" not found
  Context: {"configPath":"Plugin \"ne-plugin\" not found"}
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p10-tpl-nofile - Validate nofile
**Time**: 2026-02-24T10:08:18.4066035+08:00

#### Input
```nactant template validate C:\nonexistent-12345.json
```

#### Output
```nexit_code: 1

--- stdout ---


--- stderr ---
Invalid template
  - : Configuration file not found: C:\nonexistent-12345.json
```

#### Judgment: PASS
**Expect**: exitNon0

---

### [Step] p11-list-final - Final agent list
**Time**: 2026-02-24T10:08:19.4334538+08:00

#### Input
```nactant agent list -f json
```

#### Output
```nexit_code: 0

--- stdout ---
[]

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p11-daemon-stop - Stop daemon
**Time**: 2026-02-24T10:08:20.4604963+08:00

#### Input
```nactant daemon stop
```

#### Output
```nexit_code: 0

--- stdout ---
Daemon stopping...

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exit0

---

### [Step] p11-daemon-status - Daemon status (stopped)
**Time**: 2026-02-24T10:08:21.4917477+08:00

#### Input
```nactant daemon status
```

#### Output
```nexit_code: 1

--- stdout ---
Daemon is not running.
Start with: actant daemon start

--- stderr ---
(empty)
```

#### Judgment: PASS
**Expect**: exitNon0

---
