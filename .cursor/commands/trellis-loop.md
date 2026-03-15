# Loop Execution

Start with a planning phase, then execute the requested work in iterative loops.

## Core Behavior

1. First, understand the user's goal and build a clear plan before making changes.
2. Execute the current highest-priority item in the loop.
3. After each task or subtask completes, re-evaluate the remaining work against the original goal.
4. Repeat the loop by issuing the same internal command sequence again until you determine the loop's commands are fully exhausted.
5. Stop only when no meaningful work remains, all acceptance criteria are satisfied, and the loop goal is complete.

## Loop Commands

For each iteration, follow this sequence:

### 1. Plan
- Read relevant context, specs, and task files.
- Clarify dependencies, risks, and next concrete action.
- If the work is substantial, present or maintain a short execution plan.

### 2. Execute
- Perform the next concrete task.
- Prefer completing one coherent unit of work per loop iteration.
- Update any task tracking or planning artifacts if they are part of the workflow.

### 3. Verify
- Run the most relevant checks for the work just completed.
- Confirm whether the iteration's goal is done and whether follow-up work remains.

### 4. Decide
- If more loop commands remain to satisfy the original request, immediately start the next iteration from Plan.
- If the loop goal is fully complete, stop and provide a final completion report.

## Stop Condition

Terminate the loop only when all of the following are true:
- The requested goal has been fully delivered
- No planned or newly discovered required follow-up remains
- Relevant verification has passed or any remaining gap is explicitly reported as non-blocking

## Output Format

During execution, keep updates concise:
- Current iteration goal
- What was completed
- What remains before the next loop iteration

At the end, report:
- Completed work
- Verification performed
- Why the loop is terminating
