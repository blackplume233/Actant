import { describe, it, expect, beforeEach } from "vitest";
import { VfsPermissionManager, DEFAULT_PERMISSION_RULES } from "../vfs-permission-manager";
import type { VfsIdentity, VfsSourceRegistration } from "@actant/shared";

function agentIdentity(name: string, archetype: "repo" | "service" | "employee" = "repo"): VfsIdentity {
  return { type: "agent", agentName: name, archetype, sessionId: "s1" };
}

const anonymousIdentity: VfsIdentity = { type: "anonymous" };

function createSource(owner?: string): VfsSourceRegistration {
  return {
    name: "test",
    mountPoint: "/test",
    sourceType: "memory",
    lifecycle: { type: "manual" },
    metadata: { owner },
    fileSchema: {},
    handlers: {},
  };
}

describe("VfsPermissionManager", () => {
  let pm: VfsPermissionManager;

  beforeEach(() => {
    pm = new VfsPermissionManager([...DEFAULT_PERMISSION_RULES]);
  });

  describe("workspace access", () => {
    it("allows any agent full access to /workspace", () => {
      const identity = agentIdentity("agent-a");
      expect(pm.check(identity, "/workspace/src/index.ts", "read")).toBe("allow");
      expect(pm.check(identity, "/workspace/src/index.ts", "write")).toBe("allow");
      expect(pm.check(identity, "/workspace/src/index.ts", "delete")).toBe("allow");
    });

    it("denies anonymous access to /workspace", () => {
      expect(pm.check(anonymousIdentity, "/workspace/src/index.ts", "read")).toBe("deny");
    });
  });

  describe("memory access", () => {
    it("allows agent to read/write own memory", () => {
      const identity = agentIdentity("agent-a");
      const source = createSource("agent-a");
      expect(pm.check(identity, "/memory/agent-a/notes.md", "read", source)).toBe("allow");
      expect(pm.check(identity, "/memory/agent-a/notes.md", "write", source)).toBe("allow");
    });

    it("allows any agent to read other's memory", () => {
      const identity = agentIdentity("agent-b");
      expect(pm.check(identity, "/memory/agent-a/notes.md", "read")).toBe("allow");
    });

    it("denies anonymous access to /memory", () => {
      expect(pm.check(anonymousIdentity, "/memory/agent-a/notes.md", "read")).toBe("deny");
    });
  });

  describe("config access", () => {
    it("allows service-level agents to write config", () => {
      const identity = agentIdentity("svc", "service");
      expect(pm.check(identity, "/config/template.json", "write")).toBe("allow");
    });

    it("allows any agent to read config", () => {
      const identity = agentIdentity("agent-a", "repo");
      expect(pm.check(identity, "/config/template.json", "read")).toBe("allow");
    });
  });

  describe("vcs access", () => {
    it("allows any agent read-only access to /vcs", () => {
      const identity = agentIdentity("agent-a");
      expect(pm.check(identity, "/vcs/status", "read")).toBe("allow");
      expect(pm.check(identity, "/vcs/status", "git_status")).toBe("allow");
    });

    it("denies write to /vcs", () => {
      const identity = agentIdentity("agent-a");
      expect(pm.check(identity, "/vcs/status", "write")).toBe("deny");
    });
  });

  describe("root listing", () => {
    it("allows public to list root", () => {
      expect(pm.check(anonymousIdentity, "/", "list")).toBe("allow");
    });
  });

  describe("resolveIdentity", () => {
    it("returns anonymous for no token", () => {
      const identity = pm.resolveIdentity(undefined);
      expect(identity.type).toBe("anonymous");
    });

    it("returns anonymous for invalid token without store", () => {
      const identity = pm.resolveIdentity("some-token");
      expect(identity.type).toBe("anonymous");
    });
  });
});
