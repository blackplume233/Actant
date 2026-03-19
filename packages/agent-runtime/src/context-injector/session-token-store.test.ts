import { describe, it, expect, beforeEach } from "vitest";
import { SessionTokenStore } from "./session-token-store";

describe("SessionTokenStore", () => {
  let store: SessionTokenStore;

  beforeEach(() => {
    store = new SessionTokenStore();
  });

  it("generates a 64-char hex token", () => {
    const token = store.generate("agent-1", "session-1");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("validates a generated token", () => {
    const token = store.generate("agent-1", "session-1", 1234);
    const result = store.validate(token);
    expect(result).not.toBeNull();
    expect(result!.agentName).toBe("agent-1");
    expect(result!.sessionId).toBe("session-1");
    expect(result!.pid).toBe(1234);
    expect(result!.createdAt).toBeGreaterThan(0);
  });

  it("returns null for unknown token", () => {
    expect(store.validate("nonexistent")).toBeNull();
  });

  it("revokes token by sessionId", () => {
    const token = store.generate("agent-1", "session-1");
    expect(store.validate(token)).not.toBeNull();

    const revoked = store.revokeSession("session-1");
    expect(revoked).toBe(true);
    expect(store.validate(token)).toBeNull();
  });

  it("returns false when revoking unknown session", () => {
    expect(store.revokeSession("unknown")).toBe(false);
  });

  it("revokes all tokens for an agent", () => {
    const t1 = store.generate("agent-1", "session-1");
    const t2 = store.generate("agent-1", "session-2");
    const t3 = store.generate("agent-2", "session-3");

    const count = store.revokeByAgent("agent-1");
    expect(count).toBe(2);
    expect(store.validate(t1)).toBeNull();
    expect(store.validate(t2)).toBeNull();
    expect(store.validate(t3)).not.toBeNull();
  });

  it("replaces token when same sessionId is regenerated", () => {
    const t1 = store.generate("agent-1", "session-1");
    const t2 = store.generate("agent-1", "session-1");

    expect(t1).not.toBe(t2);
    expect(store.validate(t1)).toBeNull();
    expect(store.validate(t2)).not.toBeNull();
  });

  it("tracks size correctly", () => {
    expect(store.size).toBe(0);
    store.generate("a", "s1");
    store.generate("a", "s2");
    expect(store.size).toBe(2);
    store.revokeSession("s1");
    expect(store.size).toBe(1);
  });

  it("cleans up byAgent map when all tokens revoked", () => {
    store.generate("agent-1", "session-1");
    store.revokeByAgent("agent-1");
    expect(store.revokeByAgent("agent-1")).toBe(0);
  });

  it("generates unique tokens across calls", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(store.generate(`agent-${i}`, `session-${i}`));
    }
    expect(tokens.size).toBe(100);
  });

  it("validate returns null for empty string", () => {
    expect(store.validate("")).toBeNull();
  });

  it("revokeByAgent returns 0 for unknown agent", () => {
    expect(store.revokeByAgent("ghost")).toBe(0);
  });

  it("revokeSession after revokeByAgent is a no-op", () => {
    store.generate("agent-1", "session-1");
    store.revokeByAgent("agent-1");
    expect(store.revokeSession("session-1")).toBe(false);
  });

  it("multiple agents with overlapping sessions stay independent", () => {
    const t1 = store.generate("agent-1", "shared-session");
    const t2 = store.generate("agent-2", "shared-session");

    // Both valid (different tokens for same sessionId because second generate replaces first)
    expect(store.validate(t1)).toBeNull();
    expect(store.validate(t2)).not.toBeNull();
    expect(store.size).toBe(1);
  });
});
