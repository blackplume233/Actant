import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AppContext } from "../../services/app-context";
import { HandlerRegistry } from "../handler-registry";
import { registerEventHandlers } from "../event-handlers";

describe("event handlers", () => {
  let ctx: AppContext;
  let registry: HandlerRegistry;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ac-event-handler-test-"));
    ctx = new AppContext({ homeDir: tmpDir, launcherMode: "mock" });
    await ctx.init();
    registry = new HandlerRegistry();
    registerEventHandlers(registry);
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("registers events.recent and events.emit", () => {
    expect(registry.has("events.recent")).toBe(true);
    expect(registry.has("events.emit")).toBe(true);
  });

  it("events.emit injects an event into the event bus", async () => {
    const handler = registry.get("events.emit")!;
    const result = await handler({
      event: "custom:external-sync",
      agentName: "agent-a",
      payload: { source: "webhook" },
    }, ctx) as { ok: true };

    expect(result.ok).toBe(true);
    const recent = await registry.get("events.recent")!({ limit: 5 }, ctx) as { events: Array<{ event: string; agentName?: string; payload: Record<string, unknown> }> };
    expect(recent.events.some((e) => e.event === "custom:external-sync" && e.agentName === "agent-a")).toBe(true);
  });
});
