import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RecordSystem } from "./record-system";

describe("RecordSystem", () => {
  let globalDir: string;
  let instancesDir: string;
  let rs: RecordSystem;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), "rs-test-"));
    globalDir = join(base, "global");
    instancesDir = join(base, "instances");
    rs = new RecordSystem({ globalDir, instancesDir });
  });

  afterEach(async () => {
    rs.dispose();
    const base = join(globalDir, "..");
    await rm(base, { recursive: true, force: true });
  });

  // ── Core dual-write ──

  it("writes to global timeline for unscoped records", async () => {
    await rs.record({ category: "system", type: "actant:start", data: { pid: 1234 } });

    const entries = await rs.queryGlobal();
    expect(entries).toHaveLength(1);
    const firstEntry = entries[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry?.category).toBe("system");
    expect(firstEntry?.type).toBe("actant:start");
    expect(firstEntry?.agentName).toBeUndefined();
  });

  it("dual-writes global + agent for agent-scoped records", async () => {
    await rs.record({
      category: "lifecycle",
      type: "agent:created",
      agentName: "alice",
      data: { "agent.name": "alice" },
    });

    const global = await rs.queryGlobal();
    expect(global).toHaveLength(1);

    const { records } = await rs.queryAgent("alice", "_lifecycle");
    expect(records).toHaveLength(1);
    const firstRecord = records[0];
    expect(firstRecord).toBeDefined();
    expect(firstRecord?.type).toBe("agent:created");
  });

  it("dual-writes global + agent session for session-scoped records", async () => {
    await rs.record({
      category: "communication",
      type: "session_update",
      agentName: "bob",
      sessionId: "conv-1",
      data: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } },
    });

    const global = await rs.queryGlobal();
    expect(global).toHaveLength(1);

    const { records } = await rs.queryAgent("bob", "conv-1");
    expect(records).toHaveLength(1);
    const firstRecord = records[0];
    expect(firstRecord).toBeDefined();
    expect(firstRecord?.category).toBe("communication");
  });

  // ── Querying ──

  it("queryGlobal filters by category", async () => {
    await rs.record({ category: "system", type: "actant:start", data: {} });
    await rs.record({ category: "lifecycle", type: "agent:created", agentName: "x", data: {} });
    await rs.record({ category: "error", type: "error", agentName: "x", data: {} });

    const systemOnly = await rs.queryGlobal({ category: "system" });
    expect(systemOnly).toHaveLength(1);
    const firstEntry = systemOnly[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry?.type).toBe("actant:start");
  });

  it("queryAgent filters by type", async () => {
    await rs.record({ category: "communication", type: "session_update", agentName: "a", sessionId: "s1", data: { sessionUpdate: "agent_message_chunk" } });
    await rs.record({ category: "prompt", type: "prompt_sent", agentName: "a", sessionId: "s1", data: { content: "hi" } });

    const { records } = await rs.queryAgent("a", "s1", { types: ["prompt_sent"] });
    expect(records).toHaveLength(1);
    const firstRecord = records[0];
    expect(firstRecord).toBeDefined();
    expect(firstRecord?.type).toBe("prompt_sent");
  });

  it("queryAgent filters by category", async () => {
    await rs.record({ category: "communication", type: "session_update", agentName: "a", sessionId: "s1", data: {} });
    await rs.record({ category: "lifecycle", type: "agent:created", agentName: "a", sessionId: "s1", data: {} });

    const { records } = await rs.queryAgent("a", "s1", { categories: ["communication"] });
    expect(records).toHaveLength(1);
    const firstRecord = records[0];
    expect(firstRecord).toBeDefined();
    expect(firstRecord?.category).toBe("communication");
  });

  // ── Session summaries ──

  it("getSessions tracks counts correctly", async () => {
    await rs.record({ category: "communication", type: "session_update", agentName: "agent1", sessionId: "s1", data: { sessionUpdate: "agent_message_chunk" } });
    await rs.record({ category: "communication", type: "session_update", agentName: "agent1", sessionId: "s1", data: { sessionUpdate: "tool_call" } });
    await rs.record({ category: "file", type: "file_write", agentName: "agent1", sessionId: "s1", data: { path: "/foo" } });
    await rs.record({ category: "lifecycle", type: "agent:created", agentName: "agent1", sessionId: "s1", data: {} });

    const sessions = rs.getSessions("agent1");
    expect(sessions).toHaveLength(1);
    const firstSession = sessions[0];
    expect(firstSession).toBeDefined();
    expect(firstSession?.messageCount).toBe(1);
    expect(firstSession?.toolCallCount).toBe(1);
    expect(firstSession?.fileWriteCount).toBe(1);
    expect(firstSession?.platformEventCount).toBe(1);
    expect(firstSession?.recordCount).toBe(4);
  });

  it("getSessions excludes _lifecycle pseudo-session", async () => {
    await rs.record({ category: "lifecycle", type: "agent:created", agentName: "agent2", data: {} });

    const sessions = rs.getSessions("agent2");
    expect(sessions).toHaveLength(0);
  });

  // ── Replay ──

  it("replay iterates entries of a given category", async () => {
    await rs.record({ category: "session", type: "session:created", agentName: "x", data: { action: "created" } });
    await rs.record({ category: "system", type: "actant:start", data: {} });
    await rs.record({ category: "session", type: "session:closed", agentName: "x", data: { action: "closed" } });

    const visited: string[] = [];
    const count = await rs.replay("session", (entry) => {
      visited.push(entry.type);
    });

    expect(count).toBe(2);
    expect(visited).toEqual(["session:created", "session:closed"]);
  });

  // ── Blob storage ──

  it("packContent inlines small content", async () => {
    const result = await rs.packContent("agent1", "small text");
    expect("content" in result).toBe(true);
    expect((result as { content: string }).content).toBe("small text");
  });

  it("packContent stores large content as blob", async () => {
    const large = "x".repeat(5000);
    const result = await rs.packContent("agent1", large);
    expect("contentRef" in result).toBe(true);
    const ref = (result as { contentRef: { hash: string } }).contentRef;
    expect(ref.hash).toMatch(/^sha256:/);

    const content = await rs.readBlob("agent1", ref.hash);
    expect(content).toBe(large);
  });

  // ── Index rebuild ──

  it("rebuildIndex reconstructs session summaries from disk", async () => {
    await rs.record({ category: "communication", type: "session_update", agentName: "a", sessionId: "s1", data: { sessionUpdate: "agent_message_chunk" } });
    await rs.record({ category: "file", type: "file_write", agentName: "a", sessionId: "s1", data: { path: "/x" } });

    const rs2 = new RecordSystem({ globalDir, instancesDir });
    expect(rs2.getSessions("a")).toHaveLength(0);

    await rs2.rebuildIndex();
    const sessions = rs2.getSessions("a");
    expect(sessions).toHaveLength(1);
    const firstSession = sessions[0];
    expect(firstSession).toBeDefined();
    expect(firstSession?.messageCount).toBe(1);
    expect(firstSession?.fileWriteCount).toBe(1);
    rs2.dispose();
  });

  // ── Backward-compat: readStream returns legacy format ──

  it("readStream returns ActivityRecord-shaped objects", async () => {
    await rs.record({ category: "prompt", type: "prompt_sent", agentName: "a", sessionId: "s1", data: { content: "hi" } });

    const { records, total } = await rs.readStream("a", "s1");
    expect(total).toBe(1);
    const firstRecord = records[0];
    expect(firstRecord).toBeDefined();
    expect(firstRecord?.type).toBe("prompt_sent");
    expect(firstRecord?.sessionId).toBe("s1");
    expect(typeof firstRecord?.ts).toBe("number");
  });

  // ── Backward-compat: getSessionsLegacy ──

  it("getSessionsLegacy returns ActivitySessionSummary shape", async () => {
    await rs.record({ category: "communication", type: "session_update", agentName: "a", sessionId: "s1", data: { sessionUpdate: "agent_message_chunk" } });

    const sessions = rs.getSessionsLegacy("a");
    expect(sessions).toHaveLength(1);
    const firstSession = sessions[0];
    expect(firstSession).toBeDefined();
    expect(firstSession).not.toHaveProperty("platformEventCount");
    expect(firstSession).toHaveProperty("messageCount", 1);
  });

  // ── Monotonic seq ──

  it("assigns monotonically increasing seq numbers", async () => {
    await rs.record({ category: "system", type: "a", data: {} });
    await rs.record({ category: "system", type: "b", data: {} });
    await rs.record({ category: "system", type: "c", data: {} });

    const entries = await rs.queryGlobal();
    const firstEntry = entries[0];
    const secondEntry = entries[1];
    const thirdEntry = entries[2];
    expect(firstEntry?.seq).toBe(0);
    expect(secondEntry?.seq).toBe(1);
    expect(thirdEntry?.seq).toBe(2);
  });
});
