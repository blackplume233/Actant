# Phase 3 Black-Box CLI Test Report

**Date:** 2026-02-22
**Summary:** Total 36 | Passed 33 | Warned 2 | Failed 1

## FAIL: Step A.2 - daemon status
With ACTANT_SOCKET=\\.\pipe\ac-qa-phase3-test, daemon status returns 'not running' because daemon binds to pipe derived from ACTANT_HOME, not ACTANT_SOCKET.

## WARN: Step C.15 - template show
domainContext.plugins not displayed in template show output.

## WARN: Step D.18 - Workspace artifacts
AGENTS.md not present in workspace root.

Full report written to .trellis/tasks/qa-phase3/
