import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RestartTracker } from "./restart-tracker";

describe("RestartTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("shouldRestart", () => {
    it("should allow restart when under limit", () => {
      const tracker = new RestartTracker({ maxRestarts: 3 });
      const decision = tracker.shouldRestart("agent-1");

      expect(decision.allowed).toBe(true);
      expect(decision.attempt).toBe(1);
    });

    it("should deny restart when limit is reached", () => {
      const tracker = new RestartTracker({ maxRestarts: 2 });

      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");

      const decision = tracker.shouldRestart("agent-1");
      expect(decision.allowed).toBe(false);
      expect(decision.attempt).toBe(2);
    });

    it("should use exponential backoff", () => {
      const tracker = new RestartTracker({ backoffBaseMs: 1000, maxRestarts: 5 });

      let d = tracker.shouldRestart("agent-1");
      expect(d.delayMs).toBe(1000); // 1000 * 2^0
      tracker.recordRestart("agent-1");

      d = tracker.shouldRestart("agent-1");
      expect(d.delayMs).toBe(2000); // 1000 * 2^1
      tracker.recordRestart("agent-1");

      d = tracker.shouldRestart("agent-1");
      expect(d.delayMs).toBe(4000); // 1000 * 2^2
      tracker.recordRestart("agent-1");

      d = tracker.shouldRestart("agent-1");
      expect(d.delayMs).toBe(8000); // 1000 * 2^3
    });

    it("should cap backoff at backoffMaxMs", () => {
      const tracker = new RestartTracker({ backoffBaseMs: 10000, backoffMaxMs: 30000, maxRestarts: 10 });

      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");

      const d = tracker.shouldRestart("agent-1");
      expect(d.delayMs).toBe(30000);
    });

    it("should reset counter after stable running period", () => {
      const resetAfterMs = 5000;
      const tracker = new RestartTracker({ maxRestarts: 3, resetAfterMs });

      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");
      tracker.recordStart("agent-1");

      vi.advanceTimersByTime(resetAfterMs + 1);

      const d = tracker.shouldRestart("agent-1");
      expect(d.allowed).toBe(true);
      expect(d.attempt).toBe(1);
      expect(d.delayMs).toBe(1000);
    });

    it("should NOT reset counter before stable period", () => {
      const tracker = new RestartTracker({ maxRestarts: 3, resetAfterMs: 5000 });

      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");
      tracker.recordStart("agent-1");

      vi.advanceTimersByTime(3000);

      const d = tracker.shouldRestart("agent-1");
      expect(d.allowed).toBe(true);
      expect(d.attempt).toBe(3);
    });
  });

  describe("recordRestart / recordStart", () => {
    it("should increment count on recordRestart", () => {
      const tracker = new RestartTracker();

      expect(tracker.getRestartCount("agent-1")).toBe(0);
      tracker.recordRestart("agent-1");
      expect(tracker.getRestartCount("agent-1")).toBe(1);
      tracker.recordRestart("agent-1");
      expect(tracker.getRestartCount("agent-1")).toBe(2);
    });
  });

  describe("reset / dispose", () => {
    it("should reset individual instance tracking", () => {
      const tracker = new RestartTracker();
      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");

      tracker.reset("agent-1");
      expect(tracker.getRestartCount("agent-1")).toBe(0);

      const d = tracker.shouldRestart("agent-1");
      expect(d.allowed).toBe(true);
      expect(d.attempt).toBe(1);
    });

    it("should clear all state on dispose", () => {
      const tracker = new RestartTracker();
      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-2");

      tracker.dispose();
      expect(tracker.getRestartCount("agent-1")).toBe(0);
      expect(tracker.getRestartCount("agent-2")).toBe(0);
    });
  });

  describe("independent tracking per instance", () => {
    it("should track instances independently", () => {
      const tracker = new RestartTracker({ maxRestarts: 2 });

      tracker.recordRestart("agent-1");
      tracker.recordRestart("agent-1");

      const d1 = tracker.shouldRestart("agent-1");
      const d2 = tracker.shouldRestart("agent-2");

      expect(d1.allowed).toBe(false);
      expect(d2.allowed).toBe(true);
    });
  });
});
