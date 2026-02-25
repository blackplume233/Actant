/**
 * Shared test utilities for @actant/core.
 *
 * Provides real-process-based helpers that replace MockLauncher.
 * All lifecycle tests should use these to avoid fake-PID race conditions.
 */
export { createTestLauncher, makeSleeperTemplate, createTestManager } from "./test-launcher";
