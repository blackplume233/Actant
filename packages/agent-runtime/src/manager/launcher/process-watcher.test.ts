import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProcessWatcher, type ProcessExitHandler } from "./process-watcher";
import * as processUtils from "./process-utils";

vi.mock("./process-utils", () => ({
  isProcessAlive: vi.fn(() => true),
}));

describe("ProcessWatcher", () => {
  let watcher: ProcessWatcher;
  let exitHandler: ReturnType<typeof vi.fn<ProcessExitHandler>>;
  const isAliveMock = vi.mocked(processUtils.isProcessAlive);

  beforeEach(() => {
    vi.useFakeTimers();
    exitHandler = vi.fn<ProcessExitHandler>();
    isAliveMock.mockReturnValue(true);
  });

  afterEach(() => {
    watcher?.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("watch / unwatch", () => {
    it("should track watched processes", () => {
      watcher = new ProcessWatcher(exitHandler);

      watcher.watch("agent-1", 1001);
      watcher.watch("agent-2", 1002);

      expect(watcher.isWatching("agent-1")).toBe(true);
      expect(watcher.isWatching("agent-2")).toBe(true);
      expect(watcher.watchCount).toBe(2);
    });

    it("should remove unwatched processes", () => {
      watcher = new ProcessWatcher(exitHandler);

      watcher.watch("agent-1", 1001);
      const removed = watcher.unwatch("agent-1");

      expect(removed).toBe(true);
      expect(watcher.isWatching("agent-1")).toBe(false);
      expect(watcher.watchCount).toBe(0);
    });

    it("should return false when unwatching non-existent entry", () => {
      watcher = new ProcessWatcher(exitHandler);
      expect(watcher.unwatch("ghost")).toBe(false);
    });

    it("should overwrite existing watch for same name", () => {
      watcher = new ProcessWatcher(exitHandler);

      watcher.watch("agent-1", 1001);
      watcher.watch("agent-1", 2002);

      expect(watcher.watchCount).toBe(1);
    });
  });

  describe("polling", () => {
    it("should detect exited process and call handler", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);
      watcher.start();

      isAliveMock.mockReturnValue(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(exitHandler).toHaveBeenCalledWith({
        instanceName: "agent-1",
        pid: 1001,
      });
      expect(watcher.isWatching("agent-1")).toBe(false);
    });

    it("should not call handler for alive processes", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);
      watcher.start();

      isAliveMock.mockReturnValue(true);
      await vi.advanceTimersByTimeAsync(100);

      expect(exitHandler).not.toHaveBeenCalled();
      expect(watcher.isWatching("agent-1")).toBe(true);
    });

    it("should handle multiple exits in a single poll", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);
      watcher.watch("agent-2", 1002);
      watcher.start();

      isAliveMock.mockReturnValue(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(exitHandler).toHaveBeenCalledTimes(2);
      expect(watcher.watchCount).toBe(0);
    });

    it("should only report exit for dead processes", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("alive-agent", 1001);
      watcher.watch("dead-agent", 1002);
      watcher.start();

      isAliveMock.mockImplementation((pid) => pid === 1001);
      await vi.advanceTimersByTimeAsync(100);

      expect(exitHandler).toHaveBeenCalledTimes(1);
      expect(exitHandler).toHaveBeenCalledWith({
        instanceName: "dead-agent",
        pid: 1002,
      });
      expect(watcher.isWatching("alive-agent")).toBe(true);
      expect(watcher.isWatching("dead-agent")).toBe(false);
    });

    it("should continue polling after handler throws", async () => {
      exitHandler.mockRejectedValueOnce(new Error("handler error"));

      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);
      watcher.watch("agent-2", 1002);
      watcher.start();

      isAliveMock.mockReturnValue(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(exitHandler).toHaveBeenCalledTimes(2);
      expect(watcher.watchCount).toBe(0);
    });

    it("should not fire for processes unwatched before poll", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);
      watcher.start();

      watcher.unwatch("agent-1");
      isAliveMock.mockReturnValue(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(exitHandler).not.toHaveBeenCalled();
    });
  });

  describe("start / stop / dispose", () => {
    it("should not poll when stopped", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);

      isAliveMock.mockReturnValue(false);
      await vi.advanceTimersByTimeAsync(200);

      expect(exitHandler).not.toHaveBeenCalled();
    });

    it("should stop polling after stop()", async () => {
      watcher = new ProcessWatcher(exitHandler, { pollIntervalMs: 100 });
      watcher.watch("agent-1", 1001);
      watcher.start();
      watcher.stop();

      isAliveMock.mockReturnValue(false);
      await vi.advanceTimersByTimeAsync(200);

      expect(exitHandler).not.toHaveBeenCalled();
    });

    it("should clear all watches on dispose", () => {
      watcher = new ProcessWatcher(exitHandler);
      watcher.watch("agent-1", 1001);
      watcher.watch("agent-2", 1002);
      watcher.start();

      watcher.dispose();

      expect(watcher.watchCount).toBe(0);
      expect(watcher.isRunning).toBe(false);
    });

    it("should report isRunning correctly", () => {
      watcher = new ProcessWatcher(exitHandler);

      expect(watcher.isRunning).toBe(false);
      watcher.start();
      expect(watcher.isRunning).toBe(true);
      watcher.stop();
      expect(watcher.isRunning).toBe(false);
    });

    it("should be safe to call start() twice", () => {
      watcher = new ProcessWatcher(exitHandler);
      watcher.start();
      watcher.start();
      expect(watcher.isRunning).toBe(true);
    });

    it("should be safe to call stop() when not running", () => {
      watcher = new ProcessWatcher(exitHandler);
      watcher.stop();
      expect(watcher.isRunning).toBe(false);
    });
  });

  describe("default options", () => {
    it("should default pollIntervalMs to 5000", () => {
      watcher = new ProcessWatcher(exitHandler);
      watcher.watch("agent-1", 1001);
      watcher.start();

      isAliveMock.mockReturnValue(false);
      vi.advanceTimersByTime(4999);
      expect(exitHandler).not.toHaveBeenCalled();
    });
  });
});
