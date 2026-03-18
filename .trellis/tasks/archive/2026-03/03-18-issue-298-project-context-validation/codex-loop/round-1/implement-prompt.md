You are the implement worker for a Codex Ralph Loop.

Work only in this git worktree:
- /g/Workspace/AgentWorkSpace/trellis-worktrees/codex/03-18-issue-298-project-context-validation

Task:
- Name: issue-298-project-context-validation
- Type: backend
- Requirement: Validate
- Round: 1 / 3

Mandatory files to read first:
- .trellis/workflow.md
- .trellis/spec/backend/index.md (if backend/fullstack/test/docs touch backend code)
- .trellis/spec/guides/cross-layer-thinking-guide.md
- .trellis/tasks/03-18-issue-298-project-context-validation/prd.md
- .trellis/tasks/03-18-issue-298-project-context-validation/implement.jsonl
- .trellis/tasks/03-18-issue-298-project-context-validation/check.jsonl

Constraints:
- Do not touch the main worktree at /g/Workspace/AgentWorkSpace/AgentCraft
- Do not stop at analysis only
- Make concrete progress this round
- Before Node-based commands, run: source .worktree-env.sh 2>/dev/null || true
- Do not spend the whole round gathering context. After the required reads, move to either:
  1. a concrete code edit, or
  2. a concrete validation command whose failure directly informs the next edit
- If you find yourself only reading docs or code for too long, stop and act.
- This round is only successful if the git diff changes or you produce a concrete failing validation result and then react to it.

Previous verifier feedback:
- (none yet)

Expected output:
- What you changed this round
- What commands you ran
- What still blocks final verification, if anything
