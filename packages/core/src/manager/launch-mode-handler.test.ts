import { describe, it, expect } from "vitest";
import type { AgentInstanceMeta } from "@actant/shared";
import { getLaunchModeHandler } from "./launch-mode-handler";

function makeMeta(overrides?: Partial<AgentInstanceMeta>): AgentInstanceMeta {
  return {
    id: "test-id",
    name: "test-agent",
    templateName: "test-tpl",
    templateVersion: "1.0.0",
    backendType: "cursor",
    status: "running",
    launchMode: "direct",
    workspacePolicy: "persistent",
    processOwnership: "managed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("LaunchModeHandler", () => {
  describe("direct", () => {
    const handler = getLaunchModeHandler("direct");

    it("should return mark-stopped on process exit", () => {
      expect(handler.getProcessExitAction("agent-1")).toEqual({ type: "mark-stopped" });
    });

    it("should return mark-stopped on recovery", () => {
      expect(handler.getRecoveryAction("agent-1")).toEqual({ type: "mark-stopped" });
    });
  });

  describe("acp-background", () => {
    const handler = getLaunchModeHandler("acp-background");

    it("should return mark-stopped on process exit", () => {
      expect(handler.getProcessExitAction("agent-1")).toEqual({ type: "mark-stopped" });
    });

    it("should return mark-stopped on recovery", () => {
      expect(handler.getRecoveryAction("agent-1")).toEqual({ type: "mark-stopped" });
    });
  });

  describe("acp-service", () => {
    const handler = getLaunchModeHandler("acp-service");

    it("should return restart on process exit", () => {
      expect(handler.getProcessExitAction("agent-1")).toEqual({ type: "restart" });
    });

    it("should return restart on recovery", () => {
      expect(handler.getRecoveryAction("agent-1")).toEqual({ type: "restart" });
    });
  });

  describe("one-shot", () => {
    const handler = getLaunchModeHandler("one-shot");

    it("should return mark-stopped by default", () => {
      expect(handler.getProcessExitAction("agent-1")).toEqual({ type: "mark-stopped" });
    });

    it("should return destroy when autoDestroy metadata is set", () => {
      const meta = makeMeta({ launchMode: "one-shot", metadata: { autoDestroy: "true" } });
      expect(handler.getProcessExitAction("agent-1", meta)).toEqual({ type: "destroy" });
    });

    it("should return mark-stopped when autoDestroy is false", () => {
      const meta = makeMeta({ launchMode: "one-shot", metadata: { autoDestroy: "false" } });
      expect(handler.getProcessExitAction("agent-1", meta)).toEqual({ type: "mark-stopped" });
    });

    it("should return mark-stopped on recovery", () => {
      expect(handler.getRecoveryAction("agent-1")).toEqual({ type: "mark-stopped" });
    });
  });

  describe("getLaunchModeHandler", () => {
    it("should return different handlers for each mode", () => {
      const modes = ["direct", "acp-background", "acp-service", "one-shot"] as const;
      const handlers = modes.map(getLaunchModeHandler);

      expect(handlers[0]!.mode).toBe("direct");
      expect(handlers[1]!.mode).toBe("acp-background");
      expect(handlers[2]!.mode).toBe("acp-service");
      expect(handlers[3]!.mode).toBe("one-shot");
    });
  });
});
