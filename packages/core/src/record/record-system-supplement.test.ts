/**
 * Supplementary unit tests for RecordSystem — covering gaps identified in QA review:
 *
 * 1. SessionRegistry.rebuildFromRecordSystem() correctness
 * 2. RecordSystem backward-compat: getSessionsLegacy shape validation
 * 3. RecordSystem backward-compat: replayAsJournal
 * 4. Blob storage round-trip with RecordSystem
 * 5. HookEventBus → RecordSystem bridge
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RecordSystem } from "./record-system";
import { SessionRegistry } from "../session/session-registry";
import { HookEventBus } from "../hooks/hook-event-bus";

describe("RecordSystem — Supplementary Gap Coverage", () => {
  let globalDir: string;
  let instancesDir: string;
  let rs: RecordSystem;
  let base: string;

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), "rs-supp-"));
    globalDir = join(base, "global");
    instancesDir = join(base, "instances");
    rs = new RecordSystem({ globalDir, instancesDir });
  });

  afterEach(async () => {
    rs.dispose();
    await rm(base, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════
  //  Gap 1: SessionRegistry.rebuildFromRecordSystem()
  // ═══════════════════════════════════════════

  describe("SessionRegistry.rebuildFromRecordSystem()", () => {
    it("rebuilds session state from RecordSystem session events", async () => {
      await rs.record({
        category: "session",
        type: "session:created",
        agentName: "agent-a",
        sessionId: "conv-1",
        data: {
          action: "created",
          sessionId: "lease-1",
          conversationId: "conv-1",
          agentName: "agent-a",
        },
      });
      await rs.record({
        category: "session",
        type: "session:released",
        agentName: "agent-a",
        sessionId: "conv-1",
        data: {
          action: "released",
          sessionId: "lease-1",
          conversationId: "conv-1",
          agentName: "agent-a",
        },
      });

      const registry = new SessionRegistry();
      await registry.rebuildFromRecordSystem(rs);

      const sessions = registry.list("agent-a");
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      const s = sessions.find((s) => s.conversationId === "conv-1");
      expect(s).toBeDefined();
      expect(s?.state).toBe("idle");
    });

    it("handles HookEventBus payload wrapping in session events", async () => {
      await rs.record({
        category: "session",
        type: "session:created",
        agentName: "agent-b",
        sessionId: "conv-2",
        data: {
          event: "session:created",
          agentName: "agent-b",
          data: {
            action: "created",
            sessionId: "lease-2",
            conversationId: "conv-2",
            agentName: "agent-b",
          },
          timestamp: new Date().toISOString(),
          callerType: "system",
          callerId: "SessionRegistry",
        },
      });

      const registry = new SessionRegistry();
      await registry.rebuildFromRecordSystem(rs);

      const sessions = registry.list("agent-b");
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  //  Gap 2: getSessionsLegacy shape validation
  // ═══════════════════════════════════════════

  describe("getSessionsLegacy() backward compatibility", () => {
    it("returns objects WITHOUT platformEventCount", async () => {
      await rs.record({
        category: "communication",
        type: "session_update",
        agentName: "a",
        sessionId: "s1",
        data: { sessionUpdate: "agent_message_chunk" },
      });
      await rs.record({
        category: "lifecycle",
        type: "agent:created",
        agentName: "a",
        sessionId: "s1",
        data: {},
      });

      const legacy = rs.getSessionsLegacy("a");
      expect(legacy).toHaveLength(1);
      const firstSession = legacy[0];
      expect(firstSession).toBeDefined();
      expect(firstSession).not.toHaveProperty("platformEventCount");
      expect(firstSession).toHaveProperty("messageCount", 1);
      expect(firstSession).toHaveProperty("recordCount", 2);
      expect(firstSession).toHaveProperty("sessionId", "s1");
      expect(firstSession).toHaveProperty("agentName", "a");
      expect(firstSession).toHaveProperty("startTs");
    });
  });

  // ═══════════════════════════════════════════
  //  Gap 3: replayAsJournal backward compat
  // ═══════════════════════════════════════════

  describe("replayAsJournal()", () => {
    it("replays session events as JournalEntry format", async () => {
      await rs.record({
        category: "session",
        type: "session:created",
        agentName: "x",
        data: { action: "created" },
      });
      await rs.record({
        category: "lifecycle",
        type: "agent:created",
        agentName: "x",
        data: {},
      });

      const entries: unknown[] = [];
      const count = await rs.replayAsJournal("session", (entry) => {
        entries.push(entry);
      });

      expect(count).toBe(1);
      const e = entries[0] as Record<string, unknown> | undefined;
      expect(e).toBeDefined();
      expect(e).toHaveProperty("seq");
      expect(e).toHaveProperty("ts");
      expect(e).toHaveProperty("category", "session");
      expect(e).toHaveProperty("event", "session:created");
      expect(e).toHaveProperty("data");
    });

    it("replays hook events as JournalEntry format", async () => {
      await rs.record({ category: "lifecycle", type: "agent:created", agentName: "x", data: {} });
      await rs.record({ category: "process", type: "process:start", agentName: "x", data: {} });
      await rs.record({ category: "session", type: "session:start", agentName: "x", data: {} });
      await rs.record({ category: "system", type: "actant:start", data: {} });

      const entries: unknown[] = [];
      const count = await rs.replayAsJournal("hook", (entry) => {
        entries.push(entry);
      });

      expect(count).toBe(3);
      for (const e of entries as Record<string, unknown>[]) {
        expect(e).toHaveProperty("category", "hook");
      }
    });
  });

  // ═══════════════════════════════════════════
  //  Gap 4: Blob storage round-trip
  // ═══════════════════════════════════════════

  describe("blob storage round-trip", () => {
    it("stores and retrieves content above INLINE_THRESHOLD", async () => {
      const largeContent = "A".repeat(5000);
      const result = await rs.packContent("blob-agent", largeContent);
      expect("contentRef" in result).toBe(true);
      const ref = (result as { contentRef: { hash: string; size: number; preview: string; truncated: boolean } }).contentRef;
      expect(ref.hash).toMatch(/^sha256:/);
      expect(ref.size).toBe(Buffer.byteLength(largeContent, "utf-8"));
      expect(ref.truncated).toBe(true);

      const retrieved = await rs.readBlob("blob-agent", ref.hash);
      expect(retrieved).toBe(largeContent);
    });

    it("deduplicates identical blobs", async () => {
      const content = "B".repeat(6000);
      const r1 = await rs.packContent("blob-agent", content);
      const r2 = await rs.packContent("blob-agent", content);
      expect("contentRef" in r1 && "contentRef" in r2).toBe(true);
      const h1 = (r1 as { contentRef: { hash: string } }).contentRef.hash;
      const h2 = (r2 as { contentRef: { hash: string } }).contentRef.hash;
      expect(h1).toBe(h2);
    });
  });

  // ═══════════════════════════════════════════
  //  Gap 5: HookEventBus → RecordSystem bridge
  // ═══════════════════════════════════════════

  describe("HookEventBus → RecordSystem bridge", () => {
    it("records hook events to RecordSystem when bridge is active", async () => {
      const bus = new HookEventBus();
      bus.setRecordSystem(rs);

      bus.emit("agent:created", { callerType: "system", callerId: "test" }, "test-agent", {
        "agent.name": "test-agent",
      });

      await new Promise((r) => setTimeout(r, 100));

      const entries = await rs.queryGlobal({ category: "lifecycle" });
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const agentCreated = entries.find((e) => e.type === "agent:created");
      expect(agentCreated).toBeDefined();
      expect(agentCreated?.agentName).toBe("test-agent");

      bus.dispose();
    });

    it("routes events to per-agent _lifecycle file when no session resolver", async () => {
      const bus = new HookEventBus();
      bus.setRecordSystem(rs);

      bus.emit("process:start", { callerType: "system", callerId: "test" }, "my-agent", {
        pid: 12345,
      });

      await new Promise((r) => setTimeout(r, 100));

      const { records } = await rs.queryAgent("my-agent", "_lifecycle");
      expect(records.length).toBeGreaterThanOrEqual(1);
      const firstRecord = records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord?.type).toBe("process:start");

      bus.dispose();
    });

    it("routes events to session file when session resolver is set", async () => {
      const bus = new HookEventBus();
      bus.setRecordSystem(rs);
      bus.setSessionResolver((_agentName: string) => "active-session-123");

      bus.emit("prompt:before", { callerType: "system", callerId: "test" }, "routed-agent", {
        prompt: "hello",
      });

      await new Promise((r) => setTimeout(r, 100));

      const { records } = await rs.queryAgent("routed-agent", "active-session-123");
      expect(records.length).toBeGreaterThanOrEqual(1);
      const firstRecord = records[0];
      expect(firstRecord).toBeDefined();
      expect(firstRecord?.type).toBe("prompt:before");

      bus.dispose();
    });
  });

  // ═══════════════════════════════════════════
  //  Gap 6: queryAsJournal backward compat
  // ═══════════════════════════════════════════

  describe("queryAsJournal()", () => {
    it("returns JournalEntry-shaped results", async () => {
      await rs.record({ category: "session", type: "session:created", agentName: "x", data: { action: "created" } });
      await rs.record({ category: "system", type: "actant:start", data: {} });

      const results = await rs.queryAsJournal({});
      expect(results.length).toBe(2);
      for (const e of results) {
        expect(e).toHaveProperty("seq");
        expect(e).toHaveProperty("ts");
        expect(e).toHaveProperty("category");
        expect(e).toHaveProperty("event");
        expect(e).toHaveProperty("data");
        expect(["session", "system", "hook"]).toContain(e.category);
      }
    });
  });
});
