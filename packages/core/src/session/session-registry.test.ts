import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionRegistry } from "./session-registry";

describe("SessionRegistry – conversationId", () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry({ ttlCheckIntervalMs: 60_000 });
  });

  afterEach(() => {
    registry.dispose();
  });

  it("auto-generates a conversationId when none is provided", () => {
    const lease = registry.create({ agentName: "svc-a1", clientId: "client-1" });
    expect(lease.conversationId).toBeTruthy();
    expect(typeof lease.conversationId).toBe("string");
    // conversationId is a UUID — different from sessionId (lease ID)
    expect(lease.conversationId).not.toBe(lease.sessionId);
  });

  it("uses the provided conversationId to continue an existing conversation", () => {
    const existingConvId = "00000000-1111-2222-3333-444444444444";
    const lease = registry.create({
      agentName: "svc-a1",
      clientId: "client-1",
      conversationId: existingConvId,
    });
    expect(lease.conversationId).toBe(existingConvId);
    // sessionId (lease ID) is still a fresh UUID
    expect(lease.sessionId).not.toBe(existingConvId);
  });

  it("two separate leases can share the same conversationId (reconnect scenario)", () => {
    const first = registry.create({ agentName: "svc-a1", clientId: "client-1" });
    const convId = first.conversationId;

    // Simulate disconnect: close the first lease
    registry.close(first.sessionId);

    // Reconnect with the same conversationId
    const second = registry.create({
      agentName: "svc-a1",
      clientId: "client-2",
      conversationId: convId,
    });

    expect(second.conversationId).toBe(convId);
    // But each connection has a unique lease ID
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it("different agents independently generate different conversationIds", () => {
    const a = registry.create({ agentName: "agent-a", clientId: "c1" });
    const b = registry.create({ agentName: "agent-b", clientId: "c1" });
    expect(a.conversationId).not.toBe(b.conversationId);
  });

  it("conversationId is preserved through list()", () => {
    const convId = "aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb";
    const created = registry.create({ agentName: "svc-a1", clientId: "c1", conversationId: convId });

    const leases = registry.list("svc-a1");
    expect(leases).toHaveLength(1);
    expect(leases[0]!.conversationId).toBe(convId);
    expect(leases[0]!.sessionId).toBe(created.sessionId);
  });

  it("conversationId is preserved through get()", () => {
    const convId = "11112222-3333-4444-5555-666677778888";
    const created = registry.create({ agentName: "svc-a1", clientId: "c1", conversationId: convId });

    const fetched = registry.get(created.sessionId);
    expect(fetched?.conversationId).toBe(convId);
  });

  it("rebuildFromJournal restores conversationId from journal entries", async () => {
    const mockJournal = {
      replay: vi.fn(async (_cat: string, fn: (entry: { ts: number; data: unknown }) => void) => {
        fn({
          ts: Date.now(),
          data: {
            action: "created",
            sessionId: "lease-001",
            agentName: "svc-a1",
            clientId: "c1",
            idleTtlMs: 30_000,
            conversationId: "conv-stable-001",
          },
        });
        return 1;
      }),
    } as never;

    await registry.rebuildFromJournal(mockJournal);
    const restored = registry.get("lease-001");
    expect(restored).toBeDefined();
    expect(restored!.conversationId).toBe("conv-stable-001");
    expect(restored!.sessionId).toBe("lease-001");
  });

  it("falls back to sessionId when journal entry lacks conversationId (backward compat)", async () => {
    const mockJournal = {
      replay: vi.fn(async (_cat: string, fn: (entry: { ts: number; data: unknown }) => void) => {
        fn({
          ts: Date.now(),
          data: {
            action: "created",
            sessionId: "legacy-lease",
            agentName: "svc-old",
            clientId: "c1",
            // no conversationId — old journal entry
          },
        });
        return 1;
      }),
    } as never;

    await registry.rebuildFromJournal(mockJournal);
    const restored = registry.get("legacy-lease");
    expect(restored).toBeDefined();
    // Falls back to sessionId for backward compatibility
    expect(restored!.conversationId).toBe("legacy-lease");
  });
});
